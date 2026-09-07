# Politiques Row Level Security (RLS)

> Documentation des politiques de sécurité au niveau des lignes dans GMBS-CRM.

---

## Vue d'ensemble

Supabase utilise les **Row Level Security (RLS)** de PostgreSQL pour contrôler l'accès aux données au niveau de chaque ligne. Les policies sont définies dans les migrations :
- `supabase/migrations/00012_rls_policies.sql` : tables billing et chat
- `supabase/migrations/00041_rls_core_tables.sql` : tables coeur (users, artisans, interventions)
- `supabase/migrations/00042_user_permissions.sql` : table user_permissions
- `supabase/migrations/99076_rls_unify_identity_and_restore_user_tables.sql` : resolution d'identite unifiee + user_preferences, intervention_reminders, email_logs
- `supabase/migrations/99077_rls_lock_remaining_public_tables.sql` : tables restantes du schema public (zones, artisan_metiers, agency_config, tables sans acces applicatif, archives)

**Note importante :** La plupart des API routes utilisent le client Supabase en mode `service_role` (via `getSupabaseClientForNode()`), ce qui **bypass les RLS**. Les policies protègent principalement :
1. L'accès direct depuis le client frontend (Supabase JS)
2. L'accès via PostgREST
3. Les futures migrations vers un client authentifié

---

## Fonctions helper

Trois fonctions SQL `SECURITY DEFINER` servent de base aux policies :

### get_public_user_id()

Resout `auth.uid()` (Supabase Auth) vers `public.users.id`. C'est le **point
d'entree unique** de cette traduction : toute nouvelle policy doit passer par
elle, jamais comparer `auth.uid()` directement a une colonne referencant
`public.users(id)`.

> **Pourquoi c'est necessaire** : dans ce projet `auth.users.id` != `public.users.id`
> pour la majorite des comptes (10 sur 32 seulement coincident). Une policy du
> type `USING (auth.uid() = user_id)` est donc silencieusement fausse : elle ne
> renvoie aucune ligne et bloque l'utilisateur. C'est ce qui avait casse
> `user_preferences` et `email_logs`.

Depuis `99076`, la fonction essaie **trois** chemins de resolution dans l'ordre,
car trois mecanismes de liaison coexistent historiquement et aucun ne couvre
l'ensemble des comptes a lui seul :

| Ordre | Source | Introduit par |
|-------|--------|---------------|
| 1 | `auth_user_mapping.auth_user_id` | `00041` |
| 2 | `users.auth_user_id` | `00031` |
| 3 | Email, compare en `lower()` | repli |

```sql
CREATE OR REPLACE FUNCTION public.get_public_user_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT m.public_user_id FROM public.auth_user_mapping m
      WHERE m.auth_user_id = auth.uid() LIMIT 1),
    (SELECT u.id FROM public.users u
      WHERE u.auth_user_id = auth.uid() LIMIT 1),
    (SELECT u.id FROM public.users u
       JOIN auth.users au ON lower(au.email) = lower(u.email)
      WHERE au.id = auth.uid() LIMIT 1)
  );
$$;
```

### get_current_user_id()

Alias historique introduit par `00031`, qui resolvait uniquement via
`users.auth_user_id`. Depuis `99076` il **delegue** a `get_public_user_id()`,
afin qu'il n'existe plus qu'une seule logique de resolution. Conserve pour les
policies existantes qui l'appellent ; ne pas utiliser dans du nouveau code.

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

### user_preferences

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `Users can view their own preferences` | SELECT | `user_id = get_public_user_id()` |
| `Users can insert their own preferences` | INSERT | `user_id = get_public_user_id()` |
| `Users can update their own preferences` | UPDATE | `user_id = get_public_user_id()` (USING **et** WITH CHECK) |

Accès applicatif uniquement via `app/api/user-preferences/route.ts` en
`service_role` : ces policies sont de la défense en profondeur contre un accès
PostgREST direct.

### intervention_reminders

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `Users can view own reminders and mentions` | SELECT | Propriétaire **ou** mentionné dans `mentioned_user_ids` |
| `Users can create own reminders` | INSERT | `user_id = get_public_user_id()` |
| `Users can update own reminders` | UPDATE | Propriétaire (USING **et** WITH CHECK) |
| `Users can delete own reminders` | DELETE | Propriétaire |

Table lue **depuis le navigateur** avec la clé anon (`src/lib/api/remindersApi.ts`) :
la RLS est ici une vraie frontière de sécurité. Elle s'applique aussi aux
abonnements Realtime (`src/lib/realtime/realtime-client.ts`), qui ne remontent
donc que les rappels visibles par l'utilisateur.

### email_logs

| Policy | Opération | Condition |
|--------|-----------|-----------|
| `email_logs_read_all_authenticated` | SELECT | Tous authentifiés |
| `email_logs_insert_authenticated` | INSERT | Tous authentifiés |

Lecture volontairement ouverte à tous les authentifiés : l'historique des envois
d'une intervention (`src/hooks/useEmailLogs.ts`) affiche les emails de toute
l'équipe, pas seulement les siens. Restreindre par `sent_by` masquerait les
envois des collègues. La protection utile est l'exclusion du rôle `anon`.

### Tables de jonction et configuration (99077)

Tables atteintes depuis le navigateur : CRUD complet pour `authenticated`,
aucun accès pour `anon`.

| Table | Policies | Pourquoi ce périmètre |
|-------|----------|------------------------|
| `zones` | `zones_*_authenticated` (SELECT/INSERT/UPDATE/DELETE) | Lue et écrite par `enumsApi.ts` ; une zone inédite est créée à la volée lors de la création d'un artisan ou d'un import — une policy admin-only casserait ce parcours |
| `artisan_metiers` | `artisan_metiers_*_authenticated` | Jonction lue en embed par `artisans-crud.ts` et `searchApi.ts` ; même jeu que sa sœur `artisan_zones` |
| `agency_config` | `agency_config_select/insert/update_authenticated`, `agency_config_delete_admin` | `agenciesApi.updateRequiresReference()` fait un **upsert** : INSERT et UPDATE sont tous deux requis, sinon l'upsert échoue |

### Tables sans accès applicatif (99077)

`tasks`, `task_statuses`, `sync_logs`, `podium_periods`, ainsi que les archives
`_pr2_archive_*` et `user_page_sessions_cleanup_backup`.

RLS activée **sans aucune policy** : deny-all pour `anon` comme pour
`authenticated`, seul le `service_role` y accède. C'est volontaire et sûr ici
précisément parce qu'aucun code applicatif ne les lit. Ne pas reproduire ce
schéma sur une table utilisée par l'app.

Le Supabase Advisor signalera ces tables en `rls_enabled_no_policy` (niveau
INFO) : c'est attendu, et préférable à l'alerte critique inverse.

### search_views_refresh_flags — le cas mixte

Deux chemins d'accès, deux traitements différents, et c'est instructif :

| Accès | Nature | Traitement | Symptôme si on se trompe |
|-------|--------|------------|--------------------------|
| `flag_interventions_search_refresh()`, `flag_artisans_search_refresh()` | Écriture par trigger | Fonctions passées en `SECURITY DEFINER` | L'`UPDATE` touche 0 ligne **sans erreur** : les vues matérialisées cessent d'être rafraîchies, la recherche renvoie des résultats périmés |
| `search_global()` (`99073:506`, `STABLE`, non `SECURITY DEFINER`) | Lecture de `last_refresh` | Policy `SELECT` pour `authenticated` | Lecture vide → repli sur `1970-01-01` → la branche « live » scanne toutes les tables à chaque recherche |

Règle générale qui s'en dégage : **pour une écriture, `SECURITY DEFINER` sur la
fonction ; pour une lecture, une policy `SELECT`.** La seconde accorde beaucoup
moins de privilèges, et cette table ne contient que des booléens et des
horodatages.

À l'inverse `podium_periods` n'a rien demandé : `get_current_podium_period()`,
malgré son nom, est un calcul pur sur `now()` et ne lit pas la table. Vérifier
le corps d'une fonction plutôt que se fier à son nom.

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

Pour les données personnelles (préférences, rappels) :

```sql
CREATE POLICY table_owner_rw ON table
  FOR ALL TO authenticated
  USING (user_id = public.get_public_user_id())
  WITH CHECK (user_id = public.get_public_user_id());
```

> **Ne jamais écrire `user_id = auth.uid()`** quand `user_id` référence
> `public.users(id)`. Les deux identifiants diffèrent pour la majorité des
> comptes : la policy est alors silencieusement fausse, ne renvoie aucune ligne
> et bloque l'utilisateur sans message d'erreur explicite. Toujours passer par
> `get_public_user_id()`. Un cast `::text` pour faire taire une erreur de type
> ne résout rien — c'est le symptôme de cette confusion.
>
> Seule exception : les tables billing/chat héritées (`payment_methods`,
> `subscriptions`, `chat_sessions`…), dont le `user_id` désigne directement un
> compte `auth.users`. Elles relèvent d'un modèle SaaS non utilisé par le CRM ;
> vérifier leur état réel avant de s'en inspirer.

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

### Points de vigilance

- **Toujours préciser `TO authenticated`.** Sans clause de rôle, la policy
  s'applique aussi à `anon`, c'est-à-dire à la clé publique embarquée dans le
  bundle JS.
- **Une policy UPDATE a besoin de `USING` *et* `WITH CHECK`.** `USING` filtre
  les lignes modifiables, `WITH CHECK` valide le résultat : sans lui, un
  utilisateur peut réaffecter sa ligne à quelqu'un d'autre.
- **RLS activée sans aucune policy = deny-all.** C'est le piège qui avait vidé
  les avatars artisans (cf. `99057`).
- **Vérifier les triggers.** Si un trigger écrit dans une table annexe (cache,
  log, flags, transitions), sa fonction doit être `SECURITY DEFINER` avec
  `search_path` figé. Attention à la forme de l'échec, qui diffère selon
  l'opération : un `INSERT` refusé lève une erreur `42501` bien visible, mais
  un `UPDATE` refusé **ne lève rien** — il touche simplement 0 ligne. Une table
  de flags ou de cache mise à jour par trigger se fige donc en silence, et le
  symptôme apparaît ailleurs, longtemps après (cf. `search_views_refresh_flags`
  dans `99077`).
- **Vérifier les embeds PostgREST.** Un `select('*, sender:users(...)')` exige
  une policy SELECT sur la table jointe, sinon l'embed renvoie `null` en
  silence.
- **Realtime applique la RLS.** Restreindre une policy SELECT restreint aussi
  les évènements reçus par les abonnements.
