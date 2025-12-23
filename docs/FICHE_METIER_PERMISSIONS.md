# FICHE MÉTIER - SYSTÈME DE PERMISSIONS GMBS CRM

## ⚠️ POINT CRITIQUE: Architecture des permissions

**Les permissions utilisateur (user_permissions) sont le chef d'orchestre, pas les rôles.**

- Les rôles servent uniquement à donner un "template" de permissions par défaut via `role_permissions`
- Les permissions effectives d'un utilisateur = `role_permissions` + `user_permissions` (overrides)
- Les overrides utilisateur (`user_permissions`) prennent TOUJOURS la priorité
- La fonction DB `user_has_permission(user_id, permission_key)` calcule cela correctement
- **Problème actuel**: `requirePermission()` dans `src/lib/api/permissions.ts` utilise uniquement les rôles, ignorants les overrides `user_permissions`

---

## 📋 LISTE COMPLÈTE DES PERMISSIONS

### 🔍 INTERVENTIONS

#### `read_interventions`
**Description**: Lire/voir les interventions

**Impact UI actuel**: ❌ AUCUN
- La page `/interventions` est accessible à tous les utilisateurs authentifiés
- Pas de vérification de permission côté UI

**Impact API actuel**: ❌ AUCUN
- `GET /api/interventions` → aucune vérification
- Routes API utilisent `supabaseAdmin` (bypass RLS)

**Où devrait être utilisé**:
- [ ] Masquer le lien "Interventions" dans sidebar/topbar si pas de permission
- [ ] Empêcher l'accès à `/interventions` si pas de permission
- [ ] `GET /api/interventions` devrait vérifier `user_has_permission(userId, 'read_interventions')`

---

#### `write_interventions`
**Description**: Créer/modifier des interventions

**Impact UI actuel**: ❌ AUCUN
- Bouton "Nouvelle intervention" visible pour tous
- Formulaires d'édition accessibles à tous
- Pas de `PermissionGate` ou `can()` check sur les boutons

**Impact API actuel**: ⚠️ PARTIEL
- `POST /api/interventions` → aucune vérification
- `PATCH /api/interventions/[id]` → vérifie seulement si admin pour modifier contexte, mais pas la permission `write_interventions`
- `POST /api/interventions/[id]/status` → aucune vérification

**Où devrait être utilisé**:
- [ ] `PermissionGate permission="write_interventions"` sur le bouton "Nouvelle intervention" de la topbar de la page intervention
- [ ] Désactiver/masquer les boutons d'édition dans les formulaires si pas de permission (tablevue de intervention icone oeil)
- [ ] `POST /api/interventions` → `requireUserPermission(userId, 'write_interventions')` 
- [ ] `PATCH /api/interventions/[id]` → `requireUserPermission(userId, 'write_interventions')`

---

#### `delete_interventions`
**Description**: Supprimer des interventions

**Impact UI actuel**: ❌ AUCUN
- Option "Supprimer" dans le menu contextuel visible pour tous
- Pas de `can("delete_interventions")` check

**Impact API actuel**: ❌ AUCUN
- `DELETE /api/interventions/[id]` → aucune vérification

**Où devrait être utilisé**:
- [ ] `PermissionGate permission="delete_interventions"` sur l'option "Supprimer" dans `InterventionContextMenu.tsx` (retirer l'option dans l'ui du context_menu serai le plus judicieux)
- [ ] `DELETE /api/interventions/[id]` → `requireUserPermission(userId, 'delete_interventions')`

---

#### `edit_closed_interventions`
**Description**: Modifier les interventions clôturées/terminées

**Impact UI actuel**: ❌ AUCUN
- Aucune vérification dans les formulaires d'édition
- Pas de distinction entre intervention ouverte/fermée dans les checks de permission

**Impact API actuel**: ⚠️ PARTIEL
- `PATCH /api/interventions/[id]` → vérifie seulement si admin (hardcodé), pas la permission `edit_closed_interventions`
- Le check admin ne vérifie pas les permissions utilisateur

**Où devrait être utilisé**:
- [ ] Dans `InterventionForm.tsx` ou `InterventionEditForm.tsx`, vérifier si intervention est fermée (fermé == status inter_terminé)
- [ ] Si fermée, vérifier `can("edit_closed_interventions")` avant d'autoriser l'édition
- [ ] `PATCH /api/interventions/[id]` → si intervention fermée, vérifier `user_has_permission(userId, 'edit_closed_interventions')`

---

### 👷 ARTISANS

#### `read_artisans`
**Description**: Lire/voir les artisans

**Impact UI actuel**: ❌ AUCUN
- La page `/artisans` est accessible à tous les utilisateurs authentifiés
- Pas de vérification de permission

**Impact API actuel**: ❌ AUCUN
- `GET /api/artisans` (via `artisansApi`) → aucune vérification
- Utilise `supabaseAdmin` (bypass RLS)

**Où devrait être utilisé**:
- [ ] Masquer le lien "Artisans" dans sidebar/topbar si pas de permission
- [ ] Empêcher l'accès à `/artisans` si pas de permission
- [ ] API devrait vérifier `user_has_permission(userId, 'read_artisans')`

---

#### `write_artisans`
**Description**: Créer/modifier des artisans

**Impact UI actuel**: ❌ AUCUN
- Bouton "Nouvel artisan" visible pour tous
- Formulaires d'édition accessibles à tous
- Pas de `PermissionGate` sur les boutons

**Impact API actuel**: ❌ AUCUN
- `POST /api/artisans` → aucune vérification
- `PATCH /api/artisans/[id]` → aucune vérification
- `POST /api/artisans/[id]/archive` → vérifie seulement token, pas permission

**Où devrait être utilisé**:
- [ ] `PermissionGate permission="write_artisans"` sur le bouton "Nouvel artisan"
- [ ] Désactiver/masquer les boutons d'édition dans les modals artisan et dans la table des artisan dans la colonne des actions
- [ ] `POST /api/artisans` → `requireUserPermission(userId, 'write_artisans')`
- [ ] `PATCH /api/artisans/[id]` → `requireUserPermission(userId, 'write_artisans')`

---

#### `delete_artisans`
**Description**: Supprimer des artisans

**Impact UI actuel**: ❌ AUCUN
- Option "Supprimer" dans les menus contextuels visible pour tous
- Pas de `can("delete_artisans")` check

**Impact API actuel**: ❌ AUCUN
- `DELETE /api/artisans/[id]` → aucune vérification

**Où devrait être utilisé**:
- [ ] `PermissionGate permission="delete_artisans"` sur l'option "Supprimer" dans `ArtisanContextMenu.tsx`
- [ ] `DELETE /api/artisans/[id]` → `requireUserPermission(userId, 'delete_artisans')`

---

#### `export_artisans` (en attente d'implementation d'export artisans a ne pas faire )
**Description**: Exporter les données des artisans

**Impact UI actuel**: ❌ AUCUN
- Pas de bouton d'export visible dans l'UI

**Impact API actuel**: ❓ UNKNOWN
- Utilisé dans `scripts/exports/export-to-sheets.js` (CLI)
- Pas d'endpoint API exposé

**Où devrait être utilisé**:
- [ ] Si bouton export ajouté dans `/artisans`, vérifier `can("export_artisans")`
- [ ] Script CLI devrait vérifier la permission

---

### 👥 UTILISATEURS / ÉQUIPE

#### `read_users`
**Description**: Voir la liste des utilisateurs

**Impact UI actuel**: ✅ UTILISÉ
- Onglet "Team" dans Settings visible seulement si `can("write_users")` (mais devrait être `read_users` pour la lecture)
- Utilisé dans `SettingsNav.tsx` et `SettingsRoot.tsx`

**Impact API actuel**: ✅ UTILISÉ
- `GET /api/settings/team` → `requirePermission(req, "read_users")` dans `route.ts`

**État**: ✅ Fonctionne, mais logique incohérente (UI utilise `write_users` pour masquer l'onglet, alors que l'API utilise `read_users`)

---

#### `write_users`
**Description**: Créer/modifier des utilisateurs

**Impact UI actuel**: ✅ UTILISÉ (partiellement)
- Onglet "Team" masqué si pas `can("write_users")` dans `SettingsNav.tsx`
- Boutons créer/modifier utilisateur visibles dans Settings

**Impact API actuel**: ✅ UTILISÉ
- `POST /api/settings/team/user` → `requirePermission(req, "write_users")`
- `PATCH /api/settings/team/user` → `requirePermission(req, "write_users")`

**État**: ✅ Fonctionne côté API, mais `requirePermission()` ignore les overrides `user_permissions` (utilise seulement rôles)

---

#### `delete_users`
**Description**: Supprimer des utilisateurs

**Impact UI actuel**: ⚠️ PARTIEL
- Bouton "Supprimer" visible dans Settings/Team, mais pas de check de permission explicite

**Impact API actuel**: ✅ UTILISÉ
- `DELETE /api/settings/team/user` → `requirePermission(req, "delete_users")`

**Où devrait être utilisé**:
- [ ] `PermissionGate permission="delete_users"` sur le bouton "Supprimer" utilisateur

---

### 🔐 GESTION DES RÔLES ET PERMISSIONS

#### `manage_roles`
**Description**: Gérer les rôles et permissions des utilisateurs

**Impact UI actuel**: ✅ UTILISÉ
- Dialog `UserPermissionsDialog.tsx` accessible depuis Settings/Team
- Utilisé pour afficher/masquer le dialog de gestion des permissions

**Impact API actuel**: ✅ UTILISÉ
- `GET /api/users/[id]/permissions` → `requireUserPermission(actor.id, "manage_roles")`
- `PUT /api/users/[id]/permissions` → `requireUserPermission(actor.id, "manage_roles")`
- `GET /api/settings/team/user/[userId]/page-permissions` → `requirePermission(req, "manage_roles")`
- `POST /api/settings/team/user/[userId]/page-permissions` → `requirePermission(req, "manage_roles")`
- `POST /api/settings/team/role` → `requirePermission(req, "manage_roles")`

**État**: ✅ Fonctionne, mais `requirePermission()` ignore les overrides (utilise seulement rôles)

---

### ⚙️ PARAMÈTRES SYSTÈME

#### `manage_settings`
**Description**: Gérer les paramètres système (agences, métiers, statuts, etc.)

**Impact UI actuel**: ✅ UTILISÉ
- Onglet "Configuration Enums" masqué si pas `can("manage_settings")` dans `SettingsNav.tsx`
- Onglet "Targets" masqué si pas `canAny(["manage_settings", "view_comptabilite"])` dans `SettingsRoot.tsx`

**Impact API actuel**: ✅ UTILISÉ
- `POST /api/settings/agency` → `requirePermission(req, "manage_settings")`
- `PATCH /api/settings/agency` → `requirePermission(req, "manage_settings")`
- `DELETE /api/settings/agency` → `requirePermission(req, "manage_settings")`
- Routes `/api/settings/metiers/*` → `requirePermission(req, "manage_settings")`

**État**: ✅ Fonctionne côté API, mais `requirePermission()` ignore les overrides

---

### 👁️ VUE COMPTABILITÉ

#### `view_comptabilite`
**Description**: Accéder à la page Comptabilité

**Impact UI actuel**: ✅ UTILISÉ
- Lien "Comptabilité" masqué dans `app-sidebar.tsx` si pas `canAccessPage("view_comptabilite", "comptabilite")`
- Lien "Comptabilité" masqué dans `topbar.tsx` si pas `canAccessPage("view_comptabilite", "comptabilite")`
- Page `/comptabilite` vérifie `page_permissions.comptabilite` (mais pas la permission `view_comptabilite` directement)

**Impact API actuel**: ❌ AUCUN
- Aucune route API spécifique pour comptabilité (charge les données directement)

**État**: ✅ Fonctionne côté UI avec `canAccessPage()` qui combine permission + page_permissions override

---

### 🎛️ ADMIN DASHBOARD

#### `view_admin`
**Description**: Accéder au dashboard admin et analytics

**Impact UI actuel**: ✅ UTILISÉ
- `AdminGuard.tsx` utilise `can("view_admin")` pour protéger `/admin/dashboard` et `/admin/analytics`
- Redirige si pas de permission

**Impact API actuel**: ❌ AUCUN
- Pas de vérification explicite dans les routes `/api/admin/*`
- Les fonctions RPC `get_admin_dashboard_stats*` ne vérifient pas la permission

**Où devrait être utilisé**:
- [ ] Routes `/api/admin/*` devraient vérifier `user_has_permission(userId, 'view_admin')`
- [ ] RPC functions devraient vérifier la permission

---

## 🚨 PROBLÈMES CRITIQUES IDENTIFIÉS

### 1. `requirePermission()` ignore les overrides `user_permissions`

**Fichier**: `src/lib/api/permissions.ts`

**Problème**: La fonction `requirePermission()` calcule les permissions uniquement depuis les rôles via `ROLE_PERMISSIONS` (mapping statique). Elle ignore complètement les overrides `user_permissions`.

**Solution nécessaire**: 
- Utiliser `user_has_permission(user_id, permission_key)` de la DB au lieu du mapping statique
- Ou appeler `/api/users/[id]/permissions` côté serveur pour obtenir les permissions effectives

**Code actuel problématique**:

```typescript
// ❌ PROBLÈME: utilise seulement les rôles, ignore user_permissions
const permissions = new Set<PermissionKey>()
for (const role of roles) {
  const normalizedRole = (role || "").toLowerCase().trim()
  const rolePerms = ROLE_PERMISSIONS[normalizedRole]
  if (rolePerms) {
    for (const perm of rolePerms) {
      permissions.add(perm)
    }
  }
}
```

**Solution proposée**:

```typescript
// ✅ UTILISER user_has_permission() de la DB
const { data: hasPerm } = await supabaseAdmin.rpc("user_has_permission", {
  p_user_id: publicUserId,
  p_permission_key: permission,
})
```

---

### 2. Les permissions métier (interventions/artisans) n'ont AUCUN impact UI

**Problème**: Aucune des permissions `read_interventions`, `write_interventions`, `delete_interventions`, `read_artisans`, `write_artisans`, `delete_artisans` n'est vérifiée dans l'UI.

**Solution nécessaire**:
- Ajouter `PermissionGate` sur tous les boutons d'action
- Ajouter des checks `can()` dans les composants
- Protéger les routes de page avec des guards

---

### 3. `edit_closed_interventions` n'est pas utilisé

**Problème**: La permission existe en DB et est sélectionnable, mais aucune vérification n'est faite dans l'UI ou l'API pour savoir si une intervention est fermée avant d'autoriser l'édition.

**Solution nécessaire**:
- Vérifier le statut de l'intervention avant d'autoriser l'édition
- Si fermée, vérifier `can("edit_closed_interventions")`
- API devrait également vérifier cela

---

## 📊 RÉSUMÉ PAR STATUT

### ✅ Fonctionnel (mais avec le bug requirePermission)
- `read_users` (API)
- `write_users` (API)
- `delete_users` (API)
- `manage_roles` (API + UI)
- `manage_settings` (API + UI)
- `view_comptabilite` (UI)
- `view_admin` (UI)

### ❌ Existe mais pas utilisé
- `read_interventions` (0% utilisé)
- `write_interventions` (0% utilisé)
- `delete_interventions` (0% utilisé)
- `edit_closed_interventions` (0% utilisé)
- `read_artisans` (0% utilisé)
- `write_artisans` (0% utilisé)
- `delete_artisans` (0% utilisé)
- `export_artisans` (0% utilisé)

---

## 🔄 PRIORITÉS DE CORRECTION

### Priorité 1 (Critique)
1. **Corriger `requirePermission()` pour utiliser `user_has_permission()`** au lieu du mapping statique
2. **Ajouter les checks de permission dans l'UI pour les interventions** (read/write/delete)
3. **Ajouter les checks de permission dans l'API pour les interventions** (read/write/delete)

### Priorité 2 (Important)
4. **Implémenter `edit_closed_interventions` dans l'UI et l'API**
5. **Ajouter les checks de permission pour les artisans** (read/write/delete)
6. **Protéger les routes admin avec `view_admin`**

### Priorité 3 (Amélioration)
7. **Ajouter `export_artisans` si bouton export ajouté**
8. **Harmoniser la logique `read_users` vs `write_users` dans Settings**

---

## 📝 NOTES COMPLÉMENTAIRES

### Schéma de flux des permissions

```
Supabase Auth (cookie)
   ↓
/api/auth/me  → currentUser (roles + page_permissions)
   ↓
/api/users/:id/permissions → permissions effectives (role_permissions + user_permissions)
   ↓
usePermissions() → can/canAny/canAccessPage
   ├─ UI gating (sidebar/topbar/settings/admin)
   └─ PermissionGate (dispo mais peu utilisé)

API routes → requirePermission(...)   // ⚠️ ACTUELLEMENT: basé sur rôles uniquement, pas sur user_permissions
DB RLS → protège accès direct supabase client, pas supabaseAdmin
```

### Principe fondamental

**Les permissions utilisateur sont le chef d'orchestre.** Les rôles ne servent qu'à donner un template de départ via `role_permissions`. Les overrides `user_permissions` prennent TOUJOURS la priorité et doivent être respectés partout, y compris dans `requirePermission()`.


