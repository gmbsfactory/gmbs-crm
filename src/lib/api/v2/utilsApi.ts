// ===== API UTILITAIRES V2 =====
// Fonctions utilitaires pour toutes les APIs

import type { ReferenceData } from "@/lib/reference-api";
import { referenceApi } from "@/lib/reference-api";
import { supabase } from "@/lib/supabase-client";

// Cache pour les données de référence
type ReferenceCache = {
  data: ReferenceData;
  fetchedAt: number;
  usersById: Map<string, ReferenceData["users"][number]>;
  agenciesById: Map<string, ReferenceData["agencies"][number]>;
  interventionStatusesById: Map<string, ReferenceData["interventionStatuses"][number]>;
  artisanStatusesById: Map<string, ReferenceData["artisanStatuses"][number]>;
  metiersById: Map<string, ReferenceData["metiers"][number]>;
};

const REFERENCE_CACHE_DURATION = 5 * 60 * 1000;
let referenceCache: ReferenceCache | null = null;
let referenceCachePromise: Promise<ReferenceCache> | null = null;

export const invalidateReferenceCache = () => {
  referenceCache = null;
  referenceCachePromise = null;
};

async function getReferenceCache(): Promise<ReferenceCache> {
  const now = Date.now();
  if (referenceCache && now - referenceCache.fetchedAt < REFERENCE_CACHE_DURATION) {
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
      interventionStatusesById: new Map(data.interventionStatuses.map((status) => [status.id, status])),
      artisanStatusesById: new Map(data.artisanStatuses.map((status) => [status.id, status])),
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

  // Fonction pour construire l'affichage d'un utilisateur
  buildUserDisplay(user?: ReferenceData["users"][number] | null) {
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
  },

  // Fonction pour mapper un enregistrement d'intervention
  mapInterventionRecord(item: any, refs: ReferenceCache): any {
    const userInfo = this.buildUserDisplay(refs.usersById.get(item.assigned_user_id ?? ""));
    const agency = item.agence_id ? refs.agenciesById.get(item.agence_id) : undefined;
    const status = item.statut_id ? refs.interventionStatusesById.get(item.statut_id) : undefined;
    const metier = item.metier_id ? refs.metiersById.get(item.metier_id) : undefined;

    return {
      ...item,
      artisans: Array.isArray(item.artisans) ? item.artisans : [],
      costs: Array.isArray(item.costs) ? item.costs : [],
      payments: Array.isArray(item.payments) ? item.payments : [],
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      coutIntervention: item.cout_intervention ?? item.coutIntervention ?? null,
      coutSST: item.cout_sst ?? item.coutSST ?? null,
      coutMateriel: item.cout_materiel ?? item.coutMateriel ?? null,
      marge: item.marge ?? null,
      agence: agency?.label ?? item.agence ?? item.agence_id ?? null,
      agenceLabel: agency?.label ?? null,
      agenceCode: agency?.code ?? null,
      agenceColor: agency?.color ?? null,
      contexteIntervention: item.contexte_intervention ?? item.contexteIntervention ?? null,
      consigneIntervention: item.consigne_intervention ?? item.consigneIntervention ?? null,
      consigneDeuxiemeArtisanIntervention: item.consigne_second_artisan ?? item.consigneDeuxiemeArtisanIntervention ?? null,
      commentaireAgent: item.commentaire_agent ?? item.commentaireAgent ?? null,
      latitudeAdresse: typeof item.latitude === "number" ? item.latitude.toString() : item.latitudeAdresse ?? null,
      longitudeAdresse: typeof item.longitude === "number" ? item.longitude.toString() : item.longitudeAdresse ?? null,
      codePostal: item.code_postal ?? item.codePostal ?? null,
      dateIntervention: item.date_intervention ?? item.dateIntervention ?? item.date ?? null,
      prenomClient: item.prenom_client ?? item.prenomClient ?? null,
      nomClient: item.nom_client ?? item.nomClient ?? null,
      attribueA: userInfo.code ?? userInfo.username ?? undefined,
      assignedUserName: userInfo.fullName ?? undefined,
      assignedUserCode: userInfo.code,
      assignedUserColor: userInfo.color ?? null,
      statut: status?.code ?? item.statut ?? null,
      statusValue: status?.code ?? item.statusValue ?? item.statut ?? null,
      statusColor: status?.color ?? null,
      numeroSST: item.numero_sst ?? item.numeroSST ?? null,
      pourcentageSST: item.pourcentage_sst ?? item.pourcentageSST ?? null,
      commentaire: item.commentaire ?? item.commentaire_agent ?? null,
      demandeIntervention: item.demande_intervention ?? item.demandeIntervention ?? null,
      demandeDevis: item.demande_devis ?? item.demandeDevis ?? null,
      demandeTrustPilot: item.demande_trust_pilot ?? item.demandeTrustPilot ?? null,
      metier: metier?.code ?? item.metier ?? item.metier_id ?? null,
      metierLabel: metier?.label ?? null,
      metierCode: metier?.code ?? null,
      metierColor: metier?.color ?? null,
      type: item.type ?? null,
      typeDeuxiemeArtisan: item.type_deuxieme_artisan ?? item.typeDeuxiemeArtisan ?? null,
      datePrevue: item.date_prevue ?? item.datePrevue ?? null,
      datePrevueDeuxiemeArtisan: item.date_prevue_deuxieme_artisan ?? item.datePrevueDeuxiemeArtisan ?? null,
      telLoc: item.tel_loc ?? item.telLoc ?? null,
      locataire: item.locataire ?? null,
      emailLocataire: item.email_locataire ?? item.emailLocataire ?? null,
      telephoneClient: item.telephone_client ?? item.telephoneClient ?? null,
      telephone2Client: item.telephone2_client ?? item.telephone2Client ?? null,
      emailClient: item.email_client ?? item.emailClient ?? null,
      prenomProprietaire: item.prenom_proprietaire ?? item.prenomProprietaire ?? null,
      nomProprietaire: item.nom_proprietaire ?? item.nomProprietaire ?? null,
      telephoneProprietaire: item.telephone_proprietaire ?? item.telephoneProprietaire ?? null,
      emailProprietaire: item.email_proprietaire ?? item.emailProprietaire ?? null,
      pieceJointeIntervention: item.piece_jointe_intervention ?? item.pieceJointeIntervention ?? [],
      pieceJointeCout: item.piece_jointe_cout ?? item.pieceJointeCout ?? [],
      pieceJointeDevis: item.piece_jointe_devis ?? item.pieceJointeDevis ?? [],
      pieceJointePhotos: item.piece_jointe_photos ?? item.pieceJointePhotos ?? [],
      pieceJointeFactureGMBS: item.piece_jointe_facture_gmbs ?? item.pieceJointeFactureGMBS ?? [],
      pieceJointeFactureArtisan: item.piece_jointe_facture_artisan ?? item.pieceJointeFactureArtisan ?? [],
      pieceJointeFactureMateriel: item.piece_jointe_facture_materiel ?? item.pieceJointeFactureMateriel ?? [],
      // Sous-statut personnalisé
      understatement: item.sous_statut_text ?? item.understatement ?? null,
      sousStatutTextColor: item.sous_statut_text_color ?? '#000000',
      sousStatutBgColor: item.sous_statut_bg_color ?? 'transparent',
    };
  },

  // Fonction pour mapper un enregistrement d'artisan
  mapArtisanRecord(item: any, refs: ReferenceCache): any {
    const userInfo = this.buildUserDisplay(refs.usersById.get(item.gestionnaire_id ?? ""));

    return {
      ...item,
      metiers: Array.isArray(item.metiers) ? item.metiers : [],
      zones: Array.isArray(item.zones) ? item.zones : [],
      attribueA: userInfo.code ?? userInfo.username ?? undefined,
      gestionnaireUsername: userInfo.username ?? undefined,
      gestionnaireName: userInfo.fullName ?? undefined,
      statutArtisan: item.statut_id ?? item.statutArtisan ?? null,
      statutInactif: item.is_active === false,
      commentaire: item.suivi_relances_docs ?? item.commentaire ?? null,
      statutDossier: item.statut_dossier ?? item.statutDossier ?? null,
      zoneIntervention: Array.isArray(item.zones) && item.zones.length ? Number(item.zones[0]) : item.zoneIntervention ?? null,
      date: item.date_ajout ?? item.date ?? null,
    };
  },

  // Récupérer le cache de référence
  async getReferenceCache(): Promise<ReferenceCache> {
    return getReferenceCache();
  },

  // Fonction pour valider les données d'un utilisateur
  validateUserData(userData: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validation email
    if (!this.isValidEmail(userData.email)) {
      errors.push("Email invalide");
    }

    // Validation username
    if (!this.isValidUsername(userData.username)) {
      errors.push("Nom d'utilisateur invalide (3-20 caractères, lettres, chiffres, _, -)");
    }

    // Validation mot de passe
    if (userData.password && userData.password.length < 8) {
      errors.push("Mot de passe trop court (minimum 8 caractères)");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  },

  // Fonction pour formater une date
  formatDate(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  },

  // Fonction pour formater une date et heure
  formatDateTime(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  // Fonction pour générer un UUID v4
  generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  // Fonction pour nettoyer une chaîne de caractères
  sanitizeString(str: string): string {
    return str
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[<>]/g, '');
  },

  // Fonction pour extraire les initiales d'un nom
  getInitials(firstname: string | null, lastname: string | null): string {
    const first = firstname?.charAt(0)?.toUpperCase() || '';
    const last = lastname?.charAt(0)?.toUpperCase() || '';
    return first + last;
  },
};
