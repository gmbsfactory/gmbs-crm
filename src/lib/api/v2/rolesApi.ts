// ===== API ROLES & PERMISSIONS V2 =====
// Gestion complète des rôles et permissions

import { supabase } from "./common/client";
import type {
    CreatePermissionData,
    CreateRoleData,
    Permission,
    Role,
} from "./common/types";
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler";

export const rolesApi = {
  // Récupérer tous les rôles
  async getAll(): Promise<Role[]> {
    const { data, error } = await supabase
      .from("roles")
      .select(`
        *,
        role_permissions!inner(
          permissions!inner(
            id,
            key,
            description
          )
        )
      `)
      .order("name");

    if (error) throw error;

    return (data || []).map((role: { id: string; name: string; role_permissions?: any[]; [key: string]: unknown }) => ({
      ...role,
      permissions: role.role_permissions?.map((rp: any) => rp.permissions) || [],
    }));
  },

  // Récupérer un rôle par ID
  async getById(id: string): Promise<Role> {
    const { data, error } = await supabase
      .from("roles")
      .select(`
        *,
        role_permissions!inner(
          permissions!inner(
            id,
            key,
            description
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    return {
      ...data,
      permissions: data.role_permissions?.map((rp: any) => rp.permissions) || [],
    };
  },

  // Récupérer un rôle par nom
  async getByName(name: string): Promise<Role | null> {
    const { data, error } = await supabase
      .from("roles")
      .select(`
        *,
        role_permissions!inner(
          permissions!inner(
            id,
            key,
            description
          )
        )
      `)
      .eq("name", name)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      ...data,
      permissions: data.role_permissions?.map((rp: any) => rp.permissions) || [],
    };
  },

  // Créer un rôle
  async create(data: CreateRoleData): Promise<Role> {
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .insert({
        name: data.name,
        description: data.description,
      })
      .select()
      .single();

    if (roleError) throw roleError;

    // Assigner les permissions si spécifiées
    if (data.permissions && data.permissions.length > 0) {
      await this.assignPermissions(role.id, data.permissions);
    }

    return await this.getById(role.id);
  },

  // Modifier un rôle
  async update(id: string, data: {
    name?: string;
    description?: string;
    permissions?: string[];
  }): Promise<Role> {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from("roles")
        .update(updateData)
        .eq("id", id);

      if (updateError) throw updateError;
    }

    // Mettre à jour les permissions si spécifiées
    if (data.permissions !== undefined) {
      await this.assignPermissions(id, data.permissions);
    }

    return await this.getById(id);
  },

  // Supprimer un rôle
  async delete(id: string): Promise<{ message: string; data: Role }> {
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("*")
      .eq("id", id)
      .single();

    if (roleError) throw roleError;

    const { error: deleteError } = await supabase
      .from("roles")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return {
      message: "Role deleted successfully",
      data: role,
    };
  },

  // Assigner des permissions à un rôle
  async assignPermissions(roleId: string, permissionKeys: string[]): Promise<void> {
    // Récupérer les IDs des permissions
    const { data: permissions, error: permissionsError } = await supabase
      .from("permissions")
      .select("id, key")
      .in("key", permissionKeys);

    if (permissionsError) throw permissionsError;

    const permissionIds = permissions?.map((permission: { id: string; [key: string]: unknown }) => permission.id) || [];

    if (permissionIds.length === 0) {
      throw new Error("No valid permissions found");
    }

    // Supprimer les permissions existantes
    await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    // Ajouter les nouvelles permissions
    const rolePermissions = permissionIds.map((permissionId: string) => ({
      role_id: roleId,
      permission_id: permissionId,
    }));

    const { error: assignError } = await supabase
      .from("role_permissions")
      .insert(rolePermissions);

    if (assignError) throw assignError;
  },

  // Ajouter une permission à un rôle
  async addPermission(roleId: string, permissionKey: string): Promise<void> {
    const { data: permission, error: permissionError } = await supabase
      .from("permissions")
      .select("id")
      .eq("key", permissionKey)
      .single();

    if (permissionError) throw permissionError;

    const { error: assignError } = await supabase
      .from("role_permissions")
      .insert({
        role_id: roleId,
        permission_id: permission.id,
      });

    if (assignError) throw assignError;
  },

  // Retirer une permission d'un rôle
  async removePermission(roleId: string, permissionKey: string): Promise<void> {
    const { data: permission, error: permissionError } = await supabase
      .from("permissions")
      .select("id")
      .eq("key", permissionKey)
      .single();

    if (permissionError) throw permissionError;

    const { error: removeError } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId)
      .eq("permission_id", permission.id);

    if (removeError) throw removeError;
  },

  // Récupérer les utilisateurs ayant un rôle
  async getUsersByRole(roleId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("user_roles")
      .select(`
        users!inner(
          id,
          username,
          firstname,
          lastname,
          email,
          status
        )
      `)
      .eq("role_id", roleId);

    if (error) throw error;

    return data?.map((ur: any) => ur.users) || [];
  },

  // Obtenir les statistiques des rôles
  async getStats(): Promise<{
    total_roles: number;
    total_permissions: number;
    roles_with_permissions: number;
    users_by_role: Record<string, number>;
  }> {
    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select(`
        id,
        name,
        role_permissions(count),
        user_roles(count)
      `);

    if (rolesError) throw rolesError;

    const { data: permissions, error: permissionsError } = await supabase
      .from("permissions")
      .select("id", { count: "exact" });

    if (permissionsError) throw permissionsError;

    const stats = {
      total_roles: roles?.length || 0,
      total_permissions: permissions?.length || 0,
      roles_with_permissions: 0,
      users_by_role: {} as Record<string, number>,
    };

    roles?.forEach((role: any) => {
      if (role.role_permissions && role.role_permissions.length > 0) {
        stats.roles_with_permissions++;
      }
      stats.users_by_role[role.name] = role.user_roles?.length || 0;
    });

    return stats;
  },
};

export const permissionsApi = {
  // Récupérer toutes les permissions
  async getAll(): Promise<Permission[]> {
    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .order("key");

    if (error) throw error;
    return data || [];
  },

  // Récupérer une permission par ID
  async getById(id: string): Promise<Permission> {
    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  // Récupérer une permission par clé
  async getByKey(key: string): Promise<Permission | null> {
    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .eq("key", key)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  // Créer une permission
  async create(data: CreatePermissionData): Promise<Permission> {
    const { data: permission, error } = await supabase
      .from("permissions")
      .insert({
        key: data.key,
        description: data.description,
      })
      .select()
      .single();

    if (error) throw error;
    return permission;
  },

  // Modifier une permission
  async update(id: string, data: {
    key?: string;
    description?: string;
  }): Promise<Permission> {
    const updateData: any = {};
    if (data.key !== undefined) updateData.key = data.key;
    if (data.description !== undefined) updateData.description = data.description;

    const { data: permission, error } = await supabase
      .from("permissions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return permission;
  },

  // Supprimer une permission
  async delete(id: string): Promise<{ message: string; data: Permission }> {
    const { data: permission, error: permissionError } = await supabase
      .from("permissions")
      .select("*")
      .eq("id", id)
      .single();

    if (permissionError) throw permissionError;

    const { error: deleteError } = await supabase
      .from("permissions")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    return {
      message: "Permission deleted successfully",
      data: permission,
    };
  },

  // Récupérer les rôles ayant une permission
  async getRolesByPermission(permissionId: string): Promise<Role[]> {
    const { data, error } = await supabase
      .from("role_permissions")
      .select(`
        roles!inner(
          id,
          name,
          description
        )
      `)
      .eq("permission_id", permissionId);

    if (error) throw error;

    return data?.map((rp: any) => rp.roles) || [];
  },

  // Créer plusieurs permissions en lot
  async createBulk(permissions: CreatePermissionData[]): Promise<{
    success: number;
    errors: number;
    details: Array<{
      item: CreatePermissionData;
      success: boolean;
      data?: any;
      error?: string;
    }>;
  }> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const permission of permissions) {
      try {
        const result = await this.create(permission);
        results.success++;
        results.details.push({ item: permission, success: true, data: result });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: permission, success: false, error: safeErrorMessage(error, "la création de la permission") });
      }
    }

    return results;
  },
};
