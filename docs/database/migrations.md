# Migrations de base de données

> Guide pour la création et la gestion des migrations SQL dans GMBS-CRM via Supabase.

---

## Vue d'ensemble

Le projet utilise le système de migrations de **Supabase CLI**. Les fichiers SQL se trouvent dans `supabase/migrations/` et sont exécutés séquentiellement par ordre de nom de fichier.

**Total actuel : 82 migrations** (00001 a 00082, avec quelques numéros manquants).

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
