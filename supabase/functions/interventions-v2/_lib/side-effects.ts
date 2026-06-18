// ===== INTERVENTIONS-V2 - SIDE EFFECTS =====
// Effets de bord déclenchés par les transitions de statut :
// - recalculateArtisanStatusInternal : recalcule le niveau d'un artisan (avec downgrade)
// - handleInterventionCompletionSideEffects : update statut + dossier des artisans liés
//
// NB : la création des transitions de statut est assurée par le trigger DB
// `log_intervention_status_transition_on_insert` (source unique).

import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ARTISAN_LEVEL_CODES,
  TERMINATED_INTERVENTION_CODES,
  calculateDossierStatus,
} from './helpers.ts';

/**
 * Fonction interne pour recalculer le statut d'un artisan basé sur ses interventions terminées.
 * Supporte le downgrade (si moins d'interventions terminées, le statut peut baisser).
 */
export async function recalculateArtisanStatusInternal(
  supabase: SupabaseClient,
  artisanId: string,
  terminatedStatusIds: Set<string>,
  requestId: string,
  interventionId: string,
): Promise<void> {
  try {
    // Charger l'artisan avec son statut actuel
    const { data: artisan, error: artisanError } = await supabase
      .from('artisans')
      .select('id, statut_id')
      .eq('id', artisanId)
      .single();

    if (artisanError || !artisan) {
      console.error(JSON.stringify({
        level: 'error',
        requestId,
        interventionId,
        artisanId,
        message: 'Failed to load artisan for status recalculation',
        error: artisanError?.message ?? 'NOT_FOUND',
      }));
      return;
    }

    // Charger les statuts artisan
    const { data: artisanStatuses, error: statusError } = await supabase
      .from('artisan_statuses')
      .select('id, code');

    if (statusError || !artisanStatuses) {
      console.error(JSON.stringify({
        level: 'error',
        requestId,
        interventionId,
        artisanId,
        message: 'Failed to load artisan statuses',
        error: statusError?.message,
      }));
      return;
    }

    const codeToStatusId = new Map<string, string>();
    const statusIdToCode = new Map<string, string>();
    for (const status of artisanStatuses) {
      if (status?.code && status?.id) {
        const upperCode = (status.code as string).toUpperCase();
        codeToStatusId.set(upperCode, status.id as string);
        statusIdToCode.set(status.id as string, upperCode);
      }
    }

    const currentCode = artisan.statut_id
      ? statusIdToCode.get(artisan.statut_id as string) ?? null
      : null;

    // Ne pas modifier ARCHIVE automatiquement
    if (currentCode === 'ARCHIVE') {
      return;
    }

    // Compter TOUTES les interventions terminées de l'artisan
    const { data: linkedInterventions, error: linkedError } = await supabase
      .from('intervention_artisans')
      .select('intervention_id')
      .eq('artisan_id', artisanId);

    if (linkedError) {
      console.error(JSON.stringify({
        level: 'error',
        requestId,
        interventionId,
        artisanId,
        message: 'Failed to load artisan interventions for recalculation',
        error: linkedError.message,
      }));
      return;
    }

    const interventionIds = (linkedInterventions ?? [])
      .map((row) => row?.intervention_id as string | null)
      .filter((value): value is string => Boolean(value));

    let completedCount = 0;
    if (interventionIds.length > 0) {
      const { count, error: countError } = await supabase
        .from('interventions')
        .select('id', { count: 'exact', head: true })
        .in('id', interventionIds)
        .in('statut_id', Array.from(terminatedStatusIds));

      if (countError) {
        console.error(JSON.stringify({
          level: 'error',
          requestId,
          interventionId,
          artisanId,
          message: 'Failed to count completed interventions for artisan recalculation',
          error: countError.message,
        }));
        return;
      }

      completedCount = count ?? 0;
    }

    // Calculer le nouveau statut selon les seuils
    let newCode: string | null = null;
    if (completedCount >= 10) {
      newCode = 'EXPERT';
    } else if (completedCount >= 6) {
      newCode = 'CONFIRME';
    } else if (completedCount >= 3) {
      newCode = 'FORMATION';
    } else if (completedCount >= 1) {
      newCode = 'NOVICE';
    } else {
      // 0 intervention terminée = POTENTIEL (downgrade)
      newCode = 'POTENTIEL';
    }

    // Si pas de changement, on ne fait rien
    if (newCode === currentCode) {
      console.log(JSON.stringify({
        level: 'info',
        requestId,
        interventionId,
        artisanId,
        message: 'Artisan status unchanged after recalculation',
        currentStatus: currentCode,
        completedCount,
      }));
      return;
    }

    const newStatusId = codeToStatusId.get(newCode);
    if (!newStatusId) {
      console.error(JSON.stringify({
        level: 'error',
        requestId,
        interventionId,
        artisanId,
        message: 'New status code not found in artisan_statuses',
        newCode,
      }));
      return;
    }

    // Mettre à jour l'artisan
    const { error: updateError } = await supabase
      .from('artisans')
      .update({
        statut_id: newStatusId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artisanId);

    if (updateError) {
      console.error(JSON.stringify({
        level: 'error',
        requestId,
        interventionId,
        artisanId,
        message: 'Failed to update artisan status during recalculation',
        error: updateError.message,
      }));
      return;
    }

    console.log(JSON.stringify({
      level: 'info',
      requestId,
      interventionId,
      artisanId,
      message: 'Artisan status recalculated successfully',
      previousStatus: currentCode,
      newStatus: newCode,
      completedCount,
    }));

  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      requestId,
      interventionId,
      artisanId,
      message: 'Unexpected error during artisan status recalculation',
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

export async function handleInterventionCompletionSideEffects(
  supabase: SupabaseClient,
  intervention: { id: string; statut_id?: string | null },
  requestId: string,
  oldStatutId?: string | null,
) {
  if (!intervention?.id) {
    return;
  }

  try {
    const { data: terminatedStatuses, error: terminatedStatusError } = await supabase
      .from('intervention_statuses')
      .select('id, code')
      .in('code', TERMINATED_INTERVENTION_CODES);

    if (terminatedStatusError) {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          interventionId: intervention.id,
          message: 'Failed to load terminated intervention statuses',
          error: terminatedStatusError.message,
        }),
      );
      return;
    }

    const terminatedStatusIds = new Set(
      (terminatedStatuses ?? [])
        .filter((row) => row?.id)
        .map((row) => row.id as string),
    );

    // Vérifier si le statut a changé par rapport à un statut terminé (dans n'importe quelle direction)
    const isNowTerminated = intervention.statut_id && terminatedStatusIds.has(intervention.statut_id);
    const wasTerminated = oldStatutId && terminatedStatusIds.has(oldStatutId);

    // Si pas de changement concernant les statuts terminés, on ne fait rien
    if (!isNowTerminated && !wasTerminated) {
      return;
    }

    // NOUVEAU: Gérer le downgrade quand l'intervention QUITTE un statut terminé
    if (wasTerminated && !isNowTerminated) {
      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          interventionId: intervention.id,
          message: 'Intervention leaving terminated status, recalculating artisan statuses (downgrade)',
          oldStatutId,
          newStatutId: intervention.statut_id,
        }),
      );

      // Récupérer tous les artisans liés à cette intervention
      const { data: downgradeArtisanLinks, error: downgradeError } = await supabase
        .from('intervention_artisans')
        .select('artisan_id')
        .eq('intervention_id', intervention.id);

      if (!downgradeError && downgradeArtisanLinks) {
        const downgradeArtisanIds = downgradeArtisanLinks
          .map((link) => link?.artisan_id as string)
          .filter(Boolean);

        // Pour chaque artisan, recalculer son statut basé sur le nouveau compte d'interventions terminées
        for (const artisanId of downgradeArtisanIds) {
          await recalculateArtisanStatusInternal(supabase, artisanId, terminatedStatusIds, requestId, intervention.id);
        }
      }

      return;
    }

    // Si l'intervention n'est pas terminée maintenant, sortir
    if (!isNowTerminated) {
      return;
    }

    const { data: artisanLinks, error: artisanLinkError } = await supabase
      .from('intervention_artisans')
      .select('artisan_id, is_primary')
      .eq('intervention_id', intervention.id);

    if (artisanLinkError) {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          interventionId: intervention.id,
          message: 'Failed to load intervention artisans',
          error: artisanLinkError.message,
        }),
      );
      return;
    }

    if (!artisanLinks || artisanLinks.length === 0) {
      return;
    }

    // CORRECTION: Récupérer TOUS les artisans liés (primaires ET secondaires)
    // Chaque artisan lié à une intervention terminée doit voir son compteur mis à jour
    let artisanIds = artisanLinks
      .filter((link) => link?.artisan_id)
      .map((link) => link.artisan_id as string);

    artisanIds = Array.from(new Set(artisanIds));

    if (artisanIds.length === 0) {
      return;
    }

    const { data: artisanStatuses, error: artisanStatusError } = await supabase
      .from('artisan_statuses')
      .select('id, code');

    if (artisanStatusError) {
      console.error(
        JSON.stringify({
          level: 'error',
          requestId,
          interventionId: intervention.id,
          message: 'Failed to load artisan statuses',
          error: artisanStatusError.message,
        }),
      );
      return;
    }

    const codeToStatusId = new Map<string, string>();
    const statusIdToCode = new Map<string, string>();

    for (const status of artisanStatuses ?? []) {
      if (status?.code && status?.id) {
        const upperCode = (status.code as string).toUpperCase();
        codeToStatusId.set(upperCode, status.id as string);
        statusIdToCode.set(status.id as string, upperCode);
      }
    }

    const missingCodes = ARTISAN_LEVEL_CODES.filter(
      (code) => !codeToStatusId.has(code),
    );

    if (missingCodes.length === ARTISAN_LEVEL_CODES.length) {
      // Aucun statut cible n'est disponible, inutile de continuer
      console.warn(
        JSON.stringify({
          level: 'warn',
          requestId,
          interventionId: intervention.id,
          message:
            'Automatic artisan status update skipped because no target status codes are available',
          missingCodes,
        }),
      );
      return;
    }

    for (const artisanId of artisanIds) {
      // Charger l'artisan avec son statut actuel et son statut de dossier
      const { data: artisan, error: artisanError } = await supabase
        .from('artisans')
        .select('id, statut_id, statut_dossier')
        .eq('id', artisanId)
        .single();

      if (artisanError || !artisan) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to load artisan for status update',
            error: artisanError?.message ?? 'NOT_FOUND',
          }),
        );
        continue;
      }

      // Charger les documents de l'artisan pour calculer le statut de dossier
      const { data: attachments, error: attachmentsError } = await supabase
        .from('artisan_attachments')
        .select('kind')
        .eq('artisan_id', artisanId)
        .neq('kind', 'autre');

      if (attachmentsError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to load artisan attachments',
            error: attachmentsError.message,
          }),
        );
        // Continuer quand même, on utilisera une valeur par défaut
      }

      // CORRECTION: Compter TOUTES les interventions de l'artisan (primaires ET secondaires)
      const { data: linkedInterventions, error: linkedError } = await supabase
        .from('intervention_artisans')
        .select('intervention_id')
        .eq('artisan_id', artisanId);

      if (linkedError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to load artisan interventions',
            error: linkedError.message,
          }),
        );
        continue;
      }

      const interventionIds = (linkedInterventions ?? [])
        .map((row) => row?.intervention_id as string | null)
        .filter((value): value is string => Boolean(value));

      if (interventionIds.length === 0) {
        continue;
      }

      const { count: completedCount, error: countError } = await supabase
        .from('interventions')
        .select('id', { count: 'exact', head: true })
        .in('id', interventionIds)
        .in('statut_id', Array.from(terminatedStatusIds));

      if (countError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to count completed interventions for artisan',
            error: countError.message,
          }),
        );
        continue;
      }

      const completed = completedCount ?? 0;
      const currentCode = artisan.statut_id
        ? statusIdToCode.get(artisan.statut_id as string) ?? null
        : null;

      // Ne pas modifier les statuts ONE_SHOT et ARCHIVE automatiquement
      // Ces statuts sont gérés manuellement uniquement
      if (currentCode === 'ONE_SHOT' || currentCode === 'ARCHIVE') {
        // Mettre à jour uniquement le statut de dossier si nécessaire
        const currentDossierStatus = artisan.statut_dossier as string | null;
        const newDossierStatus = calculateDossierStatus(attachments ?? [], completed > 0);

        if (newDossierStatus !== currentDossierStatus) {
          const { error: dossierUpdateError } = await supabase
            .from('artisans')
            .update({
              statut_dossier: newDossierStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', artisanId);

          if (dossierUpdateError) {
            console.error(
              JSON.stringify({
                level: 'error',
                requestId,
                interventionId: intervention.id,
                artisanId,
                message: 'Failed to update artisan dossier status',
                error: dossierUpdateError.message,
              }),
            );
          }
        }
        continue;
      }

      // Calculer le nouveau statut selon les règles
      let nextCode = currentCode;

      // Règle : candidat → novice après 1 intervention terminée
      // Règle : potentiel → novice après première intervention terminée
      if (completed >= 10) {
        nextCode = 'EXPERT';
      } else if (completed >= 6) {
        nextCode = 'CONFIRME';
      } else if (completed >= 3) {
        nextCode = 'FORMATION';
      } else if (completed >= 1) {
        // Si CANDIDAT ou POTENTIEL → NOVICE après 1 intervention
        if (currentCode === 'CANDIDAT' || currentCode === 'POTENTIEL') {
          nextCode = 'NOVICE';
        } else if (currentCode === null) {
          nextCode = 'NOVICE';
        } else {
          // Pour les autres statuts, on garde le statut actuel jusqu'au seuil suivant
          nextCode = currentCode;
        }
      } else {
        // Moins de 1 intervention → reste CANDIDAT ou POTENTIEL
        nextCode = currentCode || 'CANDIDAT';
      }

      // Ne pas mettre à jour si le statut n'a pas changé
      if (!nextCode || nextCode === currentCode) {
        // Mais on peut quand même mettre à jour le statut de dossier
        const currentDossierStatus = artisan.statut_dossier as string | null;
        const newDossierStatus = calculateDossierStatus(attachments ?? [], completed > 0);

        if (newDossierStatus !== currentDossierStatus) {
          const { error: dossierUpdateError } = await supabase
            .from('artisans')
            .update({
              statut_dossier: newDossierStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', artisanId);

          if (dossierUpdateError) {
            console.error(
              JSON.stringify({
                level: 'error',
                requestId,
                interventionId: intervention.id,
                artisanId,
                message: 'Failed to update artisan dossier status',
                error: dossierUpdateError.message,
              }),
            );
          }
        }
        continue;
      }

      const nextStatusId = codeToStatusId.get(nextCode);
      if (!nextStatusId) {
        continue;
      }

      // Calculer le nouveau statut de dossier
      const currentDossierStatus = artisan.statut_dossier as string | null;
      let newDossierStatus = calculateDossierStatus(attachments ?? [], completed > 0);

      // Règle ARC-002 : Si statut dossier = INCOMPLET ET statut artisan devient NOVICE → statut dossier passe à "À compléter"
      if (
        currentDossierStatus === 'INCOMPLET' &&
        nextCode === 'NOVICE' &&
        currentCode !== 'NOVICE'
      ) {
        newDossierStatus = 'À compléter';
      }

      // Préparer la mise à jour
      const updateData: any = {
        statut_id: nextStatusId,
        updated_at: new Date().toISOString(),
      };

      // Mettre à jour le statut de dossier seulement s'il a changé
      if (newDossierStatus !== currentDossierStatus) {
        updateData.statut_dossier = newDossierStatus;
      }

      const { error: updateError } = await supabase
        .from('artisans')
        .update(updateData)
        .eq('id', artisanId);

      if (updateError) {
        console.error(
          JSON.stringify({
            level: 'error',
            requestId,
            interventionId: intervention.id,
            artisanId,
            message: 'Failed to update artisan status',
            error: updateError.message,
          }),
        );
        continue;
      }

      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          interventionId: intervention.id,
          artisanId,
          previousStatus: currentCode,
          newStatus: nextCode,
          previousDossierStatus: currentDossierStatus,
          newDossierStatus: newDossierStatus,
          completedInterventions: completed,
          timestamp: new Date().toISOString(),
          message: 'Artisan status and dossier status updated based on completed interventions',
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        interventionId: intervention?.id ?? null,
        message: 'Unexpected error while updating artisan status',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
