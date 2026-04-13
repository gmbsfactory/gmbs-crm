// ===== HELPERS POUR GÉRER LES OWNERS ET TENANTS DANS LES INTERVENTIONS =====

import { ownersApi, tenantsApi } from "@/lib/api";
import type { CreateOwnerData, CreateTenantData } from "@/lib/api/common/types";

/**
 * Trouve ou crée un owner (propriétaire) à partir des données du formulaire
 * @param ownerData - Données du propriétaire depuis le formulaire
 * @returns L'ID du owner trouvé ou créé, ou null si aucune donnée valide
 */
export async function findOrCreateOwner(ownerData: {
  nomPrenomFacturation?: string;
  telephoneProprietaire?: string;
  emailProprietaire?: string;
}): Promise<string | null> {
  const { nomPrenomFacturation, telephoneProprietaire, emailProprietaire } = ownerData;

  // Si aucune donnée n'est fournie, retourner null
  if (!nomPrenomFacturation && !telephoneProprietaire && !emailProprietaire) {
    return null;
  }

  // Si on a un téléphone, chercher d'abord par téléphone
  if (telephoneProprietaire && telephoneProprietaire.trim()) {
    try {
      const existingOwners = await ownersApi.searchByPhone(telephoneProprietaire.trim());
      if (existingOwners && existingOwners.length > 0) {
        // Mettre à jour l'owner existant avec les nouvelles données si nécessaire
        const existingOwner = existingOwners[0];

        // Normaliser les valeurs pour la comparaison (gérer null/undefined/espaces)
        const newNom = nomPrenomFacturation?.trim() || null;
        const existingNom = existingOwner.plain_nom_facturation?.trim() || null;
        const newEmail = emailProprietaire?.trim() || null;
        const existingEmail = existingOwner.email?.trim() || null;

        const needsUpdate =
          (newNom !== null && newNom !== existingNom) ||
          (newEmail !== null && newEmail !== existingEmail);

        if (needsUpdate) {
          await ownersApi.update(existingOwner.id, {
            plain_nom_facturation: newNom || existingOwner.plain_nom_facturation,
            email: newEmail || existingOwner.email,
          });
        }
        return existingOwner.id;
      }
    } catch (error) {
      console.warn("[findOrCreateOwner] Erreur lors de la recherche par téléphone:", error);
    }
  }

  // Si pas trouvé, créer un nouvel owner
  try {
    const createData: CreateOwnerData = {
      plain_nom_facturation: nomPrenomFacturation?.trim() || null,
      telephone: telephoneProprietaire?.trim() || null,
      email: emailProprietaire?.trim() || null,
    };

    // Ne créer que si on a au moins un nom ou un téléphone
    if (!createData.plain_nom_facturation && !createData.telephone) {
      return null;
    }

    const newOwner = await ownersApi.create(createData);
    return newOwner.id;
  } catch (error) {
    console.error("[findOrCreateOwner] Erreur lors de la création du owner:", error);
    throw error;
  }
}

/**
 * Trouve ou crée un tenant (client/locataire) à partir des données du formulaire
 * @param tenantData - Données du client depuis le formulaire
 * @returns L'ID du tenant trouvé ou créé, ou null si aucune donnée valide
 */
export async function findOrCreateTenant(tenantData: {
  nomPrenomClient?: string;
  telephoneClient?: string;
  emailClient?: string;
}): Promise<string | null> {
  const { nomPrenomClient, telephoneClient, emailClient } = tenantData;

  // Si aucune donnée n'est fournie, retourner null
  if (!nomPrenomClient && !telephoneClient && !emailClient) {
    return null;
  }

  // Si on a un téléphone, chercher d'abord par téléphone
  if (telephoneClient && telephoneClient.trim()) {
    try {
      const existingTenants = await tenantsApi.searchByPhone(telephoneClient.trim());
      if (existingTenants && existingTenants.length > 0) {
        // Mettre à jour le tenant existant avec les nouvelles données si nécessaire
        const existingTenant = existingTenants[0];

        // Normaliser les valeurs pour la comparaison (gérer null/undefined/espaces)
        const newNom = nomPrenomClient?.trim() || null;
        const existingNom = existingTenant.plain_nom_client?.trim() || null;
        const newEmail = emailClient?.trim() || null;
        const existingEmail = existingTenant.email?.trim() || null;

        const needsUpdate =
          (newNom !== null && newNom !== existingNom) ||
          (newEmail !== null && newEmail !== existingEmail);

        if (needsUpdate) {
          await tenantsApi.update(existingTenant.id, {
            plain_nom_client: newNom || existingTenant.plain_nom_client,
            email: newEmail || existingTenant.email,
          });
        }
        return existingTenant.id;
      }
    } catch (error) {
      console.warn("[findOrCreateTenant] Erreur lors de la recherche par téléphone:", error);
    }
  }

  // Si on a un email et pas trouvé par téléphone, chercher par email
  if (emailClient && emailClient.trim()) {
    try {
      const existingTenants = await tenantsApi.searchByEmail(emailClient.trim());
      if (existingTenants && existingTenants.length > 0) {
        // Mettre à jour le tenant existant avec les nouvelles données si nécessaire
        const existingTenant = existingTenants[0];

        // Normaliser les valeurs pour la comparaison (gérer null/undefined/espaces)
        const newNom = nomPrenomClient?.trim() || null;
        const existingNom = existingTenant.plain_nom_client?.trim() || null;
        const newTelephone = telephoneClient?.trim() || null;
        const existingTelephone = existingTenant.telephone?.trim() || null;

        const needsUpdate =
          (newNom !== null && newNom !== existingNom) ||
          (newTelephone !== null && newTelephone !== existingTelephone);

        if (needsUpdate) {
          await tenantsApi.update(existingTenant.id, {
            plain_nom_client: newNom || existingTenant.plain_nom_client,
            telephone: newTelephone || existingTenant.telephone,
          });
        }
        return existingTenant.id;
      }
    } catch (error) {
      console.warn("[findOrCreateTenant] Erreur lors de la recherche par email:", error);
    }
  }

  // Si pas trouvé, créer un nouveau tenant
  try {
    const createData: CreateTenantData = {
      plain_nom_client: nomPrenomClient?.trim() || null,
      telephone: telephoneClient?.trim() || null,
      email: emailClient?.trim() || null,
    };

    // Ne créer que si on a au moins un nom ou un téléphone ou un email
    if (!createData.plain_nom_client && !createData.telephone && !createData.email) {
      return null;
    }

    const newTenant = await tenantsApi.create(createData);
    return newTenant.id;
  } catch (error) {
    console.error("[findOrCreateTenant] Erreur lors de la création du tenant:", error);
    throw error;
  }
}












