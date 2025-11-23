import { supabase } from '@/lib/supabase-client';
import { calculateIntermediateStatuses } from './status-chain-calculator';
import { DEFAULT_STATUS_CHAIN, STATUS_CHAIN_CONFIG } from '@/config/intervention-status-chains';
import type { InterventionStatusKey } from '@/config/interventions';

export interface AutomaticTransitionResult {
    success: boolean;
    transitionsCreated: number;
    finalStatus: InterventionStatusKey;
    errors: string[];
}

/**
 * Service pour gérer les transitions automatiques avec statuts intermédiaires
 */
export class AutomaticTransitionService {
    /**
     * Exécute une transition de statut avec gestion des statuts intermédiaires
     */
    async executeTransition(
        interventionId: string,
        fromStatus: InterventionStatusKey,
        toStatus: InterventionStatusKey,
        userId?: string,
        metadata?: Record<string, unknown>
    ): Promise<AutomaticTransitionResult> {
        const errors: string[] = [];
        let transitionsCreated = 0;

        // Calculer les statuts intermédiaires
        const chainResult = calculateIntermediateStatuses(
            fromStatus,
            toStatus,
            DEFAULT_STATUS_CHAIN
        );

        if (!chainResult.isValid && chainResult.error) {
            return {
                success: false,
                transitionsCreated: 0,
                finalStatus: fromStatus,
                errors: [chainResult.error],
            };
        }

        // Si pas de statuts intermédiaires, transition directe
        if (chainResult.intermediateStatuses.length === 0) {
            const transitionId = await this.createTransition(
                interventionId,
                fromStatus,
                toStatus,
                userId,
                metadata
            );

            if (transitionId) {
                transitionsCreated = 1;
            }

            return {
                success: !!transitionId,
                transitionsCreated,
                finalStatus: toStatus,
                errors: transitionId ? [] : ['Échec de la création de la transition'],
            };
        }

        // Créer les transitions intermédiaires
        const allStatuses = [fromStatus, ...chainResult.intermediateStatuses, toStatus];
        const transitionDate = new Date();

        // On itère jusqu'à l'avant-dernier élément pour créer les transitions
        // Ex: A -> B -> C. allStatuses = [A, B, C].
        // i=0: A -> B (intermédiaire)
        // i=1: B -> C (final)
        for (let i = 0; i < allStatuses.length - 1; i++) {
            const currentFrom = allStatuses[i];
            const currentTo = allStatuses[i + 1];
            const isFinal = i === allStatuses.length - 2;

            // Calculer la date de transition (avec délai pour préserver l'ordre)
            const currentTransitionDate = new Date(
                transitionDate.getTime() + i * STATUS_CHAIN_CONFIG.intermediateTransitionDelay
            );

            const transitionMetadata = {
                ...metadata,
                is_intermediate: !isFinal,
                final_target_status: toStatus,
                transition_chain: 'MAIN_PROGRESSION', // Idéalement dynamique
                transition_order: i + 1,
                total_transitions: allStatuses.length - 1,
            };

            const transitionId = await this.createTransition(
                interventionId,
                currentFrom,
                currentTo,
                userId,
                transitionMetadata,
                currentTransitionDate
            );

            if (transitionId) {
                transitionsCreated++;
            } else {
                errors.push(
                    `Échec de la transition de ${currentFrom} vers ${currentTo}`
                );
            }
        }

        return {
            success: errors.length === 0,
            transitionsCreated,
            finalStatus: toStatus,
            errors,
        };
    }

    /**
     * Crée une transition dans la table intervention_status_transitions
     */
    private async createTransition(
        interventionId: string,
        fromStatus: InterventionStatusKey,
        toStatus: InterventionStatusKey,
        userId?: string,
        metadata?: Record<string, unknown>,
        transitionDate?: Date
    ): Promise<string | null> {
        try {
            // Récupérer les IDs des statuts depuis la table intervention_statuses
            const { data: statuses, error: statusError } = await supabase
                .from('intervention_statuses')
                .select('id, code')
                .in('code', [fromStatus, toStatus]);

            if (statusError || !statuses) {
                console.error('Erreur lors de la récupération des statuts:', statusError);
                return null;
            }

            const fromStatusData = statuses.find((s) => s.code === fromStatus);
            const toStatusData = statuses.find((s) => s.code === toStatus);

            if (!toStatusData) {
                console.error(`Statut cible "${toStatus}" introuvable`);
                return null;
            }

            // Appeler la fonction SQL existante
            const { data, error } = await supabase.rpc('log_status_transition_from_api', {
                p_intervention_id: interventionId,
                p_from_status_id: fromStatusData?.id || null,
                p_to_status_id: toStatusData.id,
                p_changed_by_user_id: userId || null,
                p_metadata: metadata || {},
            });

            if (error) {
                console.error('Erreur lors de la création de la transition:', error);
                return null;
            }

            // Si une date personnalisée est fournie, mettre à jour la transition
            // Note: log_status_transition_from_api utilise now() par défaut
            if (transitionDate && data) {
                await supabase
                    .from('intervention_status_transitions')
                    .update({ transition_date: transitionDate.toISOString() })
                    .eq('id', data);
            }

            return data;
        } catch (error) {
            console.error('Exception lors de la création de la transition:', error);
            return null;
        }
    }
}

export const automaticTransitionService = new AutomaticTransitionService();
