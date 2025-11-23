import type { InterventionStatusKey } from '@/config/interventions';
import { DEFAULT_STATUS_CHAIN } from '@/config/intervention-status-chains';

export interface IntermediateStatusResult {
    intermediateStatuses: InterventionStatusKey[];
    isValid: boolean;
    error?: string;
}

/**
 * Calcule les statuts intermédiaires à parcourir lors d'une transition
 */
export function calculateIntermediateStatuses(
    fromStatus: InterventionStatusKey,
    toStatus: InterventionStatusKey,
    chain: InterventionStatusKey[] = DEFAULT_STATUS_CHAIN
): IntermediateStatusResult {
    // Cas 1 : Même statut
    if (fromStatus === toStatus) {
        return {
            intermediateStatuses: [],
            isValid: true,
        };
    }

    // Cas 2 : Vérifier que les statuts sont dans la chaîne
    const fromIndex = chain.indexOf(fromStatus);
    const toIndex = chain.indexOf(toStatus);

    if (fromIndex === -1) {
        return {
            intermediateStatuses: [],
            isValid: false,
            error: `Le statut source "${fromStatus}" n'est pas dans la chaîne de progression`,
        };
    }

    if (toIndex === -1) {
        // Le statut cible n'est pas dans la chaîne, transition directe autorisée
        return {
            intermediateStatuses: [],
            isValid: true,
            error: `Le statut cible "${toStatus}" n'est pas dans la chaîne, transition directe`,
        };
    }

    // Cas 3 : Régression (toIndex < fromIndex)
    if (toIndex < fromIndex) {
        return {
            intermediateStatuses: [],
            isValid: true,
            error: `Transition régressive de "${fromStatus}" vers "${toStatus}", pas de progression intermédiaire`,
        };
    }

    // Cas 4 : Progression normale
    // Retourner tous les statuts de fromIndex+1 à toIndex (inclus)
    // Note: toIndex est exclus dans slice, donc on utilise toIndex
    // Attends, le prompt disait "de fromIndex+1 à toIndex (inclus)"
    // slice(start, end) -> start inclus, end exclus.
    // Donc si on veut jusqu'à toIndex (exclus, car c'est le statut final, pas intermédiaire), on met toIndex.
    // Le prompt disait: "Retourner tous les statuts entre fromIndex+1 et toIndex (inclus)"
    // Mais la fonction s'appelle calculateIntermediateStatuses. Le statut final est-il intermédiaire ? Non.
    // Si je vais de A -> C (A, B, C). Intermédiaire = B.
    // Index: A=0, B=1, C=2.
    // fromIndex=0, toIndex=2.
    // slice(1, 2) -> [B]. Correct.

    const intermediateStatuses = chain.slice(fromIndex + 1, toIndex);

    return {
        intermediateStatuses,
        isValid: true,
    };
}
