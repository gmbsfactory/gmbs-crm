import type { ImportJobRow } from "@/lib/api/interventions/import-jobs"
import type { ImportStage, StageId, StageStatus } from "./ImportProgressPanel"

// Mapping job → stages, partagé par useImportJob. Module pur (aucune dépendance
// Supabase / React) pour rester testable en isolation.

export const STAGE_ORDER: StageId[] = ['parsing', 'validating', 'lookup', 'persisting', 'done']

const STAGE_LABELS: Record<StageId, string> = {
  parsing: 'Lecture du fichier',
  validating: 'Validation des lignes',
  lookup: 'Recherche des doublons',
  persisting: 'Écriture en base',
  done: 'Finalisation',
}

export function initialStages(): ImportStage[] {
  return STAGE_ORDER.map((id) => ({ id, label: STAGE_LABELS[id], status: 'idle' as StageStatus }))
}

// Le worker écrit `stage` ∈ parsing|validating|lookup|persisting (et 'parsed'
// en fin de dry-run, qu'on rattache à 'parsing').
function jobStageToId(stage: string | null): StageId {
  if (stage === 'parsed') return 'parsing'
  if ((STAGE_ORDER as string[]).includes(stage ?? '')) return stage as StageId
  return 'parsing'
}

const fr = (n: number) => n.toLocaleString('fr-FR')

/**
 * Reconstruit l'état des stages à partir d'un instantané du job. Contrairement
 * à l'ancien flux streamé (événements incrémentaux), on reçoit ici des
 * snapshots Realtime : on dérive donc les stages de zéro à chaque mise à jour.
 */
export function stagesFromJob(job: Pick<ImportJobRow,
  'status' | 'stage' | 'processed_rows' | 'total_rows'>): ImportStage[] {
  const stages = initialStages()

  if (job.status === 'succeeded') {
    return stages.map((s) => ({ ...s, status: 'done' as StageStatus, progress: 1 }))
  }

  const currentId = jobStageToId(job.stage)
  const currentIdx = STAGE_ORDER.indexOf(currentId)

  return stages.map((s, i) => {
    if (i < currentIdx) return { ...s, status: 'done', progress: 1 }
    if (i > currentIdx) return s // idle
    // Stage courante.
    if (job.status === 'failed' || job.status === 'cancelled') {
      return { ...s, status: 'error' }
    }
    if (s.id === 'validating' || s.id === 'persisting') {
      const total = job.total_rows ?? 0
      const done = job.processed_rows ?? 0
      const pct = total > 0 ? done / total : 0
      return {
        ...s,
        status: 'active',
        progress: pct,
        detail: total === 0 ? undefined : `${fr(done)} / ${fr(total)}`,
      }
    }
    return { ...s, status: 'active' }
  })
}
