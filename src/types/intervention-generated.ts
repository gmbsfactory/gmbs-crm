/**
 * Types générés depuis le schéma SQL (source unique de vérité)
 * Ces types sont basés sur database.types.ts qui est généré depuis Supabase
 * 
 * ⚠️ IMPORTANT: Ne pas modifier ce fichier manuellement.
 * Les types doivent être générés depuis le schéma SQL via:
 *   npx supabase gen types typescript --local > src/lib/database.types.ts
 * 
 * Ce fichier exporte des types consolidés basés sur database.types.ts
 */

import type { Database } from '@/lib/database.types';

// ===== TYPES DE BASE DEPUIS LE SCHÉMA SQL =====

/**
 * Type de base pour une intervention (Row depuis database.types.ts)
 * Source unique de vérité: table interventions dans le schéma SQL
 */
export type InterventionRow = Database['public']['Tables']['interventions']['Row'];

/**
 * Type pour créer une intervention (Insert depuis database.types.ts)
 */
export type InterventionInsert = Database['public']['Tables']['interventions']['Insert'];

/**
 * Type pour mettre à jour une intervention (Update depuis database.types.ts)
 */
export type InterventionUpdate = Database['public']['Tables']['interventions']['Update'];

// ===== TYPES ENRICHIS (avec relations) =====

/**
 * Intervention de base avec toutes les colonnes de la table
 * Utilise le type généré depuis le schéma SQL
 */
export interface Intervention extends InterventionRow {
    // Relations optionnelles (chargées via JOIN)
    artisans?: string[]; // IDs des artisans associés
    costs?: InterventionCost[];
    payments?: InterventionPayment[];
    attachments?: InterventionAttachment[];
}

/**
 * Intervention avec le statut enrichi
 */
export interface InterventionWithStatus extends Intervention {
    status?: InterventionStatus | null;
}

/**
 * Statut d'intervention (depuis intervention_statuses)
 */
export interface InterventionStatus {
    id: string;
    code: string;
    label: string;
    color: string;
    sort_order: number | null;
}

// ===== TYPES POUR LES RELATIONS =====

/**
 * Coût d'intervention
 */
export interface InterventionCost {
    id: string;
    intervention_id: string;
    cost_type: 'sst' | 'materiel' | 'intervention' | 'marge';
    label: string | null;
    amount: number;
    currency: string | null;
    artisan_order: 1 | 2 | null; // 1=principal, 2=secondaire, null=global
    metadata: any;
    created_at: string | null;
    updated_at: string | null;
}

/**
 * Paiement d'intervention
 */
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

/**
 * Pièce jointe d'intervention
 */
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

// ===== TYPES POUR LES OPÉRATIONS CRUD =====

/**
 * Données pour créer une intervention
 * Basé sur InterventionInsert mais avec des champs optionnels pour faciliter l'usage
 */
export type CreateInterventionData = Partial<InterventionInsert> & {
    date: string; // Requis
};

/**
 * Données pour mettre à jour une intervention
 */
export type UpdateInterventionData = Partial<InterventionUpdate>;

// ===== TYPES DE VUE ENRICHIE (pour l'affichage) =====

/**
 * Vue enrichie d'intervention avec tous les champs mappés pour l'affichage
 * Utilisé dans les composants UI
 * 
 * Note: Ce type inclut tous les champs de base de Intervention plus
 * les champs calculés/mappés pour l'affichage dans l'UI
 */
export type InterventionView = Intervention & {
    // Status enrichi
    statusValue?: string | null;
    // Champs mappés pour l'affichage
    statusLabel?: string | null;
    statusColor?: string | null;
    adresse_complete?: string | null;
    attribueA?: string;
    assignedUserName?: string;
    assignedUserCode?: string | null;
    assignedUserColor?: string | null;
    assignedUserAvatarUrl?: string | null;

    // Contexte et consignes (snake_case → camelCase)
    contexteIntervention?: string | null;
    consigneIntervention?: string | null;
    consigneDeuxiemeArtisanIntervention?: string | null;
    commentaireAgent?: string | null;

    // Localisation
    codePostal?: string | null;
    latitudeAdresse?: string | null;
    longitudeAdresse?: string | null;
    dateIntervention?: string | null;

    // Informations client (mappées depuis les relations)
    prenomClient?: string | null;
    nomClient?: string | null;
    telephoneClient?: string | null;
    telephone2Client?: string | null;
    emailClient?: string | null;

    // Informations propriétaire
    prenomProprietaire?: string | null;
    nomProprietaire?: string | null;
    telephoneProprietaire?: string | null;
    emailProprietaire?: string | null;

    // Finances
    coutIntervention?: number | null;
    coutSST?: number | null;
    coutMateriel?: number | null;
    marge?: number | null;

    // SST
    numeroSST?: string | null;
    pourcentageSST?: number | null;

    // Agence
    agence?: string | null;
    agenceLabel?: string | null;
    agenceCode?: string | null;
    agenceColor?: string | null;

    // Métier
    metier?: string | null;
    metierLabel?: string | null;
    metierCode?: string | null;
    metierColor?: string | null;

    // Artisans
    artisan?: string | null;
    primaryArtisan?: {
        id: string;
        prenom: string | null;
        nom: string | null;
        plain_nom: string | null;
        telephone: string | null;
        email: string | null;
    } | null;

    // Dates
    datePrevue?: string | null;

    // Legacy fields (pour compatibilité)
    type?: string | null;
    typeDeuxiemeArtisan?: string | null;
    telLoc?: string | null;
    locataire?: string | null;
    emailLocataire?: string | null;
    commentaire?: string | null;
    idFacture?: number | null;
    sousStatutText?: string | null;
    sousStatutTextColor?: string | null;
    sousStatutBgColor?: string | null;
    deuxiemeArtisan?: string | null;
};

