# Migrations de base de données

> Guide pour la création et la gestion des migrations SQL dans GMBS-CRM via Supabase.

---

## Vue d'ensemble

Le projet utilise le système de migrations de **Supabase CLI**. Les fichiers SQL se trouvent dans `supabase/migrations/` et sont exécutés séquentiellement par ordre de nom de fichier.

**Total actuel : 115 migrations** — séquence historique `00001`–`00086` (avec quelques trous) plus la séquence `99001`–`99024` introduite en 2026 (voir section dédiée plus bas).

---

## Conventions de nommage

### Format du nom de fichier

```
NNNNN_description_courte.sql
```

- `NNNNN` : numéro a 5 chiffres, incrémenté séquentiellement
- `description_courte` : description en snake_case de la migration

### Exemples

```
00001_clean_schema.sql
00012_rls_policies.sql
00037_intervention_audit_system.sql
00052_artisan_status_history.sql
00082_touch_intervention_on_child_change.sql
```

### Bonnes pratiques de nommage

- Utiliser des verbes d'action : `add_`, `fix_`, `create_`, `enable_`, `setup_`, `optimize_`
- Être descriptif mais concis
- Préfixer les corrections : `fix_`
- Préfixer les optimisations : `optimize_`

---

## Structure d'une migration

### Template standard

```sql
-- ========================================
-- Description de la migration
-- ========================================
-- Version: 1.0
-- Date: YYYY-MM-DD
-- Description: Ce que fait cette migration

-- 1. Modifications de schema
CREATE TABLE IF NOT EXISTS public.ma_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- colonnes...
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Index
CREATE INDEX IF NOT EXISTS idx_ma_table_colonne ON public.ma_table(colonne);

-- 3. RLS (si applicable)
ALTER TABLE public.ma_table ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ma_table_select_authenticated ON public.ma_table;
CREATE POLICY ma_table_select_authenticated ON public.ma_table
  FOR SELECT TO authenticated
  USING (true);

-- 4. Commentaires
COMMENT ON TABLE public.ma_table IS 'Description de la table';
```

### Règles de sécurité

- Toujours utiliser `IF NOT EXISTS` / `IF EXISTS` pour l'idempotence
- Utiliser `DROP ... IF EXISTS` avant `CREATE` pour les policies, triggers, fonctions
- Protéger les données existantes : `ON CONFLICT ... DO NOTHING` pour les inserts
- Ne jamais supprimer de colonnes en production sans migration en plusieurs étapes

---

## Workflow de migration

### 1. Créer une migration

```bash
# Méthode manuelle (recommandée pour le contrôle)
# Créer le fichier dans supabase/migrations/ avec le prochain numéro disponible

# Ou via Supabase CLI
supabase migration new description_courte
```

### 2. Écrire le SQL

Suivre le template ci-dessus. Points de vigilance :
- Tester la migration sur une base locale d'abord
- Vérifier l'idempotence (la migration doit pouvoir être rejouée)
- Inclure les policies RLS si la table doit être accédée depuis le frontend

### 3. Appliquer en local

```bash
# Reset complet (applique toutes les migrations depuis zéro)
supabase db reset

# Ou appliquer uniquement les nouvelles migrations
supabase db push
```

### 4. Régénérer les types TypeScript

Après chaque modification de schéma :

```bash
npm run types:generate
# Équivalent a : supabase gen types typescript --local > src/lib/database.types.ts
```

### 5. Déployer

Les migrations sont appliquées automatiquement lors du déploiement via Supabase.

---

## Catégories de migrations existantes

### Schema initial (00001-00009)

| Migration | Description |
|-----------|-------------|
| `00001_clean_schema.sql` | Schema consolidé complet (tables, enums, données initiales) |
| `00002_ai_views.sql` | Vues pour l'assistant IA |
| `00003_user_features.sql` | Fonctionnalités utilisateur |
| `00004_documents_bucket.sql` | Bucket Supabase Storage pour documents |
| `00005_attachments_constraints.sql` | Contraintes sur les pièces jointes |
| `00006_indexes_all.sql` | Index de performance |
| `00007_triggers_updated_at.sql` | Triggers de mise a jour automatique |
| `00008_artisan_triggers.sql` | Triggers artisan |
| `00009_gestionnaire_targets.sql` | Objectifs gestionnaires |

### Workflow et dashboard (00010-00011)

| Migration | Description |
|-----------|-------------|
| `00010_status_transitions.sql` | Table des transitions de statuts |
| `00011_dashboard_functions.sql` | Fonctions RPC pour le dashboard |

### Sécurité et RLS (00012, 00040-00046)

| Migration | Description |
|-----------|-------------|
| `00012_rls_policies.sql` | Policies RLS billing/chat |
| `00040_seed_permissions_roles.sql` | Seed des permissions et rôles |
| `00041_rls_core_tables.sql` | RLS pour users, artisans, interventions |
| `00042_user_permissions.sql` | Système de permissions individuelles |
| `00043-00046` | Corrections permissions et rôles |

### Recherche (00020-00036)

| Migration | Description |
|-----------|-------------|
| `00020_search_materialized_views.sql` | Vues matérialisées de recherche |
| `00033_auto_refresh_search_views.sql` | Rafraîchissement automatique |
| `00035_async_search_views_refresh.sql` | Rafraîchissement asynchrone |

### Features métier (00024-00082)

Ajouts progressifs de fonctionnalités : champs artisan, audit, sous-statuts, comptabilité, etc.

### Realtime et performance (00083-00085)

| Migration | Description |
|-----------|-------------|
| `00083_fix_artisan_status_protected_list.sql` | Correction de la liste des statuts proteges artisan |
| `00084_enable_interventions_realtime.sql` | Activation du Realtime Supabase sur la table interventions |
| `00085_enable_artisans_realtime.sql` | Activation du Realtime Supabase sur la table artisans |

> Les migrations 00084 et 00085 activent la publication Realtime PostgreSQL sur les tables interventions et artisans, permettant au systeme de synchronisation temps reel (cache-sync) de recevoir des evenements `INSERT`, `UPDATE` et `DELETE` via Supabase Realtime.

### Fix data integrity (00086)

| Migration | Description |
|-----------|-------------|
| `00086_fix_intervention_costs_duplicates.sql` | Correction des doublons dans `intervention_costs` + contrainte UNIQUE |

> La migration 00086 corrige un bug ou `addCost()` utilisait `artisan_order=1` par defaut pour tous les types de couts, tandis que `upsertCostsBatch()` utilisait `artisan_order=NULL` pour les types `intervention` et `marge`. Ce mismatch creait des doublons silencieux qui faussaient les totaux dans `intervention_costs_cache` (SUM incluant les doublons). La migration normalise `artisan_order` a NULL pour les types `intervention`/`marge`, supprime les doublons (garde la ligne la plus recente), ajoute une contrainte UNIQUE `(intervention_id, cost_type, COALESCE(artisan_order, 0))`, et recalcule le cache.

### Migrations 99xxx (numérotation parallèle)

À partir de 2026, les nouvelles migrations utilisent une **numérotation 99xxx** pour éviter les collisions avec les commits parallèles sur plusieurs branches. Elles s'exécutent toutes après la séquence 000xx grâce au tri lexicographique.

| Migration | Description |
|-----------|-------------|
| `99014_password_reset_tokens.sql` | Table de tokens pour la réinitialisation de mot de passe |
| `99015_recalculate_null_dossier_status.sql` | Recalcul des `statut_dossier` à NULL pour les artisans existants |
| `99016_compta_checks_realtime.sql` | Activation Realtime sur `intervention_compta_checks` |
| `99017_artisan_telephone_unique.sql` | Contrainte d'unicité sur le téléphone artisan |
| `99018_rpc_get_public_tables.sql` | RPC d'introspection : liste des tables publiques (utilisée par le dashboard dev) |
| `99019_attachments_updated_at.sql` | Ajout/correction du trigger `updated_at` sur `attachments` |
| `99020_protect_expert_confirme_from_downgrade.sql` | Empêche un artisan `EXPERT_CONFIRME` d'être rétrogradé via update |
| `99021_search_add_owner_email_and_plain_noms.sql` | Étend la recherche full-text aux emails owner et aux versions "plain" des noms |
| `99022_rpc_get_sorted_intervention_ids.sql` | RPC retournant les IDs d'interventions triés selon les filtres serveur (pagination par ID) |
| `99023_intervention_compta_exclusions.sql` | Table d'exclusions comptables : interventions à exclure de la vue compta — **supprimée par 99029 (obsolète)** |
| `99024_hybrid_search_global.sql` | Recherche hybride globale (renommage / consolidation de l'ancienne `99018_hybrid_search_global`) |
| `99028_csv_import_composite_match.sql` | Import CSV : normalisation d'adresse IMMUTABLE, index composite `(agence, date, adresse)` et RPC `csv_intervention_import_resolve_by_composite` (résolution lecture-seule pour le match composite des interventions sans `id_inter`) |
| `99029_drop_intervention_compta_exclusions.sql` | Supprime la table `intervention_compta_exclusions` (99023), devenue code mort : plus aucun code applicatif ni objet SQL ne la référence |
| `99076_portal_demo_convergence.sql` | **Portail artisans** : `artisan_portal_tokens` (jetons hachés, `service_role` seulement), `artisan_reports` (rapport structuré, versions, `portal_report_id` unique), `interventions.has_portal_report`, `intervention_attachments.metadata`, `artisan_attachments.review_status` + `metadata`, trigger `trg_artisan_reports_sync_flag`. **Idempotente** : conçue pour passer sur la base locale (objets absents) et sur la production (objets créés par `00064`-`00069` de `depose_docs` : `token`/`content` passés nullable, CHECK de statut remplacé, FK `reviewed_by` → `public.users` en `NOT VALID`, policy `anon` supprimée, RPC historiques révoquées). Reprise des données de production **avant** les index uniques : renumérotation des versions par couple (intervention, artisan) dans l'ordre chronologique (`row_number()`, ne touche que les lignes en version 1/NULL), dédoublonnage de `portal_report_id` (seule la ligne la plus récente le conserve), hachage des jetons en clair (`digest(token,'sha256')`, pgcrypto) puis effacement du clair. Trigger `trg_artisan_reports_sync_flag` sur `INSERT`, `UPDATE OF status` **et `DELETE`**. Validée par simulation : DDL `00064`-`00069` + rapports/jetons legacy dans une transaction annulée, deux rejeux consécutifs |
| `99078_portal_v2_socle.sql` | **Portail artisans — vision v2, socle** : `artisan_reports` (`version` NOT NULL, état `superseded` au CHECK, `superseded_at`/`superseded_by`, `started_at`, index unique partiel `ux_artisan_reports_one_open` = au plus un rapport `submitted` par couple intervention/artisan) ; `intervention_artisans` (prix proposé/accepté avec montant **gelé**, refus et motif, `work_started_at` + source, `payment_status` et champs de paiement) ; **RLS + policies `authenticated` + `REVOKE ALL … FROM anon` sur `intervention_artisans`, dans la même migration** ; `artisan_attachments` (`reviewed_by`, `reviewed_at`, `review_comment`) ; `artisans` (`pieces_a_verifier`, `dossier_validated_at`, `dossier_validated_by`) ; `calculate_artisan_dossier_status` corrigée (seules les pièces validées comptent, via `COALESCE(review_status,'approved')`) ; `fn_artisan_dossier_sync` + `trg_artisan_dossier_sync` remplacent les **deux** triggers INSERT/DELETE de `00008` ; rattrapage du compteur existant. **Idempotente**, rejouée deux fois de suite sans erreur |
| `99079_artisan_portal_actions.sql` | **Portail artisans — journal d'actions** : table append-only `artisan_portal_actions` (acteur `artisan_id`/`actor_user_id`, `source` `portal`\|`crm`, `action_type` sous CHECK fermé, `payload` JSONB, deux horloges `occurred_at`/`recorded_at`, `event_uid` d'idempotence en index unique partiel). RLS activée, SELECT pour `authenticated`, tout pour `service_role`, `REVOKE ALL FROM anon` **et** `REVOKE ALL FROM authenticated` puis `GRANT SELECT` (l'immuabilité est applicative : un trigger `RAISE EXCEPTION` rendrait impossible la suppression d'un artisan ou d'une intervention à cause des FK `ON DELETE CASCADE`). **Aucun trigger, aucune publication temps réel** |

> **99022 — pagination par ID** : ce RPC est consommé par `useInterventionsQuery` pour résoudre l'ordre stable des interventions côté serveur, évitant les sauts de pagination quand les données mutent en temps réel pendant le scroll.
>
> **99023 — exclusions compta** *(obsolète, supprimée par 99029)* : table introduite pour cacher de la vue Comptabilité les interventions marquées comme à exclure. La fonctionnalité n'est plus câblée et la table était devenue du code mort (aucune référence applicative ni SQL).
>
> **99076 — convergence portail** : ne jamais copier `00064`-`00069` de `depose_docs` ; cette migration les remplace. Elle est rejouable (`psql -v ON_ERROR_STOP=1 -f`) et passe dans un `supabase db reset` local complet. Sur la production elle s'appliquera plus tard avec `supabase db push --linked` — **jamais pendant la démo locale** (aucune commande `--linked`, `db push`, `migration repair` ni `functions deploy` tant que `supabase/.temp` est retiré ; voir `docs/guides/demo-locale-portail.md`).
>
> **99078 / 99079 — socle de la vision v2 du portail** *(lot L0)* : spécification [portail-vision-spec.md](../architecture/portail-vision-spec.md) §3.1 et §3.2, plan [portail-vision-plan-lots.md](../guides/portail-vision-plan-lots.md). Deux points valent d'être retenus. **(1)** `intervention_artisans` n'avait ni RLS ni `REVOKE` alors que `00001:738-747` grante `ALL ON ALL TABLES` à `anon` et pose des `ALTER DEFAULT PRIVILEGES` : y poser `price_accepted_amount`, `paid_at` et `payment_status` sans la sécuriser aurait rendu le montant dû à chaque artisan lisible avec la clé anon. Les policies `authenticated` sont dans la **même** migration — motif `99057` : « RLS activée sans policy = deny-all », c'est l'incident de l'avatar artisan. **(2)** `calculate_artisan_dossier_status` s'écrit avec `COALESCE(review_status,'approved') = 'approved'` et jamais `review_status IN ('approved', NULL)` : en SQL, `x IN (…, NULL)` ne vaut jamais vrai pour `NULL`, et le CHECK de `99076` tolère `NULL` — écrite ainsi, la migration ferait basculer des dossiers aujourd'hui `COMPLET`. Non-régression couverte par `tests/integration/migrations/99078-socle.test.ts` et `tests/integration/security/anon-access.test.ts` (base **locale** uniquement).
>
> **99024 — recherche hybride** : combine la recherche trigramme (`pg_trgm`) et la recherche full-text sur les entités globales (interventions + artisans + clients). Renomme et remplace la migration `99018_hybrid_search_global` historique (cf. commit `feat : rename hybrid search`).

---

## Bonnes pratiques

### Idempotence

Toutes les migrations doivent être idempotentes. Utiliser les patterns :

```sql
-- Tables
CREATE TABLE IF NOT EXISTS ...

-- Colonnes (via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ma_table' AND column_name = 'ma_colonne') THEN
    ALTER TABLE public.ma_table ADD COLUMN ma_colonne text;
  END IF;
END $$;

-- Policies
DROP POLICY IF EXISTS ... ;
CREATE POLICY ... ;

-- Fonctions
CREATE OR REPLACE FUNCTION ... ;

-- Triggers
DROP TRIGGER IF EXISTS ... ;
CREATE TRIGGER ... ;

-- Données
INSERT INTO ... ON CONFLICT ... DO NOTHING;
```

### Performance

- Toujours ajouter des index sur les colonnes utilisées dans les WHERE et les jointures
- Utiliser `CONCURRENTLY` pour les index sur les tables volumineuses en production
- Préférer `jsonb` a `json` pour les colonnes JSON

### Documentation

- Ajouter des `COMMENT ON` sur les tables et colonnes non évidentes
- Inclure un en-tête avec version, date et description
- Documenter le "pourquoi" des migrations de correction (fix_*)


## Leçons du socle portail v2 (revue du 2026-09-05)

Cinq pièges vérifiés en local, à relire avant d'écrire une migration dans ce dépôt.

1. **`DROP FUNCTION` + `CREATE FUNCTION` rend les privilèges par défaut.** Les
   `ALTER DEFAULT PRIVILEGES` de `00001` regrantent `EXECUTE` à `anon` (et `PUBLIC` garde son
   `=X` de toute façon). Toute fonction, *a fortiori* `SECURITY DEFINER`, doit être suivie d'un
   `REVOKE ALL … FROM PUBLIC, anon` + `GRANT EXECUTE … TO authenticated, service_role`.
   `ALTER DEFAULT PRIVILEGES` ferme les **tables** futures, jamais les **fonctions**.
2. **`REVOKE ALL` puis `GRANT` des verbes voulus**, jamais `REVOKE SELECT, INSERT, UPDATE,
   DELETE` : ce dernier laisse `TRUNCATE` (`D`) et `TRIGGER` (`t`), et `TRUNCATE` ne passe par
   aucune policy RLS.
3. **`ENABLE ROW LEVEL SECURITY` et ses policies vont dans la MÊME migration** (motif `99057`) :
   RLS sans policy = deny-all = lockout client.
4. **Une garde « anti-écriture inutile » doit couvrir *toutes* les colonnes que l'UPDATE pose.**
   Dans `fn_artisan_dossier_sync`, la garde ne testait que deux colonnes sur trois : la
   troisième (`dossier_validated_at`) est restée `NULL` pour tout l'existant.
5. **Un rattrapage de données se fait par sous-requête corrélée, pas par jointure interne** :
   une jointure ne voit que les lignes qui ont une correspondance, donc jamais les compteurs
   orphelins à remettre à zéro. Et quand une migration **change la règle de calcul** d'une
   colonne dénormalisée, elle doit la recalculer (`99015:47-49` le faisait déjà).

Contrainte de nommage vérifiée au passage : ne jamais `DROP CONSTRAINT` par son nom quand la
table ne naît pas de ce dépôt (`artisan_reports` vient de `depose_docs`). Parcourir
`pg_constraint` et supprimer la contrainte qui porte sur la colonne visée.
