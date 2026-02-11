# Politiques Row Level Security (RLS)

> Documentation des politiques de sécurité au niveau des lignes dans GMBS-CRM.

---

## Vue d'ensemble

Supabase utilise les **Row Level Security (RLS)** de PostgreSQL pour contrôler l'accès aux données au niveau de chaque ligne. Les policies sont définies dans les migrations :
- `supabase/migrations/00012_rls_policies.sql` : tables billing et chat
- `supabase/migrations/00041_rls_core_tables.sql` : tables coeur (users, artisans, interventions)
- `supabase/migrations/00042_user_permissions.sql` : table user_permissions

**Note importante :** La plupart des API routes utilisent le client Supabase en mode `service_role` (via `getSupabaseClientForNode()`), ce qui **bypass les RLS**. Les policies protègent principalement :
1. L'accès direct depuis le client frontend (Supabase JS)
2. L'accès via PostgREST
3. Les futures migrations vers un client authentifié

---

## Fonctions helper

Trois fonctions SQL `SECURITY DEFINER` servent de base aux policies :

### get_public_user_id()

Résout `auth.uid()` (Supabase Auth) vers `public.users.id` :

```sql
CREATE OR REPLACE FUNCTION public.get_public_user_id()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER STABLE
AS $$
BEGIN
  -- 1. Essai via auth_user_mapping (rapide)
  SELECT public_user_id INTO v_public_user_id
  FROM public.auth_user_mapping
  WHERE auth_user_id = auth.uid();

  -- 2. Fallback par email
  IF v_public_user_id IS NULL THEN
    SELECT id INTO v_public_user_id
    FROM public.users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid());
  END IF;

  RETURN v_public_user_id;
END;
$$;
```

### user_has_role(role_name text)

Vérifie si l'utilisateur courant possède un rôle spécifique :

```sql
-- Usage dans les policies :
USING (public.user_has_role('admin'))
```

### user_has_any_role(role_names text[])

Vérifie si l'utilisateur possède au moins l'un des rôles listés :

```sql
-- Usage dans les policies :
WITH CHECK (public.user_has_any_role(ARRAY['admin', 'manager', 'gestionnaire']))
```

---

## Policies par table

### users

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `users_select_authenticated` | SELECT | Tous les utilisateurs authentifiés |
| `users_insert_admin` | INSERT | Admin uniquement |
| `users_update_self_or_admin` | UPDATE | Soi-même ou admin |
| `users_delete_admin` | DELETE | Admin uniquement |

**Principe :** Tout le monde peut lire les utilisateurs (nécessaire pour les sélecteurs et l'affichage), mais seul l'admin peut en créer ou supprimer. Chaque utilisateur peut modifier son propre profil.

### artisans

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `artisans_select_authenticated` | SELECT | Tous authentifiés |
| `artisans_insert_authorized` | INSERT | admin, manager, gestionnaire |
| `artisans_update_authorized` | UPDATE | admin, manager, gestionnaire |
| `artisans_delete_admin` | DELETE | Admin uniquement |

### interventions

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `interventions_select_authenticated` | SELECT | Tous authentifiés |
| `interventions_insert_authorized` | INSERT | admin, manager, gestionnaire |
| `interventions_update_authorized` | UPDATE | admin, manager, gestionnaire |
| `interventions_delete_admin` | DELETE | Admin uniquement |

### user_roles

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `user_roles_select_authenticated` | SELECT | Tous authentifiés (affichage rôles) |
| `user_roles_insert_admin` | INSERT | Admin uniquement |
| `user_roles_update_admin` | UPDATE | Admin uniquement |
| `user_roles_delete_admin` | DELETE | Admin uniquement |

### user_permissions

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `user_permissions_select_own` | SELECT | Soi-même ou admin |
| `user_permissions_insert_admin` | INSERT | Admin uniquement |
| `user_permissions_update_admin` | UPDATE | Admin uniquement |
| `user_permissions_delete_admin` | DELETE | Admin uniquement |

### user_page_permissions

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `user_page_permissions_select` | SELECT | Soi-même ou admin |
| `user_page_permissions_insert_admin` | INSERT | Admin uniquement |
| `user_page_permissions_update_admin` | UPDATE | Admin uniquement |
| `user_page_permissions_delete_admin` | DELETE | Admin uniquement |

### Tables de référence (roles, permissions, role_permissions, metiers, agencies, intervention_statuses, artisan_statuses)

Pattern commun pour toutes les tables de référence :

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `*_select_authenticated` | SELECT | Tous authentifiés |
| `*_modify_admin` | ALL (insert/update/delete) | Admin uniquement |

### Tables billing et chat

| Table | Policy | Condition |
|-------|--------|-----------|
| `payment_methods` | `pm_owner_rw` | Propriétaire uniquement (`user_id = auth.uid()`) |
| `subscriptions` | `subs_owner_r` / `subs_owner_w` | Propriétaire (lecture + insertion) |
| `orders` | `orders_owner_r` | Propriétaire (lecture seule) |
| `usage_events` | `usage_owner_ri` / `usage_owner_i` | Propriétaire (lecture + insertion) |
| `billing_state` | `billing_owner_r` / `billing_owner_w` | Propriétaire |
| `chat_sessions` | `chat_sessions_owner_rw` | Propriétaire |
| `chat_messages` | `chat_messages_owner_rw` | Auteur ou propriétaire de la session |

---

## Matrice de droits par rôle

| Table | viewer | gestionnaire | manager | admin |
|-------|--------|-------------|---------|-------|
| users | SELECT | SELECT | SELECT | ALL |
| artisans | SELECT | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ALL |
| interventions | SELECT | SELECT, INSERT, UPDATE | SELECT, INSERT, UPDATE | ALL |
| roles/permissions | SELECT | SELECT | SELECT | ALL |
| user_roles | SELECT | SELECT | SELECT | ALL |
| metiers/agencies | SELECT | SELECT | SELECT | ALL |

---

## Patterns de sécurité

### Pattern "Lecture ouverte, écriture restreinte"

La majorité des tables CRM suivent ce pattern : tous les utilisateurs authentifiés peuvent lire, mais l'écriture est restreinte par rôle.

```sql
-- Lecture : tous authentifiés
CREATE POLICY table_select_authenticated ON table
  FOR SELECT TO authenticated
  USING (true);

-- Écriture : rôles autorisés
CREATE POLICY table_insert_authorized ON table
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(ARRAY['admin', 'manager', 'gestionnaire']));
```

### Pattern "Propriétaire uniquement"

Pour les données personnelles (billing, chat) :

```sql
CREATE POLICY table_owner_rw ON table
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### Pattern "Soi-même ou admin"

Pour les données de profil :

```sql
CREATE POLICY table_update_self_or_admin ON table
  FOR UPDATE TO authenticated
  USING (
    id = public.get_public_user_id()
    OR public.user_has_role('admin')
  );
```

---

## Considérations de performance

- Les fonctions helper sont déclarées `STABLE` pour optimiser le caching du query planner
- `SECURITY DEFINER` permet aux fonctions d'accéder aux tables de rôles sans RLS récursif
- La table `auth_user_mapping` est indexée sur `auth_user_id` pour la résolution rapide
- Le fallback par email dans `get_public_user_id()` n'est utilisé que si le mapping n'existe pas

---

## Ajouter une policy RLS

Pour une nouvelle table nécessitant une protection RLS :

```sql
-- 1. Activer RLS
ALTER TABLE public.ma_table ENABLE ROW LEVEL SECURITY;

-- 2. Policy de lecture
DROP POLICY IF EXISTS ma_table_select_authenticated ON public.ma_table;
CREATE POLICY ma_table_select_authenticated ON public.ma_table
  FOR SELECT TO authenticated
  USING (true);  -- ou condition plus restrictive

-- 3. Policy d'écriture
DROP POLICY IF EXISTS ma_table_insert_authorized ON public.ma_table;
CREATE POLICY ma_table_insert_authorized ON public.ma_table
  FOR INSERT TO authenticated
  WITH CHECK (public.user_has_any_role(ARRAY['admin', 'manager', 'gestionnaire']));

-- 4. Policy de suppression (admin only)
DROP POLICY IF EXISTS ma_table_delete_admin ON public.ma_table;
CREATE POLICY ma_table_delete_admin ON public.ma_table
  FOR DELETE TO authenticated
  USING (public.user_has_role('admin'));
```
