// ===== UTILITAIRES COMMUNS POUR L'API V2 =====
// Fonctions partagées entre toutes les APIs

import { supabase } from "@/lib/supabase-client";

// Ré-exporter le cache centralisé
export {
  getReferenceCache,
  invalidateReferenceCache,
  referenceCacheManager,
  type ReferenceCache,
  type ReferenceData,
} from "./cache";

// Ré-exporter les constantes centralisées
export {
  INTERVENTION_STATUS,
  INTERVENTION_METIERS,
  DOCUMENT_TYPES,
  COMMENT_TYPES,
  COST_TYPES,
  ENTITY_TYPES,
  USER_STATUS,
  MAX_BATCH_SIZE,
  DEFAULT_FUNCTIONS_URL,
  type InterventionStatusCode,
  type InterventionMetierCode,
  type InterventionDocumentType,
  type ArtisanDocumentType,
  type CommentType,
  type CostType,
  type EntityType,
  type UserStatus,
} from "./constants";

/**
 * Construit l'URL des Edge Functions en prenant en compte les variations possibles
 * de NEXT_PUBLIC_SUPABASE_URL (avec ou sans /rest/v1 et slash final).
 * Normalise également 127.0.0.1 en localhost pour éviter les problèmes CORS.
 * Supporte aussi SUPABASE_URL pour les scripts Node.js.
 */
export const getSupabaseFunctionsUrl = (): string => {
  // Vérifier d'abord une URL explicite pour les Edge Functions
  const explicitUrl =
    process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL ||
    process.env.SUPABASE_FUNCTIONS_URL;
  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "").replace(/127\.0\.0\.1/g, "localhost");
  }

  // Sinon, construire depuis l'URL de base Supabase
  const rawUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

  if (!rawUrl) {
    return "http://localhost:54321/functions/v1";
  }

  // Normaliser 127.0.0.1 en localhost pour éviter les problèmes CORS
  let sanitized = rawUrl.replace(/\/$/, "").replace(/127\.0\.0\.1/g, "localhost");

  if (sanitized.endsWith("/rest/v1")) {
    return sanitized.replace(/\/rest\/v1$/, "/functions/v1");
  }

  return `${sanitized}/functions/v1`;
};

export const SUPABASE_FUNCTIONS_URL = getSupabaseFunctionsUrl();

// Headers communs pour toutes les requêtes
export const getHeaders = async () => {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // Détecter si on est dans Node.js (pas de window)
  const isNodeJs = typeof window === "undefined";

  // Pour l'apikey, toujours utiliser l'anon key (disponible côté client et serveur)
  const apiKey = anonKey;

  // Pour le token Authorization
  let token = anonKey; // Par défaut, utiliser l'anon key (valide pour les Edge Functions)

  if (isNodeJs) {
    // Côté serveur (Node.js), on peut utiliser serviceRoleKey si disponible
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (serviceRoleKey) {
      token = serviceRoleKey;
    }
  } else {
    // Côté client (browser), essayer d'obtenir la session utilisateur
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.access_token) {
        // Utiliser le token de session si disponible
        token = session.session.access_token;
      }
      // Sinon, token reste l'anon key (valide pour les Edge Functions)
    } catch (error) {
      // En cas d'erreur, continuer avec l'anon key (qui est valide pour les Edge Functions)
      console.warn("[getHeaders] Failed to get session, using anon key:", error);
    }
  }

  return {
    apikey: apiKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

// Gestionnaire d'erreurs centralisé
export const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  return response.json();
};

// Fonction pour convertir un fichier en base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Retirer le préfixe "data:image/jpeg;base64," par exemple
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Fonction pour obtenir la taille d'un fichier en format lisible
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// Fonction pour valider un type MIME
export const isValidMimeType = (mimeType: string): boolean => {
  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/heic",
    "image/heif",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
    "video/mp4",
    "text/plain",
  ];
  return allowedTypes.includes(mimeType);
};

// Fonction pour générer un mot de passe sécurisé
export const generateSecurePassword = (length: number = 12): string => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

// Fonction pour valider un email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Fonction pour valider un nom d'utilisateur
export const isValidUsername = (username: string): boolean => {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

// Fonction pour générer un code gestionnaire unique
export const generateUniqueCodeGestionnaire = async (
  firstname: string,
  lastname: string
): Promise<string> => {
  const baseCode = `${firstname.charAt(0).toUpperCase()}${lastname.charAt(0).toUpperCase()}`;
  let code = baseCode;
  let counter = 1;

  while (true) {
    const { data, error } = await supabase
      .from("users")
      .select("code_gestionnaire")
      .eq("code_gestionnaire", code)
      .single();

    if (error && error.code === "PGRST116") {
      // Code n'existe pas, on peut l'utiliser
      break;
    } else if (error) {
      throw error;
    }

    // Code existe, essayer avec un numéro
    code = `${baseCode}${counter}`;
    counter++;
  }

  return code;
};

// Fonction pour construire l'affichage d'un utilisateur
export const buildUserDisplay = (user?: any) => {
  if (!user) {
    return {
      username: null as string | null,
      fullName: null as string | null,
      code: null as string | null,
      color: null as string | null,
      avatarUrl: null as string | null,
    };
  }

  const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();

  return {
    username: user.username ?? null,
    fullName: fullName || user.username || null,
    code: user.code_gestionnaire ?? null,
    color: user.color ?? null,
    avatarUrl: user.avatar_url ?? null,
  };
};

// Fonction pour mapper un enregistrement d'intervention
export const mapInterventionRecord = (item: any, refs: any): any => {
  const userInfo = buildUserDisplay(
    refs.usersById?.get(item.assigned_user_id ?? "")
  );
  const agency = item.agence_id
    ? refs.agenciesById?.get(item.agence_id)
    : undefined;
  const statusRelationship = item.status ?? item.intervention_statuses ?? null;
  const status =
    statusRelationship ??
    (item.statut_id
      ? refs.interventionStatusesById?.get(item.statut_id)
      : undefined);
  const normalizedStatus = status
    ? {
      id: status.id,
      code: status.code,
      label: status.label,
      color: status.color,
      sort_order: status.sort_order ?? null,
    }
    : undefined;
  const statusCode =
    normalizedStatus?.code ?? item.statut ?? item.statusValue ?? null;
  const metier = item.metier_id
    ? refs.metiersById?.get(item.metier_id)
    : undefined;
  const tenantId = item.tenant_id ?? item.client_id ?? null;
  const ownerId = item.owner_id ?? null;

  // Extraction des artisans depuis intervention_artisans
  const interventionArtisans = Array.isArray(item.intervention_artisans)
    ? item.intervention_artisans
    : [];
  const artisanIds = interventionArtisans
    .map((ia: any) => ia.artisan_id)
    .filter(Boolean);

  // Extraction de l'artisan principal pour l'affichage
  const primaryArtisanEntry = interventionArtisans.find((ia: any) => ia.is_primary) ?? interventionArtisans[0];
  const primaryArtisanData = primaryArtisanEntry?.artisans ?? primaryArtisanEntry?.artisan ?? null;

  // Construction du nom d'affichage de l'artisan avec fallback :
  // 1. raison_sociale (si non null/vide)
  // 2. plain_nom (si non null/vide)
  // 3. prenom nom (concaténation si non null/vide)
  // 4. null (affichera "—")
  let artisanDisplayName: string | null = null;
  if (primaryArtisanData) {
    const raisonSociale = primaryArtisanData.raison_sociale?.trim();
    const plainNom = primaryArtisanData.plain_nom?.trim();
    const prenom = primaryArtisanData.prenom?.trim();
    const nom = primaryArtisanData.nom?.trim();

    // Log détaillé pour chaque intervention
    const interventionId = item.id_inter || 'unknown';

    if (prenom || nom) {
      artisanDisplayName = `${prenom ?? ""} ${nom ?? ""}`.trim() || null;
    } else if (plainNom && plainNom.length > 0) {
      artisanDisplayName = plainNom;
    } else if (raisonSociale && raisonSociale.length > 0) {
      artisanDisplayName = raisonSociale;
    } else {
    }
  }

  // Extraction des coûts depuis intervention_costs
  const interventionCosts = Array.isArray(item.intervention_costs)
    ? item.intervention_costs
    : [];

  // Calcul des totaux de coûts depuis intervention_costs
  // cost_type: "sst" | "materiel" | "intervention" (CA) | "marge"
  const calculatedCosts = {
    total_ca: interventionCosts
      .filter((c: any) => c.cost_type === "intervention" || c.cost_type === "ca")
      .reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0) || null,
    total_sst: interventionCosts
      .filter((c: any) => c.cost_type === "sst")
      .reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0) || null,
    total_materiel: interventionCosts
      .filter((c: any) => c.cost_type === "materiel")
      .reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0) || null,
    total_marge: interventionCosts
      .filter((c: any) => c.cost_type === "marge")
      .reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0) || null,
  };

  // Extraction des coûts depuis le cache (intervention_costs_cache) - priorité sur le cache si disponible
  const costsCache = item.costs_cache ?? null;

  return {
    ...item,
    tenant_id: tenantId,
    owner_id: ownerId,
    client_id: item.client_id ?? tenantId,
    status: normalizedStatus,
    statusLabel: normalizedStatus?.label ?? item.statusLabel ?? null,
    artisans: artisanIds, // Liste des IDs d'artisans
    artisan: artisanDisplayName, // Nom d'affichage de l'artisan principal (raison_sociale > plain_nom > prenom nom)
    primaryArtisan: primaryArtisanData, // Données complètes de l'artisan principal
    costs: interventionCosts, // Liste des coûts avec leurs labels
    payments: Array.isArray(item.payments) && item.payments.length > 0
      ? item.payments
      : Array.isArray(item.intervention_payments)
        ? item.intervention_payments
        : [],
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    // Utiliser le cache des coûts si disponible, sinon calculer depuis intervention_costs, sinon fallback sur les champs directs
    coutIntervention:
      costsCache?.total_ca ??
      calculatedCosts.total_ca ??
      item.cout_intervention ??
      item.coutIntervention ??
      null,
    coutSST:
      costsCache?.total_sst ??
      calculatedCosts.total_sst ??
      item.cout_sst ??
      item.coutSST ??
      null,
    coutMateriel:
      costsCache?.total_materiel ??
      calculatedCosts.total_materiel ??
      item.cout_materiel ??
      item.coutMateriel ??
      null,
    marge:
      costsCache?.total_marge ??
      calculatedCosts.total_marge ??
      item.marge ??
      null,
    agence: agency?.label ?? item.agence ?? item.agence_id ?? null,
    agenceLabel: agency?.label ?? null,
    agenceCode: agency?.code ?? null,
    agenceColor: agency?.color ?? null,
    reference_agence: item.reference_agence ?? item.referenceAgence ?? null,
    contexteIntervention:
      item.contexte_intervention ?? item.contexteIntervention ?? null,
    consigneIntervention:
      item.consigne_intervention ?? item.consigneIntervention ?? null,
    consigneDeuxiemeArtisanIntervention:
      item.consigne_second_artisan ??
      item.consigneDeuxiemeArtisanIntervention ??
      null,
    commentaireAgent: item.commentaire_agent ?? item.commentaireAgent ?? null,
    latitudeAdresse:
      typeof item.latitude === "number"
        ? item.latitude.toString()
        : item.latitudeAdresse ?? null,
    longitudeAdresse:
      typeof item.longitude === "number"
        ? item.longitude.toString()
        : item.longitudeAdresse ?? null,
    adresse: item.adresse_complete || item.adresse || null,
    adresse_complete: item.adresse_complete || null,
    adresseComplete: item.adresse_complete || null,
    codePostal: item.code_postal ?? item.codePostal ?? null,
    dateIntervention:
      item.date_intervention ?? item.dateIntervention ?? item.date ?? null,
    prenomClient: item.prenom_client ?? item.prenomClient ?? null,
    nomClient: item.nom_client ?? item.nomClient ?? null,
    nomPrenomClient:
      item.plain_nom_client ??
      item.nomPrenomClient ??
      (item.nom_client ||
        item.nomClient ||
        item.prenom_client ||
        item.prenomClient
        ? `${item.nom_client ?? item.nomClient ?? ""} ${item.prenom_client ?? item.prenomClient ?? ""}`.trim()
        : null),
    attribueA: userInfo.code ?? userInfo.username ?? undefined,
    assignedUserName: userInfo.fullName ?? undefined,
    assignedUserCode: userInfo.code,
    assignedUserColor: userInfo.color ?? null,
    assignedUserAvatarUrl: userInfo.avatarUrl ?? null,
    statut: statusCode,
    statusValue: statusCode,
    statusColor: normalizedStatus?.color ?? null,
    numeroSST: item.numero_sst ?? item.numeroSST ?? null,
    pourcentageSST: item.pourcentage_sst ?? item.pourcentageSST ?? null,
    commentaire: item.commentaire ?? item.commentaire_agent ?? null,
    demandeIntervention:
      item.demande_intervention ?? item.demandeIntervention ?? null,
    demandeDevis: item.demande_devis ?? item.demandeDevis ?? null,
    demandeTrustPilot:
      item.demande_trust_pilot ?? item.demandeTrustPilot ?? null,
    metier: metier?.code ?? item.metier ?? item.metier_id ?? null,
    metierLabel: metier?.label ?? null,
    metierCode: metier?.code ?? null,
    metierColor: metier?.color ?? null,
    type: item.type ?? null,
    typeDeuxiemeArtisan:
      item.type_deuxieme_artisan ?? item.typeDeuxiemeArtisan ?? null,
    datePrevue: item.date_prevue ?? item.datePrevue ?? null,
    datePrevueDeuxiemeArtisan:
      item.date_prevue_deuxieme_artisan ??
      item.datePrevueDeuxiemeArtisan ??
      null,
    telLoc: item.tel_loc ?? item.telLoc ?? null,
    locataire: item.locataire ?? null,
    emailLocataire: item.email_locataire ?? item.emailLocataire ?? null,
    telephoneClient: item.telephone_client ?? item.telephoneClient ?? null,
    telephone2Client: item.telephone2_client ?? item.telephone2Client ?? null,
    emailClient: item.email_client ?? item.emailClient ?? null,
    prenomProprietaire:
      item.prenom_proprietaire ?? item.prenomProprietaire ?? null,
    nomProprietaire: item.nom_proprietaire ?? item.nomProprietaire ?? null,
    nomPrenomFacturation:
      item.plain_nom_facturation ??
      item.nomPrenomFacturation ??
      (item.nom_proprietaire ||
        item.nomProprietaire ||
        item.prenom_proprietaire ||
        item.prenomProprietaire
        ? `${item.nom_proprietaire ?? item.nomProprietaire ?? ""} ${item.prenom_proprietaire ?? item.prenomProprietaire ?? ""}`.trim()
        : null),
    telephoneProprietaire:
      item.telephone_proprietaire ?? item.telephoneProprietaire ?? null,
    emailProprietaire:
      item.email_proprietaire ?? item.emailProprietaire ?? null,
    pieceJointeIntervention:
      item.piece_jointe_intervention ?? item.pieceJointeIntervention ?? [],
    pieceJointeCout: item.piece_jointe_cout ?? item.pieceJointeCout ?? [],
    pieceJointeDevis: item.piece_jointe_devis ?? item.pieceJointeDevis ?? [],
    pieceJointePhotos: item.piece_jointe_photos ?? item.pieceJointePhotos ?? [],
    pieceJointeFactureGMBS:
      item.piece_jointe_facture_gmbs ?? item.pieceJointeFactureGMBS ?? [],
    pieceJointeFactureArtisan:
      item.piece_jointe_facture_artisan ?? item.pieceJointeFactureArtisan ?? [],
    pieceJointeFactureMateriel:
      item.piece_jointe_facture_materiel ??
      item.pieceJointeFactureMateriel ??
      [],
    // Sous-statut personnalisé
    understatement: item.sous_statut_text ?? item.understatement ?? null,
    sousStatutTextColor: item.sous_statut_text_color ?? "#000000",
    sousStatutBgColor: item.sous_statut_bg_color ?? "transparent",
  };
};

// Fonction pour mapper un enregistrement d'artisan
export const mapArtisanRecord = (item: any, refs: any): any => {
  const userInfo = buildUserDisplay(
    refs.usersById?.get(item.gestionnaire_id ?? "")
  );

  // Extraire les métiers depuis artisan_metiers (relation Supabase) ou item.metiers (legacy)
  let metiers: any[] = [];
  if (Array.isArray(item.artisan_metiers)) {
    // Nouvelle structure : artisan_metiers est un tableau d'objets avec metiers.code
    // On extrait le code (ex: "BRI", "JAR") car le frontend utilise metierColorMap[code]
    metiers = item.artisan_metiers
      .map((am: any) => am.metiers?.code || am.metiers?.label)
      .filter(Boolean);
  } else if (Array.isArray(item.metiers)) {
    // Ancienne structure : metiers est déjà un tableau de codes/labels
    metiers = item.metiers;
  }

  // Extraire les zones depuis artisan_zones (relation Supabase) ou item.zones (legacy)
  let zones: any[] = [];
  if (Array.isArray(item.artisan_zones)) {
    // Nouvelle structure : artisan_zones est un tableau d'objets avec zone_id ou zones.id
    zones = item.artisan_zones
      .map((az: any) => az.zones?.id || az.zone_id)
      .filter(Boolean);
  } else if (Array.isArray(item.zones)) {
    // Ancienne structure : zones est déjà un tableau d'IDs
    zones = item.zones;
  }

  // Extraire les métadonnées de la photo de profil depuis artisan_attachments
  const attachments = Array.isArray(item.artisan_attachments)
    ? item.artisan_attachments
    : [];

  const photoProfilAttachment = attachments.find(
    (att: any) => att?.kind === "photo_profil" && att?.url && att.url.trim() !== ""
  );

  const photoProfilMetadata = photoProfilAttachment ? {
    hash: photoProfilAttachment.content_hash || null,
    sizes: photoProfilAttachment.derived_sizes || {},
    mime_preferred: photoProfilAttachment.mime_preferred || photoProfilAttachment.mime_type || 'image/jpeg',
    baseUrl: photoProfilAttachment.url || null
  } : null;

  const photoProfilBaseUrl = photoProfilMetadata?.baseUrl || null;

  return {
    ...item,
    metiers,
    zones,
    attribueA: userInfo.code ?? userInfo.username ?? undefined,
    gestionnaireUsername: userInfo.username ?? undefined,
    gestionnaireName: userInfo.fullName ?? undefined,
    statutArtisan: item.statut_id ?? item.statutArtisan ?? null,
    statutInactif: item.is_active === false,
    commentaire: item.suivi_relances_docs ?? item.commentaire ?? null,
    statutDossier: item.statut_dossier ?? item.statutDossier ?? null,
    zoneIntervention: zones.length
      ? Number(zones[0])
      : item.zoneIntervention ?? null,
    date: item.date_ajout ?? item.date ?? null,
    photoProfilBaseUrl,
    photoProfilMetadata,
  };
};

/**
 * Divise un tableau en lots de taille maximale
 * Utile pour éviter les erreurs de longueur d'URL avec les requêtes .in()
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// Export managedFetch for automatic request cancellation on logout
export { managedFetch } from "@/lib/api/abort-controller-manager";
