# Spec: Recherche hybride avec fallback de fraicheur

> **Statut** : Draft
> **Date** : 2026-04-10
> **Branche** : `fix/delivery_fixes`

---

## 1. Probleme

Quand un gestionnaire cree une intervention (ex: `INT-00123`) et la recherche immediatement dans la barre de recherche universelle, **elle n'apparait pas** dans les resultats.

### Cause racine

La recherche repose sur des **materialized views** (`global_search_mv`, `interventions_search_mv`, `artisans_search_mv`) rafraichies par un **cron pg_cron toutes les minutes** (`migration 00035`).

```
INSERT intervention → trigger flag_interventions_search_refresh()
                    → SET needs_refresh = true dans search_views_refresh_flags
                    → pg_cron (toutes les 1 min) → REFRESH MATERIALIZED VIEW CONCURRENTLY
                    → donnee disponible dans la recherche (delai: 0 a 60s)
```

L'utilisateur qui cherche dans les 0-60s apres creation ne trouve pas sa donnee.

---

## 2. Solution : pattern "Near-Real-Time Search"

Inspire du pattern Elasticsearch (segments + translog), la recherche combine :

1. **Materialized View** (bulk, rapide) — contient l'index pre-calcule
2. **Buffer live** (frais, borne) — scan direct des tables pour les lignes modifiees depuis le dernier refresh
3. **Deduplication** — si un ID existe dans les deux sources, le resultat live gagne

```
┌─────────────────────────────────────────────────────────┐
│                    search_global()                       │
│                                                         │
│  ┌──────────────┐   UNION ALL   ┌───────────────────┐  │
│  │ global_search │              │  recent_writes     │  │
│  │ _mv (bulk)   │              │  buffer (live)     │  │
│  │              │              │                     │  │
│  │ Toutes les   │              │ interventions WHERE │  │
│  │ donnees du   │              │ updated_at >        │  │
│  │ dernier      │              │ last_refresh_at     │  │
│  │ refresh      │              │                     │  │
│  └──────────────┘              └───────────────────────┘  │
│                                                         │
│  → DISTINCT ON (entity_type, entity_id)                 │
│  → live gagne en cas de doublon                         │
│  → ORDER BY rank DESC LIMIT p_limit                     │
└─────────────────────────────────────────────────────────┘
```

### Pourquoi c'est scalable

| Volume | Comportement |
|--------|-------------|
| Faible (actuel) | Le buffer recent contient peu de lignes, scan quasi instantane |
| Moyen | La MV fait le gros du travail, buffer borne a quelques min de donnees |
| Gros | Le cron peut etre espace, le buffer reste petit car borne temporellement |

Le cout du scan "recent" est toujours faible car borne par `updated_at > last_refresh_at` (quelques minutes de donnees max).

---

## 3. Changements requis

### 3.1 SQL — Nouvelle fonction `search_global` (migration)

**Fichier** : `supabase/migrations/XXXXX_hybrid_search_global.sql`

#### 3.1.1 Ajouter des index tsvector sur les tables de base

Les tables `interventions` et `artisans` n'ont **aucun index GIN tsvector** actuellement. Le buffer live a besoin de ces index pour performer.

```sql
-- Index trigram existants (gin_trgm_ops) sur interventions: contexte, ville
-- NOUVEAUX: index tsvector pour full-text search sur tables de base

-- PREREQUIS: wrapper IMMUTABLE autour de unaccent() (STABLE par defaut)
-- Necessaire car GENERATED ALWAYS AS exige des expressions IMMUTABLE.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $func$
  SELECT unaccent('unaccent', $1)
$func$;

-- Interventions: colonne generee + index GIN
ALTER TABLE public.interventions
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    -- POIDS A: Identifiants critiques
    setweight(to_tsvector('french', f_unaccent(coalesce(id_inter, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(reference_agence, ''))), 'A') ||
    -- POIDS B: Informations principales
    setweight(to_tsvector('french', f_unaccent(coalesce(contexte_intervention, ''))), 'B') ||
    -- POIDS C: Informations secondaires
    setweight(to_tsvector('french', f_unaccent(coalesce(consigne_intervention, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(commentaire_agent, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(adresse, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ville, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(code_postal, ''))), 'C') ||
    -- POIDS D: Details et metadonnees
    setweight(to_tsvector('french', f_unaccent(coalesce(consigne_second_artisan, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(key_code, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(floor, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(apartment_number, ''))), 'D')
  ) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_search_vector_live
  ON public.interventions USING gin(search_vector);

-- Index sur updated_at pour le buffer temporel
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_interventions_updated_at
  ON public.interventions(updated_at DESC) WHERE is_active = true;

-- Artisans: colonne generee + index GIN
ALTER TABLE public.artisans
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    -- POIDS A: Identifiants critiques
    setweight(to_tsvector('french', f_unaccent(coalesce(numero_associe, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(siret, ''))), 'A') ||
    -- POIDS B: Informations principales
    setweight(to_tsvector('french', f_unaccent(
      coalesce(prenom, '') || ' ' || coalesce(nom, '')
    )), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(plain_nom, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(raison_sociale, ''))), 'B') ||
    -- POIDS C: Informations secondaires
    setweight(to_tsvector('french', f_unaccent(coalesce(email, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(telephone, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(telephone2, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ville_intervention, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ville_siege_social, ''))), 'C') ||
    -- POIDS D: Details et metadonnees
    setweight(to_tsvector('french', f_unaccent(coalesce(adresse_siege_social, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(adresse_intervention, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(statut_juridique, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(suivi_relances_docs, ''))), 'D')
  ) STORED;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artisans_search_vector_live
  ON public.artisans USING gin(search_vector);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artisans_updated_at
  ON public.artisans(updated_at DESC) WHERE is_active = true;
```

> **Note** : La colonne generee `search_vector` est moins riche que celle de la MV (pas de joins sur agence, tenant, artisan lie, commentaires). C'est voulu : le buffer live couvre les **champs principaux** pour la fraicheur. La MV enrichie prend le relais au prochain refresh.

#### 3.1.2 Reecrire `search_global()` avec buffer hybride

```sql
CREATE OR REPLACE FUNCTION search_global(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0,
  p_entity_type text DEFAULT NULL
)
RETURNS TABLE (
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  rank real
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tsquery tsquery;
  v_tsquery_prefix tsquery;
  v_last_refresh timestamptz;
  v_normalized text;
BEGIN
  -- 1. Normaliser la requete
  v_normalized := unaccent(trim(p_query));

  -- 2. Construire les tsqueries (full + prefix)
  BEGIN
    v_tsquery := websearch_to_tsquery('french', v_normalized);
    v_tsquery_prefix := to_tsquery('french',
      array_to_string(
        array(SELECT unnest(string_to_array(v_normalized, ' ')) || ':*'),
        ' & '
      )
    );
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := plainto_tsquery('french', v_normalized);
    v_tsquery_prefix := v_tsquery;
  END;

  -- 3. Recuperer le timestamp du dernier refresh
  SELECT last_refresh INTO v_last_refresh
  FROM public.search_views_refresh_flags
  WHERE id = 'global_search_mv'
  LIMIT 1;

  -- Fallback: si jamais refreshe, traiter toutes les donnees comme "recentes"
  IF v_last_refresh IS NULL THEN
    v_last_refresh := '1970-01-01'::timestamptz;
  END IF;

  -- 4. Requete hybride: MV + buffer live, dedupliques
  RETURN QUERY
  WITH
  -- A) Resultats de la MV (bulk, pre-calcule)
  mv_results AS (
    SELECT
      gsv.entity_type,
      gsv.entity_id,
      gsv.metadata,
      GREATEST(
        ts_rank(gsv.search_vector, v_tsquery),
        ts_rank(gsv.search_vector, v_tsquery_prefix) * 0.9
      ) AS rank,
      1 AS source_priority  -- MV = priorite basse (ecrasee par live)
    FROM global_search_mv gsv
    WHERE gsv.search_vector @@ v_tsquery
       OR gsv.search_vector @@ v_tsquery_prefix
    ORDER BY rank DESC
    LIMIT p_limit * 3  -- sur-fetcher pour laisser de la place au merge
  ),

  -- B) Buffer live: interventions modifiees depuis le dernier refresh
  --    Inclut fallback ILIKE pour les recherches partielles (ex: "123" pour INT-00123)
  recent_interventions AS (
    SELECT
      'intervention'::text AS entity_type,
      i.id AS entity_id,
      jsonb_build_object(
        'id_inter', i.id_inter,
        'contexte', left(i.contexte_intervention, 120),
        'adresse', i.adresse,
        'ville', i.ville,
        'date', to_char(i.date, 'DD/MM/YYYY')
      ) AS metadata,
      CASE
        WHEN i.search_vector @@ v_tsquery OR i.search_vector @@ v_tsquery_prefix
        THEN GREATEST(
          ts_rank(i.search_vector, v_tsquery),
          ts_rank(i.search_vector, v_tsquery_prefix) * 0.9
        )
        ELSE 0.3  -- Score fixe pour les matchs ILIKE (plus bas que full-text)
      END AS rank,
      0 AS source_priority  -- Live = priorite haute
    FROM public.interventions i
    WHERE i.is_active = true
      AND i.updated_at > v_last_refresh
      AND (
        i.search_vector @@ v_tsquery
        OR i.search_vector @@ v_tsquery_prefix
        OR i.id_inter ILIKE '%' || v_normalized || '%'
      )
  ),

  -- C) Buffer live: artisans modifies depuis le dernier refresh
  --    Inclut fallback ILIKE pour recherches partielles (numero, nom)
  recent_artisans AS (
    SELECT
      'artisan'::text AS entity_type,
      a.id AS entity_id,
      jsonb_build_object(
        'numero_associe', a.numero_associe,
        'plain_nom', a.plain_nom,
        'raison_sociale', a.raison_sociale,
        'email', a.email,
        'telephone', a.telephone,
        'ville', a.ville_intervention
      ) AS metadata,
      CASE
        WHEN a.search_vector @@ v_tsquery OR a.search_vector @@ v_tsquery_prefix
        THEN GREATEST(
          ts_rank(a.search_vector, v_tsquery),
          ts_rank(a.search_vector, v_tsquery_prefix) * 0.9
        )
        ELSE 0.3
      END AS rank,
      0 AS source_priority
    FROM public.artisans a
    WHERE a.is_active = true
      AND a.updated_at > v_last_refresh
      AND (
        a.search_vector @@ v_tsquery
        OR a.search_vector @@ v_tsquery_prefix
        OR a.numero_associe ILIKE '%' || v_normalized || '%'
        OR a.plain_nom ILIKE '%' || v_normalized || '%'
      )
  ),

  -- D) Union + deduplication (live gagne)
  all_results AS (
    SELECT * FROM mv_results
    WHERE (p_entity_type IS NULL OR mv_results.entity_type = p_entity_type)
    UNION ALL
    SELECT * FROM recent_interventions
    WHERE (p_entity_type IS NULL OR p_entity_type = 'intervention')
    UNION ALL
    SELECT * FROM recent_artisans
    WHERE (p_entity_type IS NULL OR p_entity_type = 'artisan')
  ),

  deduplicated AS (
    SELECT DISTINCT ON (entity_type, entity_id)
      entity_type,
      entity_id,
      metadata,
      rank
    FROM all_results
    ORDER BY entity_type, entity_id, source_priority ASC  -- 0 (live) avant 1 (MV)
  )

  SELECT
    d.entity_type,
    d.entity_id,
    d.metadata,
    d.rank
  FROM deduplicated d
  ORDER BY d.rank DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
```

#### 3.1.3 Securite des parametres utilisateur

`v_normalized` est interpole dans les clauses `ILIKE '%' || v_normalized || '%'`. Ceci est **safe** car en PL/pgSQL les variables sont toujours traitees comme des parametres lies (pas de concatenation SQL brute). Aucun risque d'injection SQL.

### 3.2 Frontend — Aucun changement requis

Le contrat de `search_global` RPC ne change pas :
- Memes parametres : `p_query, p_limit, p_offset, p_entity_type`
- Meme format de retour : `entity_type, entity_id, metadata, rank`
- Le fallback existant dans `search.ts` (ligne 928) reste en place pour les erreurs RPC

Le frontend n'a **aucune modification** a faire. La fraicheur est geree cote SQL.

### 3.3 Infrastructure existante preservee

| Element | Action |
|---------|--------|
| `search_views_refresh_flags` | **Conserve** — utilise pour lire `last_refresh` |
| `pg_cron` (refresh toutes les 1 min) | **Conserve** — continue de rafraichir les MV |
| Triggers `flag_*_search_refresh()` | **Conserve** — continuent de flagger les MV |
| `global_search_mv` | **Conserve** — sert de source bulk |
| `interventions_search_mv` / `artisans_search_mv` | **Conserve** — alimentent `global_search_mv` |
| Fallback JS `searchArtisans()`/`searchInterventions()` | **Conserve** — fallback si RPC echoue |

---

## 4. Metadata du buffer live vs MV

Le buffer live retourne un `metadata` JSONB **simplifie** (pas de joins couteux) :

| Champ metadata | MV (complet) | Buffer live |
|----------------|-------------|-------------|
| id_inter | Oui | Oui |
| contexte | Oui | Oui (tronque 120 chars) |
| adresse, ville | Oui | Oui |
| agence | Oui | Non |
| artisan | Oui | Non |
| statut, statut_color | Oui | Non |
| date | Oui | Oui |
| assigned_user | Oui | Non |

**Impact** : Le frontend re-fetche les donnees completes par ID de toute facon (`fetchInterventionsByIds`, `fetchArtisansByIds` dans `search.ts` lignes 960-970). Le metadata de la RPC sert uniquement au ranking et au tri initial — les champs manquants n'affectent pas l'affichage.

---

## 5. Performance attendue

### Cout du buffer live

Le scan porte sur `interventions WHERE is_active = true AND updated_at > last_refresh_at` :
- Fenetre temporelle : 0 a 60 secondes de donnees
- Volume attendu : **0 a ~50 lignes** dans le pire cas (pic d'activite)
- Index utilise : `idx_interventions_updated_at` (B-tree) + `idx_interventions_search_vector_live` (GIN)
- Cout estime : **< 5ms** supplementaires

### Cout des colonnes generees

Les colonnes `search_vector` (GENERATED ALWAYS AS ... STORED) :
- Calculees a chaque INSERT/UPDATE automatiquement par PostgreSQL
- Cout : ~0.1ms par ligne modifiee (negligeable)
- Stockage : ~200-500 bytes par ligne

### Impact global

| Metrique | Avant | Apres |
|----------|-------|-------|
| Latence recherche | 200-400ms | 205-410ms (+5ms buffer) |
| Fraicheur donnees | 0-60s | **< 1s** |
| Cout ecriture | Flag only (~0.5ms) | Flag + update search_vector (~0.6ms) |

---

## 6. Migration & rollback

### Deploiement

1. Appliquer la migration (ajoute colonnes, index, reecrit la fonction)
2. Les colonnes `GENERATED ALWAYS` se remplissent automatiquement pour les lignes existantes
3. Les index utilisent `CREATE INDEX CONCURRENTLY` (cf. section 3.1.1) — **ne peut pas s'executer dans une transaction**. Si le runner de migration wrappe tout dans `BEGIN/COMMIT`, extraire les `CREATE INDEX CONCURRENTLY` dans un script separe execute apres la migration principale.
4. La nouvelle `search_global()` remplace l'ancienne immediatement (pas de downtime)

### Rollback

Si probleme, restaurer l'ancienne version de `search_global()` depuis la migration `00020` / `99021`. Les colonnes et index supplementaires peuvent rester sans impact.

---

## 7. Tests

### Tests SQL

```sql
-- 1. Creer une intervention
INSERT INTO interventions (...) VALUES (...) RETURNING id;

-- 2. Rechercher IMMEDIATEMENT (avant le cron refresh)
SELECT * FROM search_global('INT-00123', 20, 0, NULL);
-- Attendu: l'intervention apparait via le buffer live

-- 3. Attendre le refresh cron (1 min)
SELECT * FROM search_global('INT-00123', 20, 0, NULL);
-- Attendu: l'intervention apparait via la MV (source_priority = 1)

-- 4. Verifier la deduplication
-- L'intervention ne doit apparaitre qu'une seule fois dans les resultats
```

### Tests frontend (existants — aucun changement)

Les tests existants dans `tests/unit/hooks/` pour `useUniversalSearch` restent valides car le contrat RPC ne change pas.

### Test de non-regression

```sql
-- Verifier que le scoring est coherent entre MV et live
-- pour une intervention presente dans les deux sources
SELECT rank FROM search_global('terme_test') WHERE entity_id = 'xxx';
-- Le rank doit etre similaire (pas de saut de score au moment du refresh)
```

---

## 8. Fichiers impactes

| Fichier | Action |
|---------|--------|
| `supabase/migrations/XXXXX_hybrid_search_global.sql` | **Creer** — nouvelle migration |
| `src/lib/api/v2/search.ts` | **Aucun changement** |
| `src/hooks/useUniversalSearch.ts` | **Aucun changement** |
| `src/types/search.ts` | **Aucun changement** |
| `docs/architecture/data-flow.md` | **Mettre a jour** — documenter le pattern hybride |

---

## 9. Observabilite

### Comment verifier que le buffer live fonctionne

```sql
-- Nombre de resultats provenant du buffer live vs MV
-- (a executer manuellement ou via un dashboard)
WITH debug AS (
  SELECT
    entity_type, entity_id, source_priority,
    CASE source_priority WHEN 0 THEN 'live' WHEN 1 THEN 'mv' END AS source
  FROM (
    -- reproduire la logique interne de search_global avec source_priority expose
    SELECT *, 1 AS source_priority FROM global_search_mv
    WHERE search_vector @@ websearch_to_tsquery('french', 'terme_test')
    UNION ALL
    SELECT 'intervention', id, NULL, 0
    FROM interventions
    WHERE is_active = true
      AND updated_at > (SELECT last_refresh FROM search_views_refresh_flags WHERE id = 'global_search_mv')
  ) sub
)
SELECT source, count(*) FROM debug GROUP BY source;
```

### Metriques a monitorer

| Metrique | Source | Seuil d'alerte |
|----------|--------|----------------|
| Latence p95 de `search_global` RPC | Supabase Dashboard > API | > 800ms |
| Nombre de lignes dans le buffer live | `SELECT count(*) FROM interventions WHERE updated_at > last_refresh` | > 500 (indique un cron bloque) |
| Derniere date de refresh | `SELECT last_refresh FROM search_views_refresh_flags` | > 5 min de retard |
| Erreurs RPC `search_global` | Supabase Logs | Tout pic soudain |

### Alerte recommandee

Si `last_refresh` a plus de 5 minutes de retard, le buffer live grossit et les performances se degradent. Configurer une alerte (Supabase Webhooks ou monitoring externe) sur :

```sql
SELECT EXTRACT(EPOCH FROM now() - last_refresh) > 300
FROM search_views_refresh_flags
WHERE id = 'global_search_mv';
```

---

## 10. Comportement pendant le refresh de la MV

`REFRESH MATERIALIZED VIEW CONCURRENTLY` prend un verrou `EXCLUSIVE` sur la MV mais **ne bloque pas les lectures** (contrairement a `REFRESH` sans `CONCURRENTLY`). Pendant le refresh :

- Les requetes `SELECT` sur `global_search_mv` continuent de retourner les anciennes donnees
- Le buffer live couvre les nouvelles donnees
- A la fin du refresh, la MV est mise a jour atomiquement et `last_refresh` est ecrit
- Le buffer live se reduit alors naturellement (moins de lignes avec `updated_at > last_refresh`)

**Aucune fenetre de perte de donnees** : le buffer live et la MV sont toujours complementaires.

---

## 11. Validation en charge

### Plan de test de performance

Avant le deploiement en production, valider avec les scenarios suivants :

| Scenario | Methode | Critere de succes |
|----------|---------|-------------------|
| Recherche nominale (MV seule) | `search_global('INT-00100')` sur donnees rafraichies | < 400ms p95 |
| Recherche fraiche (buffer live) | INSERT puis `search_global` immediat | < 450ms p95, resultat present |
| Buffer charge | Simuler 200 interventions non rafraichies, puis rechercher | < 500ms p95 |
| Concurrence | 20 recherches simultanees (`pgbench` ou `k6`) | < 600ms p95, 0 erreurs |
| Refresh pendant recherche | Lancer `REFRESH MATERIALIZED VIEW CONCURRENTLY` + recherches en parallele | Aucune erreur, resultats coherents |

### Commande pgbench suggeree

```bash
# Fichier search_bench.sql
\set query '''INT-00''' || (random() * 200)::int
SELECT * FROM search_global(:query, 20, 0, NULL);

# Execution
pgbench -c 20 -j 4 -T 60 -f search_bench.sql -U postgres -d gmbs_crm
```

---

## 12. Edge case : pagination avec deduplication

L'utilisation de `OFFSET` apres `DISTINCT ON` sur un `UNION ALL` peut produire des resultats inconsistants entre les pages si des lignes basculent du buffer live vers la MV entre deux requetes paginees (un refresh a lieu entre page 1 et page 2).

### Impact

Faible en pratique : la recherche universelle affiche rarement plus d'une page, et l'utilisateur relance generalement une nouvelle recherche plutot que de paginer.

### Mitigation si necessaire (futur)

Pour une pagination stable, deux options :
1. **Keyset pagination** : remplacer `OFFSET` par un curseur base sur `(rank, entity_id)` — plus stable mais necessite de changer le contrat RPC
2. **Snapshot du buffer** : passer `v_last_refresh` en parametre client pour figer la fenetre temporelle pendant la pagination

Non implemente dans cette version car le cas d'usage de pagination profonde est rare.

---

## 13. Limites connues

1. **Metadata simplifie dans le buffer live** : Les resultats recents n'ont pas les infos agence/artisan/statut dans le metadata JSON. Impact nul car le frontend re-fetche les donnees completes par ID.

2. **Champs de recherche reduits dans le buffer live** : Le `search_vector` de la table de base ne contient pas les commentaires, le nom du tenant, ni le nom de l'artisan lie (car ce sont des joins). Un gestionnaire cherchant par nom de client ne trouvera pas une intervention fraichement creee via le buffer live — il la trouvera via la MV au prochain refresh. Les champs couverts par le buffer live (id_inter, contexte, adresse, ville, reference_agence) couvrent le cas d'usage principal : "je viens de creer l'intervention, je cherche son numero".

3. **pg_cron reste a 1 min** : Le cron pourrait etre reduit a 30s si necessaire, mais le buffer live rend cela non urgent.

4. **Pagination profonde instable** : Voir section 12. Non bloquant pour le cas d'usage actuel.

---

## 14. Evolution future : approche trigger-based (architecture cible)

### Probleme avec l'approche actuelle (GENERATED columns)

Les colonnes `GENERATED ALWAYS AS` ne peuvent referencer que les colonnes de la meme table. Le `search_vector` du buffer live est donc **appauvri** par rapport a celui de la MV :

| Champs manquants dans le buffer live (interventions) | Table source | Poids MV |
|-------------------------------------------------------|-------------|----------|
| `agence.label` | agencies | B |
| `tenant.firstname/lastname`, `plain_nom_client` | tenants | B |
| `owner.owner_firstname/lastname`, `plain_nom_facturation` | owner | B |
| `metier.label` | metiers | B |
| `assigned_user.username` | users | C |
| Emails tenant/owner/artisan | tenants/owner/artisans | C |
| Telephones tenant/owner/artisan (6 champs) | tenants/owner/artisans | C |
| `artisan.plain_nom`, `raison_sociale`, `siret`, `numero_associe` | artisans (via junction) | A-B |
| `commentaires_aggreges` | comments | C |
| `statut.label`, `metier.description` | intervention_statuses/metiers | D |

**Impact** : pendant la fenetre de 0-60s, une recherche par nom de tenant, nom d'artisan lie, ou nom d'agence ne trouvera pas une intervention fraichement creee.

### Architecture cible : triggers au lieu de GENERATED columns

Remplacer les colonnes `GENERATED ALWAYS AS` par des colonnes `tsvector` classiques maintenues par des triggers. Le trigger peut faire des JOINs et construire un vecteur aussi riche que celui de la MV.

#### Principe

```
INSERT/UPDATE intervention
  → trigger trg_interventions_search_vector()
    → JOIN agencies, tenants, owner, users, metiers, intervention_artisans, comments
    → SET NEW.search_vector = <tsvector complet avec tous les poids>

UPDATE tenant (nom change)
  → trigger trg_cascade_tenant_search()
    → UPDATE interventions SET updated_at = now() WHERE tenant_id = OLD.id
    → (ce qui re-declenche trg_interventions_search_vector)
```

#### Schema des triggers necessaires

```sql
-- 1. Trigger principal sur interventions (INSERT/UPDATE)
--    Construit le search_vector complet avec JOINs
CREATE OR REPLACE FUNCTION trg_interventions_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_vector tsvector;
BEGIN
  SELECT
    -- POIDS A: Identifiants critiques
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.id_inter, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.reference_agence, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(pa.numero_associe, ''))), 'A') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(pa.siret, ''))), 'A') ||
    -- POIDS B: Informations principales (avec JOINS)
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.contexte_intervention, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(a.label, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(pa.plain_nom, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(pa.raison_sociale, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(t.plain_nom_client, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(t.firstname || ' ' || t.lastname, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(o.plain_nom_facturation, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(o.owner_firstname || ' ' || o.owner_lastname, ''))), 'B') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(m.label, ''))), 'B') ||
    -- POIDS C: Informations secondaires
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.consigne_intervention, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.commentaire_agent, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.adresse, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.ville, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.code_postal, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(pa.email, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(t.email, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(o.email, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(u.username, ''))), 'C') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(ic.commentaires, ''))), 'C') ||
    -- POIDS D: Details
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.consigne_second_artisan, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.key_code, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.floor, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.apartment_number, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(NEW.vacant_housing_instructions, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(s.label, ''))), 'D') ||
    setweight(to_tsvector('french', f_unaccent(coalesce(m.description, ''))), 'D')
  INTO v_vector
  FROM (SELECT 1) _dummy
  LEFT JOIN agencies a ON a.id = NEW.agence_id
  LEFT JOIN tenants t ON t.id = NEW.tenant_id
  LEFT JOIN owner o ON o.id = NEW.owner_id
  LEFT JOIN users u ON u.id = NEW.assigned_user_id
  LEFT JOIN intervention_statuses s ON s.id = NEW.statut_id
  LEFT JOIN metiers m ON m.id = NEW.metier_id
  LEFT JOIN LATERAL (
    SELECT art.* FROM intervention_artisans ia
    JOIN artisans art ON ia.artisan_id = art.id
    WHERE ia.intervention_id = NEW.id AND ia.is_primary = true
    LIMIT 1
  ) pa ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(content, ' | ') AS commentaires
    FROM comments WHERE entity_id = NEW.id AND entity_type = 'intervention'
  ) ic ON true;

  NEW.search_vector := v_vector;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_interventions_search_vector
  BEFORE INSERT OR UPDATE ON interventions
  FOR EACH ROW EXECUTE FUNCTION trg_interventions_search_vector();

-- 2. Triggers cascade sur tables liees
--    Quand une table liee change, on "touche" les interventions concernees
--    pour re-declencher le trigger principal.

-- Cascade: tenant name/email change → re-index interventions liees
CREATE OR REPLACE FUNCTION trg_cascade_tenant_search()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE interventions SET updated_at = now()
  WHERE tenant_id = NEW.id AND is_active = true;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cascade_tenant_search
  AFTER UPDATE OF firstname, lastname, plain_nom_client, email, telephone, telephone2
  ON tenants FOR EACH ROW EXECUTE FUNCTION trg_cascade_tenant_search();

-- Cascade: owner change → re-index interventions liees
CREATE OR REPLACE FUNCTION trg_cascade_owner_search()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE interventions SET updated_at = now()
  WHERE owner_id = NEW.id AND is_active = true;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cascade_owner_search
  AFTER UPDATE OF owner_firstname, owner_lastname, plain_nom_facturation, email, telephone, telephone2
  ON owner FOR EACH ROW EXECUTE FUNCTION trg_cascade_owner_search();

-- Cascade: agency label change → re-index interventions liees
CREATE OR REPLACE FUNCTION trg_cascade_agency_search()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE interventions SET updated_at = now()
  WHERE agence_id = NEW.id AND is_active = true;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cascade_agency_search
  AFTER UPDATE OF label ON agencies
  FOR EACH ROW EXECUTE FUNCTION trg_cascade_agency_search();

-- Cascade: comment added/updated → re-index intervention liee
CREATE OR REPLACE FUNCTION trg_cascade_comment_search()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entity_type = 'intervention' THEN
    UPDATE interventions SET updated_at = now()
    WHERE id = NEW.entity_id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cascade_comment_search
  AFTER INSERT OR UPDATE OF content ON comments
  FOR EACH ROW EXECUTE FUNCTION trg_cascade_comment_search();

-- Cascade: artisan assigned/changed → re-index intervention liee
CREATE OR REPLACE FUNCTION trg_cascade_artisan_assignment_search()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE interventions SET updated_at = now()
  WHERE id = COALESCE(NEW.intervention_id, OLD.intervention_id) AND is_active = true;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cascade_artisan_assignment_search
  AFTER INSERT OR UPDATE OR DELETE ON intervention_artisans
  FOR EACH ROW EXECUTE FUNCTION trg_cascade_artisan_assignment_search();
```

#### Impact performance

| Metrique | GENERATED (actuel) | Trigger-based (cible) |
|----------|--------------------|-----------------------|
| Cout INSERT intervention | ~0.1ms (expression locale) | ~2-5ms (7 JOINs sur 1 row) |
| Cout UPDATE intervention | ~0.1ms | ~2-5ms |
| Cout UPDATE tenant | 0 (pas de cascade) | ~5-20ms (UPDATE N interventions liees) |
| Cout UPDATE agency label | 0 | ~10-50ms (UPDATE toutes interventions de l'agence) |
| Cout ajout commentaire | 0 | ~2-5ms (UPDATE 1 intervention) |
| Recherche buffer live | Identique | Identique (meme GIN index) |
| Qualite recherche buffer | ~12 champs (same-table) | **~30+ champs (pareil que MV)** |

**Verdict** : cout negligeable pour un CRM (dizaines d'ecritures/heure, pas des milliers/seconde). Le seul cas a surveiller serait un renommage d'agence qui cascade sur des centaines d'interventions — mais c'est un evenement exceptionnel.

#### Migration depuis l'approche actuelle

```sql
-- 1. Supprimer la colonne GENERATED
ALTER TABLE interventions DROP COLUMN search_vector;

-- 2. Ajouter une colonne tsvector classique
ALTER TABLE interventions ADD COLUMN search_vector tsvector;

-- 3. Creer les triggers (cf. ci-dessus)

-- 4. Backfill: re-calculer le search_vector pour toutes les lignes existantes
UPDATE interventions SET updated_at = updated_at WHERE is_active = true;
-- (le trigger se declenche et recalcule search_vector)

-- 5. Meme chose pour artisans
```

#### Effort estime

| Tache | Temps |
|-------|-------|
| Drop GENERATED, ajouter colonne classique | 10 min |
| Trigger principal interventions (avec JOINs) | 30-40 min |
| Trigger principal artisans (avec JOINs) | 20-30 min |
| Triggers cascade (tenants, owner, agencies, users, comments, intervention_artisans) | 1-2h |
| Tests SQL + non-regression | 1h |
| **Total** | **~3-4h** |
