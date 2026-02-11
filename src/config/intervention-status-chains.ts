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
     * Note: Utilise les codes DB réels (INTER_EN_COURS et INTER_TERMINEE)
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
 * Chaîne cumulative pour la validation.
 *
 * Pour atteindre un statut X sur cette chaîne, TOUS les prérequis
 * des statuts précédents X doivent aussi être satisfaits.
 *
 * VISITE_TECHNIQUE est exclu car c'est un détour optionnel
 * (la chaîne VISIT_FIRST_PROGRESSION existe comme alternative sans devis).
 */
export const CUMULATIVE_VALIDATION_CHAIN: InterventionStatusKey[] = [
    'DEMANDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'INTER_EN_COURS',
    'INTER_TERMINEE',
];

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
    validationMode: 'strict' as IntermediateStatusValidationMode,

    /**
     * Délai entre chaque transition intermédiaire (en millisecondes)
     * Permet de préserver l'ordre chronologique dans la table
     */
    intermediateTransitionDelay: 1, // 1ms entre chaque transition
} as const;
