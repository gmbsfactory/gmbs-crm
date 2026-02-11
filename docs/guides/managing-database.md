# Gerer la base de donnees

Guide pour travailler avec la base de donnees Supabase (PostgreSQL) : migrations, types generes, seeds et maintenance.

---

## Table des matieres

1. [Architecture de la base](#1-architecture-de-la-base)
2. [Migrations](#2-migrations)
3. [Creer une migration](#3-creer-une-migration)
4. [Types generes](#4-types-generes)
5. [Seeds](#5-seeds)
6. [Row Level Security (RLS)](#6-row-level-security-rls)
7. [Patterns SQL courants](#7-patterns-sql-courants)
8. [Maintenance](#8-maintenance)

---

## 1. Architecture de la base

### Tables principales

```
-- Users & Auth
users                       # Profils utilisateurs
auth_user_mapping           # Lien auth.users <-> public.users
roles / permissions         # RBAC
user_roles / role_permissions
user_permissions            # Overrides par utilisateur
user_page_permissions       # Acces par page

-- Donnees de reference
metiers                     # 22 metiers (Plomberie, Electricite, etc.)
zones                       # 10 zones geographiques
agencies                    # Agences
artisan_statuses            # 9 statuts artisan
intervention_statuses       # 11 statuts intervention

-- Artisans
artisans                    # Profils artisans (sous-traitants)
artisan_metiers             # Relation artisan <-> metiers
artisan_zones               # Relation artisan <-> zones
artisan_statuses_history    # Historique des changements de statut

-- Interventions
interventions               # Ordres de travaux
intervention_artisans       # Relation intervention <-> artisans (primary/secondary)
intervention_costs          # Couts (CA, SST, materiel)
intervention_payments       # Paiements
intervention_audit_log      # Historique des modifications

-- Support
comments                    # Commentaires (polymorphe : intervention/artisan)
documents                   # Documents (stockage Supabase Storage)
clients / tenants / owners  # Clients, locataires, proprietaires
gestionnaire_targets        # Objectifs par gestionnaire
```

### Diagramme de relations

```
users ──┬── intervention.assigned_user_id
        ├── comments.created_by
        └── intervention_audit_log.actor_id

interventions ──┬── intervention_artisans (1:N)
                ├── intervention_costs (1:N)
                ├── intervention_payments (1:N)
                ├── comments (polymorphe entity_type='intervention')
                └── documents (polymorphe entity_type='intervention')

artisans ──┬── artisan_metiers (N:M via table pivot)
           ├── artisan_zones (N:M via table pivot)
           └── artisan_statuses_history (1:N)
```

---

## 2. Migrations

### Structure

Les migrations sont stockees dans `supabase/migrations/` avec un prefixe numerique :

```
supabase/migrations/
  00001_clean_schema.sql
  00002_ai_views.sql
  00003_user_features.sql
  ...
  00082_touch_intervention_on_child_change.sql
```

**82 migrations** au total, executees dans l'ordre numerique.

### Exemples de migrations recentes

**00082 - Triggers sur tables enfants :**

```sql
-- Quand un cout, paiement, artisan ou commentaire change,
-- mettre a jour updated_at de l'intervention parente.
-- Cela declenche Realtime sur le canal `interventions`.

CREATE OR REPLACE FUNCTION touch_intervention_on_child_change()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE interventions
  SET updated_at = NOW()
  WHERE id = COALESCE(NEW.intervention_id, OLD.intervention_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_intervention_on_cost_change
  AFTER INSERT OR UPDATE OR DELETE ON intervention_costs
  FOR EACH ROW EXECUTE FUNCTION touch_intervention_on_child_change();
```

**00050 - Ajout colonne :**

```sql
ALTER TABLE users ADD COLUMN avatar_url TEXT;
```

**00037 - Systeme d'audit :**

```sql
CREATE TABLE intervention_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  intervention_id UUID NOT NULL REFERENCES interventions(id),
  action_type TEXT NOT NULL,
  changed_fields JSONB,
  old_values JSONB,
  new_values JSONB,
  actor_id UUID REFERENCES users(id),
  actor_type TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_intervention ON intervention_audit_log(intervention_id);
CREATE INDEX idx_audit_log_created ON intervention_audit_log(created_at DESC);
```

---

## 3. Creer une migration

### Etape 1 : Creer le fichier

Nommer le fichier avec le prochain numero sequentiel :

```bash
# Verifier le dernier numero
ls supabase/migrations/ | sort -n | tail -1
# 00082_touch_intervention_on_child_change.sql

# Creer la prochaine migration
touch supabase/migrations/00083_ma_migration.sql
```

### Etape 2 : Ecrire le SQL

```sql
-- Migration 00083: Description courte
--
-- Purpose: Explication de ce que fait la migration
-- Tables affected: liste des tables

-- Ajouter une colonne
ALTER TABLE artisans ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2);

-- Creer un index
CREATE INDEX IF NOT EXISTS idx_artisans_rating ON artisans(rating)
WHERE rating IS NOT NULL;

-- Creer une fonction
CREATE OR REPLACE FUNCTION update_artisan_rating()
RETURNS TRIGGER AS $$
BEGIN
  -- Logique
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Creer un trigger
CREATE TRIGGER trg_update_artisan_rating
  AFTER INSERT ON intervention_costs
  FOR EACH ROW EXECUTE FUNCTION update_artisan_rating();
```

### Etape 3 : Appliquer la migration

```bash
# En local via Supabase CLI
npx supabase db push

# Ou via la console Supabase (SQL Editor)
# Copier-coller le contenu de la migration
```

### Etape 4 : Regenerer les types

```bash
npm run types:generate
```

### Bonnes pratiques pour les migrations

- Utiliser `IF NOT EXISTS` / `IF EXISTS` pour l'idempotence
- Commenter le but de la migration en en-tete
- Lister les tables affectees
- Tester sur un environnement de staging avant production
- Ne jamais modifier une migration deja appliquee en production : creer une nouvelle migration corrective

---

## 4. Types generes

### Generer les types depuis la base

```bash
npm run types:generate
```

Cela genere `src/lib/database.types.ts` avec les types TypeScript correspondant au schema de la base.

### Utilisation

```typescript
// Les types generes sont utilises dans les modules API
import type { Database } from "@/lib/database.types"

type InterventionRow = Database["public"]["Tables"]["interventions"]["Row"]
type InterventionInsert = Database["public"]["Tables"]["interventions"]["Insert"]
type InterventionUpdate = Database["public"]["Tables"]["interventions"]["Update"]
```

### Types manuels vs generes

Le projet utilise aussi des types manuels enrichis dans `src/types/` :

```typescript
// src/types/intervention-generated.ts
// Types qui etendent les types generes avec des relations
interface Intervention extends InterventionRow {
  artisans?: string[]
  costs?: InterventionCost[]
  payments?: InterventionPayment[]
}
```

**Regle :** Utiliser les types generes pour les operations base de donnees directes, et les types manuels pour les objets metier enrichis.

---

## 5. Seeds

### Fichiers de seed

```
supabase/seeds/
  seed.sql                    # Seed principal (reference data)
  seed_essential.sql          # Donnees essentielles
  seed_mockup.sql             # Donnees de test
  seed_admin_auth.sql         # Configuration admin
  seed_agency_config.sql      # Configuration agences
  seed_default_performance.sql # Objectifs par defaut
  init_default_targets.sql    # Targets gestionnaires
  seed-from-sheets.js         # Import depuis Google Sheets
  ajout_interventions_test.sql # Interventions de test
```

### Donnees de reference (seed principal)

Le seed principal insere :

- **13 utilisateurs GMBS** (admin, badr, andrea, olivier, tom, paul, etc.)
- **22 metiers** (Plomberie, Electricite, Chauffage, Serrurerie, etc.)
- **10 zones** (Paris, Lyon, Marseille, Bordeaux, etc.)
- **9 statuts artisan** (Candidat, Valide, Expert, One Shot, Inactif, Archive, etc.)
- **11 statuts intervention** (Demande, Devis Envoye, Visite Technique, Accepte, etc.)
- **4 roles** (admin, manager, gestionnaire, viewer)
- **Permissions** associees a chaque role

### Executer un seed

```bash
# Via Supabase CLI
npx supabase db seed

# Via SQL Editor (console Supabase)
# Copier-coller le contenu du fichier seed

# Import depuis Google Sheets
npm run import:all
npm run import:interventions
npm run import:artisans
```

---

## 6. Row Level Security (RLS)

### Politique RLS

Les RLS policies sont definies dans la migration `00012_rls_policies.sql` et `00041_rls_core_tables.sql`.

```sql
-- Exemple : les utilisateurs ne voient que les interventions de leur agence
CREATE POLICY "Users can view own agency interventions"
ON interventions FOR SELECT
USING (
  agence_id IN (
    SELECT agency_id FROM user_agencies WHERE user_id = auth.uid()
  )
);
```

### Client Supabase et RLS

| Contexte | Client | RLS |
|----------|--------|-----|
| Browser (composants) | Anon key + token session | Applique |
| API Routes Next.js | Service role key | Bypass |
| Edge Functions | Service role key | Bypass |

```typescript
// Browser : soumis au RLS
import { supabase } from "@/lib/supabase-client"

// Node.js (API routes) : bypass RLS
import { supabaseAdmin } from "@/lib/supabase-admin"

// Dynamique : detecte automatiquement l'environnement
import { getSupabaseClientForNode } from "@/lib/api/v2/common/client"
```

---

## 7. Patterns SQL courants

### Triggers `updated_at`

Chaque table principale a un trigger qui met a jour `updated_at` automatiquement :

```sql
-- Migration 00007_triggers_updated_at.sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_interventions_updated_at
  BEFORE UPDATE ON interventions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Soft delete

Les utilisateurs ne sont jamais supprimes physiquement :

```sql
-- Migration 00057_add_user_soft_delete_columns.sql
ALTER TABLE users ADD COLUMN delete_date TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN deleted_by UUID REFERENCES users(id);

-- Migration 00058_add_archived_user_status.sql
-- Le statut 'archived' indique un utilisateur soft-deleted
```

### Fonctions RPC (PostgreSQL)

Pour les operations complexes, le projet utilise des fonctions PostgreSQL appelees via `supabase.rpc()` :

```sql
-- Exemple : historique d'intervention paginee
CREATE OR REPLACE FUNCTION get_intervention_history(
  p_intervention_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  action_type TEXT,
  changed_fields JSONB,
  actor_name TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ial.id,
    ial.action_type,
    ial.changed_fields,
    COALESCE(u.firstname || ' ' || u.lastname, 'Systeme') as actor_name,
    ial.created_at
  FROM intervention_audit_log ial
  LEFT JOIN users u ON ial.actor_id = u.id
  WHERE ial.intervention_id = p_intervention_id
  ORDER BY ial.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
```

Appel cote client :

```typescript
const { data } = await supabase.rpc("get_intervention_history", {
  p_intervention_id: interventionId,
  p_limit: 20,
  p_offset: 0,
})
```

---

## 8. Maintenance

### Commandes utiles

```bash
# Regenerer les types TypeScript depuis la base
npm run types:generate

# Deployer les Edge Functions
npm run deploy:functions

# Recalculer les statuts artisans
npm run recalculate:artisan-statuses
npm run recalculate:single-artisan -- --id=<uuid>

# Import/Export
npm run import:all
npm run export:to-excel
npm run export:interventions-csv
```

### Verifier l'etat de la base

```sql
-- Nombre d'interventions par statut
SELECT is2.code, COUNT(*)
FROM interventions i
JOIN intervention_statuses is2 ON i.statut_id = is2.id
WHERE i.is_active = true
GROUP BY is2.code
ORDER BY COUNT(*) DESC;

-- Utilisateurs actifs (vus dans les dernieres 24h)
SELECT username, status, last_seen_at
FROM users
WHERE last_seen_at > NOW() - INTERVAL '24 hours'
ORDER BY last_seen_at DESC;
```

### Sauvegardes

Les sauvegardes sont gerees automatiquement par Supabase (plan Pro). Pour un backup manuel :

```bash
# Via Supabase CLI
npx supabase db dump -f backup.sql
```
