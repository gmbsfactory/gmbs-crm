-- CSV intervention import : match composite (agence, date, adresse) en
-- résolution applicative, en complément de `id_inter`.
--
-- Stratégie : la déduplication est arbitrée côté orchestrateur d'import (TS).
-- Pas de UNIQUE globale sur (agence, date, adresse) — l'UI continue à pouvoir
-- créer manuellement des interventions sans contrainte additionnelle.
--
-- Cette migration fournit uniquement :
--   1. Une normalisation d'adresse IMMUTABLE (indexable).
--   2. Un index d'expression composite pour rendre le match performant.
--   3. Un RPC de résolution lecture-seule qui retourne, par ligne CSV, la
--      liste des interventions matchées par clé composite.
--
-- L'INSERT/UPDATE en bulk avec advisory-lock par tenant sera fourni dans une
-- migration suivante (RPC d'apply).
--
-- Sécurité : security invoker → la RLS de `interventions` s'applique.

-- ─── 1. Wrapper IMMUTABLE pour unaccent ───────────────────────────────────────
-- `public.unaccent(text)` est STABLE (lookup du dictionnaire), inutilisable
-- dans une expression IMMUTABLE / un index. La signature à 2 arguments avec
-- dictionnaire littéral est IMMUTABLE.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = public, pg_temp
as $$
  select public.unaccent('public.unaccent', $1);
$$;

-- ─── 2. Normalisation d'adresse ───────────────────────────────────────────────
-- lower + unaccent + collapse de tout espace/ponctuation en espace simple.
-- Utilisée à la fois dans l'index d'expression et dans le RPC de résolution :
-- les deux DOIVENT passer par cette même fonction pour que l'index soit utilisé.
create or replace function public.normalize_address(p_adresse text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
  select nullif(
    trim(
      regexp_replace(
        lower(public.immutable_unaccent(coalesce(p_adresse, ''))),
        '[[:space:][:punct:]]+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

-- ─── 3. Index d'expression composite ──────────────────────────────────────────
-- Pas de table rewrite (contrairement à une colonne STORED). Pas de UNIQUE :
-- la dédup est arbitrée côté orchestrateur d'import.
--
-- Convention : `(date AT TIME ZONE 'UTC')::date` est IMMUTABLE car le fuseau
-- est un littéral. Tous les usages composite (index + RPC) DOIVENT utiliser
-- cette même expression pour que l'index soit utilisé.
--
-- Note : `CREATE INDEX` (sans CONCURRENTLY) prend un SHARE lock — il bloque
-- les writes mais pas les reads, le temps du build. Sur une table grosse,
-- préférer extraire ces deux CREATE INDEX dans un script manuel exécuté hors
-- transaction avec `CREATE INDEX CONCURRENTLY`.
create index if not exists idx_interventions_composite_match
  on public.interventions (
    agence_id,
    ((date at time zone 'UTC')::date),
    public.normalize_address(adresse)
  )
  where date is not null
    and adresse is not null;

-- Variante sans agence pour le fallback (CSV sans agence résolue).
create index if not exists idx_interventions_composite_match_no_agency
  on public.interventions (
    ((date at time zone 'UTC')::date),
    public.normalize_address(adresse)
  )
  where date is not null
    and adresse is not null;

-- ─── 4. RPC de résolution composite ───────────────────────────────────────────
-- Prend des tableaux parallèles indexés par numéro de ligne CSV. Pour chaque
-- ligne, retourne la liste des interventions existantes qui matchent — un
-- tableau permet à l'appelant (orchestrateur TS) de détecter l'ambiguïté
-- (>1 match → conflit signalé à l'utilisateur).
--
-- p_agence_ids[i] peut être NULL → fallback sur (date, adresse) sans
-- contrainte d'agence. p_dates[i] et p_addresses[i] doivent être non-NULL
-- (sinon ligne ignorée par le filtre `fingerprint is not null`).

create or replace function public.csv_intervention_import_resolve_by_composite(
  p_lines      int[],
  p_agence_ids uuid[],
  p_dates      date[],
  p_addresses  text[]
)
returns table (
  line      int,
  match_ids uuid[]
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with input as (
    select
      p_lines[i]      as line,
      p_agence_ids[i] as agence_id,
      p_dates[i]      as date,
      public.normalize_address(p_addresses[i]) as fingerprint
    from generate_subscripts(p_lines, 1) as g(i)
  ),
  matches as (
    select
      inp.line,
      i.id as match_id
    from input inp
    join public.interventions i
      on (i.date at time zone 'UTC')::date = inp.date
     and public.normalize_address(i.adresse) = inp.fingerprint
     and (
       (inp.agence_id is not null and i.agence_id = inp.agence_id)
       or (inp.agence_id is null)
     )
    where inp.fingerprint is not null
      and inp.date is not null
  )
  select
    line,
    array_agg(match_id) as match_ids
  from matches
  group by line;
$$;

grant execute on function public.csv_intervention_import_resolve_by_composite(
  int[], uuid[], date[], text[]
) to authenticated;

comment on function public.csv_intervention_import_resolve_by_composite(int[], uuid[], date[], text[]) is
  'Résolution composite (agence?, date::date UTC, adresse normalisée) pour CSV import. '
  'Retourne un tableau de matches par ligne pour permettre à l''orchestrateur '
  'de détecter l''ambiguïté (>1 match) et de la signaler à l''utilisateur. '
  'Lecture seule : l''INSERT/UPDATE est arbitré par un RPC d''apply séparé.';
