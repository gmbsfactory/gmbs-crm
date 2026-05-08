"use client"

import { motion } from "framer-motion"
import { CheckCircle2, Loader2, Circle, XCircle } from "lucide-react"

export type StageId = 'parsing' | 'validating' | 'lookup' | 'persisting' | 'done'
export type StageStatus = 'idle' | 'active' | 'done' | 'error'

export interface ImportStage {
  id: StageId
  label: string
  status: StageStatus
  /** Texte d'état (ex: "3 487 / 3 500 — 99 %"). */
  detail?: string
  /** Progression 0..1 pour la barre de la stage active. */
  progress?: number
}

interface Props {
  stages: ImportStage[]
  onCancel?: () => void
  canCancel: boolean
}

export function ImportProgressPanel({ stages, onCancel, canCancel }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border bg-background/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Import en cours</p>
        {canCancel && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Annuler
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {stages.map((s) => (
          <li key={s.id} className="flex items-start gap-3 text-sm">
            <StageIcon status={s.status} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={
                    s.status === 'idle'
                      ? 'text-muted-foreground'
                      : s.status === 'error'
                      ? 'text-destructive font-medium'
                      : 'font-medium'
                  }
                >
                  {s.label}
                </span>
                {s.detail && (
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                    {s.detail}
                  </span>
                )}
              </div>
              {s.status === 'active' && typeof s.progress === 'number' && (
                <div className="mt-1.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(s.progress * 100)}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

function StageIcon({ status }: { status: StageStatus }) {
  if (status === 'done') return <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
  if (status === 'active') return <Loader2 className="h-4 w-4 text-blue-500 animate-spin mt-0.5 shrink-0" />
  if (status === 'error') return <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
  return <Circle className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
}
