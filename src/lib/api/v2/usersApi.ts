// ===== API USERS V2 =====
// Gestion complète des utilisateurs avec authentification Supabase

import { supabase } from "@/lib/supabase-client";
import type {
    BulkOperationResult,
    CreateUserData,
    PaginatedResponse,
    UpdateUserData,
    User,
    UserQueryParams,
    UserStats,
    GestionnaireTarget,
    CreateGestionnaireTargetData,
    UpdateGestionnaireTargetData,
    TargetPeriodType,
} from "./common/types";
import { safeErrorMessage } from "@/lib/api/v2/common/error-handler";

export const usersApi = {
  // Récupérer tous les utilisateurs avec leurs rôles
  // Par défaut, exclut les utilisateurs archivés (soft-deleted)
  async getAll(params?: UserQueryParams & { includeArchived?: boolean }): Promise<PaginatedResponse<User>> {
    let query = supabase
      .from("users")
      .select(`
        *,
        user_roles!inner(
          role_id,
          roles!inner(
            id,
            name,
            description
          )
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    // Appliquer les filtres si nécessaire
    if (params?.status) {
      query = query.eq("status", params.status);
    } else if (!params?.includeArchived) {
      // Par défaut, exclure les utilisateurs archivés
      query = query.neq("status", "archived");
    }

    // Pagination
    const limit = params?.limit || 100;
    const offset = params?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const transformedData = (data || []).map((item: { id: string; [key: string]: unknown }) => ({
      ...item,
      roles: (item.user_roles as any[])?.map((ur: any) => ur.roles?.name).filter(Boolean) || [],
    }));

    return {
      data: transformedData,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: offset + limit < (count || 0),
      },
    };
  },

  // Récupérer un utilisateur par ID
  async getById(id: string): Promise<User> {
    const { data, error } = await supabase
      .from("users")
      .select(`
        *,
        user_roles!inner(
          role_id,
          roles!inner(
            id,
            name,
            description
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error) throw error;

    return {
      ...data,
      roles: data.user_roles?.map((ur: any) => ur.roles?.name).filter(Boolean) || [],
    };
  },

  // Créer un utilisateur complet (auth + profile)
  async create(data: CreateUserData): Promise<User> {
    // 1. Créer l'utilisateur dans Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        name: data.firstname,
        prenom: data.lastname,
      },
    });

    if (authError) throw authError;
    if (!authUser.user) throw new Error("Failed to create auth user");

    const userId = authUser.user.id;

    // 2. Créer le profil dans public.users avec le même ID
    const { data: profileData, error: profileError } = await supabase
      .from("users")
      .insert({
        id: userId, // Même ID que auth.users
        username: data.username,
        email: data.email,
        firstname: data.firstname,
        lastname: data.lastname,
        color: data.color,
        code_gestionnaire: data.code_gestionnaire,
        status: "offline",
        token_version: 0,
      })
      .select()
      .single();

    if (profileError) {
      // Si le profil échoue, supprimer l'utilisateur auth
      await supabase.auth.admin.deleteUser(userId);
      throw profileError;
    }

    // 3. Assigner les rôles si spécifiés
    if (data.roles && data.roles.length > 0) {
      await this.assignRoles(userId, data.roles);
    }

    // 4. Récupérer l'utilisateur complet avec ses rôles
    return await this.getById(userId);
  },

  // Modifier un utilisateur
  async update(id: string, data: UpdateUserData): Promise<User> {
    // 1. Mettre à jour l'utilisateur dans Supabase Auth si nécessaire
    if (data.email || data.password) {
      const updateData: any = {};
      if (data.email) updateData.email = data.email;
      if (data.password) updateData.password = data.password;

      const { error: authError } = await supabase.auth.admin.updateUserById(id, updateData);
      if (authError) throw authError;
    }

    // 2. Mettre à jour le profil dans public.users
    const profileUpdateData: any = {};
    if (data.username !== undefined) profileUpdateData.username = data.username;
    if (data.firstname !== undefined) profileUpdateData.firstname = data.firstname;
    if (data.lastname !== undefined) profileUpdateData.lastname = data.lastname;
    if (data.color !== undefined) profileUpdateData.color = data.color;
    if (data.code_gestionnaire !== undefined) profileUpdateData.code_gestionnaire = data.code_gestionnaire;
    if (data.status !== undefined) profileUpdateData.status = data.status;

    if (Object.keys(profileUpdateData).length > 0) {
      const { error: profileError } = await supabase
        .from("users")
        .update(profileUpdateData)
        .eq("id", id);

      if (profileError) throw profileError;
    }

    // 3. Mettre à jour les rôles si spécifiés
    if (data.roles !== undefined) {
      await this.updateRoles(id, data.roles);
    }

    // 4. Récupérer l'utilisateur mis à jour
    return await this.getById(id);
  },

  // Supprimer un utilisateur (soft delete)
  async delete(id: string): Promise<{ message: string; data: User }> {
    // 1. Soft delete dans public.users
    const { data: userData, error: profileError } = await supabase
      .from("users")
      .update({ 
        is_active: false,
        status: "offline",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (profileError) throw profileError;

    // 2. Supprimer l'utilisateur de Supabase Auth
    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) throw authError;

    return {
      message: "User deleted successfully",
      data: userData,
    };
  },

  // Assigner des rôles à un utilisateur
  async assignRoles(userId: string, roleNames: string[]): Promise<void> {
    // Récupérer les IDs des rôles
    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("id, name")
      .in("name", roleNames);

    if (rolesError) throw rolesError;

    const roleIds = roles?.map((role: { id: string; [key: string]: unknown }) => role.id) || [];

    if (roleIds.length === 0) {
      throw new Error("No valid roles found");
    }

    // Supprimer les rôles existants
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // Ajouter les nouveaux rôles
    const userRoles = roleIds.map((roleId: string) => ({
      user_id: userId,
      role_id: roleId,
    }));

    const { error: assignError } = await supabase
      .from("user_roles")
      .insert(userRoles);

    if (assignError) throw assignError;
  },

  // Mettre à jour les rôles d'un utilisateur
  async updateRoles(userId: string, roleNames: string[]): Promise<void> {
    await this.assignRoles(userId, roleNames);
  },

  // Récupérer les permissions d'un utilisateur
  async getUserPermissions(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("user_roles")
      .select(`
        roles!inner(
          role_permissions!inner(
            permissions!inner(
              key
            )
          )
        )
      `)
      .eq("user_id", userId);

    if (error) throw error;

    const permissions = new Set<string>();
    data?.forEach((userRole: any) => {
      userRole.roles?.role_permissions?.forEach((rp: any) => {
        if (rp.permissions?.key) {
          permissions.add(rp.permissions.key);
        }
      });
    });

    return Array.from(permissions);
  },

  // Vérifier si un utilisateur a une permission
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  },

  // Récupérer les utilisateurs par rôle
  async getUsersByRole(roleName: string): Promise<User[]> {
    const { data, error } = await supabase
      .from("users")
      .select(`
        *,
        user_roles!inner(
          role_id,
          roles!inner(
            id,
            name,
            description
          )
        )
      `)
      .eq("user_roles.roles.name", roleName);

    if (error) throw error;

    return (data || []).map((item: { id: string; [key: string]: unknown }) => ({
      ...item,
      roles: (item.user_roles as any[])?.map((ur: any) => ur.roles?.name).filter(Boolean) || [],
    }));
  },

  // Synchroniser un utilisateur existant (pour migration)
  async syncUser(authUserId: string, profileData: {
    username: string;
    firstname?: string;
    lastname?: string;
    color?: string;
    code_gestionnaire?: string;
    roles?: string[];
  }): Promise<User> {
    // 1. Vérifier que l'utilisateur existe dans auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(authUserId);
    if (authError || !authUser.user) {
      throw new Error("Auth user not found");
    }

    // 2. Créer ou mettre à jour le profil dans public.users
    const { data: profileDataResult, error: profileError } = await supabase
      .from("users")
      .upsert({
        id: authUserId, // Même ID que auth.users
        username: profileData.username,
        email: authUser.user.email,
        firstname: profileData.firstname,
        lastname: profileData.lastname,
        color: profileData.color,
        code_gestionnaire: profileData.code_gestionnaire,
        status: "offline",
        token_version: 0,
      })
      .select()
      .single();

    if (profileError) throw profileError;

    // 3. Assigner les rôles si spécifiés
    if (profileData.roles && profileData.roles.length > 0) {
      await this.assignRoles(authUserId, profileData.roles);
    }

    // 4. Récupérer l'utilisateur complet
    return await this.getById(authUserId);
  },

  // Récupérer les statistiques des utilisateurs
  async getStats(): Promise<UserStats> {
    const { data: users, error } = await supabase
      .from("users")
      .select(`
        status,
        user_roles!inner(
          roles!inner(
            name
          )
        ),
        last_seen_at
      `);

    if (error) throw error;

    const stats = {
      total: users?.length || 0,
      by_status: {} as Record<string, number>,
      by_role: {} as Record<string, number>,
      active_today: 0,
    };

    const today = new Date().toISOString().split('T')[0];

    users?.forEach((user: any) => {
      // Par statut
      const status = user.status || 'offline';
      stats.by_status[status] = (stats.by_status[status] || 0) + 1;

      // Par rôle
      user.user_roles?.forEach((ur: any) => {
        const roleName = ur.roles?.name;
        if (roleName) {
          stats.by_role[roleName] = (stats.by_role[roleName] || 0) + 1;
        }
      });

      // Actif aujourd'hui
      if (user.last_seen_at && user.last_seen_at.startsWith(today)) {
        stats.active_today++;
      }
    });

    return stats;
  },

  // Créer plusieurs utilisateurs en lot
  async createBulk(users: CreateUserData[]): Promise<BulkOperationResult> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const user of users) {
      try {
        const result = await this.create(user);
        results.success++;
        results.details.push({ item: user, success: true, data: result });
      } catch (error: unknown) {
        results.errors++;
        results.details.push({ item: user, success: false, error: safeErrorMessage(error, "la création de l'utilisateur") });
      }
    }

    return results;
  },

  // ===== GESTION DES OBJECTIFS DE MARGE =====
  
  /**
   * Récupère l'objectif de marge pour un gestionnaire et une période donnée
   * @param userId - ID du gestionnaire
   * @param periodType - Type de période (week, month, year)
   * @returns L'objectif ou null si non défini
   */
  async getTargetByUserAndPeriod(
    userId: string,
    periodType: TargetPeriodType
  ): Promise<GestionnaireTarget | null> {
    if (!userId) {
      throw new Error("userId is required");
    }

    const { data, error } = await supabase
      .from("gestionnaire_targets")
      .select("*")
      .eq("user_id", userId)
      .eq("period_type", periodType)
      .maybeSingle();

    if (error) {
      throw new Error(`Erreur lors de la récupération de l'objectif: ${error.message}`);
    }

    return data;
  },

  /**
   * Récupère tous les objectifs pour un gestionnaire
   * @param userId - ID du gestionnaire
   * @returns Liste des objectifs
   */
  async getTargetsByUser(userId: string): Promise<GestionnaireTarget[]> {
    if (!userId) {
      throw new Error("userId is required");
    }

    const { data, error } = await supabase
      .from("gestionnaire_targets")
      .select("*")
      .eq("user_id", userId)
      .order("period_type", { ascending: true });

    if (error) {
      throw new Error(`Erreur lors de la récupération des objectifs: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Récupère tous les objectifs pour une période donnée (tous les gestionnaires)
   * @param periodType - Type de période (week, month, year)
   * @returns Liste des objectifs
   */
  async getTargetsByPeriod(periodType: TargetPeriodType): Promise<GestionnaireTarget[]> {
    const { data, error } = await supabase
      .from("gestionnaire_targets")
      .select("*")
      .eq("period_type", periodType)
      .order("user_id", { ascending: true });

    if (error) {
      throw new Error(`Erreur lors de la récupération des objectifs: ${error.message}`);
    }

    return data || [];
  },

  /**
   * Crée ou met à jour un objectif pour un gestionnaire
   * Utilise une route API pour contourner les politiques RLS en production
   * @param data - Données de l'objectif
   * @param createdBy - ID de l'utilisateur qui crée/modifie l'objectif
   * @returns L'objectif créé ou mis à jour
   */
  async upsertTarget(
    data: CreateGestionnaireTargetData,
    createdBy: string
  ): Promise<GestionnaireTarget> {
    if (!data.user_id) {
      throw new Error("user_id is required");
    }
    if (!data.period_type) {
      throw new Error("period_type is required");
    }
    if (data.margin_target === undefined || data.margin_target === null) {
      throw new Error("margin_target is required");
    }

    try {
      // Utiliser la route API qui utilise le service role key pour contourner les politiques RLS
      const response = await fetch('/api/targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Inclure les cookies pour l'authentification
        body: JSON.stringify({
          user_id: data.user_id,
          period_type: data.period_type,
          margin_target: data.margin_target,
          performance_target: data.performance_target ?? 40,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data;
    } catch (error: any) {
      // Fallback vers l'ancienne méthode si la route API échoue (pour compatibilité)
      console.warn('[upsertTarget] Erreur avec la route API, fallback vers Supabase direct:', error);
      const { data: result, error: supabaseError } = await supabase
        .from("gestionnaire_targets")
        .upsert(
          {
            ...data,
            created_by: createdBy,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,period_type",
          }
        )
        .select()
        .single();

      if (supabaseError) {
        throw new Error(`Erreur lors de la création/mise à jour de l'objectif: ${supabaseError.message}`);
      }

      return result;
    }
  },

  /**
   * Met à jour un objectif existant
   * @param targetId - ID de l'objectif
   * @param data - Données à mettre à jour
   * @param updatedBy - ID de l'utilisateur qui met à jour l'objectif
   * @returns L'objectif mis à jour
   */
  async updateTarget(
    targetId: string,
    data: UpdateGestionnaireTargetData,
    updatedBy: string
  ): Promise<GestionnaireTarget> {
    if (!targetId) {
      throw new Error("targetId is required");
    }

    const { data: result, error } = await supabase
      .from("gestionnaire_targets")
      .update({
        ...data,
        created_by: updatedBy,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erreur lors de la mise à jour de l'objectif: ${error.message}`);
    }

    return result;
  },

  /**
   * Supprime un objectif
   * @param targetId - ID de l'objectif
   */
  async deleteTarget(targetId: string): Promise<void> {
    if (!targetId) {
      throw new Error("targetId is required");
    }

    const { error } = await supabase
      .from("gestionnaire_targets")
      .delete()
      .eq("id", targetId);

    if (error) {
      throw new Error(`Erreur lors de la suppression de l'objectif: ${error.message}`);
    }
  },

  /**
   * Récupère tous les objectifs (pour l'admin/president)
   * Utilise une route API pour contourner les politiques RLS en production
   * @returns Liste de tous les objectifs
   */
  async getAllTargets(): Promise<GestionnaireTarget[]> {
    try {
      // Utiliser la route API qui utilise le service role key pour contourner les politiques RLS
      const response = await fetch('/api/targets', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Inclure les cookies pour l'authentification
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error: any) {
      // Fallback vers l'ancienne méthode si la route API échoue (pour compatibilité)
      console.warn('[getAllTargets] Erreur avec la route API, fallback vers Supabase direct:', error);
      const { data, error: supabaseError } = await supabase
        .from("gestionnaire_targets")
        .select("*")
        .order("user_id", { ascending: true })
        .order("period_type", { ascending: true });

      if (supabaseError) {
        throw new Error(`Erreur lors de la récupération des objectifs: ${supabaseError.message}`);
      }

      return data || [];
    }
  },

  // ===== GESTION DES PRÉFÉRENCES UTILISATEUR =====
  
  /**
   * Récupère les préférences utilisateur
   * Utilise une route API pour contourner les politiques RLS en production
   * @param userId - ID de l'utilisateur (non utilisé côté serveur, mais conservé pour compatibilité)
   * @returns Les préférences ou les valeurs par défaut si non définies
   */
  async getUserPreferences(userId: string): Promise<{
    speedometer_margin_average_show_percentage: boolean
    speedometer_margin_total_show_percentage: boolean
  } | null> {
    if (!userId) {
      throw new Error("userId is required");
    }

    try {
      // Utiliser la route API qui utilise le service role key pour contourner les politiques RLS
      const response = await fetch('/api/user-preferences', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Inclure les cookies pour l'authentification
      });

      if (!response.ok) {
        // Si 404 ou autre erreur, retourner les valeurs par défaut
        if (response.status === 404) {
          return {
            speedometer_margin_average_show_percentage: true,
            speedometer_margin_total_show_percentage: true,
          };
        }
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // Si aucune donnée, retourner les valeurs par défaut
      if (!result.data) {
        return {
          speedometer_margin_average_show_percentage: true,
          speedometer_margin_total_show_percentage: true,
        };
      }

      return {
        speedometer_margin_average_show_percentage: result.data.speedometer_margin_average_show_percentage ?? true,
        speedometer_margin_total_show_percentage: result.data.speedometer_margin_total_show_percentage ?? true,
      };
    } catch (error: any) {
      // Si l'erreur est déjà une Error avec un message, la relancer
      if (error instanceof Error) {
        throw error;
      }
      // Sinon, créer une nouvelle erreur
      throw new Error(`Erreur lors de la récupération des préférences: ${error?.message || 'Erreur inconnue'}`);
    }
  },

  /**
   * Met à jour les préférences utilisateur
   * Utilise une route API pour contourner les politiques RLS en production
   * @param userId - ID de l'utilisateur (non utilisé côté serveur, mais conservé pour compatibilité)
   * @param preferences - Les préférences à mettre à jour
   */
  async updateUserPreferences(
    userId: string,
    preferences: {
      speedometer_margin_average_show_percentage?: boolean
      speedometer_margin_total_show_percentage?: boolean
    }
  ): Promise<void> {
    if (!userId) {
      throw new Error("userId is required");
    }

    try {
      // Utiliser la route API qui utilise le service role key pour contourner les politiques RLS
      const response = await fetch('/api/user-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Inclure les cookies pour l'authentification
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(errorData.error || `Erreur HTTP ${response.status}`);
      }
    } catch (error: any) {
      // Si l'erreur est déjà une Error avec un message, la relancer
      if (error instanceof Error) {
        throw error;
      }
      // Sinon, créer une nouvelle erreur
      throw new Error(`Erreur lors de la mise à jour des préférences: ${error?.message || 'Erreur inconnue'}`);
    }
  },
};
