"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { RealtimeChannel } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase-client"
import type { ImportMode, ImportResponse, ImportResolutionsMap } from "@/utils/import-export/import-types"
import type { ImportJobRow, ImportJobStatus } from "@/lib/api/interventions/import-jobs"
import type { ImportStage } from "./ImportProgressPanel"
import { initialStages, stagesFromJob } from "./import-job-stages"

// ─── Interface (identique à useImportStream pour rester drop-in) ──────────────

interface RunArgs {
  file: File
  mode: ImportMode
  dryRun: boolean
  resolutions?: ImportResolutionsMap
}

interface RunResult {
  report?: ImportResponse
  error?: string
  aborted?: boolean
}

const POLL_INTERVAL_MS = 4000
const TERMINAL: ImportJobStatus[] = ['succeeded', 'failed', 'cancelled']

export function useImportJob() {
  const [stages, setStages] = useState<ImportStage[]>(initialStages())
  const [running, setRunning] = useState(false)
  const jobIdRef = useRef<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Résolveur de la promesse `run` en cours, déclenché par l'état terminal.
  const settleRef = useRef<((r: RunResult) => void) | null>(null)
  const settledRef = useRef(false)

  const teardown = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    teardown()
    jobIdRef.current = null
    settleRef.current = null
    settledRef.current = false
    setStages(initialStages())
    setRunning(false)
  }, [teardown])

  useEffect(() => () => teardown(), [teardown])

  // Applique un snapshot de job : met à jour les stages et, si terminal,
  // résout la promesse `run`.
  const applyJob = useCallback(async (job: ImportJobRow) => {
    setStages(stagesFromJob(job))

    if (!TERMINAL.includes(job.status) || settledRef.current) return
    settledRef.current = true
    teardown()
    setRunning(false)

    if (job.status === 'cancelled') {
      settleRef.current?.({ aborted: true })
      return
    }
    if (job.status === 'failed') {
      settleRef.current?.({ error: job.error_message ?? "L'import a échoué" })
      return
    }
    // succeeded : le `result` complet (avec preview) vit dans la sidecar, non
    // diffusée par Realtime → on le récupère via GET.
    try {
      const res = await fetch(`/api/imports/interventions/jobs/${job.id}`)
      const json = await res.json()
      const full = json.job as ImportJobRow | undefined
      if (full?.result) settleRef.current?.({ report: full.result })
      else settleRef.current?.({ error: 'Résultat introuvable après import' })
    } catch (e) {
      settleRef.current?.({ error: e instanceof Error ? e.message : 'Erreur de lecture du résultat' })
    }
  }, [teardown])

  const subscribe = useCallback((jobId: string) => {
    // Realtime sur la ligne du job.
    channelRef.current = supabase
      .channel(`import-job-${jobId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'intervention_import_jobs', filter: `id=eq.${jobId}` },
        (payload: { new: ImportJobRow }) => { void applyJob(payload.new) },
      )
      .subscribe()

    // Filet de sécurité : polling si un événement Realtime est manqué.
    pollRef.current = setInterval(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/imports/interventions/jobs/${jobId}`)
          if (!res.ok) return
          const json = await res.json()
          if (json.job) await applyJob(json.job as ImportJobRow)
        } catch {
          /* transient — le prochain tick réessaiera */
        }
      })()
    }, POLL_INTERVAL_MS)
  }, [applyJob])

  const run = useCallback(async (args: RunArgs): Promise<RunResult> => {
    reset()
    setRunning(true)

    const body = new FormData()
    body.append('file', args.file)
    body.append('mode', args.mode)
    body.append('dry_run', String(args.dryRun))
    if (args.resolutions && Object.keys(args.resolutions).length > 0) {
      body.append('resolutions', JSON.stringify(args.resolutions))
    }

    let jobId: string
    try {
      const res = await fetch('/api/imports/interventions/jobs', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok || !json.job_id) {
        setRunning(false)
        return { error: json.error ?? `Erreur HTTP ${res.status}` }
      }
      jobId = json.job_id
    } catch (e) {
      setRunning(false)
      return { error: e instanceof Error ? e.message : 'Erreur réseau' }
    }

    jobIdRef.current = jobId
    settledRef.current = false

    return new Promise<RunResult>((resolve) => {
      settleRef.current = resolve
      subscribe(jobId)
      // Récupération initiale immédiate (le job peut déjà avoir progressé, voire
      // terminé, avant l'établissement de l'abonnement Realtime).
      void (async () => {
        try {
          const res = await fetch(`/api/imports/interventions/jobs/${jobId}`)
          if (res.ok) {
            const json = await res.json()
            if (json.job) await applyJob(json.job as ImportJobRow)
          }
        } catch { /* le polling/Realtime prendra le relais */ }
      })()
    })
  }, [reset, subscribe, applyJob])

  const cancel = useCallback(() => {
    const jobId = jobIdRef.current
    if (!jobId) return
    void fetch(`/api/imports/interventions/jobs/${jobId}/cancel`, { method: 'POST' }).catch(() => {})
  }, [])

  return { stages, running, run, cancel, reset }
}
