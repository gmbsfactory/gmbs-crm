// ===== EXEMPLES D'UTILISATION - API USERS V2 =====
// Ce fichier montre comment utiliser l'API complète de gestion des utilisateurs

import { permissionsApi, rolesApi, usersApi, utilsApi } from '../src/lib/api/v2';

// ===== EXEMPLES DE CRÉATION D'UTILISATEURS =====

export const userExamples = {
  // Créer un nouvel utilisateur avec authentification complète
  async createNewUser() {
    try {
      const newUser = await usersApi.create({
        email: "nouveau@gmbs.fr",
        password: "motdepasse123",
        username: "nouveau",
        firstname: "Nouveau",
        lastname: "Utilisateur",
        color: "#FF5733",
        code_gestionnaire: "NU",
        roles: ["gestionnaire"]
      });

      console.log("Utilisateur créé:", newUser);
      return newUser;
    } catch (error) {
      console.error("Erreur création utilisateur:", error);
      throw error;
    }
  },

  // Créer un utilisateur avec mot de passe sécurisé généré
  async createUserWithSecurePassword() {
    try {
      const securePassword = utilsApi.generateSecurePassword(16);
      
      const newUser = await usersApi.create({
        email: "secure@gmbs.fr",
        password: securePassword,
        username: "secure",
        firstname: "Secure",
        lastname: "User",
        roles: ["manager"]
      });

      console.log("Utilisateur créé avec mot de passe sécurisé:", newUser);
      console.log("Mot de passe généré:", securePassword);
      return { user: newUser, password: securePassword };
    } catch (error) {
      console.error("Erreur création utilisateur sécurisé:", error);
      throw error;
    }
  },

  // Créer un utilisateur avec code gestionnaire auto-généré
  async createUserWithAutoCode() {
    try {
      const firstname = "Jean";
      const lastname = "Dupont";
      const autoCode = await utilsApi.generateUniqueCodeGestionnaire(firstname, lastname);

      const newUser = await usersApi.create({
        email: "jean.dupont@gmbs.fr",
        password: "jean123",
        username: "jean.dupont",
        firstname: firstname,
        lastname: lastname,
        code_gestionnaire: autoCode,
        roles: ["gestionnaire"]
      });

      console.log("Utilisateur créé avec code auto:", newUser);
      return newUser;
    } catch (error) {
      console.error("Erreur création utilisateur avec code auto:", error);
      throw error;
    }
  },

  // ===== EXEMPLES DE GESTION DES RÔLES =====

  // Assigner des rôles à un utilisateur existant
  async assignRolesToUser(userId: string) {
    try {
      await usersApi.assignRoles(userId, ["manager", "gestionnaire"]);
      console.log("Rôles assignés avec succès");
    } catch (error) {
      console.error("Erreur assignation rôles:", error);
      throw error;
    }
  },

  // Vérifier les permissions d'un utilisateur
  async checkUserPermissions(userId: string) {
    try {
      const permissions = await usersApi.getUserPermissions(userId);
      const hasWritePermission = await usersApi.hasPermission(userId, "write_interventions");
      
      console.log("Permissions de l'utilisateur:", permissions);
      console.log("Peut écrire des interventions:", hasWritePermission);
      
      return { permissions, hasWritePermission };
    } catch (error) {
      console.error("Erreur vérification permissions:", error);
      throw error;
    }
  },

  // ===== EXEMPLES DE MODIFICATION D'UTILISATEURS =====

  // Mettre à jour un utilisateur
  async updateUser(userId: string) {
    try {
      const updatedUser = await usersApi.update(userId, {
        firstname: "Nouveau Prénom",
        lastname: "Nouveau Nom",
        color: "#00FF00",
        status: "connected",
        roles: ["admin"] // Changement de rôle
      });

      console.log("Utilisateur mis à jour:", updatedUser);
      return updatedUser;
    } catch (error) {
      console.error("Erreur mise à jour utilisateur:", error);
      throw error;
    }
  },

  // Changer le mot de passe d'un utilisateur
  async changeUserPassword(userId: string, newPassword: string) {
    try {
      const updatedUser = await usersApi.update(userId, {
        password: newPassword
      });

      console.log("Mot de passe changé avec succès");
      return updatedUser;
    } catch (error) {
      console.error("Erreur changement mot de passe:", error);
      throw error;
    }
  },

  // ===== EXEMPLES DE RECHERCHE ET FILTRAGE =====

  // Récupérer tous les utilisateurs avec pagination
  async getAllUsersPaginated() {
    try {
      const result = await usersApi.getAll({
        limit: 10,
        offset: 0,
        status: "offline"
      });

      console.log("Utilisateurs récupérés:", result.data);
      console.log("Pagination:", result.pagination);
      return result;
    } catch (error) {
      console.error("Erreur récupération utilisateurs:", error);
      throw error;
    }
  },

  // Récupérer les utilisateurs par rôle
  async getUsersByRole(roleName: string) {
    try {
      const users = await usersApi.getUsersByRole(roleName);
      console.log(`Utilisateurs avec le rôle ${roleName}:`, users);
      return users;
    } catch (error) {
      console.error("Erreur récupération utilisateurs par rôle:", error);
      throw error;
    }
  },

  // Récupérer les statistiques des utilisateurs
  async getUserStats() {
    try {
      const stats = await usersApi.getStats();
      console.log("Statistiques utilisateurs:", stats);
      return stats;
    } catch (error) {
      console.error("Erreur récupération statistiques:", error);
      throw error;
    }
  },

  // ===== EXEMPLES DE GESTION DES RÔLES ET PERMISSIONS =====

  // Créer un nouveau rôle avec permissions
  async createCustomRole() {
    try {
      const newRole = await rolesApi.create({
        name: "supervisor",
        description: "Superviseur avec permissions étendues",
        permissions: [
          "read_interventions",
          "write_interventions",
          "delete_interventions",
          "read_artisans",
          "write_artisans",
          "view_admin"
        ]
      });

      console.log("Nouveau rôle créé:", newRole);
      return newRole;
    } catch (error) {
      console.error("Erreur création rôle:", error);
      throw error;
    }
  },

  // Créer une nouvelle permission
  async createCustomPermission() {
    try {
      const newPermission = await permissionsApi.create({
        key: "manage_reports",
        description: "Gérer les rapports et exports"
      });

      console.log("Nouvelle permission créée:", newPermission);
      return newPermission;
    } catch (error) {
      console.error("Erreur création permission:", error);
      throw error;
    }
  },

  // ===== EXEMPLES DE VALIDATION =====

  // Valider les données avant création
  async validateUserData(userData: any) {
    const errors: string[] = [];

    // Validation email
    if (!utilsApi.isValidEmail(userData.email)) {
      errors.push("Email invalide");
    }

    // Validation username
    if (!utilsApi.isValidUsername(userData.username)) {
      errors.push("Nom d'utilisateur invalide (3-20 caractères, lettres, chiffres, _, -)");
    }

    // Validation mot de passe
    if (userData.password && userData.password.length < 8) {
      errors.push("Mot de passe trop court (minimum 8 caractères)");
    }

    if (errors.length > 0) {
      throw new Error(`Données invalides: ${errors.join(", ")}`);
    }

    return true;
  },

  // ===== EXEMPLE COMPLET DE WORKFLOW =====

  // Workflow complet : créer un utilisateur, assigner des rôles, vérifier les permissions
  async completeUserWorkflow() {
    try {
      console.log("=== DÉBUT DU WORKFLOW UTILISATEUR ===");

      // 1. Valider les données
      const userData = {
        email: "workflow@gmbs.fr",
        password: "workflow123",
        username: "workflow",
        firstname: "Workflow",
        lastname: "Test",
        roles: ["manager"]
      };

      await this.validateUserData(userData);

      // 2. Créer l'utilisateur
      const newUser = await usersApi.create(userData);
      console.log("✅ Utilisateur créé:", newUser.id);

      // 3. Vérifier les permissions
      const permissions = await usersApi.getUserPermissions(newUser.id);
      console.log("✅ Permissions:", permissions);

      // 4. Modifier l'utilisateur
      const updatedUser = await usersApi.update(newUser.id, {
        color: "#FF0000",
        status: "connected"
      });
      console.log("✅ Utilisateur mis à jour");

      // 5. Récupérer les statistiques
      const stats = await usersApi.getStats();
      console.log("✅ Statistiques:", stats);

      console.log("=== WORKFLOW TERMINÉ AVEC SUCCÈS ===");
      return { user: updatedUser, permissions, stats };

    } catch (error) {
      console.error("❌ Erreur dans le workflow:", error);
      throw error;
    }
  }
};

// ===== EXEMPLES D'UTILISATION DANS UN COMPOSANT REACT =====

export const ReactUserManagementExamples = {
  // Hook pour gérer les utilisateurs
  useUserManagement() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const createUser = async (userData: any) => {
      setLoading(true);
      try {
        const newUser = await usersApi.create(userData);
        setUsers(prev => [...prev, newUser]);
        return newUser;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    };

    const updateUser = async (userId: string, data: any) => {
      setLoading(true);
      try {
        const updatedUser = await usersApi.update(userId, data);
        setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
        return updatedUser;
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    };

    const deleteUser = async (userId: string) => {
      setLoading(true);
      try {
        await usersApi.delete(userId);
        setUsers(prev => prev.filter(u => u.id !== userId));
      } catch (err) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    };

    return {
      users,
      loading,
      error,
      createUser,
      updateUser,
      deleteUser
    };
  }
};

// ===== EXPORT DES EXEMPLES =====
export default userExamples;
