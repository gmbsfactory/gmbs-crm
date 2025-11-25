import type { InterventionStatusKey } from '@/config/interventions';
import { DEFAULT_STATUS_CHAIN } from '@/config/intervention-status-chains';

export interface IntermediateStatusResult {
    intermediateStatuses: InterventionStatusKey[];
    isValid: boolean;
    error?: string;
}

/**
 * Calcule les statuts intermédiaires à parcourir lors d'une transition
 * 
 * @param fromStatus - Statut source (null lors de la création initiale)
 * @param toStatus - Statut cible
 * @param chain - Chaîne de progression des statuts
 * 
 * Si fromStatus est null (création initiale), on considère qu'on part du premier statut de la chaîne.
 * Si le statut cible n'est pas le premier de la chaîne, tous les statuts précédents seront créés.
 */
export function calculateIntermediateStatuses(
    fromStatus: InterventionStatusKey | null,
    toStatus: InterventionStatusKey,
    chain: InterventionStatusKey[] = DEFAULT_STATUS_CHAIN
): IntermediateStatusResult {
    // Cas 1 : Création initiale (fromStatus est null)
    // Si on crée directement avec un statut qui n'est pas le premier de la chaîne,
    // on doit créer tous les statuts précédents
    if (fromStatus === null) {
        const toIndex = chain.indexOf(toStatus);
        
        if (toIndex === -1) {
            // Le statut cible n'est pas dans la chaîne, transition directe autorisée
            return {
                intermediateStatuses: [],
                isValid: true,
            };
        }
        
        if (toIndex === 0) {
            // Le statut cible est le premier de la chaîne, pas de statuts intermédiaires
            return {
                intermediateStatuses: [],
                isValid: true,
            };
        }
        
        // Créer tous les statuts depuis le début jusqu'au statut cible (exclus)
        // Exemple: chaîne [DEMANDE, DEVIS_ENVOYE, INTER_TERMINEE]
        // Si on crée directement avec INTER_TERMINEE (index 2), on doit créer DEMANDE et DEVIS_ENVOYE
        const intermediateStatuses = chain.slice(0, toIndex);
        
        return {
            intermediateStatuses,
            isValid: true,
        };
    }

    // Cas 2 : Même statut
    if (fromStatus === toStatus) {
        return {
            intermediateStatuses: [],
            isValid: true,
        };
    }

    // Cas 3 : Vérifier que les statuts sont dans la chaîne
    const fromIndex = chain.indexOf(fromStatus);
    const toIndex = chain.indexOf(toStatus);

    if (toIndex === -1) {
        // Le statut cible n'est pas dans la chaîne, transition directe autorisée
        return {
            intermediateStatuses: [],
            isValid: true,
        };
    }

    if (fromIndex === -1) {
        // Le statut source n'est pas dans la chaîne, mais le statut cible oui
        // On considère qu'on part du premier statut de la chaîne
        // et on crée tous les statuts jusqu'au statut cible (exclus)
        const intermediateStatuses = chain.slice(0, toIndex);
        return {
            intermediateStatuses,
            isValid: true,
        };
    }

    // Cas 4 : Régression (toIndex < fromIndex)
    if (toIndex < fromIndex) {
        return {
            intermediateStatuses: [],
            isValid: true,
        };
    }

    // Cas 5 : Progression normale
    // Retourner tous les statuts de fromIndex+1 à toIndex (exclus)
    // Exemple: A -> C (A=0, B=1, C=2). Intermédiaire = B.
    // slice(1, 2) -> [B]. Correct.
    const intermediateStatuses = chain.slice(fromIndex + 1, toIndex);

    return {
        intermediateStatuses,
        isValid: true,
    };
}
