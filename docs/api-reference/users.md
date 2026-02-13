# Users API Reference

> Source: `src/lib/api/v2/usersApi.ts`

Complete API for managing users with Supabase Auth integration. Handles user creation (auth + profile + roles), role assignment, permissions, gestionnaire targets, and user preferences.

**Import:**

```typescript
import { usersApi } from "@/lib/api/v2";
```

---

## Table of Contents

- [CRUD Operations](#crud-operations)
- [Roles and Permissions](#roles-and-permissions)
- [Gestionnaire Targets](#gestionnaire-targets)
- [User Preferences](#user-preferences)
- [Utilities](#utilities)

---

## CRUD Operations

### getAll(params?)

Retrieves all users with their roles. By default, excludes archived (soft-deleted) users.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| params | `UserQueryParams & { includeArchived?: boolean }` | No | Filters |
| params.status | `string` | No | Filter by status (e.g. `"connected"`, `"offline"`) |
| params.includeArchived | `boolean` | No | Include archived users (default: `false`) |
| params.limit | `number` | No | Max results (default: 100) |
| params.offset | `number` | No | Pagination offset |

**Return:** `Promise<PaginatedResponse<User>>`

**Example**

```typescript
const result = await usersApi.getAll({ status: "connected", limit: 50 });
```

---

### getById(id)

Retrieves a single user by ID with their roles.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | User UUID |

**Return:** `Promise<User>`

---

### create(data)

Creates a complete user: Supabase Auth account + public.users profile + role assignments. If profile creation fails, the auth user is automatically deleted (rollback).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `CreateUserData` | Yes | User data |
| data.email | `string` | Yes | Email address |
| data.password | `string` | Yes | Password |
| data.username | `string` | Yes | Username |
| data.firstname | `string` | No | First name |
| data.lastname | `string` | No | Last name |
| data.color | `string` | No | User color (hex) |
| data.code_gestionnaire | `string` | No | Gestionnaire code |
| data.roles | `string[]` | No | Role names to assign |

**Return:** `Promise<User>`

**Example**

```typescript
const user = await usersApi.create({
  email: "john@example.com",
  password: "securePassword123",
  username: "johndoe",
  firstname: "John",
  lastname: "Doe",
  roles: ["gestionnaire"],
});
```

---

### update(id, data)

Updates a user. Handles auth updates (email, password) separately from profile updates. Updates roles if provided.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | User UUID |
| data | `UpdateUserData` | Yes | Fields to update |
| data.email | `string` | No | New email |
| data.password | `string` | No | New password |
| data.username | `string` | No | New username |
| data.firstname | `string` | No | New first name |
| data.lastname | `string` | No | New last name |
| data.color | `string` | No | New color |
| data.code_gestionnaire | `string` | No | New gestionnaire code |
| data.status | `string` | No | New status |
| data.roles | `string[]` | No | Replace roles with these |

**Return:** `Promise<User>`

---

### delete(id)

Soft-deletes a user. Sets `is_active = false` and `status = "offline"` in public.users, then deletes the auth user from Supabase Auth.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `string` | Yes | User UUID |

**Return:** `Promise<{ message: string; data: User }>`

---

### createBulk(users)

Creates multiple users sequentially.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| users | `CreateUserData[]` | Yes | Array of user data |

**Return:** `Promise<BulkOperationResult>`

---

## Roles and Permissions

### assignRoles(userId, roleNames)

Replaces all roles for a user. Deletes existing role assignments, then inserts new ones.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| roleNames | `string[]` | Yes | Role names to assign |

**Return:** `Promise<void>`

---

### updateRoles(userId, roleNames)

Alias for `assignRoles`. Replaces all existing roles.

**Parameters**

Same as [`assignRoles`](#assignrolesuserid-rolenames).

**Return:** `Promise<void>`

---

### getUserPermissions(userId)

Retrieves all permission keys for a user through the role-permission chain: `user_roles -> roles -> role_permissions -> permissions`.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |

**Return:** `Promise<string[]>`

**Example**

```typescript
const permissions = await usersApi.getUserPermissions("user-uuid");
// ["interventions.read", "interventions.write", "admin.settings"]
```

---

### hasPermission(userId, permission)

Checks if a user has a specific permission.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| permission | `string` | Yes | Permission key to check |

**Return:** `Promise<boolean>`

---

### getUsersByRole(roleName)

Retrieves all users that have a specific role.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| roleName | `string` | Yes | Role name |

**Return:** `Promise<User[]>`

---

## Gestionnaire Targets

Margin and performance targets for gestionnaires (managers).

### getTargetByUserAndPeriod(userId, periodType)

Retrieves the target for a specific user and period.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| periodType | `TargetPeriodType` (`"week" \| "month" \| "year"`) | Yes | Period type |

**Return:** `Promise<GestionnaireTarget | null>`

---

### getTargetsByUser(userId)

Retrieves all targets for a user.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |

**Return:** `Promise<GestionnaireTarget[]>`

---

### getTargetsByPeriod(periodType)

Retrieves all targets for a period type (all gestionnaires).

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| periodType | `TargetPeriodType` | Yes | Period type |

**Return:** `Promise<GestionnaireTarget[]>`

---

### upsertTarget(data, createdBy)

Creates or updates a target. Uses the `/api/targets` route to bypass RLS policies. Falls back to direct Supabase query if the API route fails.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| data | `CreateGestionnaireTargetData` | Yes | Target data |
| data.user_id | `string` | Yes | Gestionnaire UUID |
| data.period_type | `TargetPeriodType` | Yes | Period type |
| data.margin_target | `number` | Yes | Margin target amount |
| data.performance_target | `number` | No | Performance target (default: `40`) |
| createdBy | `string` | Yes | ID of the user creating/updating |

**Return:** `Promise<GestionnaireTarget>`

---

### updateTarget(targetId, data, updatedBy)

Updates an existing target by ID.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| targetId | `string` | Yes | Target UUID |
| data | `UpdateGestionnaireTargetData` | Yes | Fields to update |
| updatedBy | `string` | Yes | ID of the user updating |

**Return:** `Promise<GestionnaireTarget>`

---

### deleteTarget(targetId)

Deletes a target.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| targetId | `string` | Yes | Target UUID |

**Return:** `Promise<void>`

---

### getAllTargets()

Retrieves all targets across all gestionnaires. Uses the `/api/targets` route to bypass RLS. Falls back to direct Supabase query.

**Parameters:** None

**Return:** `Promise<GestionnaireTarget[]>`

---

## User Preferences

Dashboard display preferences stored per user.

### getUserPreferences(userId)

Retrieves user display preferences via the `/api/user-preferences` route. Returns default values if no preferences are set.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |

**Return:** `Promise<{ speedometer_margin_average_show_percentage: boolean; speedometer_margin_total_show_percentage: boolean } | null>`

**Example**

```typescript
const prefs = await usersApi.getUserPreferences("user-uuid");
// { speedometer_margin_average_show_percentage: true, speedometer_margin_total_show_percentage: false }
```

---

### updateUserPreferences(userId, preferences)

Updates user display preferences via the `/api/user-preferences` route.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| userId | `string` | Yes | User UUID |
| preferences.speedometer_margin_average_show_percentage | `boolean` | No | Show percentage on average margin speedometer |
| preferences.speedometer_margin_total_show_percentage | `boolean` | No | Show percentage on total margin speedometer |

**Return:** `Promise<void>`

---

## Utilities

### syncUser(authUserId, profileData)

Synchronizes an existing auth user with a public.users profile. Used for migration scenarios. Creates or updates the profile via upsert.

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| authUserId | `string` | Yes | Auth user UUID |
| profileData.username | `string` | Yes | Username |
| profileData.firstname | `string` | No | First name |
| profileData.lastname | `string` | No | Last name |
| profileData.color | `string` | No | Color |
| profileData.code_gestionnaire | `string` | No | Gestionnaire code |
| profileData.roles | `string[]` | No | Roles to assign |

**Return:** `Promise<User>`

---

### getStats()

Retrieves user statistics: total, by status, by role, and active today count.

**Parameters:** None

**Return:** `Promise<UserStats>`

```typescript
interface UserStats {
  total: number;
  by_status: Record<string, number>;
  by_role: Record<string, number>;
  active_today: number;
}
```
