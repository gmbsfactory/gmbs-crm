// ===== API CLIENT COMPLET ET SCALABLE =====
// Service API Supabase - Client pour les nouvelles Edge Functions
//
// FEATURES:
// - API complète pour interventions, artisans, documents, commentaires
// - CRUD complet avec validation
// - Gestion des relations et jointures
// - Upload de documents
// - Assignation d'artisans
// - Gestion des coûts et paiements
// - Pagination optimisée
// - Gestion d'erreurs robuste

import { env } from "./env";
import { referenceApi, type ReferenceData } from "./reference-api";
import { supabase } from "./supabase-client";
import type { InterventionView } from "@/types/intervention-view";
import { getHeaders } from "@/lib/api/v2/common/utils";

const resolveFunctionsUrl = () => {
  const explicitUrl =
    process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL || process.env.SUPABASE_FUNCTIONS_URL;
  if (explicitUrl) {
    // Normaliser 127.0.0.1 en localhost pour éviter les problèmes CORS
    return explicitUrl.replace(/\/$/, "").replace(/127\.0\.0\.1/g, "localhost");
  }

  const baseUrl = env.SUPABASE_URL?.replace(/\/$/, "") ?? "http://localhost:54321";
  // Normaliser 127.0.0.1 en localhost pour éviter les problèmes CORS
  const normalizedUrl = baseUrl.replace(/127\.0\.0\.1/g, "localhost");
  if (normalizedUrl.endsWith("/rest/v1")) {
    return normalizedUrl.replace(/\/rest\/v1$/, "/functions/v1");
  }
  return `${normalizedUrl}/functions/v1`;
};

const SUPABASE_FUNCTIONS_URL = resolveFunctionsUrl();

// Gestionnaire d'erreurs centralisé
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  return response.json();
};

type ReferenceCache = {
  data: ReferenceData;
  fetchedAt: number;
  usersById: Map<string, ReferenceData["users"][number]>;
  agenciesById: Map<string, ReferenceData["agencies"][number]>;
  interventionStatusesById: Map<
    string,
    ReferenceData["interventionStatuses"][number]
  >;
  artisanStatusesById: Map<string, ReferenceData["artisanStatuses"][number]>;
  metiersById: Map<string, ReferenceData["metiers"][number]>;
};

const REFERENCE_CACHE_DURATION = 5 * 60 * 1000;
let referenceCache: ReferenceCache | null = null;
let referenceCachePromise: Promise<ReferenceCache> | null = null;

// Taille maximale des lots pour les requêtes .in() pour éviter les erreurs de longueur d'URL
const MAX_BATCH_SIZE = 100;

/**
 * Divise un tableau en lots de taille maximale
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Filtre les artisans par métiers en divisant les requêtes en lots pour éviter les erreurs de longueur d'URL
 */
async function filterArtisansByMetiers(
  artisanIds: string[],
  metierIds: string[]
): Promise<Set<string>> {
  if (artisanIds.length === 0 || metierIds.length === 0) {
    return new Set();
  }

  const filteredIds = new Set<string>();

  // Diviser les artisanIds en lots
  const artisanIdChunks = chunkArray(artisanIds, MAX_BATCH_SIZE);

  // Pour chaque lot d'artisanIds, faire une requête
  for (const artisanIdChunk of artisanIdChunks) {
    const { data: artisansWithMetiers, error: metierError } = await supabase
      .from("artisan_metiers")
      .select("artisan_id")
      .in("metier_id", metierIds)
      .in("artisan_id", artisanIdChunk);

    if (metierError) {
      console.error("Erreur lors du filtrage par métiers:", metierError);
      throw metierError;
    }

    if (artisansWithMetiers) {
      artisansWithMetiers.forEach((am: any) => {
        if (am.artisan_id) {
          filteredIds.add(am.artisan_id);
        }
      });
    }
  }

  return filteredIds;
}

/**
 * Filtre les artisans par un seul métier en divisant les requêtes en lots
 */
async function filterArtisansByMetier(
  artisanIds: string[],
  metierId: string
): Promise<Set<string>> {
  if (artisanIds.length === 0) {
    return new Set();
  }

  const filteredIds = new Set<string>();

  // Diviser les artisanIds en lots
  const artisanIdChunks = chunkArray(artisanIds, MAX_BATCH_SIZE);

  // Pour chaque lot d'artisanIds, faire une requête
  for (const artisanIdChunk of artisanIdChunks) {
    const { data: artisansWithMetier, error: metierError } = await supabase
      .from("artisan_metiers")
      .select("artisan_id")
      .eq("metier_id", metierId)
      .in("artisan_id", artisanIdChunk);

    if (metierError) {
      console.error("Erreur lors du filtrage par métier:", metierError);
      throw metierError;
    }

    if (artisansWithMetier) {
      artisansWithMetier.forEach((am: any) => {
        if (am.artisan_id) {
          filteredIds.add(am.artisan_id);
        }
      });
    }
  }

  return filteredIds;
}

export const invalidateReferenceCache = () => {
  referenceCache = null;
  referenceCachePromise = null;
};

async function getReferenceCache(): Promise<ReferenceCache> {
  const now = Date.now();
  if (
    referenceCache &&
    now - referenceCache.fetchedAt < REFERENCE_CACHE_DURATION
  ) {
    return referenceCache;
  }

  if (referenceCachePromise) {
    return referenceCachePromise;
  }

  referenceCachePromise = (async () => {
    const data = await referenceApi.getAll();
    const cache: ReferenceCache = {
      data,
      fetchedAt: Date.now(),
      usersById: new Map(data.users.map((user) => [user.id, user])),
      agenciesById: new Map(data.agencies.map((agency) => [agency.id, agency])),
      interventionStatusesById: new Map(
        data.interventionStatuses.map((status) => [status.id, status])
      ),
      artisanStatusesById: new Map(
        data.artisanStatuses.map((status) => [status.id, status])
      ),
      metiersById: new Map(data.metiers.map((metier) => [metier.id, metier])),
    };
    referenceCache = cache;
    referenceCachePromise = null;
    return cache;
  })();

  try {
    return await referenceCachePromise;
  } catch (error) {
    referenceCachePromise = null;
    throw error;
  }
}

const buildUserDisplay = (user?: ReferenceData["users"][number] | null) => {
  if (!user) {
    return {
      username: null as string | null,
      fullName: null as string | null,
      code: null as string | null,
      color: null as string | null,
    };
  }

  const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();

  return {
    username: user.username ?? null,
    fullName: fullName || user.username || null,
    code: user.code_gestionnaire ?? null,
    color: user.color ?? null,
  };
};

const mapInterventionRecord = (
  item: any,
  refs: ReferenceCache
): Intervention => {
  const userInfo = buildUserDisplay(
    refs.usersById.get(item.assigned_user_id ?? "")
  );
  const agency = item.agence_id
    ? refs.agenciesById.get(item.agence_id)
    : undefined;
  const statusRelationship = item.status ?? item.intervention_statuses ?? null;
  const status =
    statusRelationship ??
    (item.statut_id
      ? refs.interventionStatusesById.get(item.statut_id)
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
  const statusCode = normalizedStatus?.code ?? item.statut ?? item.statusValue ?? null;
  const metier = item.metier_id
    ? refs.metiersById.get(item.metier_id)
    : undefined;

  // Extraction de l'artisan principal et de tous les artisans
  const interventionArtisans = Array.isArray(item.intervention_artisans) ? item.intervention_artisans : [];
  const primaryArtisan = interventionArtisans.find((ia: any) => ia.is_primary)?.artisans;
  const allArtisans = interventionArtisans.map((ia: any) => ia.artisans).filter(Boolean);

  // Extraction des coûts depuis intervention_costs
  const interventionCosts = Array.isArray(item.intervention_costs) ? item.intervention_costs : [];
  const coutInterventionObj = interventionCosts.find(
    (cost: any) => cost.cost_type === 'intervention' || cost.label === 'Coût Intervention'
  );
  const coutSSTObj = interventionCosts.find(
    (cost: any) => cost.cost_type === 'artisan' || cost.cost_type === 'sst' || cost.label === 'Coût SST'
  );
  const coutMaterielObj = interventionCosts.find(
    (cost: any) => cost.cost_type === 'material' || cost.label === 'Coût Matériel'
  );

  return {
    ...item,
    artisans: allArtisans,
    artisan: primaryArtisan?.plain_nom || primaryArtisan?.nom || null, // Alias pour la colonne "Artisan principal"
    primaryArtisan: primaryArtisan ? {
      id: primaryArtisan.id,
      prenom: primaryArtisan.prenom,
      nom: primaryArtisan.nom,
      plain_nom: primaryArtisan.plain_nom,
      telephone: primaryArtisan.telephone,
      email: primaryArtisan.email,
    } : null,
    costs: interventionCosts,
    payments: Array.isArray(item.payments) ? item.payments : [],
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    coutIntervention: coutInterventionObj?.amount ?? item.cout_intervention ?? item.coutIntervention ?? null,
    coutSST: coutSSTObj?.amount ?? item.cout_sst ?? item.coutSST ?? null,
    coutMateriel: coutMaterielObj?.amount ?? item.cout_materiel ?? item.coutMateriel ?? null,
    marge: item.marge ?? null,
    agence: agency?.label ?? item.agence ?? item.agence_id ?? null,
    agenceLabel: agency?.label ?? null,
    agenceCode: agency?.code ?? null,
    referenceAgence: item.reference_agence ?? item.referenceAgence ?? null,
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
    codePostal: item.code_postal ?? item.codePostal ?? null,
    // ⚠️ Priorité à 'date' qui est la vraie colonne DB
    dateIntervention:
      item.date ?? item.dateIntervention ?? item.date_intervention ?? null,
    prenomClient: item.prenom_client ?? item.prenomClient ?? null,
    nomClient: item.nom_client ?? item.nomClient ?? null,
    attribueA: userInfo.code ?? userInfo.username ?? undefined,
    assignedUserName: userInfo.fullName ?? undefined,
    assignedUserCode: userInfo.code,
    assignedUserColor: userInfo.color ?? null,
    status: normalizedStatus,
    statusLabel: normalizedStatus?.label ?? item.statusLabel ?? null,
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
  };
};

const mapArtisanRecord = (item: any, refs: ReferenceCache): Artisan => {
  const userInfo = buildUserDisplay(
    refs.usersById.get(item.gestionnaire_id ?? "")
  );

  // Extraire les métiers depuis artisan_metiers
  const metiers = Array.isArray(item.artisan_metiers)
    ? item.artisan_metiers
      .map((am: any) => am.metiers?.code || am.metiers?.label)
      .filter(Boolean)
    : Array.isArray(item.metiers)
      ? item.metiers
      : [];

  // Extraire les zones depuis artisan_zones
  const zones = Array.isArray(item.artisan_zones)
    ? item.artisan_zones
      .map((az: any) => az.zones?.code || az.zones?.label)
      .filter(Boolean)
    : Array.isArray(item.zones)
      ? item.zones
      : [];

  // Extraire les métadonnées de la photo de profil depuis artisan_attachments
  const attachments = Array.isArray(item.artisan_attachments)
    ? item.artisan_attachments
    : Array.isArray(item.attachments)
      ? item.attachments
      : [];

  const photoProfilAttachment = attachments.find(
    (att: any) => att?.kind === "photo_profil" && att?.url && att.url.trim() !== ""
  );

  // Construire les métadonnées de la photo de profil
  const photoProfilMetadata = photoProfilAttachment ? {
    hash: photoProfilAttachment.content_hash || null,
    sizes: photoProfilAttachment.derived_sizes || {},
    mime_preferred: photoProfilAttachment.mime_preferred || photoProfilAttachment.mime_type || 'image/jpeg',
    baseUrl: photoProfilAttachment.url || null
  } : null;

  // URL de base pour la photo de profil (sans taille spécifique)
  const photoProfilBaseUrl = photoProfilMetadata?.baseUrl || null;

  return {
    // Propriétés de base de l'artisan
    id: item.id,
    prenom: item.prenom,
    nom: item.nom,
    email: item.email,
    plain_nom: item.plain_nom,
    telephone: item.telephone,
    telephone2: item.telephone2,
    departement: item.departement,
    raison_sociale: item.raison_sociale,
    siret: item.siret,
    statut_juridique: item.statut_juridique,
    adresse_siege_social: item.adresse_siege_social,
    ville_siege_social: item.ville_siege_social,
    code_postal_siege_social: item.code_postal_siege_social,
    adresse_intervention: item.adresse_intervention,
    ville_intervention: item.ville_intervention,
    code_postal_intervention: item.code_postal_intervention,
    intervention_latitude: item.intervention_latitude,
    intervention_longitude: item.intervention_longitude,
    numero_associe: item.numero_associe,
    gestionnaire_id: item.gestionnaire_id,
    statut_id: item.statut_id,
    suivi_relances_docs: item.suivi_relances_docs,
    date_ajout: item.date_ajout,
    is_active: item.is_active,
    created_at: item.created_at,
    updated_at: item.updated_at,

    // Propriétés calculées et relations
    metiers,
    zones,
    attribueA: userInfo.code ?? userInfo.username ?? undefined,
    gestionnaireUsername: userInfo.username ?? undefined,
    gestionnaireName: userInfo.fullName ?? undefined,
    statutArtisan: item.statut_id ?? item.statutArtisan ?? null,
    statutInactif: item.is_active === false,
    commentaire: item.suivi_relances_docs ?? item.commentaire ?? null,
    statutDossier: item.statut_dossier ?? item.statutDossier ?? null,
    zoneIntervention:
      zones.length > 0
        ? Number(zones[0]) || zones[0]
        : item.zoneIntervention ?? null,
    date: item.date_ajout ?? item.date ?? null,
    photoProfilBaseUrl,
    photoProfilMetadata,
  };
};

// ===== TYPES ET INTERFACES =====

export interface User {
  id: string;
  firstname: string | null;
  lastname: string | null;
  username: string;
  email: string | null;
  roles: string[];
  token_version: number | null;
  color: string | null;
  code_gestionnaire: string | null;
  status: "connected" | "dnd" | "busy" | "offline";
  last_seen_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Artisan {
  id: string;
  prenom: string | null;
  nom: string | null;
  plain_nom: string | null;
  telephone: string | null;
  telephone2: string | null;
  email: string | null;
  raison_sociale: string | null;
  siret: string | null;
  statut_juridique: string | null;
  statut_id: string | null;
  gestionnaire_id: string | null;
  adresse_siege_social: string | null;
  ville_siege_social: string | null;
  code_postal_siege_social: string | null;
  departement: string | null;
  adresse_intervention: string | null;
  ville_intervention: string | null;
  code_postal_intervention: string | null;
  intervention_latitude: number | null;
  intervention_longitude: number | null;
  numero_associe: string | null;
  suivi_relances_docs: string | null;
  is_active: boolean | null;
  date_ajout: string | null;
  created_at: string | null;
  updated_at: string | null;
  photoProfilBaseUrl?: string | null;
  photoProfilMetadata?: {
    hash: string | null;
    sizes: Record<string, string>;
    mime_preferred: string;
    baseUrl: string | null;
  } | null;
  metiers?: string[];
  zones?: string[];
  // Propriétés calculées et relations
  attribueA?: string | undefined;
  gestionnaireUsername?: string | undefined;
  gestionnaireName?: string | undefined;
  statutArtisan?: string | null;
  statutInactif?: boolean;
  commentaire?: string | null;
  statutDossier?: string | null;
  zoneIntervention?: number | string | null;
  date?: string | null;
}

export interface Intervention {
  id: string;
  id_inter: string | null;
  agence_id: string | null;
  reference_agence: string | null;
  client_id: string | null;
  assigned_user_id: string | null;
  updated_by: string | null; // Utilisateur qui a effectué la dernière modification
  statut_id: string | null;
  metier_id: string | null;
  date: string;
  date_termine: string | null;
  date_prevue: string | null;
  due_date: string | null;
  contexte_intervention: string | null;
  consigne_intervention: string | null;
  consigne_second_artisan: string | null;
  commentaire_agent: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  latitude: number | null;
  longitude: number | null;
  numero_sst: string | null;
  pourcentage_sst: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  artisans?: string[];
  costs?: InterventionCost[];
  payments?: InterventionPayment[];
  attachments?: InterventionAttachment[];
}

export interface InterventionCost {
  id: string;
  intervention_id: string;
  cost_type: "sst" | "materiel" | "intervention" | "marge";
  label: string | null;
  amount: number;
  currency: string | null;
  metadata: any;
  created_at: string | null;
  updated_at: string | null;
}

export interface InterventionPayment {
  id: string;
  intervention_id: string;
  payment_type: string;
  amount: number;
  currency: string | null;
  is_received: boolean | null;
  payment_date: string | null;
  reference: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface InterventionAttachment {
  id: string;
  intervention_id: string;
  kind: string;
  url: string;
  filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string | null;
}

export interface ArtisanAttachment {
  id: string;
  artisan_id: string;
  kind: string;
  url: string;
  filename: string | null;
  mime_type: string | null;
  file_size: number | null;
  created_at: string | null;
  created_by: string | null;
  created_by_display: string | null;
  created_by_code: string | null;
  created_by_color: string | null;
}

export interface Comment {
  id: string;
  entity_id: string;
  entity_type: "intervention" | "artisan" | "client";
  content: string;
  comment_type: string;
  is_internal: boolean | null;
  author_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  users?: {
    id: string;
    firstname: string | null;
    lastname: string | null;
    username: string;
  };
}

export type CursorDirection = "forward" | "backward";

export interface InterventionCursor {
  date: string;
  id: string;
  direction?: CursorDirection;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    total: number;
    hasMore: boolean;
    offset?: number;
    hasPrev?: boolean;
    cursorNext?: InterventionCursor | null;
    cursorPrev?: InterventionCursor | null;
    direction?: CursorDirection;
  };
}

// ===== API INTERVENTIONS V2 =====

/**
 * Mapping des propriétés de la vue vers les vraies colonnes de la base
 * ⚠️ Basé STRICTEMENT sur le schéma réel : supabase/migrations/20251005_clean_schema.sql
 * ⚠️ Contient UNIQUEMENT les colonnes qui existent dans la table interventions
 */
const PROPERTY_COLUMN_MAP: Record<string, string> = {
  // Identifiants
  id: "id",
  id_inter: "id_inter",
  idInter: "id_inter",

  // Statut
  statusValue: "statut_id",
  statut: "statut_id",
  statut_id: "statut_id",

  // User assigné
  attribueA: "assigned_user_id",
  assigned_user_id: "assigned_user_id",
  assignedUserName: "assigned_user_id",
  assignedUserId: "assigned_user_id",

  // Agence
  agence: "agence_id",
  agence_id: "agence_id",
  agenceLabel: "agence_id",

  // Métier
  metier: "metier_id",
  metier_id: "metier_id",

  // Dates - ⚠️ La colonne principale est 'date', pas 'date_intervention'
  date: "date",
  dateIntervention: "date",
  date_intervention: "date",
  dateTermine: "date_termine",
  date_termine: "date_termine",
  datePrevue: "date_prevue",
  date_prevue: "date_prevue",
  dueDate: "due_date",
  due_date: "due_date",
  created_at: "created_at",
  updated_at: "updated_at",
  createdAt: "created_at",
  updatedAt: "updated_at",

  // Localisation
  codePostal: "code_postal",
  code_postal: "code_postal",
  ville: "ville",
  adresse: "adresse",
  latitude: "latitude",
  longitude: "longitude",
  latitudeAdresse: "latitude",
  longitudeAdresse: "longitude",

  // Tenant / Owner
  tenantId: "tenant_id",
  tenant_id: "tenant_id",
  clientId: "tenant_id",
  client_id: "tenant_id",
  ownerId: "owner_id",
  owner_id: "owner_id",

  // Champs texte intervention
  contexteIntervention: "contexte_intervention",
  contexte_intervention: "contexte_intervention",
  consigneIntervention: "consigne_intervention",
  consigne_intervention: "consigne_intervention",
  consigneDeuxiemeArtisanIntervention: "consigne_second_artisan",
  consigneSecondArtisan: "consigne_second_artisan",
  consigne_second_artisan: "consigne_second_artisan",
  commentaireAgent: "commentaire_agent",
  commentaire_agent: "commentaire_agent",
  commentaire: "commentaire_agent",

  // État
  isActive: "is_active",
  is_active: "is_active",
};

/**
 * Colonnes par défaut pour les interventions
 * ⚠️ Basé sur le schéma réel : supabase/migrations/20251005_clean_schema.sql
 * ⚠️ Les colonnes artisan, coûts sont dans des tables séparées (intervention_artisans, intervention_costs)
 */
const DEFAULT_INTERVENTION_COLUMNS: string[] = [
  "id",
  "id_inter",
  "created_at",
  "updated_at",
  "statut_id",
  "assigned_user_id",
  "agence_id",
  "tenant_id",
  "owner_id",
  "metier_id",
  "date",              // ⚠️ Colonne principale pour la date (PAS date_intervention)
  "date_termine",
  "date_prevue",
  "due_date",
  "contexte_intervention",
  "consigne_intervention",
  "consigne_second_artisan",
  "commentaire_agent",
  "adresse",
  "code_postal",
  "ville",
  "latitude",
  "longitude",
  "is_active",
];

/**
 * Champs calculés/dérivés qui NE SONT PAS des colonnes de la table interventions
 * Ces champs proviennent de jointures ou sont calculés côté client
 * ⚠️ Ces champs doivent être IGNORÉS lors de la construction du SELECT SQL
 */
const DERIVED_VIEW_FIELDS = new Set<string>([
  // Artisans (table intervention_artisans)
  "artisan",
  "artisans",
  "primaryArtisan",
  "deuxiemeArtisan",

  // Statut (enrichi côté client avec label/color)
  "status",
  "statusLabel",
  "statusColor",

  // User (enrichi côté client avec color)
  "assignedUserColor",
  "assignedUserCode",

  // Relations
  "payments",
  "costs",
  "attachments",
  "comments",

  // Coûts (table intervention_costs)
  "coutIntervention",
  "cout_intervention",
  "coutSST",
  "cout_sst",
  "coutMateriel",
  "cout_materiel",
  "marge",

  // Données client (table tenants)
  "nomClient",
  "nom_client",
  "prenomClient",
  "prenom_client",
  "telephoneClient",
  "telephone_client",
  "telephone2Client",
  "telephone2_client",
  "emailClient",
  "email_client",

  // Données propriétaire (table owner)
  "nomProprietaire",
  "nom_proprietaire",
  "prenomProprietaire",
  "prenom_proprietaire",
  "telephoneProprietaire",
  "telephone_proprietaire",
  "emailProprietaire",
  "email_proprietaire",

  // Pièces jointes (table intervention_attachments)
  "pieceJointeIntervention",
  "piece_jointe_intervention",
  "pieceJointeCout",
  "piece_jointe_cout",
  "pieceJointeDevis",
  "piece_jointe_devis",
  "pieceJointePhotos",
  "piece_jointe_photos",
  "pieceJointeFactureGMBS",
  "piece_jointe_facture_gmbs",
  "pieceJointeFactureArtisan",
  "piece_jointe_facture_artisan",
  "pieceJointeFactureMateriel",
  "piece_jointe_facture_materiel",

  // Champs qui n'existent plus dans le nouveau schéma
  "datePrevueDeuxiemeArtisan",
  "date_prevue_deuxieme_artisan",
  "typeDeuxiemeArtisan",
  "type_deuxieme_artisan",
  "numeroSST",
  "numero_sst",
  "pourcentageSST",
  "pourcentage_sst",
  "demandeIntervention",
  "demande_intervention",
  "demandeDevis",
  "demande_devis",
  "demandeTrustPilot",
  "demande_trust_pilot",
  "telLoc",
  "tel_loc",
  "locataire",
  "emailLocataire",
  "email_locataire",
  "devisId",
  "devis_id",
  "numeroAssocie",
  "numero_associe",
  "type",
]);

/**
 * Colonnes valides de la table interventions (whitelist)
 * ⚠️ AUCUNE colonne en dehors de cette liste ne sera ajoutée au SELECT
 */
const VALID_INTERVENTION_COLUMNS = new Set<string>(DEFAULT_INTERVENTION_COLUMNS);

const resolveColumn = (property: string): string | null => {
  // Si c'est un champ dérivé, on retourne null pour l'ignorer
  if (DERIVED_VIEW_FIELDS.has(property)) {
    return null;
  }

  // Si on a un mapping, on l'utilise
  const mapped = PROPERTY_COLUMN_MAP[property];
  if (mapped) {
    // Vérifier que la colonne mappée est valide
    return VALID_INTERVENTION_COLUMNS.has(mapped) ? mapped : null;
  }

  // Si pas de mapping, vérifier que la propriété est une colonne valide
  return VALID_INTERVENTION_COLUMNS.has(property) ? property : null;
};

const resolveSelectColumns = (fields?: string[]): string => {
  const columns = new Set<string>(DEFAULT_INTERVENTION_COLUMNS);

  if (Array.isArray(fields) && fields.length > 0) {
    fields.forEach((field) => {
      if (!field || typeof field !== 'string') return;

      const column = resolveColumn(field.trim());
      if (column) {
        columns.add(column);
      }
    });
  }

  const selection = Array.from(columns).filter(Boolean);
  return selection.length > 0 ? selection.join(",") : DEFAULT_INTERVENTION_COLUMNS.join(",");
};

type FilterValue = string | string[] | null | undefined;

export type GetAllParams = {
  limit?: number;
  offset?: number;
  statut?: FilterValue;
  agence?: FilterValue;
  artisan?: FilterValue;
  metier?: FilterValue;
  user?: FilterValue;
  startDate?: string;
  endDate?: string;
  search?: string;
  fields?: string[];
};

export type GetDistinctParams = Omit<GetAllParams, "limit" | "fields"> & {
  limit?: number;
};

const applyInterventionFilters = <T>(query: T, params?: GetAllParams): T => {
  if (!params) {
    return query;
  }

  type Builder = {
    in: (column: string, values: string[]) => Builder;
    eq: (column: string, value: string | null) => Builder;
    gte: (column: string, value: string) => Builder;
    lte: (column: string, value: string) => Builder;
    ilike: (column: string, pattern: string) => Builder;
    is: (column: string, value: null) => Builder;
  };

  let builder = query as unknown as Builder;

  if (params.statut) {
    if (Array.isArray(params.statut) && params.statut.length > 0) {
      builder = builder.in("statut_id", params.statut);
    } else if (typeof params.statut === "string") {
      builder = builder.eq("statut_id", params.statut);
    }
  }

  if (params.agence) {
    if (Array.isArray(params.agence) && params.agence.length > 0) {
      builder = builder.in("agence_id", params.agence);
    } else if (typeof params.agence === "string") {
      builder = builder.eq("agence_id", params.agence);
    }
  }

  if (params.metier) {
    if (Array.isArray(params.metier) && params.metier.length > 0) {
      builder = builder.in("metier_id", params.metier);
    } else if (typeof params.metier === "string") {
      builder = builder.eq("metier_id", params.metier);
    }
  }

  // ⚠️ TODO: Le filtre artisan nécessite un JOIN avec intervention_artisans
  // Pour l'instant, il est ignoré car artisan n'est pas une colonne directe

  const userFilter = (params as { user?: string | string[] | null })?.user;
  if (Array.isArray(userFilter) && userFilter.length > 0) {
    builder = builder.in("assigned_user_id", userFilter);
  } else if (typeof userFilter === "string") {
    builder = builder.eq("assigned_user_id", userFilter);
  } else if (userFilter === null) {
    builder = builder.is("assigned_user_id", null);
  }

  if (params.startDate) {
    builder = builder.gte("date", params.startDate);
  }
  if (params.endDate) {
    builder = builder.lte("date", params.endDate);
  }

  if (params.search) {
    builder = builder.ilike("contexte_intervention", `%${params.search}%`);
  }

  return builder as unknown as T;
};

// ✅ Mapping direct sans chunks (6K items = ~200ms, acceptable)
function mapInterventionRecordsBatch(
  items: any[],
  refs: ReferenceCache
): InterventionView[] {
  if (items.length === 0) return [];

  // Mapping synchrone direct - plus rapide que les chunks async
  return items.map((item) => mapInterventionRecord(item, refs) as InterventionView);
}

export const interventionsApiV2 = {
  // Récupérer toutes les interventions (chargement complet)
  async getAll(params: GetAllParams = {}): Promise<{ data: InterventionView[]; total: number }> {
    const limit = Math.max(1, params.limit ?? 100);
    const selectColumns = resolveSelectColumns(params?.fields);

    const searchParams = new URLSearchParams();
    searchParams.set("limit", limit.toString());
    if (params.offset !== undefined) {
      searchParams.set("offset", params.offset.toString());
    }
    if (selectColumns) {
      searchParams.set("select", selectColumns);
    }

    const appendFilterParam = (key: string, value?: FilterValue) => {
      // Cas spécial pour user === null (vue Market) : envoyer "null" comme chaîne
      if (key === "user" && value === null) {
        searchParams.append(key, "null");
        return;
      }

      if (value === undefined || value === null) {
        // Ne pas envoyer le paramètre si la valeur est undefined ou null
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((entry) => {
          // Ignorer les valeurs null dans les tableaux
          if (entry !== null && typeof entry === "string" && entry.length > 0) {
            searchParams.append(key, entry);
          }
        });
        return;
      }
      if (typeof value === "string" && value.length > 0) {
        searchParams.append(key, value);
      }
    };

    appendFilterParam("statut", params.statut);
    appendFilterParam("agence", params.agence);
    appendFilterParam("artisan", params.artisan);
    appendFilterParam("metier", params.metier);
    appendFilterParam("user", params.user);

    if (params.startDate) {
      searchParams.set("startDate", params.startDate);
    }
    if (params.endDate) {
      searchParams.set("endDate", params.endDate);
    }
    if (params.search) {
      searchParams.set("search", params.search);
    }

    if (process.env.NODE_ENV === "production") {
      searchParams.set("_ts", Date.now().toString());
    }
    const queryString = searchParams.toString();
    const url = `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions${queryString ? `?${queryString}` : ""
      }`;

    console.log(`[interventionsApiV2.getAll] URL: ${url}`)
    console.log(`[interventionsApiV2.getAll] Params: limit=${limit}, offset=${params.offset ?? 0}`)

    const fetchStart = Date.now();
    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    const raw = await handleResponse(response);
    const rawLength = Array.isArray(raw?.data) ? raw.data.length : 0;
    const rawFirstId = rawLength > 0 ? raw.data[0]?.id ?? null : null;
    const rawLastId = rawLength > 0 ? raw.data[rawLength - 1]?.id ?? null : null;
    console.log(
      `[interventionsApiV2.getAll] Payload debug - offset=${params.offset ?? 0}, length=${rawLength}, firstId=${rawFirstId}, lastId=${rawLastId}`,
    );
    const fetchDuration = Date.now() - fetchStart;

    const refs = await getReferenceCache();

    const mapStart = Date.now();
    // ✅ Mapping direct (synchrone = plus rapide)
    const transformedData = Array.isArray(raw?.data)
      ? mapInterventionRecordsBatch(raw.data, refs)
      : [];
    const mapDuration = Date.now() - mapStart;

    console.log(`🚀 [interventionsApiV2.getAll] Fetch: ${fetchDuration}ms, Map: ${mapDuration}ms, Total: ${transformedData.length} items`);

    const total =
      typeof raw?.pagination?.total === "number"
        ? raw.pagination.total
        : transformedData.length;

    return { data: transformedData, total };
  },

  /**
   * Obtient le nombre total d'interventions (sans les charger)
   * @returns Le nombre total d'interventions ou 0 en cas d'erreur
   */
  async getTotalCount(): Promise<number> {
    const { count, error } = await supabase
      .from("interventions")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("Erreur lors du comptage des interventions:", error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Obtient une liste légère d'interventions pour le warm-up (données minimales)
   * Retourne uniquement les champs essentiels pour réduire la taille du payload
   */
  async getAllLight(params: GetAllParams = {}): Promise<{ data: InterventionView[]; total: number }> {
    const limit = Math.max(1, Math.min(params.limit ?? 100, 50000));
    const offset = Math.max(0, params.offset ?? 0);

    const searchParams = new URLSearchParams();
    searchParams.set("limit", limit.toString());
    searchParams.set("offset", offset.toString());

    const appendFilterParam = (key: string, value: FilterValue) => {
      // Cas spécial pour user === null (vue Market) : envoyer "null" comme chaîne
      if (key === "user" && value === null) {
        searchParams.append(key, "null");
        return;
      }

      if (!value) {
        return;
      }
      const values = Array.isArray(value) ? value : [value];
      values.forEach((v) => {
        if (v) {
          searchParams.append(key, v);
        }
      });
    };

    appendFilterParam("statut", params.statut);
    appendFilterParam("agence", params.agence);
    appendFilterParam("artisan", params.artisan);
    appendFilterParam("metier", params.metier);
    appendFilterParam("user", params.user);

    if (params.startDate) {
      searchParams.set("startDate", params.startDate);
    }
    if (params.endDate) {
      searchParams.set("endDate", params.endDate);
    }
    if (params.search) {
      searchParams.set("search", params.search);
    }

    if (process.env.NODE_ENV === "production") {
      searchParams.set("_ts", Date.now().toString());
    }
    const queryString = searchParams.toString();
    const url = `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions/light${queryString ? `?${queryString}` : ""
      }`;

    console.log(`[interventionsApiV2.getAllLight] URL: ${url}`)
    console.log(`[interventionsApiV2.getAllLight] Params: limit=${limit}, offset=${offset}`)

    const fetchStart = Date.now();
    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    const raw = await handleResponse(response);
    const rawLength = Array.isArray(raw?.data) ? raw.data.length : 0;
    const rawFirstId = rawLength > 0 ? raw.data[0]?.id ?? null : null;
    const rawLastId = rawLength > 0 ? raw.data[rawLength - 1]?.id ?? null : null;
    console.log(
      `[interventionsApiV2.getAllLight] Payload debug - offset=${offset}, length=${rawLength}, firstId=${rawFirstId}, lastId=${rawLastId}`,
    );
    const fetchDuration = Date.now() - fetchStart;

    // Pour la version light, on retourne les données brutes sans mapping complet
    // car on n'a pas toutes les relations nécessaires pour le mapping complet
    const refs = await getReferenceCache();
    const transformedData = Array.isArray(raw?.data)
      ? raw.data.map((item: any) => {
        // Mapping minimal pour les champs disponibles
        const userInfo = buildUserDisplay(
          refs.usersById.get(item.assigned_user_id ?? "")
        );
        const agency = item.agence_id
          ? refs.agenciesById.get(item.agence_id)
          : undefined;
        const status = item.statut_id
          ? refs.interventionStatusesById.get(item.statut_id)
          : undefined;
        const metier = item.metier_id
          ? refs.metiersById.get(item.metier_id)
          : undefined;

        return {
          id: item.id,
          id_inter: item.id_inter,
          statut_id: item.statut_id,
          date: item.date,
          date_prevue: item.date_prevue,
          agence_id: item.agence_id,
          assigned_user_id: item.assigned_user_id,
          metier_id: item.metier_id,
          created_at: item.created_at,
          updated_at: item.updated_at,
          // Champs minimaux pour compatibilité avec InterventionView
          statusValue: status?.code || null,
          agence: agency?.label || null,
          attribueA: userInfo.fullName || null,
          metier: metier?.label || null,
        } as Partial<InterventionView> as InterventionView;
      })
      : [];

    const mapDuration = Date.now() - fetchStart - fetchDuration;
    console.log(`🚀 [interventionsApiV2.getAllLight] Fetch: ${fetchDuration}ms, Map: ${mapDuration}ms, Total: ${transformedData.length} items`);

    const total =
      typeof raw?.pagination?.total === "number"
        ? raw.pagination.total
        : transformedData.length;

    return { data: transformedData, total };
  },

  /**
   * Obtient un résumé des interventions pour une vue donnée (métadonnées sans données complètes)
   */
  async getSummary(params: GetAllParams = {}): Promise<{
    total: number;
    countsByStatus: Record<string, number>;
    filters: {
      statut: string[];
      agence: string[];
      metier: string[];
      user: string[];
      userIsNull: boolean;
      startDate: string | null;
      endDate: string | null;
      search: string | null;
    };
  }> {
    const searchParams = new URLSearchParams();

    const appendFilterParam = (key: string, value: FilterValue) => {
      if (!value) {
        return;
      }
      const values = Array.isArray(value) ? value : [value];
      values.forEach((v) => {
        if (v) {
          searchParams.append(key, v);
        }
      });
    };

    appendFilterParam("statut", params.statut);
    appendFilterParam("agence", params.agence);
    appendFilterParam("artisan", params.artisan);
    appendFilterParam("metier", params.metier);
    appendFilterParam("user", params.user);

    if (params.startDate) {
      searchParams.set("startDate", params.startDate);
    }
    if (params.endDate) {
      searchParams.set("endDate", params.endDate);
    }
    if (params.search) {
      searchParams.set("search", params.search);
    }

    const queryString = searchParams.toString();
    const url = `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions/summary${queryString ? `?${queryString}` : ""
      }`;

    console.log(`[interventionsApiV2.getSummary] URL: ${url}`)

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    const raw = await handleResponse(response);

    return {
      total: raw.total ?? 0,
      countsByStatus: raw.countsByStatus ?? {},
      filters: raw.filters ?? {
        statut: [],
        agence: [],
        metier: [],
        user: [],
        userIsNull: false,
        startDate: null,
        endDate: null,
        search: null,
      },
    };
  },

  // Récupérer une intervention par ID
  async getById(id: string, include?: string[]): Promise<InterventionView> {
    const searchParams = new URLSearchParams();
    if (include) searchParams.append("include", include.join(","));

    const url = `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions/${id}${searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    const raw = await handleResponse(response);
    const refs = await getReferenceCache();
    const record = raw?.data ?? raw;
    return mapInterventionRecord(record, refs) as InterventionView;
  },

  // Créer une intervention
  async create(data: {
    agence_id?: string;
    client_id?: string;
    assigned_user_id?: string;
    statut_id?: string;
    metier_id?: string;
    date: string;
    date_prevue?: string;
    contexte_intervention?: string;
    consigne_intervention?: string;
    consigne_second_artisan?: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    latitude?: number;
    longitude?: number;
    numero_sst?: string;
    pourcentage_sst?: number;
  }): Promise<Intervention> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return await handleResponse(response);
  },

  // Modifier une intervention
  async update(
    id: string,
    data: {
      agence_id?: string;
      client_id?: string;
      assigned_user_id?: string;
      statut_id?: string;
      metier_id?: string;
      date?: string;
      date_termine?: string;
      date_prevue?: string;
      contexte_intervention?: string;
      consigne_intervention?: string;
      consigne_second_artisan?: string;
      commentaire_agent?: string;
      adresse?: string;
      code_postal?: string;
      ville?: string;
      latitude?: number;
      longitude?: number;
      numero_sst?: string;
      pourcentage_sst?: number;
      is_active?: boolean;
    }
  ): Promise<Intervention> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions/${id}`,
      {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    const raw = await handleResponse(response);
    const refs = await getReferenceCache();
    const record = raw?.data ?? raw;
    return mapInterventionRecord(record, refs);
  },

  // Supprimer une intervention (soft delete)
  async delete(id: string): Promise<{ message: string; data: Intervention }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions/${id}`,
      {
        method: "DELETE",
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Assigner un artisan à une intervention
  async assignArtisan(
    interventionId: string,
    artisanId: string,
    role: "primary" | "secondary" = "primary"
  ): Promise<any> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions/${interventionId}/artisans`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({
          artisan_id: artisanId,
          role,
          is_primary: role === "primary",
        }),
      }
    );
    return handleResponse(response);
  },

  // Ajouter un coût à une intervention
  async addCost(
    interventionId: string,
    data: {
      cost_type: "sst" | "materiel" | "intervention" | "marge";
      label?: string;
      amount: number;
      currency?: string;
      metadata?: any;
    }
  ): Promise<InterventionCost> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions/${interventionId}/costs`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Ajouter un paiement à une intervention
  async addPayment(
    interventionId: string,
    data: {
      payment_type: string;
      amount: number;
      currency?: string;
      is_received?: boolean;
      payment_date?: string;
      reference?: string;
    }
  ): Promise<InterventionPayment> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions/${interventionId}/payments`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Upsert une intervention (créer ou mettre à jour)
  async upsert(data: {
    id_inter?: string;
    agence_id?: string;
    client_id?: string;
    assigned_user_id?: string;
    statut_id?: string;
    metier_id?: string;
    date: string;
    date_prevue?: string;
    contexte_intervention?: string;
    consigne_intervention?: string;
    consigne_second_artisan?: string;
    adresse?: string;
    code_postal?: string;
    ville?: string;
    latitude?: number;
    longitude?: number;
    numero_sst?: string;
    pourcentage_sst?: number;
  }): Promise<Intervention> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/interventions-v2/interventions/upsert`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Insérer plusieurs coûts pour des interventions
  async insertInterventionCosts(
    costs: Array<{
      intervention_id: string;
      cost_type: "sst" | "materiel" | "intervention" | "marge";
      label?: string;
      amount: number;
      currency?: string;
      metadata?: any;
    }>
  ): Promise<any> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const cost of costs) {
      try {
        const result = await this.addCost(cost.intervention_id, cost);
        results.success++;
        results.details.push({ cost, success: true, data: result });
      } catch (error: any) {
        results.errors++;
        results.details.push({ cost, success: false, error: error.message });
      }
    }

    return results;
  },
};

// ===== API ARTISANS V2 =====

export const artisansApiV2 = {
  // Récupérer tous les artisans (ULTRA-OPTIMISÉ)
  async getAll(params?: {
    limit?: number;
    offset?: number;
    statut?: string;
    statuts?: string[];
    metier?: string;
    metiers?: string[];
    zone?: string;
    gestionnaire?: string;
    search?: string;
  }): Promise<PaginatedResponse<Artisan>> {
    // Version ultra-rapide avec jointures pour métiers, zones et attachments
    let query = supabase
      .from("artisans")
      .select(`
        *,
        artisan_metiers (
          metier_id,
          metiers (
            id,
            code,
            label
          )
        ),
        artisan_zones (
          zone_id,
          zones (
            id,
            code,
            label
          )
        ),
        artisan_attachments (
          id,
          kind,
          url,
          filename,
          mime_type,
          content_hash,
          derived_sizes,
          mime_preferred
        )
      `, { count: "exact" })
      // ⚠️ Ordre ASC pour afficher d'abord les artisans avec des données
      // Les artisans récents ont été importés avec des colonnes NULL
      .order("created_at", { ascending: true });

    // Appliquer les filtres si nécessaire
    if (params?.statuts && params.statuts.length > 0) {
      query = query.in("statut_id", params.statuts);
    } else if (params?.statut) {
      query = query.eq("statut_id", params.statut);
    }
    if (params?.gestionnaire) {
      query = query.eq("gestionnaire_id", params.gestionnaire);
    }
    if (params?.search && params.search.trim()) {
      const term = params.search.trim();
      query = query.or(
        [
          `prenom.ilike.%${term}%`,
          `nom.ilike.%${term}%`,
          `raison_sociale.ilike.%${term}%`,
          `email.ilike.%${term}%`,
          `telephone.ilike.%${term}%`,
          `telephone2.ilike.%${term}%`,
        ].join(",")
      );
    }

    // Pagination
    const limit = params?.limit || 500;
    const offset = params?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const refs = await getReferenceCache();

    // Filtrer par métiers AVANT le mapping pour avoir accès aux IDs
    let filteredData = data || [];

    if (params?.metiers && params.metiers.length > 0) {
      const metierFilters = params.metiers;
      filteredData = filteredData.filter((item: any) => {
        const artisanMetiers = Array.isArray(item.artisan_metiers)
          ? item.artisan_metiers
          : [];
        return metierFilters.some((metierId) =>
          artisanMetiers.some(
            (am: any) => am.metier_id === metierId || am.metiers?.id === metierId
          )
        );
      });
    } else if (params?.metier) {
      const metierFilter = params.metier;
      filteredData = filteredData.filter((item: any) => {
        const artisanMetiers = Array.isArray(item.artisan_metiers)
          ? item.artisan_metiers
          : [];
        return artisanMetiers.some(
          (am: any) => am.metier_id === metierFilter || am.metiers?.id === metierFilter
        );
      });
    }

    // Mapper les données filtrées
    let transformedData = filteredData.map((item) =>
      mapArtisanRecord(item, refs)
    );

    // Pour les métiers, le count de Supabase ne reflète pas le filtrage
    // car c'est une relation many-to-many. Il faut recalculer le count total.
    let finalCount = count || 0;
    if (params?.metiers && params.metiers.length > 0) {
      // Compter tous les artisans correspondants (sans pagination)
      let countQuery = supabase
        .from("artisans")
        .select("id", { count: "exact", head: false })
        .eq("is_active", true);

      if (params?.statuts && params.statuts.length > 0) {
        countQuery = countQuery.in("statut_id", params.statuts);
      } else if (params?.statut) {
        countQuery = countQuery.eq("statut_id", params.statut);
      }
      if (params?.gestionnaire) {
        countQuery = countQuery.eq("gestionnaire_id", params.gestionnaire);
      }
      if (params?.search && params.search.trim()) {
        const term = params.search.trim();
        countQuery = countQuery.or(
          [
            `prenom.ilike.%${term}%`,
            `nom.ilike.%${term}%`,
            `raison_sociale.ilike.%${term}%`,
            `email.ilike.%${term}%`,
            `telephone.ilike.%${term}%`,
            `telephone2.ilike.%${term}%`,
          ].join(",")
        );
      }

      const { data: allArtisans, error: countError } = await countQuery;
      if (!countError && allArtisans) {
        // Filtrer par métiers en utilisant la fonction utilitaire qui divise en lots
        const artisanIds = allArtisans.map((a: any) => a.id).filter(Boolean);
        try {
          const filteredIds = await filterArtisansByMetiers(artisanIds, params.metiers);
          finalCount = filteredIds.size;
        } catch (metierError) {
          console.error("Erreur lors du filtrage par métiers pour le count:", metierError);
          // En cas d'erreur, on garde le count initial (sans filtrage métier)
        }
      }
    } else if (params?.metier) {
      // Même logique pour un seul métier
      let countQuery = supabase
        .from("artisans")
        .select("id", { count: "exact", head: false })
        .eq("is_active", true);

      if (params?.statuts && params.statuts.length > 0) {
        countQuery = countQuery.in("statut_id", params.statuts);
      } else if (params?.statut) {
        countQuery = countQuery.eq("statut_id", params.statut);
      }
      if (params?.gestionnaire) {
        countQuery = countQuery.eq("gestionnaire_id", params.gestionnaire);
      }
      if (params?.search && params.search.trim()) {
        const term = params.search.trim();
        countQuery = countQuery.or(
          [
            `prenom.ilike.%${term}%`,
            `nom.ilike.%${term}%`,
            `raison_sociale.ilike.%${term}%`,
            `email.ilike.%${term}%`,
            `telephone.ilike.%${term}%`,
            `telephone2.ilike.%${term}%`,
          ].join(",")
        );
      }

      const { data: allArtisans, error: countError } = await countQuery;
      if (!countError && allArtisans) {
        // Filtrer par métier en utilisant la fonction utilitaire qui divise en lots
        const artisanIds = allArtisans.map((a: any) => a.id).filter(Boolean);
        try {
          const filteredIds = await filterArtisansByMetier(artisanIds, params.metier);
          finalCount = filteredIds.size;
        } catch (metierError) {
          console.error("Erreur lors du filtrage par métier pour le count:", metierError);
          // En cas d'erreur, on garde le count initial (sans filtrage métier)
        }
      }
    }

    return {
      data: transformedData,
      pagination: {
        total: finalCount,
        limit,
        offset,
        hasMore: offset + limit < finalCount,
      },
    };
  },

  // Récupérer un artisan par ID
  async getById(id: string, include?: string[]): Promise<Artisan & {
    artisan_metiers?: Array<{
      metier_id: string
      is_primary?: boolean | null
      metiers?: { id: string; code: string | null; label: string | null } | null
    }>
    artisan_zones?: Array<{
      zone_id: string
      zones?: { id: string; code: string | null; label: string | null } | null
    }>
    artisan_attachments?: Array<{
      id: string
      kind: string
      url: string
      filename: string | null
      mime_type?: string | null
      content_hash?: string | null
      derived_sizes?: Record<string, string> | null
      mime_preferred?: string | null
      created_at?: string | null
    }>
    artisan_absences?: Array<{
      id: string
      start_date: string | null
      end_date: string | null
      reason: string | null
      is_confirmed?: boolean | null
    }>
    statutDossier?: string | null
  }> {
    const searchParams = new URLSearchParams();
    if (include) searchParams.append("include", include.join(","));

    const url = `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${id}${searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    const raw = await handleResponse(response);
    console.log("[artisansApiV2.getById] Raw response:", raw);

    // Si l'edge function retourne les relations directement, les préserver
    const record = raw?.data ?? raw;
    console.log("[artisansApiV2.getById] Record before mapping:", record);

    const refs = await getReferenceCache();
    const mapped = mapArtisanRecord(record, refs);
    console.log("[artisansApiV2.getById] Mapped result:", mapped);

    // Préserver les relations si elles existent dans la réponse brute
    if (record && typeof record === 'object') {
      const recordAny = record as any;
      if (Array.isArray(recordAny.artisan_metiers)) {
        (mapped as any).artisan_metiers = recordAny.artisan_metiers;
      }
      if (Array.isArray(recordAny.artisan_zones)) {
        (mapped as any).artisan_zones = recordAny.artisan_zones;
      }
      if (Array.isArray(recordAny.artisan_attachments)) {
        (mapped as any).artisan_attachments = recordAny.artisan_attachments;
      }
      if (Array.isArray(recordAny.artisan_absences)) {
        (mapped as any).artisan_absences = recordAny.artisan_absences;
      }
      if (recordAny.statutDossier) {
        (mapped as any).statutDossier = recordAny.statutDossier;
      }
    }

    return mapped;
  },

  // Créer un artisan
  async create(data: {
    prenom?: string;
    nom?: string;
    telephone?: string;
    telephone2?: string;
    email?: string;
    raison_sociale?: string;
    siret?: string;
    statut_juridique?: string;
    statut_id?: string;
    gestionnaire_id?: string;
    adresse_siege_social?: string;
    ville_siege_social?: string;
    code_postal_siege_social?: string;
    adresse_intervention?: string;
    ville_intervention?: string;
    code_postal_intervention?: string;
    intervention_latitude?: number;
    intervention_longitude?: number;
    numero_associe?: string;
    suivi_relances_docs?: string;
    metiers?: string[];
    zones?: string[];
  }): Promise<Artisan> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    const raw = await handleResponse(response);
    const refs = await getReferenceCache();
    const record = raw?.data ?? raw;
    return mapArtisanRecord(record, refs);
  },

  // Upsert un artisan (créer ou mettre à jour)
  async upsert(data: {
    prenom?: string;
    nom?: string;
    telephone?: string;
    telephone2?: string;
    email?: string;
    raison_sociale?: string;
    siret?: string;
    statut_juridique?: string;
    statut_id?: string;
    gestionnaire_id?: string;
    adresse_siege_social?: string;
    ville_siege_social?: string;
    code_postal_siege_social?: string;
    adresse_intervention?: string;
    ville_intervention?: string;
    code_postal_intervention?: string;
    intervention_latitude?: number;
    intervention_longitude?: number;
    numero_associe?: string;
    suivi_relances_docs?: string;
    metiers?: string[];
    zones?: string[];
  }): Promise<Artisan> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/upsert`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Créer un document pour un artisan
  async createDocument(data: {
    artisan_id: string;
    kind: string;
    url: string;
    filename: string;
    created_at?: string;
    updated_at?: string;
  }): Promise<any> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${data.artisan_id}/documents`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Créer une association métier-artisan
  async createArtisanMetier(data: {
    artisan_id: string;
    metier_id: string;
    is_primary?: boolean;
  }): Promise<any> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${data.artisan_id}/metiers`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Créer une association zone-artisan
  async createArtisanZone(data: {
    artisan_id: string;
    zone_id: string;
  }): Promise<any> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${data.artisan_id}/zones`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Modifier un artisan
  async update(
    id: string,
    data: {
      prenom?: string;
      nom?: string;
      telephone?: string;
      telephone2?: string;
      email?: string;
      raison_sociale?: string;
      siret?: string;
      statut_juridique?: string;
      statut_id?: string;
      gestionnaire_id?: string;
      adresse_siege_social?: string;
      ville_siege_social?: string;
      code_postal_siege_social?: string;
      adresse_intervention?: string;
      ville_intervention?: string;
      code_postal_intervention?: string;
      intervention_latitude?: number;
      intervention_longitude?: number;
      numero_associe?: string;
      suivi_relances_docs?: string;
      is_active?: boolean;
      metiers?: string[];
      zones?: string[];
    }
  ): Promise<Artisan> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${id}`,
      {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    const raw = await handleResponse(response);
    const refs = await getReferenceCache();
    const record = raw?.data ?? raw;
    return mapArtisanRecord(record, refs);
  },

  // Supprimer un artisan (soft delete)
  async delete(id: string): Promise<{ message: string; data: Artisan }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${id}`,
      {
        method: "DELETE",
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Assigner un métier à un artisan
  async assignMetier(
    artisanId: string,
    metierId: string,
    isPrimary: boolean = false
  ): Promise<any> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${artisanId}/metiers`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({
          metier_id: metierId,
          is_primary: isPrimary,
        }),
      }
    );
    return handleResponse(response);
  },

  // Assigner une zone à un artisan
  async assignZone(artisanId: string, zoneId: string): Promise<any> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/artisans-v2/artisans/${artisanId}/zones`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({
          zone_id: zoneId,
        }),
      }
    );
    return handleResponse(response);
  },

  // Insérer plusieurs métiers pour un artisan
  async insertArtisanMetiers(
    metiers: Array<{
      artisan_id: string;
      metier_id: string;
      is_primary?: boolean;
    }>
  ): Promise<any> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const metier of metiers) {
      try {
        const result = await this.createArtisanMetier(metier);
        results.success++;
        results.details.push({ metier, success: true, data: result });
      } catch (error: any) {
        results.errors++;
        results.details.push({ metier, success: false, error: error.message });
      }
    }

    return results;
  },

  // Insérer plusieurs zones pour un artisan
  async insertArtisanZones(
    zones: Array<{
      artisan_id: string;
      zone_id: string;
    }>
  ): Promise<any> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const zone of zones) {
      try {
        const result = await this.createArtisanZone(zone);
        results.success++;
        results.details.push({ zone, success: true, data: result });
      } catch (error: any) {
        results.errors++;
        results.details.push({ zone, success: false, error: error.message });
      }
    }

    return results;
  },
};

// ===== API CLIENTS =====

export const clientsApi = {
  // Récupérer tous les clients
  async getAll(params?: {
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/clients/clients${searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Récupérer un client par ID
  async getById(id: string): Promise<any> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/clients/clients/${id}`,
      {
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Créer un client
  async create(data: {
    firstname?: string;
    lastname?: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    ville?: string;
    code_postal?: string;
  }): Promise<any> {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/clients/clients`, {
      method: "POST",
      headers: await getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  // Insérer plusieurs clients
  async insertClients(
    clients: Array<{
      firstname?: string;
      lastname?: string;
      email?: string;
      telephone?: string;
      adresse?: string;
      ville?: string;
      code_postal?: string;
    }>
  ): Promise<any> {
    const results = { success: 0, errors: 0, details: [] as any[] };

    for (const client of clients) {
      try {
        const result = await this.create(client);
        results.success++;
        results.details.push({ client, success: true, data: result });
      } catch (error: any) {
        results.errors++;
        results.details.push({ client, success: false, error: error.message });
      }
    }

    return results;
  },

  // Modifier un client
  async update(
    id: string,
    data: {
      firstname?: string;
      lastname?: string;
      email?: string;
      telephone?: string;
      adresse?: string;
      ville?: string;
      code_postal?: string;
    }
  ): Promise<any> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/clients/clients/${id}`,
      {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Supprimer un client
  async delete(id: string): Promise<{ message: string; data: any }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/clients/clients/${id}`,
      {
        method: "DELETE",
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },
};

// ===== API DOCUMENTS =====

/**
 * Normalise le kind d'un document pour les interventions
 * Transforme les variantes (facture_gmbs, factureGMBS, etc.) vers les valeurs canoniques (facturesGMBS)
 */
function normalizeInterventionKind(kind: string): string {
  if (!kind) return kind;

  const trimmed = kind.trim();
  if (!trimmed) return kind;

  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/[_\s-]/g, '');

  // Mapping vers les valeurs canoniques avec 's' (comme dans l'Edge Function et la DB)
  const canonicalMap: Record<string, string> = {
    facturegmbs: 'facturesGMBS',
    facturesgmbs: 'facturesGMBS',
    factureartisan: 'facturesArtisans',
    facturesartisan: 'facturesArtisans',
    facturemateriel: 'facturesMateriel',
    facturesmateriel: 'facturesMateriel'
  };

  if (canonicalMap[compact]) {
    return canonicalMap[compact];
  }

  // Gérer les cas spéciaux comme 'a_classe'
  const needsClassification = [
    'aclasser',
    'aclassifier',
    'àclasser',
    'àclassifier',
    'aclasse',
    'àclasse'
  ];
  if (
    needsClassification.includes(compact) ||
    lower === 'a classer' ||
    lower === 'a classifier' ||
    lower === 'à classer' ||
    lower === 'à classifier'
  ) {
    return 'a_classe';
  }

  return trimmed;
}

export const documentsApi = {
  // Récupérer tous les documents
  async getAll(params?: {
    entity_type?: "intervention" | "artisan";
    entity_id?: string;
    kind?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<InterventionAttachment | ArtisanAttachment>> {
    const searchParams = new URLSearchParams();

    if (params?.entity_type)
      searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);
    if (params?.kind) searchParams.append("kind", params.kind);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/documents/documents${searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Récupérer un document par ID
  async getById(
    id: string,
    entityType: "intervention" | "artisan" = "intervention"
  ): Promise<InterventionAttachment | ArtisanAttachment> {
    const url = `${SUPABASE_FUNCTIONS_URL}/documents/documents/${id}?entity_type=${entityType}`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Créer un document
  async create(data: {
    entity_id: string;
    entity_type: "intervention" | "artisan";
    kind: string;
    url: string;
    filename?: string;
    mime_type?: string;
    file_size?: number;
    created_by?: string;
    created_by_display?: string;
    created_by_code?: string;
    created_by_color?: string;
  }): Promise<InterventionAttachment | ArtisanAttachment> {
    // Normaliser le kind AVANT d'envoyer à l'Edge Function
    const normalizedKind = data.entity_type === 'intervention'
      ? normalizeInterventionKind(data.kind)
      : data.kind;

    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/documents/documents`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({
          ...data,
          kind: normalizedKind,
        }),
      }
    );
    return handleResponse(response);
  },

  // Upload un document avec contenu
  async upload(data: {
    entity_id: string;
    entity_type: "intervention" | "artisan";
    kind: string;
    filename: string;
    mime_type: string;
    file_size: number;
    content: string; // Base64 encoded
    created_by?: string;
    created_by_display?: string;
    created_by_code?: string;
    created_by_color?: string;
  }): Promise<InterventionAttachment | ArtisanAttachment> {
    // Normaliser le kind AVANT d'envoyer à l'Edge Function
    const normalizedKind = data.entity_type === 'intervention'
      ? normalizeInterventionKind(data.kind)
      : data.kind;

    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/documents/documents/upload`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify({
          ...data,
          kind: normalizedKind,
        }),
      }
    );
    return handleResponse(response);
  },

  // Modifier un document
  async update(
    id: string,
    data: {
      kind?: string;
      filename?: string;
      mime_type?: string;
      file_size?: number;
      created_by?: string | null;
      created_by_display?: string | null;
      created_by_code?: string | null;
      created_by_color?: string | null;
    },
    entityType: "intervention" | "artisan" = "intervention"
  ): Promise<InterventionAttachment | ArtisanAttachment> {
    // Normaliser le kind si présent
    const normalizedData = {
      ...data,
      ...(data.kind && entityType === 'intervention'
        ? { kind: normalizeInterventionKind(data.kind) }
        : {}
      ),
    };

    const url = `${SUPABASE_FUNCTIONS_URL}/documents/documents/${id}?entity_type=${entityType}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: await getHeaders(),
      body: JSON.stringify(normalizedData),
    });
    return handleResponse(response);
  },

  // Supprimer un document
  async delete(
    id: string,
    entityType: "intervention" | "artisan" = "intervention"
  ): Promise<{ message: string; data: any }> {
    const url = `${SUPABASE_FUNCTIONS_URL}/documents/documents/${id}?entity_type=${entityType}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Obtenir les types de documents supportés
  async getSupportedTypes(): Promise<{
    supported_types: Record<string, string[]>;
    max_file_size: string;
    allowed_mime_types: string[];
  }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/documents/documents/types`,
      {
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },
};

// ===== API COMMENTAIRES =====

export const commentsApi = {
  // Récupérer tous les commentaires
  async getAll(params?: {
    entity_type?: "intervention" | "artisan" | "client";
    entity_id?: string;
    comment_type?: string;
    is_internal?: boolean;
    author_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Comment>> {
    const searchParams = new URLSearchParams();

    if (params?.entity_type)
      searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);
    if (params?.comment_type)
      searchParams.append("comment_type", params.comment_type);
    if (params?.is_internal !== undefined)
      searchParams.append("is_internal", params.is_internal.toString());
    if (params?.author_id) searchParams.append("author_id", params.author_id);
    if (params?.limit) searchParams.append("limit", params.limit.toString());
    if (params?.offset) searchParams.append("offset", params.offset.toString());

    const url = `${SUPABASE_FUNCTIONS_URL}/comments/comments${searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },

  // Récupérer un commentaire par ID
  async getById(id: string): Promise<Comment> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments/${id}`,
      {
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Créer un commentaire
  async create(data: {
    entity_id: string;
    entity_type: "intervention" | "artisan" | "client";
    content: string;
    comment_type?: string;
    is_internal?: boolean;
    author_id?: string;
  }): Promise<Comment> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments`,
      {
        method: "POST",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Modifier un commentaire
  async update(
    id: string,
    data: {
      content?: string;
      comment_type?: string;
      is_internal?: boolean;
    }
  ): Promise<Comment> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments/${id}`,
      {
        method: "PUT",
        headers: await getHeaders(),
        body: JSON.stringify(data),
      }
    );
    return handleResponse(response);
  },

  // Supprimer un commentaire
  async delete(id: string): Promise<{ message: string; data: Comment }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments/${id}`,
      {
        method: "DELETE",
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Obtenir les types de commentaires supportés
  async getSupportedTypes(): Promise<{
    comment_types: string[];
    entity_types: string[];
    default_type: string;
    internal_default: boolean;
  }> {
    const response = await fetch(
      `${SUPABASE_FUNCTIONS_URL}/comments/comments/types`,
      {
        headers: await getHeaders(),
      }
    );
    return handleResponse(response);
  },

  // Obtenir les statistiques des commentaires
  async getStats(params?: {
    entity_type?: "intervention" | "artisan" | "client";
    entity_id?: string;
  }): Promise<{
    total: number;
    by_type: Record<string, number>;
    by_internal: { internal: number; external: number };
    recent_count: number;
  }> {
    const searchParams = new URLSearchParams();

    if (params?.entity_type)
      searchParams.append("entity_type", params.entity_type);
    if (params?.entity_id) searchParams.append("entity_id", params.entity_id);

    const url = `${SUPABASE_FUNCTIONS_URL}/comments/comments/stats${searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;

    const response = await fetch(url, {
      headers: await getHeaders(),
    });
    return handleResponse(response);
  },
};

// ===== API ÉNUMÉRATIONS =====

export const enumsApi = {
  // ===== MÉTIERS =====

  // Récupérer tous les métiers
  async getMetiers(): Promise<any[]> {
    const { data, error } = await supabase
      .from("metiers")
      .select("*")
      .eq("is_active", true)
      .order("label");

    if (error) throw error;
    return data || [];
  },

  // Créer un métier
  async createMetier(data: {
    code?: string;
    label: string;
    description?: string;
  }): Promise<any> {
    const { data: result, error } = await supabase
      .from("metiers")
      .insert({
        code: data.code || data.label.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        label: data.label,
        description:
          data.description || `Métier créé automatiquement lors de l'import`,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return result;
  },

  // Trouver ou créer un métier
  async findOrCreateMetier(label: string): Promise<string> {
    // Essayer de trouver le métier existant
    const { data: existing } = await supabase
      .from("metiers")
      .select("id")
      .eq("label", label)
      .single();

    if (existing) {
      return existing.id;
    }

    // Créer le métier s'il n'existe pas
    const { data: newMetier, error } = await supabase
      .from("metiers")
      .insert({
        code: label.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        label: label,
        description: `Métier créé automatiquement lors de l'import`,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return newMetier.id;
  },

  // ===== STATUTS ARTISANS =====

  // Récupérer tous les statuts artisans
  async getArtisanStatuses(): Promise<any[]> {
    const { data, error } = await supabase
      .from("artisan_statuses")
      .select("*")
      .eq("is_active", true)
      .order("label");

    if (error) throw error;
    return data || [];
  },

  // Créer un statut artisan
  async createArtisanStatus(data: {
    code: string;
    label: string;
    color?: string;
  }): Promise<any> {
    const { data: result, error } = await supabase
      .from("artisan_statuses")
      .insert({
        code: data.code,
        label: data.label,
        color: data.color,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return result;
  },

  // Trouver ou créer un statut artisan
  async findOrCreateArtisanStatus(code: string): Promise<string> {
    // Essayer de trouver le statut existant
    const { data: existing } = await supabase
      .from("artisan_statuses")
      .select("id")
      .eq("code", code)
      .single();

    if (existing) {
      return existing.id;
    }

    // Créer le statut s'il n'existe pas
    const { data: newStatus, error } = await supabase
      .from("artisan_statuses")
      .insert({
        code: code,
        label: code,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return newStatus.id;
  },

  // ===== STATUTS INTERVENTIONS =====

  // Récupérer tous les statuts interventions
  async getInterventionStatuses(): Promise<any[]> {
    const { data, error } = await supabase
      .from("intervention_statuses")
      .select("*")
      .eq("is_active", true)
      .order("label");

    if (error) throw error;
    return data || [];
  },

  // Créer un statut intervention
  async createInterventionStatus(data: {
    code: string;
    label: string;
    color?: string;
  }): Promise<any> {
    const { data: result, error } = await supabase
      .from("intervention_statuses")
      .insert({
        code: data.code,
        label: data.label,
        color: data.color,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return result;
  },

  // Trouver ou créer un statut intervention
  async findOrCreateInterventionStatus(code: string): Promise<string> {
    // Essayer de trouver le statut existant
    const { data: existing } = await supabase
      .from("intervention_statuses")
      .select("id")
      .eq("code", code)
      .single();

    if (existing) {
      return existing.id;
    }

    // Créer le statut s'il n'existe pas
    const { data: newStatus, error } = await supabase
      .from("intervention_statuses")
      .insert({
        code: code,
        label: code,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return newStatus.id;
  },

  // ===== AGENCES =====

  // Récupérer toutes les agences
  async getAgencies(): Promise<any[]> {
    const { data, error } = await supabase
      .from("agencies")
      .select("*")
      .eq("is_active", true)
      .order("label");

    if (error) throw error;
    return data || [];
  },

  // Créer une agence
  async createAgency(data: {
    label: string;
    code?: string;
    region?: string;
  }): Promise<any> {
    const { data: result, error } = await supabase
      .from("agencies")
      .insert({
        code: data.code || data.label.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        label: data.label,
        region: data.region,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return result;
  },

  // Trouver ou créer une agence
  async findOrCreateAgency(label: string): Promise<string> {
    // Essayer de trouver l'agence existante
    const { data: existing } = await supabase
      .from("agencies")
      .select("id")
      .eq("label", label)
      .single();

    if (existing) {
      return existing.id;
    }

    // Créer l'agence si elle n'existe pas
    const { data: newAgency, error } = await supabase
      .from("agencies")
      .insert({
        code: label.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        label: label,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return newAgency.id;
  },

  // ===== UTILISATEURS =====

  // Récupérer tous les utilisateurs
  async getUsers(): Promise<any[]> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .order("username");

    if (error) throw error;
    return data || [];
  },

  // Créer un utilisateur
  async createUser(data: {
    username: string;
    firstname?: string;
    lastname?: string;
    email?: string;
    roles?: string[];
  }): Promise<any> {
    const { data: result, error } = await supabase
      .from("users")
      .insert({
        username: data.username,
        firstname: data.firstname,
        lastname: data.lastname,
        email: data.email,
        roles: data.roles || ["user"],
        status: "offline",
      })
      .select("id")
      .single();

    if (error) throw error;
    return result;
  },

  // Trouver ou créer un utilisateur
  async findOrCreateUser(name: string): Promise<string> {
    // Essayer de trouver l'utilisateur existant
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .or(
        `firstname.ilike.%${name}%,lastname.ilike.%${name}%,username.ilike.%${name}%`
      )
      .single();

    if (existing) {
      return existing.id;
    }

    // Créer l'utilisateur s'il n'existe pas
    const username = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const { data: newUser, error } = await supabase
      .from("users")
      .insert({
        username: username,
        firstname: name.split(" ")[0],
        lastname: name.split(" ").slice(1).join(" "),
        roles: ["user"],
        status: "offline",
      })
      .select("id")
      .single();

    if (error) throw error;
    return newUser.id;
  },

  // ===== ZONES =====

  // Récupérer toutes les zones
  async getZones(): Promise<any[]> {
    const { data, error } = await supabase
      .from("zones")
      .select("*")
      .eq("is_active", true)
      .order("label");

    if (error) throw error;
    return data || [];
  },

  // Créer une zone
  async createZone(data: {
    code?: string;
    label: string;
    region?: string;
  }): Promise<any> {
    const { data: result, error } = await supabase
      .from("zones")
      .insert({
        code: data.code || data.label.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        label: data.label,
        region: data.region,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return result;
  },

  // Trouver ou créer une zone
  async findOrCreateZone(label: string): Promise<string> {
    // Essayer de trouver la zone existante
    const { data: existing } = await supabase
      .from("zones")
      .select("id")
      .eq("label", label)
      .single();

    if (existing) {
      return existing.id;
    }

    // Créer la zone si elle n'existe pas
    const { data: newZone, error } = await supabase
      .from("zones")
      .insert({
        code: label.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        label: label,
        is_active: true,
      })
      .select("id")
      .single();

    if (error) throw error;
    return newZone.id;
  },
};

// ===== API USERS V2 =====

export const usersApiV2 = {
  // Récupérer tous les utilisateurs avec leurs rôles
  async getAll(params?: {
    limit?: number;
    offset?: number;
    status?: string;
    role?: string;
  }): Promise<PaginatedResponse<User>> {
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
    }

    // Pagination
    const limit = params?.limit || 500;
    const offset = params?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const transformedData = (data || []).map((item) => ({
      ...item,
      roles: item.user_roles?.map((ur: any) => ur.roles?.name).filter(Boolean) || [],
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
  async create(data: {
    email: string;
    password: string;
    username: string;
    firstname?: string;
    lastname?: string;
    color?: string;
    code_gestionnaire?: string;
    roles?: string[];
  }): Promise<User> {
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
  async update(
    id: string,
    data: {
      email?: string;
      password?: string;
      username?: string;
      firstname?: string;
      lastname?: string;
      color?: string;
      code_gestionnaire?: string;
      status?: "connected" | "dnd" | "busy" | "offline";
      roles?: string[];
    }
  ): Promise<User> {
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

    const roleIds = roles?.map(role => role.id) || [];

    if (roleIds.length === 0) {
      throw new Error("No valid roles found");
    }

    // Supprimer les rôles existants
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // Ajouter les nouveaux rôles
    const userRoles = roleIds.map(roleId => ({
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

    return (data || []).map((item) => ({
      ...item,
      roles: item.user_roles?.map((ur: any) => ur.roles?.name).filter(Boolean) || [],
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
  async getStats(): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_role: Record<string, number>;
    active_today: number;
  }> {
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
};

// ===== API ROLES V2 =====

export const rolesApiV2 = {
  // Récupérer tous les rôles
  async getAll(): Promise<any[]> {
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

    return (data || []).map((role) => ({
      ...role,
      permissions: role.role_permissions?.map((rp: any) => rp.permissions) || [],
    }));
  },

  // Créer un rôle
  async create(data: {
    name: string;
    description?: string;
    permissions?: string[];
  }): Promise<any> {
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

    return role;
  },

  // Assigner des permissions à un rôle
  async assignPermissions(roleId: string, permissionKeys: string[]): Promise<void> {
    // Récupérer les IDs des permissions
    const { data: permissions, error: permissionsError } = await supabase
      .from("permissions")
      .select("id, key")
      .in("key", permissionKeys);

    if (permissionsError) throw permissionsError;

    const permissionIds = permissions?.map(permission => permission.id) || [];

    if (permissionIds.length === 0) {
      throw new Error("No valid permissions found");
    }

    // Supprimer les permissions existantes
    await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);

    // Ajouter les nouvelles permissions
    const rolePermissions = permissionIds.map(permissionId => ({
      role_id: roleId,
      permission_id: permissionId,
    }));

    const { error: assignError } = await supabase
      .from("role_permissions")
      .insert(rolePermissions);

    if (assignError) throw assignError;
  },
};

// ===== API PERMISSIONS V2 =====

export const permissionsApiV2 = {
  // Récupérer toutes les permissions
  async getAll(): Promise<any[]> {
    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .order("key");

    if (error) throw error;
    return data || [];
  },

  // Créer une permission
  async create(data: {
    key: string;
    description?: string;
  }): Promise<any> {
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
};

// ===== API UTILITAIRES =====

export const utilsApi = {
  // Fonction pour convertir un fichier en base64
  async fileToBase64(file: File): Promise<string> {
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
  },

  // Fonction pour obtenir la taille d'un fichier en format lisible
  formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  },

  // Fonction pour valider un type MIME
  isValidMimeType(mimeType: string): boolean {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ];
    return allowedTypes.includes(mimeType);
  },

  // Fonction pour générer un mot de passe sécurisé
  generateSecurePassword(length: number = 12): string {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  },

  // Fonction pour valider un email
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Fonction pour valider un nom d'utilisateur
  isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    return usernameRegex.test(username);
  },

  // Fonction pour générer un code gestionnaire unique
  async generateUniqueCodeGestionnaire(firstname: string, lastname: string): Promise<string> {
    const baseCode = `${firstname.charAt(0).toUpperCase()}${lastname.charAt(0).toUpperCase()}`;
    let code = baseCode;
    let counter = 1;

    while (true) {
      const { data, error } = await supabase
        .from("users")
        .select("code_gestionnaire")
        .eq("code_gestionnaire", code)
        .single();

      if (error && error.code === 'PGRST116') {
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
  },

};

/**
 * Obtient le nombre total d'interventions correspondant aux filtres fournis
 * sans récupérer les enregistrements.
 * @param params - Filtres optionnels à appliquer
 * @returns Nombre total d'interventions correspondant
 */
export async function getInterventionTotalCount(
  params?: Omit<
    GetAllParams,
    "limit" | "offset" | "fields" | "sortBy" | "sortDir" | "cursor" | "direction"
  >,
): Promise<number> {
  try {
    let query = supabase
      .from("interventions")
      .select("id", { count: "exact", head: true });

    query = applyInterventionFilters(query, params);

    const { count, error } = await query;

    if (error) {
      // Améliorer le message d'erreur pour le diagnostic
      const errorMessage = error.message || JSON.stringify(error, Object.getOwnPropertyNames(error))
      console.error(`[getInterventionTotalCount] Erreur Supabase:`, {
        error,
        errorMessage,
        params,
      })
      throw new Error(`Erreur lors du comptage des interventions: ${errorMessage}`)
    }

    return count ?? 0;
  } catch (error) {
    // Re-lancer l'erreur avec plus de contexte si ce n'est pas déjà une Error
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Erreur inattendue lors du comptage: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`)
  }
}

/**
 * Obtient le nombre total d'artisans correspondant aux filtres
 * Utilise count: "exact", head: true pour ne transférer que le nombre
 * @param params - Filtres optionnels à appliquer
 * @returns Nombre total d'artisans correspondant
 */
export async function getArtisanTotalCount(
  params?: {
    gestionnaire?: string
    statut?: string
  }
): Promise<number> {
  let query = supabase
    .from("artisans")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)

  if (params?.gestionnaire) {
    query = query.eq("gestionnaire_id", params.gestionnaire)
  }
  if (params?.statut) {
    query = query.eq("statut_id", params.statut)
  }

  const { count, error } = await query
  if (error) throw error

  return count ?? 0
}

/**
 * Obtient le nombre total d'artisans avec tous les filtres appliqués
 * @param params - Filtres à appliquer (gestionnaire, statuts, metiers, search)
 * @returns Nombre total d'artisans correspondant
 */
export async function getArtisanCountWithFilters(
  params?: {
    gestionnaire?: string
    statut?: string
    statuts?: string[]
    metier?: string
    metiers?: string[]
    search?: string
  }
): Promise<number> {
  let query = supabase
    .from("artisans")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)

  if (params?.gestionnaire) {
    query = query.eq("gestionnaire_id", params.gestionnaire)
  }

  if (params?.statuts && params.statuts.length > 0) {
    query = query.in("statut_id", params.statuts)
  } else if (params?.statut) {
    query = query.eq("statut_id", params.statut)
  }

  if (params?.search && params.search.trim()) {
    const term = params.search.trim()
    query = query.or(
      [
        `prenom.ilike.%${term}%`,
        `nom.ilike.%${term}%`,
        `raison_sociale.ilike.%${term}%`,
        `email.ilike.%${term}%`,
        `telephone.ilike.%${term}%`,
        `telephone2.ilike.%${term}%`,
      ].join(",")
    )
  }

  const { count, error } = await query
  if (error) throw error

  // Pour les métiers, on doit filtrer après car c'est une relation many-to-many
  // On récupère d'abord les IDs des artisans qui correspondent aux autres filtres,
  // puis on filtre par métiers parmi ceux-là
  if (params?.metiers && params.metiers.length > 0) {
    // Récupérer les IDs des artisans qui correspondent aux autres filtres (sans métiers)
    let idsQuery = supabase
      .from("artisans")
      .select("id")
      .eq("is_active", true)

    if (params?.gestionnaire) {
      idsQuery = idsQuery.eq("gestionnaire_id", params.gestionnaire)
    }

    if (params?.statuts && params.statuts.length > 0) {
      idsQuery = idsQuery.in("statut_id", params.statuts)
    } else if (params?.statut) {
      idsQuery = idsQuery.eq("statut_id", params.statut)
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim()
      idsQuery = idsQuery.or(
        [
          `prenom.ilike.%${term}%`,
          `nom.ilike.%${term}%`,
          `raison_sociale.ilike.%${term}%`,
          `email.ilike.%${term}%`,
          `telephone.ilike.%${term}%`,
          `telephone2.ilike.%${term}%`,
        ].join(",")
      )
    }

    const { data: filteredArtisans, error: idsError } = await idsQuery
    if (idsError) throw idsError

    if (!filteredArtisans || filteredArtisans.length === 0) {
      return 0
    }

    const artisanIds = filteredArtisans.map((a: any) => a.id).filter(Boolean)
    if (artisanIds.length === 0) {
      return 0
    }

    // Filtrer par métiers parmi ces artisans en utilisant la fonction utilitaire qui divise en lots
    const filteredIds = await filterArtisansByMetiers(artisanIds, params.metiers)

    return filteredIds.size
  } else if (params?.metier) {
    // Même logique pour un seul métier
    let idsQuery = supabase
      .from("artisans")
      .select("id")
      .eq("is_active", true)

    if (params?.gestionnaire) {
      idsQuery = idsQuery.eq("gestionnaire_id", params.gestionnaire)
    }

    if (params?.statuts && params.statuts.length > 0) {
      idsQuery = idsQuery.in("statut_id", params.statuts)
    } else if (params?.statut) {
      idsQuery = idsQuery.eq("statut_id", params.statut)
    }

    if (params?.search && params.search.trim()) {
      const term = params.search.trim()
      idsQuery = idsQuery.or(
        [
          `prenom.ilike.%${term}%`,
          `nom.ilike.%${term}%`,
          `raison_sociale.ilike.%${term}%`,
          `email.ilike.%${term}%`,
          `telephone.ilike.%${term}%`,
          `telephone2.ilike.%${term}%`,
        ].join(",")
      )
    }

    const { data: filteredArtisans, error: idsError } = await idsQuery
    if (idsError) throw idsError

    if (!filteredArtisans || filteredArtisans.length === 0) {
      return 0
    }

    const artisanIds = filteredArtisans.map((a: any) => a.id).filter(Boolean)
    if (artisanIds.length === 0) {
      return 0
    }

    // Filtrer par métier parmi ces artisans en utilisant la fonction utilitaire qui divise en lots
    const filteredIds = await filterArtisansByMetier(artisanIds, params.metier)

    return filteredIds.size
  }

  return count ?? 0
}

/**
 * Obtient le nombre d'interventions par statut (pour les pastilles de vues)
 * @param params - Filtres à appliquer (user, agence, dates, etc.)
 * @returns Objet avec statut_id → count
 */
export async function getInterventionCounts(
  params?: Omit<GetDistinctParams, "statut">
): Promise<Record<string, number>> {
  let query = supabase
    .from("interventions")
    .select("statut_id", { count: "exact", head: false });

  // Appliquer les filtres (hors statut puisqu'on compte PAR statut)
  const filterParams: GetAllParams = {
    ...params,
    statut: undefined,
  };
  query = applyInterventionFilters(query, filterParams);

  const { data, error } = await query;
  if (error) throw error;
  if (!data) return {};

  // Compter par statut_id
  const counts: Record<string, number> = {};
  for (const row of data) {
    const statusId = row.statut_id;
    if (statusId) {
      counts[statusId] = (counts[statusId] || 0) + 1;
    }
  }

  return counts;
}

export async function getDistinctInterventionValues(
  property: string,
  params?: GetDistinctParams,
): Promise<string[]> {
  const column = resolveColumn(property);
  if (!column) {
    return [];
  }

  const normalizedProperty = property.trim().toLowerCase();

  const resolveFromReferences = async (): Promise<string[] | null> => {
    switch (normalizedProperty) {
      case "statut":
      case "statut_id":
      case "statusvalue": {
        const { data } = await getReferenceCache();
        const statuses = data.interventionStatuses ?? [];
        const values = statuses
          .map((status) => status.label || status.code || status.id)
          .filter((value): value is string => Boolean(value));
        if (!values.length) return [];
        return Array.from(new Set(values)).sort((a, b) =>
          a.localeCompare(b, "fr", { sensitivity: "base" }),
        );
      }
      case "agence":
      case "agence_id": {
        const { data } = await getReferenceCache();
        const agencies = data.agencies ?? [];
        const values = agencies
          .map((agency) => agency.label || agency.code || agency.id)
          .filter((value): value is string => Boolean(value));
        if (!values.length) return [];
        return Array.from(new Set(values)).sort((a, b) =>
          a.localeCompare(b, "fr", { sensitivity: "base" }),
        );
      }
      case "attribuea":
      case "assigned_user_id": {
        const { data } = await getReferenceCache();
        const users = data.users ?? [];
        const values = users
          .map((user) => {
            const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();
            return fullName || user.username || user.id;
          })
          .filter((value): value is string => Boolean(value));
        if (!values.length) return [];
        return Array.from(new Set(values)).sort((a, b) =>
          a.localeCompare(b, "fr", { sensitivity: "base" }),
        );
      }
      case "metier":
      case "metier_id": {
        const { data } = await getReferenceCache();
        const metiers = data.metiers ?? [];
        const values = metiers
          .map((metier) => metier.label || metier.code || metier.id)
          .filter((value): value is string => Boolean(value));
        if (!values.length) return [];
        return Array.from(new Set(values)).sort((a, b) =>
          a.localeCompare(b, "fr", { sensitivity: "base" }),
        );
      }
      // Colonnes calculées depuis intervention_costs (pas de colonnes directes dans interventions)
      case "coutintervention":
      case "coutsst":
      case "coutmateriel":
      case "marge": {
        // Ces valeurs sont calculées dynamiquement, on ne peut pas les extraire facilement
        // Retourner un tableau vide pour éviter les erreurs
        return [];
      }
      // Colonnes calculées depuis intervention_artisans
      case "artisan":
      case "deuxiemeartisan": {
        // Ces valeurs sont calculées dynamiquement depuis les relations
        return [];
      }
      default:
        return null;
    }
  };

  const referenceValues = await resolveFromReferences();
  if (referenceValues && referenceValues.length > 0) {
    return referenceValues;
  }

  const limit = Math.max(10, Math.min(params?.limit ?? 250, 1000));

  let query = supabase
    .from("interventions")
    .select(column, { head: false })
    .order(column, { ascending: true, nullsFirst: false })
    .not(column, "is", null)
    .limit(limit);

  if (params?.statut) {
    if (Array.isArray(params.statut)) {
      query = query.in("statut_id", params.statut);
    } else {
      query = query.eq("statut_id", params.statut);
    }
  }
  if (params?.agence) {
    if (Array.isArray(params.agence)) {
      query = query.in("agence_id", params.agence);
    } else {
      query = query.eq("agence_id", params.agence);
    }
  }
  // ⚠️ TODO: Le filtre artisan nécessite un JOIN avec intervention_artisans
  // if (params?.artisan) { ... }

  if (params?.user) {
    if (Array.isArray(params.user)) {
      query = query.in("assigned_user_id", params.user);
    } else {
      query = query.eq("assigned_user_id", params.user);
    }
  }
  if (params?.startDate) {
    query = query.gte("date", params.startDate);  // ⚠️ Colonne réelle = 'date'
  }
  if (params?.endDate) {
    query = query.lte("date", params.endDate);    // ⚠️ Colonne réelle = 'date'
  }

  const { data, error } = await query;
  if (error) {
    console.error(`Error fetching distinct values for column "${column}":`, error);
    throw error;
  }
  if (!data) return [];

  let refs: ReferenceCache | null = null;
  const ensureRefs = async () => {
    if (!refs) {
      refs = await getReferenceCache();
    }
    return refs;
  };

  const transformValue = async (raw: unknown): Promise<string | undefined> => {
    if (raw == null) return undefined;
    const value = String(raw);

    switch (property) {
      case "statusValue":
      case "statut":
      case "statut_id": {
        const { interventionStatusesById } = await ensureRefs();
        const status = interventionStatusesById.get(value);
        if (status?.code) return status.code;
        if (status?.label) return status.label;
        return value;
      }
      case "attribueA":
      case "assigned_user_id": {
        const { usersById } = await ensureRefs();
        const user = usersById.get(value);
        if (user) {
          const fullName = `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim();
          return fullName || user.username || value;
        }
        return value;
      }
      case "agence":
      case "agence_id": {
        const { agenciesById } = await ensureRefs();
        const agency = agenciesById.get(value);
        if (agency?.label) return agency.label;
        if (agency?.code) return agency.code;
        return value;
      }
      case "metier":
      case "metier_id": {
        const { metiersById } = await ensureRefs();
        const metier = metiersById.get(value);
        if (metier?.code) return metier.code;
        if (metier?.label) return metier.label;
        return value;
      }
      default:
        return value;
    }
  };

  const seen = new Set<string>();
  const values: string[] = [];

  for (const row of data) {
    const raw = row[column as keyof typeof row];
    if (raw == null || raw === "") continue;
    const displayValue = await transformValue(raw);
    if (!displayValue) continue;
    if (seen.has(displayValue)) continue;
    seen.add(displayValue);
    values.push(displayValue);
  }

  return values;
}

// Export des constantes
export const INTERVENTION_STATUS = [
  "Demandé",
  "Devis_Envoyé",
  "Accepté",
  "En_cours",
  "Visite_Technique",
  "Terminé",
  "Annulé",
  "Refusé",
  "STAND_BY",
  "SAV",
];

export const INTERVENTION_METIERS = [
  "Vitrerie",
  "Bricolage",
  "Plomberie",
  "Électricité",
  "Couvreur",
  "Menuiserie",
  "Chauffage",
  "Dépannage",
];

export const DOCUMENT_TYPES = {
  intervention: [
    "devis",
    "photos",
    "facturesGMBS",
    "facturesArtisans",
    "facturesMateriel",
    "rapport_intervention",
    "plan",
    "schema",
    "autre",
  ],
  artisan: [
    "certificat",
    "assurance",
    "siret",
    "kbis",
    "photo_profil",
    "portfolio",
    "autre",
  ],
};

export const COMMENT_TYPES = [
  "general",
  "technique",
  "commercial",
  "interne",
  "client",
  "artisan",
  "urgent",
  "suivi",
];
