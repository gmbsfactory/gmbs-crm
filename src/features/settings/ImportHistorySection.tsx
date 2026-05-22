"use client"

import { CheckCircle2, XCircle, Loader2, Clock, Ban } from "lucide-react"
import { useImportJobs } from "./useImportJobs"
import type { ImportJobRow, ImportJobStatus } from "@/lib/api/interventions/import-jobs"

const STATUS_META: Record<ImportJobStatus, { label: string; icon: React.ReactNode; tone: string }> = {
  pending:   { label: 'En attente',  icon: <Clock className="h-3.5 w-3.5" />,             tone: 'text-muted-foreground' },
  running:   { label: 'En cours',    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, tone: 'text-blue-600 dark:text-blue-400' },
  succeeded: { label: 'Terminé',     icon: <CheckCircle2 className="h-3.5 w-3.5" />,      tone: 'text-emerald-600 dark:text-emerald-400' },
  failed:    { label: 'Échec',       icon: <XCircle className="h-3.5 w-3.5" />,           tone: 'text-destructive' },
  cancelled: { label: 'Annulé',      icon: <Ban className="h-3.5 w-3.5" />,               tone: 'text-muted-foreground' },
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function summary(job: ImportJobRow): string {
  if (job.status === 'succeeded') {
    if (job.dry_run) return `Simulation — ${job.total_rows ?? 0} ligne(s)`
    return `${job.inserted_rows} créées · ${job.updated_rows} maj · ${job.failed_rows} erreur(s)`
  }
  if (job.status === 'running') {
    const total = job.total_rows ?? 0
    return total > 0 ? `${job.processed_rows} / ${total}` : 'Traitement…'
  }
  if (job.status === 'failed') return job.error_message ?? 'Erreur inconnue'
  return ''
}

/**
 * Liste compacte des imports récents de l'utilisateur. Alimentée par
 * `useImportJobs` (TanStack Query + Realtime) : un import lancé puis dont
 * l'onglet a été fermé réapparaît ici avec son état à jour, car le worker
 * poursuit côté serveur.
 */
export function ImportHistorySection({ enabled = true }: { enabled?: boolean }) {
  const { data: jobs, isLoading, isError } = useImportJobs({ enabled })

  if (!enabled || isLoading || isError) return null
  if (!jobs || jobs.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Imports récents</p>
      <ul className="rounded-xl border divide-y overflow-hidden">
        {jobs.map((job) => {
          const meta = STATUS_META[job.status]
          return (
            <li key={job.id} className="flex items-center gap-3 px-3 py-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 shrink-0 ${meta.tone}`}>
                {meta.icon}
                {meta.label}
              </span>
              <span className="text-muted-foreground/80 shrink-0">{formatWhen(job.created_at)}</span>
              {job.dry_run && (
                <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">simulation</span>
              )}
              <span className="flex-1 min-w-0 truncate text-muted-foreground">{summary(job)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
