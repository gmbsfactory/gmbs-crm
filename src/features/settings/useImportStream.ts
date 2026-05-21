"use client"

import { useCallback, useRef, useState } from "react"
import type { ImportMode, ImportResponse, ImportResolutionsMap } from "@/utils/import-export/import-types"
import type { ImportStage, StageId, StageStatus } from "./ImportProgressPanel"

type ProgressEvent =
  | { stage: 'parsing' }
  | { stage: 'parsed'; rowCount: number }
  | { stage: 'validating'; done: number; total: number }
  | { stage: 'lookup'; total: number }
  | { stage: 'persisting'; done: number; total: number }

type StreamMessage =
  | { type: 'progress'; event: ProgressEvent }
  | { type: 'done'; body: ImportResponse }
  | { type: 'error'; error: string; status?: number }
  | { type: 'aborted' }

const STAGE_ORDER: StageId[] = ['parsing', 'validating', 'lookup', 'persisting', 'done']
const STAGE_LABELS: Record<StageId, string> = {
  parsing: 'Lecture du fichier',
  validating: 'Validation des lignes',
  lookup: 'Recherche des doublons',
  persisting: 'Écriture en base',
  done: 'Finalisation',
}

function initialStages(): ImportStage[] {
  return STAGE_ORDER.map((id) => ({ id, label: STAGE_LABELS[id], status: 'idle' as StageStatus }))
}

interface RunArgs {
  file: File
  mode: ImportMode
  dryRun: boolean
  /** Phase B : décisions manuelles ligne par ligne pour les conflits. */
  resolutions?: ImportResolutionsMap
}

interface RunResult {
  report?: ImportResponse
  error?: string
  aborted?: boolean
}

export function useImportStream() {
  const [stages, setStages] = useState<ImportStage[]>(initialStages())
  const [running, setRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setStages(initialStages())
    setRunning(false)
    abortRef.current = null
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const updateStage = useCallback(
    (id: StageId, patch: Partial<ImportStage>) => {
      setStages((prev) => {
        const idx = prev.findIndex((s) => s.id === id)
        if (idx === -1) return prev
        // Marque les stages précédentes comme terminées si on en a sauté.
        const next = prev.map((s, i) => {
          if (i < idx && s.status === 'idle') return { ...s, status: 'done' as StageStatus }
          if (i < idx && s.status === 'active') return { ...s, status: 'done' as StageStatus, progress: 1 }
          if (i === idx) return { ...s, ...patch }
          return s
        })
        return next
      })
    },
    [],
  )

  const applyEvent = useCallback(
    (event: ProgressEvent) => {
      switch (event.stage) {
        case 'parsing':
          updateStage('parsing', { status: 'active' })
          break
        case 'parsed':
          updateStage('parsing', {
            status: 'done',
            detail: `${event.rowCount.toLocaleString('fr-FR')} ligne${event.rowCount > 1 ? 's' : ''}`,
          })
          break
        case 'validating': {
          const pct = event.total > 0 ? event.done / event.total : 0
          updateStage('validating', {
            status: event.done >= event.total ? 'done' : 'active',
            progress: pct,
            detail: `${event.done.toLocaleString('fr-FR')} / ${event.total.toLocaleString('fr-FR')}`,
          })
          break
        }
        case 'lookup':
          updateStage('lookup', {
            status: 'active',
            detail: `${event.total.toLocaleString('fr-FR')} à vérifier`,
          })
          break
        case 'persisting': {
          // La fin du lookup est implicite quand persisting commence.
          const pct = event.total > 0 ? event.done / event.total : 1
          setStages((prev) =>
            prev.map((s) => {
              if (s.id === 'lookup' && s.status !== 'done') return { ...s, status: 'done' }
              if (s.id === 'persisting') {
                return {
                  ...s,
                  status: event.done >= event.total ? 'done' : 'active',
                  progress: pct,
                  detail:
                    event.total === 0
                      ? 'Rien à écrire'
                      : `${event.done.toLocaleString('fr-FR')} / ${event.total.toLocaleString('fr-FR')}`,
                }
              }
              return s
            }),
          )
          break
        }
      }
    },
    [updateStage],
  )

  const run = useCallback(
    async ({ file, mode, dryRun, resolutions }: RunArgs): Promise<RunResult> => {
      setStages(initialStages())
      setRunning(true)

      const controller = new AbortController()
      abortRef.current = controller

      const body = new FormData()
      body.append('file', file)
      body.append('mode', mode)
      body.append('dry_run', String(dryRun))
      body.append('stream', 'true')
      if (resolutions && Object.keys(resolutions).length > 0) {
        body.append('resolutions', JSON.stringify(resolutions))
      }

      let res: Response
      try {
        res = await fetch('/api/imports/interventions', {
          method: 'POST',
          body,
          signal: controller.signal,
        })
      } catch (e: any) {
        setRunning(false)
        if (e?.name === 'AbortError') return { aborted: true }
        return { error: e?.message ?? 'Erreur réseau' }
      }

      if (!res.ok || !res.body) {
        setRunning(false)
        try {
          const json = await res.json()
          return { error: json.error ?? `Erreur HTTP ${res.status}` }
        } catch {
          return { error: `Erreur HTTP ${res.status}` }
        }
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let result: RunResult = {}

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            let msg: StreamMessage
            try {
              msg = JSON.parse(line) as StreamMessage
            } catch {
              continue
            }
            if (msg.type === 'progress') {
              applyEvent(msg.event)
            } else if (msg.type === 'done') {
              setStages((prev) =>
                prev.map((s) =>
                  s.id === 'done'
                    ? { ...s, status: 'done' }
                    : s.status === 'active'
                    ? { ...s, status: 'done', progress: 1 }
                    : s,
                ),
              )
              result = { report: msg.body }
            } else if (msg.type === 'error') {
              setStages((prev) =>
                prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)),
              )
              result = { error: msg.error }
            } else if (msg.type === 'aborted') {
              result = { aborted: true }
            }
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') result = { aborted: true }
        else result = { error: e?.message ?? 'Erreur de lecture du flux' }
      } finally {
        setRunning(false)
        abortRef.current = null
      }

      return result
    },
    [applyEvent],
  )

  return { stages, running, run, cancel, reset }
}
