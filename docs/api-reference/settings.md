# Settings APIs Reference

> Sources:
> - `src/lib/api/v2/agenciesApi.ts` -- Agencies
> - `src/lib/api/v2/metiersApi.ts` -- Metiers (trades)
> - `src/lib/api/v2/rolesApi.ts` -- Roles and Permissions
> - `src/lib/api/v2/enumsApi.ts` -- Enum resolution (find-or-create)

These APIs manage the CRM reference/settings data: agencies, metiers, roles, permissions, and enum resolution for imports.

**Import:**

```typescript
import { agenciesApi } from "@/lib/api/v2/agenciesApi";
import { metiersApi } from "@/lib/api/v2/metiersApi";
import { rolesApi, permissionsApi } from "@/lib/api/v2/rolesApi";
import { enumsApi } from "@/lib/api/v2/enumsApi";
```

---

## Table of Contents

- [Agencies API](#agencies-api)
- [Metiers API](#metiers-api)
- [Roles API](#roles-api)
- [Permissions API](#permissions-api)
- [Enums API (Find-or-Create)](#enums-api)

---

## Agencies API

Source: `src/lib/api/v2/agenciesApi.ts`

### agenciesApi.getAll(params?)

Retrieves all agencies with their `requires_reference` config. By default, returns only active agencies.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params.includeInactive | `boolean` | No | Include inactive agencies (default: `false`) |

**Return:** `Promise<Agency[]>`

```typescript
interface Agency {
  id: string;
  code: string;        // Auto-generated from label (uppercase, max 10 chars)
  label: string;
  region?: string | null;
  color?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  requires_reference?: boolean; // From agency_config join
}
```

---

### agenciesApi.getById(id)

Retrieves a single agency by ID with its config.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Agency UUID |

**Return:** `Promise<Agency>`

---

### agenciesApi.create(agencyData)

Creates a new agency. The `code` is auto-generated from the label (first 10 chars, uppercase, alphanumeric only).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| agencyData.label | `string` | Yes | Agency label |
| agencyData.region | `string` | No | Region |
| agencyData.color | `string` | No | Color (hex) |

**Return:** `Promise<Agency>`

**Throws:** `"duplicate_code"` if the generated code already exists.

---

### agenciesApi.update(id, agencyData)

Updates an agency. If label changes, the code is regenerated.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Agency UUID |
| agencyData.label | `string` | No | New label (regenerates code) |
| agencyData.region | `string` | No | New region |
| agencyData.color | `string` | No | New color |

**Return:** `Promise<Agency>`

---

### agenciesApi.delete(id)

Soft-deletes an agency by setting `is_active = false`. Never physically deletes to preserve relations.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Agency UUID |

**Return:** `Promise<{ message: string; data: Agency }>`

---

### agenciesApi.updateRequiresReference(agencyId, requiresReference)

Updates the `requires_reference` config for an agency. Upserts into the `agency_config` table.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| agencyId | `string` | Yes | Agency UUID |
| requiresReference | `boolean` | Yes | Whether this agency requires reference field |

**Return:** `Promise<void>`

---

## Metiers API

Source: `src/lib/api/v2/metiersApi.ts`

### metiersApi.getAll(params?)

Retrieves all metiers. By default, returns only active ones.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params.includeInactive | `boolean` | No | Include inactive metiers (default: `false`) |

**Return:** `Promise<Metier[]>`

```typescript
interface Metier {
  id: string;
  code: string;           // Auto-generated from label
  label: string;
  description?: string | null;
  color?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

---

### metiersApi.getById(id)

Retrieves a single metier by ID.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Metier UUID |

**Return:** `Promise<Metier>`

---

### metiersApi.create(metierData)

Creates a new metier. Code is auto-generated from the label.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| metierData.label | `string` | Yes | Metier label |
| metierData.description | `string` | No | Description |
| metierData.color | `string` | No | Color (hex) |

**Return:** `Promise<Metier>`

**Throws:** `"duplicate_code"` if the generated code already exists.

---

### metiersApi.update(id, metierData)

Updates a metier. If label changes, the code is regenerated.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Metier UUID |
| metierData.label | `string` | No | New label |
| metierData.description | `string` | No | New description |
| metierData.color | `string` | No | New color |

**Return:** `Promise<Metier>`

---

### metiersApi.delete(id)

Soft-deletes a metier by setting `is_active = false`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Metier UUID |

**Return:** `Promise<{ message: string; data: Metier }>`

---

## Roles API

Source: `src/lib/api/v2/rolesApi.ts`

### rolesApi.getAll()

Retrieves all roles with their permissions.

**Parameters:** None

**Return:** `Promise<Role[]>`

```typescript
interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
}
```

---

### rolesApi.getById(id)

Retrieves a single role by ID with permissions.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Role UUID |

**Return:** `Promise<Role>`

---

### rolesApi.getByName(name)

Retrieves a role by its name. Returns `null` if not found.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | `string` | Yes | Role name |

**Return:** `Promise<Role | null>`

---

### rolesApi.create(data)

Creates a new role with optional permissions.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data.name | `string` | Yes | Role name |
| data.description | `string` | No | Description |
| data.permissions | `string[]` | No | Permission keys to assign |

**Return:** `Promise<Role>`

---

### rolesApi.update(id, data)

Updates a role. If permissions are provided, replaces all existing permissions.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Role UUID |
| data.name | `string` | No | New name |
| data.description | `string` | No | New description |
| data.permissions | `string[]` | No | Replace permissions |

**Return:** `Promise<Role>`

---

### rolesApi.delete(id)

Permanently deletes a role.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Role UUID |

**Return:** `Promise<{ message: string; data: Role }>`

---

### rolesApi.assignPermissions(roleId, permissionKeys)

Replaces all permissions for a role. Deletes existing assignments, then inserts new ones.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| roleId | `string` | Yes | Role UUID |
| permissionKeys | `string[]` | Yes | Permission keys to assign |

**Return:** `Promise<void>`

---

### rolesApi.addPermission(roleId, permissionKey)

Adds a single permission to a role.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| roleId | `string` | Yes | Role UUID |
| permissionKey | `string` | Yes | Permission key |

**Return:** `Promise<void>`

---

### rolesApi.removePermission(roleId, permissionKey)

Removes a single permission from a role.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| roleId | `string` | Yes | Role UUID |
| permissionKey | `string` | Yes | Permission key |

**Return:** `Promise<void>`

---

### rolesApi.getUsersByRole(roleId)

Retrieves all users that have a specific role (by role ID).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| roleId | `string` | Yes | Role UUID |

**Return:** `Promise<Array<{ id, username, firstname, lastname, email, status }>>`

---

### rolesApi.getStats()

Retrieves role and permission statistics.

**Parameters:** None

**Return:** `Promise<{ total_roles: number; total_permissions: number; roles_with_permissions: number; users_by_role: Record<string, number> }>`

---

## Permissions API

Source: `src/lib/api/v2/rolesApi.ts` (exported as `permissionsApi`)

### permissionsApi.getAll()

Retrieves all permissions ordered by key.

**Parameters:** None

**Return:** `Promise<Permission[]>`

```typescript
interface Permission {
  id: string;
  key: string;
  description?: string;
}
```

---

### permissionsApi.getById(id)

Retrieves a permission by ID.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Permission UUID |

**Return:** `Promise<Permission>`

---

### permissionsApi.getByKey(key)

Retrieves a permission by its key. Returns `null` if not found.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| key | `string` | Yes | Permission key |

**Return:** `Promise<Permission | null>`

---

### permissionsApi.create(data)

Creates a new permission.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data.key | `string` | Yes | Permission key |
| data.description | `string` | No | Description |

**Return:** `Promise<Permission>`

---

### permissionsApi.update(id, data)

Updates a permission.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Permission UUID |
| data.key | `string` | No | New key |
| data.description | `string` | No | New description |

**Return:** `Promise<Permission>`

---

### permissionsApi.delete(id)

Permanently deletes a permission.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | Permission UUID |

**Return:** `Promise<{ message: string; data: Permission }>`

---

### permissionsApi.getRolesByPermission(permissionId)

Retrieves all roles that have a specific permission.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| permissionId | `string` | Yes | Permission UUID |

**Return:** `Promise<Role[]>`

---

### permissionsApi.createBulk(permissions)

Creates multiple permissions sequentially.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| permissions | `CreatePermissionData[]` | Yes | Array of permission data |

**Return:** `Promise<{ success: number; errors: number; details: Array<{ item, success, data?, error? }> }>`

---

## Enums API

Source: `src/lib/api/v2/enumsApi.ts`

The Enums API provides find-or-create functions used primarily during Google Sheets import. Each function searches by label (case-insensitive) or code, and creates the entity if not found. All support an optional `customClient` parameter for Node.js usage.

### enumsApi.findOrCreateAgency(name, customClient?)

Finds or creates an agency by name.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | `string` | Yes | Agency name |
| customClient | `SupabaseClient` | No | Custom client |

**Return:** `Promise<FindOrCreateResult>`

```typescript
interface FindOrCreateResult {
  id: string;
  created: boolean;
}
```

---

### enumsApi.findOrCreateUser(name, customClient?)

Finds or creates a user by name, username, or firstname/lastname. Auto-generates username and `code_gestionnaire`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | `string` | Yes | User name |
| customClient | `SupabaseClient` | No | Custom client |

**Return:** `Promise<FindOrCreateResult>`

---

### enumsApi.findOrCreateMetier(name, customClient?)

Finds or creates a metier by name.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | `string` | Yes | Metier name |
| customClient | `SupabaseClient` | No | Custom client |

**Return:** `Promise<FindOrCreateResult>`

---

### enumsApi.findOrCreateZone(name, customClient?)

Finds or creates a zone by name.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | `string` | Yes | Zone name |
| customClient | `SupabaseClient` | No | Custom client |

**Return:** `Promise<FindOrCreateResult>`

---

### enumsApi.findOrCreateArtisanStatus(name, customClient?)

Finds or creates an artisan status by name. New statuses are created with color `#808080` and sort_order `999`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | `string` | Yes | Status name |
| customClient | `SupabaseClient` | No | Custom client |

**Return:** `Promise<FindOrCreateResult>`

---

### enumsApi.findOrCreateInterventionStatus(name, customClient?)

Finds or creates an intervention status by name.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | `string` | Yes | Status name |
| customClient | `SupabaseClient` | No | Custom client |

**Return:** `Promise<FindOrCreateResult>`

---

### enumsApi.findOrCreateInterventionStatusByCode(code, label)

Finds or creates an intervention status with a specific code and label.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| code | `string` | Yes | Status code |
| label | `string` | Yes | Status label |

**Return:** `Promise<FindOrCreateResult>`

---

### enumsApi.getInterventionStatusByCode(code, customClient?)

Retrieves an intervention status by its exact code. Returns `{ data: null, error: null }` if not found.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| code | `string` | Yes | Status code |
| customClient | `SupabaseClient` | No | Custom client |

**Return:** `Promise<{ data: { id, code, label, color, sort_order } | null; error: Error | null }>`

---

### enumsApi.getUserByUsername(username, customClient?)

Retrieves a user by username. Returns `{ data: null }` if not found.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| username | `string` | Yes | Username |
| customClient | `SupabaseClient` | No | Custom client |

**Return:** `Promise<{ data: { id, username, email, code_gestionnaire } | null; error: Error | null }>`
