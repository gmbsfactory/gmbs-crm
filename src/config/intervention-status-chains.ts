import type { InterventionStatusKey } from './interventions';

/**
 * Chaînes de progression des statuts d'intervention
 * 
 * Définit l'ordre dans lequel les statuts doivent être parcourus
 * lors d'une transition automatique.
 * 
 * Exemple : Si une intervention passe de DEMANDE à TERMINE,
 * elle passera automatiquement par tous les statuts intermédiaires
 * de la chaîne MAIN_PROGRESSION.
 */
export const INTERVENTION_STATUS_CHAINS = {
    /**
     * Chaîne principale de progression standard
     * IMPORTANT: Utilise les codes DB (INTER_EN_COURS, INTER_TERMINEE)
     */
    MAIN_PROGRESSION: [
        'DEMANDE',
        'DEVIS_ENVOYE',
        'VISITE_TECHNIQUE',
        'ACCEPTE',
        'INTER_EN_COURS',
        'INTER_TERMINEE'
    ] as InterventionStatusKey[],

    /**
     * Chaîne alternative (sans devis)
     * IMPORTANT: Utilise les codes DB (INTER_EN_COURS, INTER_TERMINEE)
     */
    VISIT_FIRST_PROGRESSION: [
        'DEMANDE',
        'VISITE_TECHNIQUE',
        'ACCEPTE',
        'INTER_EN_COURS',
        'INTER_TERMINEE'
    ] as InterventionStatusKey[],
} as const;

/**
 * Chaîne par défaut à utiliser
 */
export const DEFAULT_STATUS_CHAIN = INTERVENTION_STATUS_CHAINS.MAIN_PROGRESSION;

/**
 * Mode de validation des prérequis pour les statuts intermédiaires
 */
export type IntermediateStatusValidationMode = 'strict' | 'permissive';

/**
 * Configuration globale
 */
export const STATUS_CHAIN_CONFIG = {
    /**
     * Mode de validation : 
     * - 'strict' : Tous les prérequis doivent être remplis pour chaque statut intermédiaire
     * - 'permissive' : Les prérequis ne sont vérifiés que pour le statut final
     */
    validationMode: 'permissive' as IntermediateStatusValidationMode,

    /**
     * Délai entre chaque transition intermédiaire (en millisecondes)
     * Permet de préserver l'ordre chronologique dans la table
     */
    intermediateTransitionDelay: 1, // 1ms entre chaque transition
} as const;
