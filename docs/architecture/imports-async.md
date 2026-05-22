# Imports asynchrones (CSV interventions)

> Architecture du pipeline d'import CSV en masse : upload, traitement async via Edge Function, suivi temps réel, idempotence et reprise sur timeout.

**Statut :** Slice vertical livré (mai 2026). L'enveloppe asynchrone (jobs +
Realtime + historique) est en place et réutilise la logique TS existante
`runImport()`. La réécriture Deno stricte (ADR-1) reste un suivi optionnel —
voir **ADR-5** qui inverse ce choix pour le slice.

### État d'implémentation (mise à jour mai 2026)

| Élément | État | Référence |
|---|---|---|
| ADR-2 — résolution locataires/propriétaires en SQL set-based | ✅ Livré | migration `99027_csv_intervention_import_person_resolvers.sql` |
| Mitigation 414 sur lookups UUID (`FETCH_CHUNK` 500 → 100) | ✅ Livré | `src/lib/api/interventions/interventions-import.ts` |
| Mitigation timeout — `maxDuration=300` sur l'endpoint synchrone | ✅ Livré | `app/api/imports/interventions/route.ts` |
| P1 — Table `intervention_import_jobs` (+ sidecar `_job_data`) | ✅ Livré (slice) | migration `99030_intervention_import_jobs.sql` |
| P2 — Worker = route Next.js nodejs réutilisant `runImport()` (PAS Deno) | ✅ Livré (slice, **ADR-5**) | `app/api/imports/interventions/jobs/**`, `src/lib/api/interventions/import-jobs.ts` |
| P4 — Hooks client `useImportJob` / `useImportJobs` + Realtime | ✅ Livré (slice) | `src/features/settings/useImportJob.ts`, `useImportJobs.ts` |
| P2-bis — Réécriture Deno du worker (ADR-1 strict) | ⏳ Optionnel / suivi | section 5, ADR-1 |
| P3 — Bucket Storage `imports/` (vs colonne) | ⏳ Non retenu pour le slice | ADR-5 |
| P3.5 — `cleanup_old_import_files()` + `pg_cron` | ⏳ À faire | section 8, ADR-4 |
| Heartbeat / reprise sur timeout | ⏳ À faire | section 4 |
| P5 — Observabilité | ⏳ À faire | section 10 |
| P6 — Suppression de l'endpoint synchrone legacy | ⏳ À faire | Open Question #4 |

**Dette technique courante.** L'endpoint synchrone `POST /api/imports/interventions`
est conservé comme fallback (petits fichiers, tests d'intégration) mais n'est
plus le chemin recommandé. Limites résiduelles du slice : pas de heartbeat /
reprise sur timeout (une invocation worker = budget 300 s, soit ~25 k lignes au
débit actuel), worker en TS et non en Deno (ADR-1 non appliqué — voir ADR-5).

---

## 1. Contexte et motivation

### Le problème

L'import synchrone actuel (`POST /api/imports/interventions` avec streaming NDJSON) tient bien jusqu'à ~2 000 lignes mais casse au-delà :

| Symptôme | Cause |
|---|---|
| `Résolution locataires/propriétaires : URI too long` (HTTP 414) | `.in('plain_nom_client', slice)` envoie ~200 noms encodés URL → > 8 Ko, limite proxy |
| Import perdu à la fermeture d'onglet | Le streaming NDJSON est lié au cycle de vie de la requête HTTP du navigateur |
| Timeout serverless (~60–300 s sur Vercel) | Tout le travail tourne dans une fonction Next.js |
| Pas d'historique, pas de reprise | Aucune persistance d'état entre client et serveur |

Avec des CSV qui dépassent **7 000 lignes** en production, ces limites bloquent l'usage normal.

### La décision

Adopter le pattern standard d'import en masse :

> **Upload → ack rapide → worker async → suivi via Realtime**

Inspiré des Bulk APIs de Stripe, Salesforce, HubSpot. Le client upload le fichier, reçoit un `job_id` immédiatement, et observe l'avancement via Supabase Realtime. Le worker tourne dans une **Edge Function Supabase** (proche de la DB, hors du cycle de vie de la requête navigateur). La résolution locataires/propriétaires se fait **en SQL set-based** (un `JOIN`) au lieu de N appels `.in()` HTTP — ce qui élimine le 414 par construction.

### Bénéfices attendus

- **Survit à la fermeture d'onglet** : le worker continue, l'utilisateur retrouve l'état en revenant.
- **Pas de limite URL** : plus aucun `.in()` HTTP de masse, tout en SQL.
- **Reprise sur timeout** : curseur `processed_rows` permet au worker de redémarrer où il s'est arrêté.
- **Idempotence** : `id_inter` comme clé naturelle + `INSERT … ON CONFLICT`, on peut rejouer sans dupliquer.
- **Historique** : table `intervention_import_jobs` garde la trace de chaque import.

---

## 2. Vue d'ensemble

```
┌────────┐  1. upload CSV     ┌──────────────┐
│ Client │ ─────────────────▶ │ Supabase     │
│        │                    │ Storage      │
│        │  2. POST /jobs     │ (bucket privé)│
│        │ ─────────────────▶ └──────────────┘
│        │     {file_path}            │
│        │  ◀─────── job_id           │
│        │                            │
│        │  3. Realtime sub           │
│        │ ◀═══════ progress ═════════│
│        │                            ▼
│        │                    ┌──────────────┐
│        │                    │ Edge Function│
│        │                    │ (worker)     │
│        │                    └──────┬───────┘
│        │  4. download                │
│        │     report.csv              │ COPY → staging
└────────┘                             │ JOIN résolution
                                       │ INSERT ON CONFLICT
                                       ▼
                              ┌──────────────┐
                              │  PostgreSQL  │
                              └──────────────┘
```

### Acteurs

| Composant | Rôle |
|---|---|
| **Client** (React) | Upload du CSV, création du job, abonnement Realtime, affichage progress |
| **Supabase Storage** | Stockage du `source.csv` et du `report.csv`, bucket privé |
| **API Next.js** (`/api/imports/interventions/jobs`) | Création/lecture/cancel des jobs, vérification permissions, déclenchement du worker |
| **Edge Function** (`process-intervention-import`) | Le worker. Lit le CSV, fait la résolution SQL, insère/upsert, met à jour le job |
| **PostgreSQL** | Tables `intervention_import_jobs` + staging temp + `interventions`/`tenants`/`owner` |
| **Supabase Realtime** | Diffuse les `UPDATE` du job vers le client abonné |
| **`pg_cron`** | Cleanup nocturne (jobs zombies, fichiers expirés, lignes anciennes) |

---

## 3. Modèle de données

### Table `intervention_import_jobs`

État persistant d'un import. C'est la source de vérité observée par le client.

```sql
create type import_job_status as enum
  ('pending', 'running', 'succeeded', 'failed', 'cancelled');

create table intervention_import_jobs (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid not null references auth.users(id),

  -- Entrée
  file_path       text not null,           -- chemin dans le bucket imports/
  mode            text not null
                  check (mode in ('create', 'update', 'upsert')),
  dry_run         boolean not null default false,

  -- État
  status          import_job_status not null default 'pending',
  total_rows      int,                     -- connu après parse initial
  processed_rows  int not null default 0,  -- curseur de reprise
  inserted_rows   int not null default 0,
  updated_rows    int not null default 0,
  failed_rows     int not null default 0,

  -- Sortie
  error_message   text,                    -- erreur fatale (job entier)
  report_path     text,                    -- chemin du report.csv (erreurs ligne-à-ligne)

  -- Audit
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz,
  heartbeat_at    timestamptz              -- mis à jour par le worker, détecte les morts
);

create index on intervention_import_jobs (created_by, created_at desc);
create index on intervention_import_jobs (status)
  where status in ('pending', 'running');
```

### Table de staging (transient)

Créée par le worker dans la transaction du job, dropée à la fin. **Pas de migration** — c'est une `temp table` par invocation.

```sql
create temp table staging_interventions (
  line              int,
  raw               jsonb,        -- ligne CSV brute, pour le report d'erreurs

  -- Champs parsés
  id_inter          text,
  agence_label      text,
  statut_label      text,
  metier_label      text,
  -- ... toutes les colonnes du CSV

  tenant_phone      text,
  tenant_email      text,
  tenant_name       text,
  owner_phone       text,
  owner_email       text,
  owner_name        text,

  -- Champs résolus par JOIN
  agence_id         uuid,
  statut_id         uuid,
  metier_id         uuid,
  tenant_id         uuid,
  owner_id          uuid,

  -- État ligne
  error             text          -- non nul = ligne rejetée
) on commit drop;
```

### Bucket `imports/` (Supabase Storage)

| Élément | Valeur |
|---|---|
| Visibilité | privé (`public = false`) |
| Taille max fichier | 50 Mo |
| MIME autorisés | `text/csv`, `application/vnd.ms-excel`, `text/plain` |
| Layout | `imports/{user_id}/{job_id}/source.csv` <br> `imports/{user_id}/{job_id}/report.csv` |

### Politique de rétention

| Donnée | Durée | Justification |
|---|---|---|
| `source.csv` (job réussi) | 7 jours | Permet rejouer si bug détecté tardivement |
| `source.csv` (job échoué) | 30 jours | Temps de comprendre, corriger, relancer |
| `report.csv` | 30 jours | Téléchargement utilisateur |
| Ligne `intervention_import_jobs` | 90 jours | Historique, puis suppression (RGPD) |

Implémenté via un job `pg_cron` nocturne (voir section 8).

---

## 4. Cycle de vie d'un job

### Diagramme d'états

```
                 ┌──────────┐
   POST /jobs    │ pending  │
   ───────────▶  └────┬─────┘
                      │ worker démarre
                      ▼
                 ┌──────────┐  cancel API
                 │ running  │ ──────────────┐
                 └────┬─────┘               │
        succès        │   échec fatal       │
        ┌─────────────┤                     │
        ▼             ▼                     ▼
  ┌──────────┐  ┌──────────┐         ┌──────────┐
  │succeeded │  │  failed  │         │cancelled │
  └──────────┘  └──────────┘         └──────────┘
```

### Transitions et invariants

| Transition | Déclencheur | Invariants |
|---|---|---|
| `pending → running` | Worker prend le job | `started_at` set, `heartbeat_at` set |
| `running → running` | Tick worker (chaque chunk) | `processed_rows` croît, `heartbeat_at` rafraîchi |
| `running → succeeded` | Worker termine sans erreur fatale | `processed_rows == total_rows`, `report_path` set si `failed_rows > 0` |
| `running → failed` | Erreur fatale (CSV invalide, DB down, etc.) | `error_message` set, `finished_at` set |
| `running → cancelled` | API cancel + worker observe le flag | `finished_at` set, chunk en cours rollback |
| `running → failed` (zombie) | `pg_cron` détecte `heartbeat_at < now() - 5 min` | `error_message = 'Worker timeout (no heartbeat)'` |

### Heartbeat

Le worker `UPDATE intervention_import_jobs SET heartbeat_at = now()` à chaque chunk traité (~toutes les 5 s en pratique). Un cron nocturne marque `failed` les jobs `running` dont le heartbeat a > 5 min de retard.

### Reprise sur timeout

Les Edge Functions Supabase ont une limite ~150 s par invocation. Si un import dépasse :

1. Le worker observe le temps écoulé avant de démarrer un nouveau chunk.
2. S'il approche du seuil (~120 s), il **se réinvoque lui-même** avec le même `job_id`.
3. Au démarrage, le worker reprend à `processed_rows` (curseur dans la table de staging si elle persiste, sinon retraite depuis le CSV avec un offset).

> **Note de conception :** la table de staging est `temp` (dropée en fin de connexion). Pour la reprise, soit on la promeut en table normale par job, soit le worker recharge le CSV depuis le début et skip jusqu'à `processed_rows`. Voir Open Questions.

---

## 12. Décisions d'architecture (mini-ADR)

### ADR-1 : Edge Function Supabase plutôt que route Next.js long-running

**Contexte.** Le worker doit tourner hors du cycle de vie de la requête navigateur, exécuter `COPY`, faire des transactions longues, et survivre aux fermetures d'onglet.

**Options envisagées.**

- **A.** Edge Function Supabase (Deno, ~150 s/invocation, proche DB).
- **B.** Route Next.js sur Vercel Functions Long Running (jusqu'à 800 s, mais payant et Node).
- **C.** Worker externe (Railway, Fly.io, GitHub Actions) consommant une queue.

**Décision.** **Option A — Edge Function Supabase.**

**Conséquences.**

- ✅ Connexion DB stable (même pool que les API routes).
- ✅ Pas d'infrastructure additionnelle (pas de queue externe à exploiter).
- ✅ Cohérent avec les 13 autres Edge Functions du projet.
- ⚠️ Limite 150 s par invocation → nécessite un mécanisme de réinvocation (couvert section 4).
- ⚠️ Deno (pas Node) → on ne peut pas réutiliser tel quel le code de `interventions-import.ts`. On ré-implémente la logique métier en Deno + SQL.

### ADR-2 : Résolution locataires/propriétaires en SQL set-based plutôt qu'en `.in()` HTTP

**Contexte.** L'erreur `URI too long` vient de `.in('plain_nom_client', slice)` côté PostgREST (200 noms longs URL-encodés > 8 Ko de query string).

**Options.**

- **A.** Réduire la taille des chunks `.in()` à 50.
- **B.** Charger les locataires en SQL via JOIN sur la table de staging.

**Décision.** **Option B — JOIN SQL.**

> **Statut (mai 2026)** : implémenté pour la résolution locataires/propriétaires via deux RPCs `csv_intervention_import_resolve_tenants` / `csv_intervention_import_resolve_owners` (migration `99027_csv_intervention_import_person_resolvers.sql`). Les paramètres passent en POST body — plus aucun `.in()` HTTP de masse pour ces deux lookups. Les chunks UUID restants (lookups par `id`) ont été ramenés de 500 → 100 pour rester sous la limite Kong locale, en attendant le worker async qui les remplacera entièrement par des `JOIN` set-based.

**Conséquences.**

- ✅ Élimine le problème par construction (plus aucune URL longue).
- ✅ Une requête au lieu de N — passe de O(rows / 50) round-trips à O(1).
- ✅ Cohérent avec le pattern "staging table" du worker.
- ⚠️ Logique de matching (téléphone OU email OU nom) doit être réécrite en SQL. Le matching JS actuel reste comme référence dans `interventions-import.ts` jusqu'à dépréciation.

### ADR-3 : Table de staging `temp` (par job) plutôt que table permanente

**Contexte.** Le worker a besoin d'un espace de travail intermédiaire pour le CSV parsé.

**Options.**

- **A.** `temp table` créée et dropée par invocation worker.
- **B.** Table permanente `intervention_import_staging` partitionnée par `job_id`.

**Décision.** **Option A — temp table.**

**Conséquences.**

- ✅ Pas de cleanup à gérer (drop automatique en fin de connexion).
- ✅ Pas d'impact sur le schéma versionné.
- ⚠️ Reprise sur timeout plus complexe (la temp table ne survit pas à la réinvocation). Voir Open Questions.

### ADR-4 : `pg_cron` pour le cleanup plutôt que Vercel Cron

**Contexte.** Il faut supprimer périodiquement les fichiers expirés, les jobs zombies et les vieilles lignes.

**Options.**

- **A.** `pg_cron` (déjà disponible sur Supabase).
- **B.** Vercel Cron appelant un endpoint dédié.
- **C.** GitHub Actions schedule.

**Décision.** **Option A — `pg_cron`.**

**Conséquences.**

- ✅ Co-localisé avec la donnée à nettoyer (DB + bucket via `storage.objects`).
- ✅ Pas de dépendance réseau à un cron externe.
- ✅ Pas d'authent à gérer (s'exécute en superuser DB).
- ⚠️ Logique de cleanup en SQL/PLpgSQL, moins testable que du TypeScript.

### ADR-5 : Slice vertical — worker TS et stockage en colonne (inverse ADR-1 & P3)

**Contexte.** Livrer la valeur (survie à la fermeture d'onglet, historique,
progression Realtime) sans bloquer sur la réécriture Deno (~800 lignes de TS de
matching à porter en SQL) ni sur la mise en place d'un bucket Storage.

**Décision.** Pour cette première livraison :

1. **Worker = route Next.js `nodejs`** (`/api/imports/interventions/jobs/[id]/run`,
   `maxDuration=300`), déclenchée par self-fetch fire-and-forget depuis la route
   de création, protégée par `WORKER_SECRET`. Elle réutilise `runImport()` tel
   quel via le client service-role. **Inverse ADR-1** (Edge Function Deno).
2. **Stockage en base, pas bucket** : le CSV (entrée) et `result`/`preview`
   (sortie) vivent dans une table **sidecar** `intervention_import_job_data`,
   distincte de `intervention_import_jobs`. **Écarte P3** (bucket Storage).

**Pourquoi la sidecar.** `intervention_import_jobs` est publiée sur Realtime :
chaque UPDATE rediffuse la ligne entière. Garder `csv_content` (≤ 10 Mo) et
`result`/`preview` (jusqu'à 10 000 lignes) sur cette table ferait exploser
chaque message de progression et dépasser la limite de taille Realtime
(~256 Ko) sur le message terminal → événement perdu. La sidecar (non publiée)
garde la table jobs légère ; le client récupère `result` via `GET /jobs/:id`
quand le job atteint un état terminal.

**Conséquences.**

- ✅ Réutilise la logique métier éprouvée — pas de double maintenance immédiate.
- ✅ Zéro infra nouvelle (pas de bucket, pas de RLS Storage).
- ✅ Suivi Realtime robuste même sur gros fichiers (table publiée légère).
- ⚠️ Pas de reprise sur timeout (une invocation = budget 300 s).
- ⚠️ ADR-1 (Deno) et P3 (bucket) restent la cible si le slice montre ses limites
  (imports > ~25 k lignes, besoin de rétention fichier 7-30 j).

---

## 5. Le worker (à finaliser en P2)

> *Section à enrichir avec les détails d'implémentation au fil du PR P2 (worker minimal). L'intention est décrite section 1 et ADR-2.*

Étapes prévues : `UPDATE status='running'` → download CSV → `COPY` vers staging → validation SQL → `UPDATE … FROM tenants/owner` (résolution) → `INSERT … ON CONFLICT` → mise à jour compteurs → génération report → `UPDATE status='succeeded'`.

---

## 6. API publique (à finaliser en P1)

> *Section à enrichir avec les schémas exacts des payloads et codes d'erreur au fil du PR P1.*

Endpoints prévus :

- `POST /api/imports/interventions/jobs` — crée un job.
- `GET /api/imports/interventions/jobs/:id` — lit l'état (fallback si Realtime down).
- `POST /api/imports/interventions/jobs/:id/cancel` — annule.

Permission requise : `import_interventions` (déjà en place sur l'endpoint synchrone actuel).

---

## 7. Côté client (à finaliser en P4)

> *Section à enrichir avec le hook `useImportJob` et les états UI au fil du PR P4.*

Intention : `ImportInterventionsCard.tsx` upload le fichier, crée le job, s'abonne via Supabase Realtime aux UPDATE de la ligne `intervention_import_jobs`, affiche progress bar + bouton cancel + lien report.csv.

---

## 8. Rétention et RGPD

Politique : voir section 3. Implémenté via un `pg_cron` nocturne :

```sql
select cron.schedule('intervention-import-cleanup', '0 3 * * *', $$
  -- 1. Marquer zombies
  update intervention_import_jobs
     set status = 'failed',
         error_message = 'Worker timeout (no heartbeat)',
         finished_at = now()
   where status = 'running'
     and heartbeat_at < now() - interval '5 minutes';

  -- 2. Supprimer fichiers expirés (via storage.objects)
  perform cleanup_old_import_files();

  -- 3. Supprimer lignes > 90j
  delete from intervention_import_jobs
   where created_at < now() - interval '90 days';
$$);
```

> *Détail de `cleanup_old_import_files()` à finaliser en P3.5.*

---

## 9. Sécurité

- **RLS sur `intervention_import_jobs`** : chaque utilisateur ne voit que ses propres jobs (`created_by = auth.uid()`). L'import est strictement scopé à l'utilisateur — l'agence n'apparaît qu'au niveau des lignes d'intervention résolues, pas au niveau du job.
- **RLS sur le bucket `imports/`** : seul `created_by` peut lire/écrire ses fichiers, via le préfixe `imports/{user_id}/…` et une policy qui matche `(storage.foldername(name))[1] = auth.uid()::text`.
- **Permission applicative** : `import_interventions` requise pour `POST /jobs`.
- **Pas de PII en logs** : les Edge Function ne loggent que `job_id`, jamais le contenu CSV.

---

## 10. Observabilité (à finaliser en P5)

> *Métriques exactes à choisir au fil du PR P5.*

Intention : suivre taux d'échec global, durée médiane par 1 000 lignes, distribution des `failed_rows`, jobs zombies détectés par le cron.

---

## 11. Limites connues

- **Pas de parallélisme inter-jobs** (1 worker par job). Si 5 utilisateurs importent en même temps, 5 Edge Functions tournent en parallèle, chacune sérialisée.
- **Pas d'import incrémental** (delta). Chaque import est un fichier complet.
- **Pas de rollback global** : un import partiellement appliqué reste appliqué (les chunks réussis sont commits). L'utilisateur doit corriger via un import correctif.

---

## Open Questions

À trancher avant ou pendant l'implémentation. Mises à jour au fil de l'eau.

1. **Reprise sur timeout : staging temp ou permanente ?**
   La temp table ne survit pas à la réinvocation worker. Trois options : (a) la promouvoir en table permanente partitionnée par `job_id` ; (b) recharger le CSV from scratch et `OFFSET` jusqu'à `processed_rows` (simple mais relit du I/O) ; (c) sérialiser l'état staging en JSONB dans `intervention_import_jobs.staging_snapshot` (limite de taille). **Vote actuel : (b)** pour la simplicité, à confirmer après benchmark sur 10 k lignes.

2. **Idempotence du POST /jobs.**
   Si le client retry un upload (clic double, perte réseau), on crée deux jobs identiques. Faut-il ajouter une clé d'idempotence (`Idempotency-Key` header, ou hash du CSV) qui dédup les jobs créés dans les 5 dernières minutes ?

3. **Cancel propre pendant `INSERT … ON CONFLICT` long.**
   Le check du flag `cancelled` se fait entre chunks. Si un chunk de 500 lignes prend 30 s, l'utilisateur attend jusqu'à 30 s après son clic. Acceptable, ou faut-il un mécanisme `pg_cancel_backend()` ?

4. **Suppression de l'ancien endpoint synchrone (`POST /api/imports/interventions`).**
   Le garder en fallback pour les tests d'intégration et les imports < 500 lignes, ou tout migrer ? Coût de maintenir deux chemins vs simplicité d'un seul. **Vote actuel : suppression** une fois le nouveau en prod stable, pour ne pas maintenir deux chemins de code.

5. **Notifications de fin de job.**
   Realtime couvre l'utilisateur qui a l'onglet ouvert. Faut-il aussi envoyer un email/notification lorsque l'utilisateur a fermé l'onglet et que le job termine 10 min plus tard ?

6. **Limite supérieure de `total_rows`.**
   Au-delà de combien de lignes refuse-t-on l'import (protection contre upload accidentel d'un fichier monstre) ? Proposition : 50 000 lignes, à valider avec le métier.

7. **Format du report.csv.**
   Reproduire le CSV d'origine + colonnes `error_line`, `error_message` ? Ou format minimal `line, error` ? Le premier permet de corriger et réimporter directement ; le second est plus simple à générer.

8. **Coexistence avec le commit `f301c57` (preview diff "avant/après").**
   La fonctionnalité dry-run + `fetchPreviousDisplayPayloads` ajoutée ce matin a sa propre source de 414 (chunks de 500 UUIDs). Doit-elle migrer vers le pipeline async aussi, ou rester un mode synchrone limité aux petits fichiers ?
   *Mitigation appliquée (mai 2026)* : `FETCH_CHUNK` ramené à 100 — élimine le 414 dans la pratique. La migration vers le pipeline async reste pertinente à terme.

---

## Liens

- Plan de phasage initial : voir conversation de conception (mai 2026).
- Code legacy à terme déprécié : `src/lib/api/interventions/interventions-import.ts`, `app/api/imports/interventions/route.ts`.
- Documentation associée à mettre à jour en fin de chantier : `docs/api-reference/interventions.md`, `docs/api-reference/edge-functions.md`.
