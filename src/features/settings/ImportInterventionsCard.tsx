"use client"

import { Fragment, useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Upload, Loader2, AlertTriangle, FileUp, CheckCircle2,
  XCircle, Info, ChevronDown, ArrowRight, Search, X, Sparkles,
  Plus, RefreshCw, Minus, GitMerge, Hash,
} from "lucide-react"
import type { ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import {
  interventionKeys,
  artisanKeys,
  dashboardKeys,
} from "@/lib/react-query/queryKeys"
import { parseCSV } from "@/utils/import-export/parsers/csv-parser"
import { orderByRank, rankRawKey, rankDbKey } from "@/utils/import-export/preview-field-order"
import type {
  ImportMode,
  ImportResponse,
  ImportPreviewRow,
  ImportConflictCandidate,
  ImportConflictRow,
  ImportResolution,
  ImportResolutionsMap,
} from "@/utils/import-export/import-types"
import { ImportProgressPanel } from "./ImportProgressPanel"
import { useImportJob } from "./useImportJob"
import { ImportHistorySection } from "./ImportHistorySection"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type PreviewBucket = 'insert' | 'update' | 'skipped' | 'conflict' | 'error'

const MAX_PREVIEW_ROWS = 20
const MAX_FILE_MB = 10

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreviewState {
  headers: string[]
  rows: Record<string, string>[]
  totalRows: number
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function ImportInterventionsCard() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { can, isLoading: permsLoading } = usePermissions()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [mode, setMode] = useState<ImportMode>('upsert')
  const [dryRun, setDryRun] = useState(false)
  const [report, setReport] = useState<ImportResponse | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<ImportResponse | null>(null)
  const [previewBucket, setPreviewBucket] = useState<PreviewBucket | null>(null)
  // Phase B : décisions de résolution de conflits. Vidées à chaque nouveau
  // dry-run (l'utilisateur recommence depuis la nouvelle photo des conflits).
  const [resolutions, setResolutions] = useState<ImportResolutionsMap>({})
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { stages, running, run, cancel, reset: resetStages } = useImportJob()
  const importing = running

  const canImport = can("import_interventions")

  // Phase B : nombre de conflits restant à arbitrer (pas encore résolus par
  // l'utilisateur). Bloque le bouton "Confirmer" tant que > 0.
  const conflictRows = pendingConfirm?.preview?.toResolve ?? []
  const remainingConflicts = conflictRows.filter((r) => !resolutions[r.line]).length

  const handleFile = useCallback((f: File | null) => {
    if (!f) return
    if (!f.name.endsWith('.csv')) {
      toast({ title: 'Format invalide', description: 'Seuls les fichiers .csv sont acceptés.', variant: 'destructive' })
      return
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      toast({ title: 'Fichier trop volumineux', description: `Maximum ${MAX_FILE_MB} Mo.`, variant: 'destructive' })
      return
    }

    setFile(f)
    setReport(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      const rows = parseCSV(content)
      if (rows.length === 0) {
        toast({ title: 'Fichier vide', description: 'Aucune donnée détectée.', variant: 'destructive' })
        return
      }
      setPreview({
        headers: Object.keys(rows[0]),
        rows: rows.slice(0, MAX_PREVIEW_ROWS),
        totalRows: rows.length,
      })
    }
    reader.readAsText(f)
  }, [toast])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0] ?? null)
  }, [handleFile])

  async function runImport(opts: { dryRun: boolean; resolutions?: ImportResolutionsMap }) {
    if (!file) return null
    setReport(null)
    setErrorMessage(null)

    const result = await run({ file, mode, dryRun: opts.dryRun, resolutions: opts.resolutions })

    if (result.aborted) {
      toast({ title: 'Import annulé', description: 'L\'opération a été interrompue.' })
      return null
    }
    if (result.error) {
      setErrorMessage(result.error)
      toast({ title: 'Erreur import', description: result.error, variant: 'destructive' })
      return null
    }
    return result.report ?? null
  }

  async function handleImport() {
    if (!file) return
    setPendingConfirm(null)
    // Nouveau dry-run = nouvelle photo des conflits ; on repart de zéro.
    setResolutions({})

    // Manual "Simulation uniquement" : single dry-run, no confirm step.
    if (dryRun) {
      const r = await runImport({ dryRun: true })
      if (r) {
        setReport(r)
        toast({
          title: 'Validation terminée',
          description: `${r.valid} lignes valides sur ${r.total}`,
        })
      }
      return
    }

    // Real import : always preview first, then ask the user to confirm.
    const r = await runImport({ dryRun: true })
    if (!r) return
    setPendingConfirm(r)
  }

  async function handleConfirm() {
    if (!pendingConfirm) return
    setPendingConfirm(null)
    const r = await runImport({ dryRun: false, resolutions })
    if (r) {
      setReport(r)
      toast({
        title: 'Import terminé',
        description: `${r.inserted} créées, ${r.updated} mises à jour, ${r.skipped} ignorées`,
      })
      // L'import a écrit en base : le cache TanStack Query (listes/tableaux,
      // détails, comptages, dashboard) est désormais stale. On invalide pour
      // forcer un refetch et faire apparaître les interventions importées.
      // NB : la recherche globale (useUniversalSearch) n'est pas concernée —
      // elle interroge le serveur à chaque frappe et dépend du rafraîchissement
      // (asynchrone, ~60s) des vues matérialisées de recherche.
      if (r.inserted > 0 || r.updated > 0) {
        void queryClient.invalidateQueries({ queryKey: interventionKeys.all })
        void queryClient.invalidateQueries({ queryKey: artisanKeys.all })
        void queryClient.invalidateQueries({ queryKey: dashboardKeys.all })
      }
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setReport(null)
    setPendingConfirm(null)
    setErrorMessage(null)
    setResolutions({})
    resetStages()
    if (inputRef.current) inputRef.current.value = ''
  }

  if (permsLoading || !canImport) return null

  return (
    <div className="rounded-2xl border bg-card/50 overflow-hidden">
      {/* ── En-tête cliquable ── */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-8 py-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold">Importer des interventions</h3>
            <p className="text-sm text-muted-foreground">
              Réinjectez un fichier CSV au format export
            </p>
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        </motion.div>
      </button>

      {/* ── Contenu dépliable ── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-8 pt-4 space-y-5 border-t">

              {/* Zone de dépôt */}
              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => inputRef.current?.click()}
                className={`relative rounded-xl border-2 border-dashed p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
                  ${dragOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/20' : 'border-muted-foreground/25 hover:border-blue-400/50 hover:bg-muted/20'}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <FileUp className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <div className="text-center">
                    <p className="font-medium text-sm">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} Ko</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium">Glissez un fichier CSV ici</p>
                    <p className="text-xs text-muted-foreground">ou cliquez pour parcourir — max {MAX_FILE_MB} Mo</p>
                  </div>
                )}
              </div>

              {/* Prévisualisation */}
              <AnimatePresence>
                {preview && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        Aperçu — {preview.totalRows} ligne{preview.totalRows > 1 ? 's' : ''} détectée{preview.totalRows > 1 ? 's' : ''}
                        {preview.totalRows > MAX_PREVIEW_ROWS && ` (affichage des ${MAX_PREVIEW_ROWS} premières)`}
                      </p>
                      <button type="button" onClick={reset} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Changer de fichier
                      </button>
                    </div>
                    <div className="rounded-xl border overflow-auto max-h-48">
                      <table className="text-xs w-full">
                        <thead className="bg-muted/50 sticky top-0">
                          <tr>
                            {preview.headers.map((h) => (
                              <th key={h} className="px-3 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {preview.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/30">
                              {preview.headers.map((h) => (
                                <td key={h} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">{row[h]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mode d'import */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Mode d&apos;import</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['create', 'Créer uniquement', 'Ignore les ID existants'],
                    ['update', 'Mettre à jour', 'Ignore les ID absents'],
                    ['upsert', 'Upsert', 'Crée ou met à jour'],
                  ] as const).map(([value, label, desc]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setMode(value)}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        mode === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-input hover:bg-muted/30'
                      }`}
                    >
                      <p className="text-xs font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dry run */}
              <label className="flex items-start gap-3 p-3 rounded-xl border bg-background/30 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-input"
                />
                <div className="text-sm">
                  <div className="font-medium">Simulation uniquement</div>
                  <p className="text-xs text-muted-foreground">
                    Valide le fichier et retourne le rapport sans écrire en base.
                  </p>
                </div>
              </label>

              {/* Progression streamée */}
              <AnimatePresence>
                {importing && (
                  <ImportProgressPanel
                    stages={stages}
                    onCancel={cancel}
                    canCancel={importing}
                  />
                )}
              </AnimatePresence>

              {/* Rapport */}
              <AnimatePresence>
                {report && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {report.dry_run
                        ? <Info className="h-4 w-4 text-blue-500" />
                        : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {report.dry_run ? 'Résultat de la simulation' : 'Import terminé'}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Stat label="Total lignes" value={report.total} />
                      <Stat label="Valides" value={report.valid} tone={report.valid > 0 ? 'success' : 'neutral'} />
                      {!report.dry_run && (
                        <>
                          <Stat label="Créées" value={report.inserted} tone="success" />
                          <Stat label="Mises à jour" value={report.updated} tone="info" />
                          <Stat label="Ignorées" value={report.skipped} tone="muted" />
                        </>
                      )}
                      <Stat
                        label="Erreurs"
                        value={report.errors.length}
                        tone={report.errors.length > 0 ? 'danger' : 'neutral'}
                        onClick={
                          report.errors.length > 0
                            ? () => setPreviewBucket('error')
                            : undefined
                        }
                      />
                    </div>
                    {report.errors.length > 0 && (
                      <>
                        <ErrorList errors={report.errors} />
                        <button
                          type="button"
                          onClick={() => {
                            const header = 'line;id_inter;reason\n'
                            const body = report.errors
                              .map((e) => `${e.line};${e.id_inter ?? ''};"${e.reason.replace(/"/g, '""')}"`)
                              .join('\n')
                            const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `import-errors-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          className="text-xs text-primary underline-offset-2 hover:underline"
                        >
                          Télécharger toutes les erreurs ({report.errors.length}) en CSV
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Confirmation avant écriture en base */}
              <AnimatePresence>
                {pendingConfirm && !importing && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Confirmer l&apos;import ?
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vérifiez les chiffres ci-dessous avant d&apos;écrire en base. Cette action ne peut pas être annulée.
                    </p>

                    {pendingConfirm.errors.length > 0 && (
                      <ErrorList
                        errors={pendingConfirm.errors}
                        title={`${pendingConfirm.errors.length} ligne${pendingConfirm.errors.length > 1 ? 's' : ''} en erreur — corrigez le fichier puis relancez`}
                      />
                    )}

                    {pendingConfirm.preview && pendingConfirm.preview.skipped.length > 0 && (
                      <SkippedList rows={pendingConfirm.preview.skipped} />
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Stat label="Total lignes" value={pendingConfirm.total} />
                      <Stat label="Valides" value={pendingConfirm.valid} tone={pendingConfirm.valid > 0 ? 'success' : 'neutral'} />
                      <Stat
                        label="À créer"
                        value={pendingConfirm.inserted}
                        tone="success"
                        onClick={
                          pendingConfirm.inserted > 0
                            ? () => setPreviewBucket('insert')
                            : undefined
                        }
                      />
                      <Stat
                        label="À mettre à jour"
                        value={pendingConfirm.updated}
                        tone="info"
                        onClick={
                          pendingConfirm.updated > 0
                            ? () => setPreviewBucket('update')
                            : undefined
                        }
                      />
                      <Stat
                        label={remainingConflicts > 0
                          ? `Conflits (${remainingConflicts} à résoudre)`
                          : pendingConfirm.unresolved > 0
                            ? 'Conflits (tous résolus)'
                            : 'Conflits'}
                        value={pendingConfirm.unresolved}
                        tone={
                          remainingConflicts > 0
                            ? 'warning'
                            : pendingConfirm.unresolved > 0
                              ? 'success'
                              : 'neutral'
                        }
                        onClick={
                          pendingConfirm.unresolved > 0
                            ? () => setPreviewBucket('conflict')
                            : undefined
                        }
                      />
                      <Stat
                        label="Ignorées"
                        value={pendingConfirm.skipped}
                        tone="muted"
                        onClick={
                          pendingConfirm.skipped > 0
                            ? () => setPreviewBucket('skipped')
                            : undefined
                        }
                      />
                      <Stat
                        label="Erreurs"
                        value={pendingConfirm.errors.length}
                        tone={pendingConfirm.errors.length > 0 ? 'danger' : 'neutral'}
                        onClick={
                          pendingConfirm.errors.length > 0
                            ? () => setPreviewBucket('error')
                            : undefined
                        }
                      />
                    </div>
                    {pendingConfirm.unresolved > 0 && (
                      remainingConflicts > 0 ? (
                        <p className="text-xs text-orange-700 dark:text-orange-400">
                          <strong>{remainingConflicts}</strong> ligne{remainingConflicts > 1 ? 's' : ''} en conflit — cliquez sur le compteur «&nbsp;Conflits&nbsp;» pour choisir un candidat par ligne. L&apos;import reste bloqué tant qu&apos;il en reste à résoudre.
                        </p>
                      ) : (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400">
                          <strong>{pendingConfirm.unresolved}</strong> conflit{pendingConfirm.unresolved > 1 ? 's' : ''} résolu{pendingConfirm.unresolved > 1 ? 's' : ''} — les lignes correspondantes seront traitées en mise à jour vers la cible choisie.
                        </p>
                      )
                    )}
                    {(pendingConfirm.inserted > 0 || pendingConfirm.updated > 0 || pendingConfirm.skipped > 0) && (
                      <p className="text-[11px] text-muted-foreground">
                        Cliquez sur un compteur pour inspecter les lignes et leur mapping.
                      </p>
                    )}
                    {pendingConfirm.preview?.truncated && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Aperçu plafonné à {pendingConfirm.preview.perBucketLimit.toLocaleString('fr-FR')} lignes par catégorie. Pour réviser au-delà, scindez le fichier en plusieurs imports.
                      </p>
                    )}
                    {pendingConfirm.updated > 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        <strong>{pendingConfirm.updated}</strong> intervention{pendingConfirm.updated > 1 ? 's seront écrasées' : ' sera écrasée'} par les valeurs du fichier.
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={pendingConfirm.valid === 0 || remainingConflicts > 0}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Confirmer l&apos;import
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingConfirm(null)}
                        className="px-4 py-2 rounded-lg text-sm font-medium border hover:bg-muted/50 transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Avertissement audit */}
              {!dryRun && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    En mode mise à jour / upsert, les coûts existants sont <strong>écrasés</strong> par ceux du fichier.
                  </span>
                </div>
              )}

              {/* Erreur globale (réponse non-OK ou exception réseau) */}
              <AnimatePresence>
                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex gap-3"
                  >
                    <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="text-sm space-y-1">
                      <p className="font-medium text-destructive">Import refusé</p>
                      <p className="text-muted-foreground">{errorMessage}</p>
                      {/Colonnes requises/i.test(errorMessage) && (
                        <p className="text-xs text-muted-foreground pt-1">
                          Colonnes obligatoires attendues : <code className="font-mono">Date</code>,{' '}
                          <code className="font-mono">Métier</code>, <code className="font-mono">Agence</code>.
                          Vérifiez que votre CSV provient bien de l&apos;export de cette interface.
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bouton */}
              <motion.button
                type="button"
                onClick={handleImport}
                disabled={importing || !file || !!pendingConfirm}
                className="px-5 py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {dryRun ? 'Validation en cours…' : 'Import en cours…'}
                  </>
                ) : (
                  <>
                    <FileUp className="h-4 w-4" />
                    {dryRun ? 'Valider sans importer' : 'Importer le fichier'}
                  </>
                )}
              </motion.button>

              <p className="text-xs text-muted-foreground">
                Format attendu : CSV UTF-8 exporté depuis cette interface ou depuis l&apos;outil admin.
              </p>

              {/* Historique des imports (survit à la fermeture d'onglet — le
                  worker poursuit côté serveur). Activé seulement quand la carte
                  est dépliée. */}
              <ImportHistorySection enabled={open} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PreviewDialog
        bucket={previewBucket}
        response={pendingConfirm ?? report}
        onClose={() => setPreviewBucket(null)}
        resolutions={resolutions}
        onResolve={(line, resolution) =>
          setResolutions((prev) => ({ ...prev, [line]: resolution }))
        }
        onClearResolution={(line) =>
          setResolutions((prev) => {
            const next = { ...prev }
            delete next[line]
            return next
          })
        }
      />
    </div>
  )
}

type StatTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'muted'

const STAT_TONES: Record<StatTone, {
  bg: string
  border: string
  hover: string
  label: string
  value: string
  icon: ReactNode
}> = {
  neutral: {
    bg: 'bg-muted/30',
    border: 'border-transparent',
    hover: 'hover:bg-muted/60 hover:border-border',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    icon: <Hash className="h-3 w-3 opacity-70" />,
  },
  success: {
    bg: 'bg-emerald-500/8 dark:bg-emerald-500/12',
    border: 'border-emerald-500/25 dark:border-emerald-500/30',
    hover: 'hover:bg-emerald-500/15 hover:border-emerald-500/40',
    label: 'text-emerald-700/80 dark:text-emerald-300/80',
    value: 'text-emerald-700 dark:text-emerald-400',
    icon: <Plus className="h-3 w-3" />,
  },
  info: {
    bg: 'bg-sky-500/8 dark:bg-sky-500/12',
    border: 'border-sky-500/25 dark:border-sky-500/30',
    hover: 'hover:bg-sky-500/15 hover:border-sky-500/40',
    label: 'text-sky-700/80 dark:text-sky-300/80',
    value: 'text-sky-700 dark:text-sky-400',
    icon: <RefreshCw className="h-3 w-3" />,
  },
  warning: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/12',
    border: 'border-amber-500/30 dark:border-amber-500/35',
    hover: 'hover:bg-amber-500/18 hover:border-amber-500/50',
    label: 'text-amber-800/85 dark:text-amber-300/85',
    value: 'text-amber-700 dark:text-amber-400',
    icon: <GitMerge className="h-3 w-3" />,
  },
  danger: {
    bg: 'bg-destructive/8',
    border: 'border-destructive/25',
    hover: 'hover:bg-destructive/15 hover:border-destructive/40',
    label: 'text-destructive/85',
    value: 'text-destructive',
    icon: <XCircle className="h-3 w-3" />,
  },
  muted: {
    bg: 'bg-muted/20',
    border: 'border-transparent',
    hover: 'hover:bg-muted/40',
    label: 'text-muted-foreground/80',
    value: 'text-muted-foreground',
    icon: <Minus className="h-3 w-3 opacity-70" />,
  },
}

function Stat({
  label,
  value,
  tone = 'neutral',
  onClick,
}: {
  label: string
  value: number
  tone?: StatTone
  onClick?: () => void
}) {
  const interactive = !!onClick
  const Comp = interactive ? 'button' : 'div'
  const t = STAT_TONES[tone]
  return (
    <Comp
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={`group flex justify-between items-center gap-2 p-2 rounded-lg border w-full text-left transition-colors ${t.bg} ${t.border} ${
        interactive ? `${t.hover} cursor-pointer` : ''
      }`}
    >
      <span className={`inline-flex items-center gap-1.5 ${t.label}`}>
        <span className="inline-flex">{t.icon}</span>
        {label}
        {interactive && (
          <ArrowRight className="h-3 w-3 opacity-0 -translate-x-1 group-hover:opacity-70 group-hover:translate-x-0 transition-all" />
        )}
      </span>
      <span className={`font-semibold tabular-nums ${t.value}`}>{value}</span>
    </Comp>
  )
}

type ImportErrorEntry = { line: number; id_inter: string | null; reason: string }

function ErrorList({
  errors,
  title,
  initialLimit = 50,
}: {
  errors: ImportErrorEntry[]
  title?: string
  initialLimit?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? errors : errors.slice(0, initialLimit)
  const remaining = errors.length - visible.length

  return (
    <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1.5">
      {title && (
        <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {title}
        </p>
      )}
      <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
        {visible.map((e, i) => (
          <div key={i} className="text-xs flex gap-2">
            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <span className="break-words">
              <span className="font-medium">Ligne {e.line}</span>
              {e.id_inter && <span className="text-muted-foreground"> ({e.id_inter})</span>}
              {' — '}{e.reason}
            </span>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-primary hover:underline underline-offset-2"
        >
          Tout voir ({remaining} de plus)
        </button>
      )}
    </div>
  )
}

function SkippedList({ rows }: { rows: ImportPreviewRow[] }) {
  const [expanded, setExpanded] = useState(false)
  const withReason = rows.filter((r) => r.reason)
  if (withReason.length === 0) return null
  const visible = expanded ? withReason : withReason.slice(0, 20)
  const remaining = withReason.length - visible.length

  return (
    <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 space-y-1.5">
      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5 shrink-0" />
        {withReason.length} ligne{withReason.length > 1 ? 's' : ''} ignorée{withReason.length > 1 ? 's' : ''}
      </p>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {visible.map((r, i) => (
          <div key={i} className="text-xs flex gap-2">
            <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span className="break-words">
              <span className="font-medium">Ligne {r.line}</span>
              {r.id_inter && <span className="text-muted-foreground"> ({r.id_inter})</span>}
              {' — '}{r.reason}
            </span>
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs text-amber-700 dark:text-amber-400 hover:underline underline-offset-2"
        >
          Tout voir ({remaining} de plus)
        </button>
      )}
    </div>
  )
}

const BUCKET_LABELS: Record<PreviewBucket, string> = {
  insert: 'Lignes à créer',
  update: 'Lignes à mettre à jour',
  skipped: 'Lignes ignorées',
  conflict: 'Lignes en conflit',
  error: 'Lignes en erreur',
}

const BUCKET_DESCRIPTIONS: Record<PreviewBucket, string> = {
  insert: 'comparaison entre le CSV brut et le mapping vers la base.',
  update: 'comparaison entre le CSV brut et le mapping vers la base.',
  skipped: 'comparaison entre le CSV brut et le mapping vers la base.',
  conflict: "lignes pointant vers plusieurs interventions existantes — résolution manuelle requise (corrigez le CSV).",
  error: 'lignes invalides — non importées. Corrigez le CSV puis relancez.',
}

// Identité visuelle par bucket : un rail de couleur sur le côté de la modale
// + le ton du titre. Permet de garder le contexte d'où on est (insert / update
// / skipped / error) sans relire le titre à chaque ligne.
const BUCKET_THEME: Record<PreviewBucket, {
  rail: string
  dot: string
  title: string
  ring: string
}> = {
  insert:   { rail: 'bg-emerald-500',    dot: 'bg-emerald-500',    title: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-500/40' },
  update:   { rail: 'bg-blue-500',       dot: 'bg-blue-500',       title: 'text-blue-700 dark:text-blue-400',       ring: 'ring-blue-500/40' },
  skipped:  { rail: 'bg-amber-500',      dot: 'bg-amber-500',      title: 'text-amber-700 dark:text-amber-400',     ring: 'ring-amber-500/40' },
  conflict: { rail: 'bg-orange-500',     dot: 'bg-orange-500',     title: 'text-orange-700 dark:text-orange-400',   ring: 'ring-orange-500/40' },
  error:    { rail: 'bg-destructive',    dot: 'bg-destructive',    title: 'text-destructive',                       ring: 'ring-destructive/40' },
}

function PreviewDialog({
  bucket,
  response,
  onClose,
  resolutions,
  onResolve,
  onClearResolution,
}: {
  bucket: PreviewBucket | null
  response: ImportResponse | null
  onClose: () => void
  resolutions: ImportResolutionsMap
  onResolve: (line: number, resolution: ImportResolution) => void
  onClearResolution: (line: number) => void
}) {
  const hasData =
    bucket === 'error'
      ? !!response && response.errors.length > 0
      : !!response?.preview
  const open = bucket !== null && hasData

  const rows: ImportPreviewRow[] = (() => {
    if (!bucket || !response) return []
    if (bucket === 'error') {
      return response.errors.map((e) => ({
        line: e.line,
        id_inter: e.id_inter,
        raw: e.raw ?? {},
        payload: null,
        displayPayload: null,
        reason: e.reason,
      }))
    }
    if (!response.preview) return []
    if (bucket === 'insert') return response.preview.toInsert
    if (bucket === 'update') return response.preview.toUpdate
    if (bucket === 'conflict') return response.preview.toResolve
    return response.preview.skipped
  })()

  const theme = bucket ? BUCKET_THEME[bucket] : null

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <div className="flex flex-1 min-h-0">
          {/* Rail de couleur identifiant le bucket */}
          {theme && <div className={`w-1 shrink-0 ${theme.rail}`} aria-hidden />}
          <div className="flex-1 min-w-0 flex flex-col px-6 pt-6 pb-4">
            <DialogHeader>
              <DialogTitle className={`flex items-center gap-2.5 ${theme?.title ?? ''}`}>
                {bucket === 'error'
                  ? <XCircle className="h-5 w-5" />
                  : theme && <span className={`h-2 w-2 rounded-full ${theme.dot}`} aria-hidden />}
                {bucket ? BUCKET_LABELS[bucket] : ''}
              </DialogTitle>
              <DialogDescription>
                {rows.length} ligne{rows.length > 1 ? 's' : ''} — {bucket ? BUCKET_DESCRIPTIONS[bucket] : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto pr-1 -mr-1 space-y-3 mt-3">
              {rows.length === 0 && (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucune ligne dans cette catégorie.</p>
              )}
              <PreviewRowList
                rows={rows}
                bucket={bucket}
                resolutions={resolutions}
                onResolve={onResolve}
                onClearResolution={onClearResolution}
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const COMPACT_FIELDS: Array<{ label: string; keys: string[] }> = [
  { label: 'Date', keys: ['Date'] },
  { label: 'ID', keys: ['ID'] },
  { label: 'Agence', keys: ['Agence'] },
  { label: 'Statut', keys: ['Statut', 'STATUT', ' Statut', 'Statut '] },
  { label: 'Métier', keys: ['Métier', 'Metier'] },
]

function pickField(raw: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  return ''
}

function PreviewRowList({
  rows,
  bucket,
  resolutions,
  onResolve,
  onClearResolution,
}: {
  rows: ImportPreviewRow[]
  bucket: PreviewBucket | null
  resolutions: ImportResolutionsMap
  onResolve: (line: number, resolution: ImportResolution) => void
  onClearResolution: (line: number) => void
}) {
  const isError = bucket === 'error'
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [onlyChanged, setOnlyChanged] = useState(false)
  const PAGE_SIZE = 50

  // Reset expansion + pagination + filtres quand le bucket change.
  useEffect(() => {
    setExpanded(new Set())
    setPage(0)
    setSearch('')
    setOnlyChanged(false)
  }, [bucket])

  // Filtrage : recherche full-text simple dans line / id_inter / champs raw,
  // + filtre "uniquement changements" pour le bucket update.
  const filteredRows = (() => {
    let rs = rows
    const q = search.trim().toLowerCase()
    if (q) {
      rs = rs.filter((r) => {
        if (String(r.line).includes(q)) return true
        if (r.id_inter && r.id_inter.toLowerCase().includes(q)) return true
        for (const v of Object.values(r.raw)) {
          if (typeof v === 'string' && v.toLowerCase().includes(q)) return true
        }
        return false
      })
    }
    if (onlyChanged && bucket === 'update') {
      rs = rs.filter((r) => hasChanges(r.previousDisplayPayload, r.displayPayload))
    }
    return rs
  })()

  // Reset la page si elle dépasse après filtrage.
  useEffect(() => { setPage(0) }, [search, onlyChanged])

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const start = safePage * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, filteredRows.length)
  const pageRows = filteredRows.slice(start, end)

  const allExpandedOnPage = pageRows.length > 0 && pageRows.every((r) => expanded.has(r.line))
  const toggleAll = () => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (allExpandedOnPage) pageRows.forEach((r) => next.delete(r.line))
      else pageRows.forEach((r) => next.add(r.line))
      return next
    })
  }
  const toggle = (line: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(line)) next.delete(line)
      else next.add(line)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <>
          {/* Barre de recherche + filtres */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher (ligne, ID, ville, agence, statut…)"
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md ring-1 ring-border/50 bg-background/60 focus:bg-background focus:ring-primary/40 focus:outline-none transition-all placeholder:text-muted-foreground/60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Effacer la recherche"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {bucket === 'update' && (
              <button
                type="button"
                onClick={() => setOnlyChanged((v) => !v)}
                className={`text-[11px] px-2.5 py-1.5 rounded-md ring-1 transition-colors whitespace-nowrap ${
                  onlyChanged
                    ? 'ring-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400'
                    : 'ring-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                Avec modifications
              </button>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {filteredRows.length === rows.length
                ? `Lignes ${start + 1}–${end} sur ${rows.length}`
                : `${filteredRows.length} sur ${rows.length} lignes — ${start + 1}–${end} affichées`}
            </span>
            <button
              type="button"
              onClick={toggleAll}
              className="hover:text-foreground transition-colors"
              disabled={pageRows.length === 0}
            >
              {allExpandedOnPage ? 'Tout replier (page)' : 'Tout déplier (page)'}
            </button>
          </div>
        </>
      )}
      {pageRows.length === 0 && rows.length > 0 && (
        <p className="text-sm text-muted-foreground py-6 text-center italic">
          Aucune ligne ne correspond aux filtres.
        </p>
      )}
      {pageRows.map((row) => (
        <PreviewRowItem
          key={row.line}
          row={row}
          open={expanded.has(row.line)}
          onToggle={() => toggle(row.line)}
          isError={isError}
          bucket={bucket}
          resolution={resolutions[row.line]}
          onResolve={(resolution) => onResolve(row.line, resolution)}
          onClearResolution={() => onClearResolution(row.line)}
        />
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="text-xs px-3 py-1.5 rounded-md ring-1 ring-border/50 hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            ← Précédent
          </button>
          <span className="text-xs text-muted-foreground">
            Page {safePage + 1} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="text-xs px-3 py-1.5 rounded-md ring-1 ring-border/50 hover:bg-muted/50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}

// Détecte une chaîne ISO-8601 (date ou date+heure) pour comparer par instant
// plutôt que par sérialisation exacte. Évite les faux positifs du type
// "2025-08-21T00:00:00+00:00" vs "2025-08-21T00:00:00.000Z".
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

function isoEqual(a: string, b: string): boolean {
  if (a === b) return true
  if (!ISO_DATE_RE.test(a) || !ISO_DATE_RE.test(b)) return false
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  return Number.isFinite(ta) && Number.isFinite(tb) && ta === tb
}

// Compare deux valeurs scalaires/objets pour la diff. Pour les objets
// (locataire/propriétaire), on stringifie de manière stable. Les chaînes ISO
// sont comparées par instant pour ignorer les variantes d'encodage (+00:00
// vs .000Z, présence/absence de millisecondes, etc.).
function diffValue(a: unknown, b: unknown): boolean {
  if (a === b) return false
  if (a == null && b == null) return false
  if (a == null || b == null) return true
  if (typeof a === 'string' && typeof b === 'string') {
    return !isoEqual(a, b)
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) !== JSON.stringify(b)
  }
  return String(a) !== String(b)
}

function hasChanges(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
): boolean {
  if (!prev || !next) return false
  const keys = diffableKeys(prev, next)
  for (const k of keys) {
    if (diffValue(prev[k], next[k])) return true
  }
  return false
}

// Champs dont la valeur côté CURRENT n'est pas chargée (cf. fetchPreviousDisplayPayloads
// — les liens artisans ne sont pas hydratés). Les masquer évite un faux diff
// systématique « vide → … ». À retirer le jour où on charge les artisans.
const PREV_UNLOADED_KEYS = new Set(['artisan_sst', 'artisan_sst2'])

function diffableKeys(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  const filtered = Array.from(keys).filter((k) => {
    if (PREV_UNLOADED_KEYS.has(k) && (prev[k] === undefined || prev[k] === null)) {
      return false
    }
    return true
  })
  // Ordre canonique (cf. preview-field-order) pour que la diff se lise dans le
  // même ordre que les colonnes CSV brut / mapping BDD côte à côte.
  return orderByRank(filtered, rankDbKey)
}

const DIFF_FIELD_LABELS: Record<string, string> = {
  id_inter: 'ID',
  agence: 'Agence',
  statut: 'Statut',
  metier: 'Métier',
  gestionnaire: 'Gestionnaire',
  locataire: 'Locataire',
  proprietaire: 'Propriétaire',
  date: 'Date',
  date_prevue: 'Date prévue',
  contexte_intervention: 'Contexte',
  adresse: 'Adresse',
  is_active: 'Actif',
}

function formatDiffValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined || v === '') {
    return <span className="text-muted-foreground/60 italic">vide</span>
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const parts = Object.entries(obj)
      .filter(([, val]) => val !== null && val !== undefined && val !== '')
      .map(([k, val]) => `${k}: ${String(val)}`)
    return parts.length > 0 ? parts.join(' · ') : <span className="text-muted-foreground/60 italic">vide</span>
  }
  return String(v)
}

function DiffBlock({
  prev,
  next,
}: {
  prev: Record<string, unknown>
  next: Record<string, unknown>
}) {
  const keys = diffableKeys(prev, next).filter((k) => diffValue(prev[k], next[k]))

  if (keys.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/20">
        <div className="px-3 py-1.5 border-b text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Modifications
        </div>
        <p className="px-3 py-3 text-xs text-muted-foreground italic">
          Aucun champ ne change — l&apos;import écrirait les mêmes valeurs.
        </p>
      </div>
    )
  }

  return (
    <div className="md:col-span-2 rounded-lg border bg-blue-500/5 ring-1 ring-blue-500/20">
      <div className="px-3 py-1.5 border-b border-blue-500/20 text-[11px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400 flex items-center justify-between">
        <span>Modifications</span>
        <span className="text-[10px] font-normal normal-case text-muted-foreground tabular-nums">
          {keys.length} champ{keys.length > 1 ? 's' : ''} modifié{keys.length > 1 ? 's' : ''}
        </span>
      </div>
      <div className="divide-y divide-blue-500/10">
        {keys.map((k) => (
          <div key={k} className="px-3 py-2 grid grid-cols-[110px_1fr] gap-3 items-start text-xs">
            <span className="text-muted-foreground/90 font-medium pt-0.5">
              {DIFF_FIELD_LABELS[k] ?? k}
            </span>
            <div className="min-w-0 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-1.5 sm:gap-2 items-baseline">
              <span className="min-w-0 break-words text-muted-foreground line-through decoration-rose-500/60 decoration-1">
                {formatDiffValue(prev[k])}
              </span>
              <ArrowRight className="hidden sm:inline-block h-3 w-3 text-muted-foreground/60 shrink-0" />
              <span className="min-w-0 break-words text-emerald-700 dark:text-emerald-400 font-medium">
                {formatDiffValue(next[k])}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Résolution de conflits d'import
//
// Deux scénarios sémantiquement distincts (cf. ImportConflictReason) qui
// nécessitent un wording et une mise en scène différents :
//
//   1. id_inter_diverges_from_composite → conflit d'IDENTITÉ
//      Le CSV affirme une identité (id_inter A123) qui ne matche pas la
//      même intervention que sa clé métier (date+adresse). C'est un
//      problème d'intégrité des données. Ton rouge, choix binaire.
//
//   2. composite_ambiguous → conflit de DOUBLON en base
//      Plusieurs interventions partagent (date, adresse). C'est l'état
//      de la base qui pose problème, pas le CSV. Ton orange, choix
//      parmi N candidates avec rappel que les autres restent inchangées.
//
// Dans les deux cas, l'utilisateur peut aussi explicitement IGNORER la
// ligne (action 'skip') pour libérer le verrou sans écrire en base.
// ───────────────────────────────────────────────────────────────────────────

function ConflictResolver({
  conflict,
  newPayload,
  resolution,
  onResolve,
  onClear,
}: {
  conflict: ImportConflictRow
  /** Valeurs CSV mappées telles qu'elles seraient écrites (côté NEW). */
  newPayload: Record<string, unknown>
  resolution: ImportResolution | undefined
  onResolve: (resolution: ImportResolution) => void
  onClear?: () => void
}) {
  if (conflict.conflictReason === 'id_inter_diverges_from_composite') {
    return (
      <IdentityConflictBoard
        conflict={conflict}
        newPayload={newPayload}
        resolution={resolution}
        onResolve={onResolve}
        onClear={onClear}
      />
    )
  }
  return (
    <DuplicateConflictBoard
      conflict={conflict}
      newPayload={newPayload}
      resolution={resolution}
      onResolve={onResolve}
      onClear={onClear}
    />
  )
}

// ─── Conflit d'identité (id_inter divergent) ────────────────────────────────

function IdentityConflictBoard({
  conflict,
  newPayload,
  resolution,
  onResolve,
  onClear,
}: {
  conflict: ImportConflictRow
  newPayload: Record<string, unknown>
  resolution: ImportResolution | undefined
  onResolve: (resolution: ImportResolution) => void
  onClear?: () => void
}) {
  const csvIdInter = (newPayload['id_inter'] as string | null) ?? null
  return (
    <div className="md:col-span-2 space-y-3">
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/5">
        <div className="px-3 py-2 border-b border-rose-500/20 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">
              Conflit d&apos;identité
            </div>
            <p className="text-xs text-foreground/80 mt-0.5 leading-snug">
              Le CSV pointe vers l&apos;intervention <span className="font-mono font-medium">{csvIdInter ?? '—'}</span>{' '}
              par son ID, mais la clé métier (date + adresse) en désigne une autre.
              <br />
              <span className="font-medium text-foreground">Laquelle est la vraie intervention&nbsp;?</span>
            </p>
          </div>
        </div>
        <div className="px-3 py-2 border-b border-rose-500/10 bg-amber-500/5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <Info className="h-3 w-3" />
            Aperçu de la ligne CSV
          </div>
        </div>
        <CompactRawGrid raw={conflict.raw} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {conflict.candidates.map((c) => (
          <CandidateCard
            key={c.id}
            candidate={c}
            csvIdInter={csvIdInter}
            newPayload={newPayload}
            isSelected={resolution?.action === 'update' && resolution.targetId === c.id}
            onSelect={() => onResolve({ action: 'update', targetId: c.id })}
            onClear={onClear}
            tone="identity"
            ctaLabel="C'est celle-ci — appliquer la mise à jour"
          />
        ))}
      </div>

      {csvIdInter && (
        <CreateWithoutIdInterButton
          isSelected={resolution?.action === 'create_without_id_inter'}
          onSelect={() => onResolve({ action: 'create_without_id_inter' })}
          onClear={onClear}
          csvIdInter={csvIdInter}
        />
      )}

      <SkipLineButton
        isSkipped={resolution?.action === 'skip'}
        onSkip={() => onResolve({ action: 'skip' })}
        onClear={onClear}
        helperText="Ne rien écrire pour cette ligne — à utiliser si tu veux d'abord investiguer manuellement avant d'importer."
      />
    </div>
  )
}

// ─── Conflit de doublon (composite ambigu) ──────────────────────────────────

// Scoring heuristique appliqué aux candidates d'un conflit composite. But :
// désigner *une* recommandation pré-sélectionnée et reléguer les autres dans
// un repli, sans jamais retirer la liberté de choix.
//
// La règle d'or : on ne sait pas qui est "la bonne" — on signale juste celle
// qui ressemble le plus à une mise-à-jour légitime. Pas d'auto-merge, pas de
// suppression : la sélection reste un clic explicite que l'utilisateur peut
// défaire.
function effectiveNextFor(
  newPayload: Record<string, unknown>,
  candidate: ImportConflictCandidate,
): Record<string, unknown> {
  if (newPayload['id_inter'] == null && candidate.id_inter) {
    return { ...newPayload, id_inter: candidate.id_inter }
  }
  return newPayload
}

function countModifs(
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown>,
): number {
  if (!prev) return 0
  let n = 0
  for (const k of diffableKeys(prev, next)) {
    if (diffValue(prev[k], next[k])) n++
  }
  return n
}

interface CandidateScore {
  id: string
  score: number
  blocked: boolean
  modifs: number
  reasons: string[]
}

function scoreCandidates(
  candidates: ImportConflictCandidate[],
  newPayload: Record<string, unknown>,
  csvIdInter: string | null,
): CandidateScore[] {
  const enriched = candidates.map((c) => {
    const blocked = !!c.id_inter && !!csvIdInter && c.id_inter !== csvIdInter
    const prev = (c.previousDisplayPayload ?? {}) as Record<string, unknown>
    const next = effectiveNextFor(newPayload, c)
    const modifs = countModifs(prev, next)
    const sameStatut = !diffValue(prev['statut'], next['statut'])
    return { c, blocked, prev, modifs, sameStatut }
  })
  const minModifs = Math.min(...enriched.filter((e) => !e.blocked).map((e) => e.modifs))
  return enriched.map(({ c, blocked, modifs, sameStatut }) => {
    if (blocked) {
      return { id: c.id, score: -Infinity, blocked, modifs, reasons: ['id_inter différent du CSV — update interdite'] }
    }
    // Scoring (révision) :
    //   - On ne bonifie PAS le simple fait de porter un id_inter quand le CSV
    //     n'en apporte pas : l'id_inter de la candidate est alors sans rapport
    //     avec l'intention du CSV. Seul le match exact compte.
    //   - On ne pénalise PAS la candidate "déjà identique" : c'est au contraire
    //     le signal le plus fiable qu'elle est la cible visée par la ligne CSV.
    //   - La proximité (modifs minimales) domine quand le CSV ne fournit pas
    //     d'id — d'où le poids +2.
    let score = 0
    const reasons: string[] = []
    if (csvIdInter && c.id_inter === csvIdInter) { score += 5; reasons.push('id_inter identique à celui du CSV') }
    if (sameStatut) { score += 1; reasons.push('statut déjà aligné sur le CSV') }
    if (modifs === minModifs) {
      score += 2
      reasons.push(modifs === 0 ? 'déjà identique à la ligne CSV' : 'la plus proche de la ligne CSV')
    }
    return { id: c.id, score, blocked, modifs, reasons }
  })
}

function DuplicateConflictBoard({
  conflict,
  newPayload,
  resolution,
  onResolve,
  onClear,
}: {
  conflict: ImportConflictRow
  newPayload: Record<string, unknown>
  resolution: ImportResolution | undefined
  onResolve: (resolution: ImportResolution) => void
  onClear?: () => void
}) {
  const csvIdInter = (newPayload['id_inter'] as string | null) ?? null

  const scores = scoreCandidates(conflict.candidates, newPayload, csvIdInter)
  const scoreById = new Map(scores.map((s) => [s.id, s]))
  const best = scores
    .filter((s) => !s.blocked)
    .reduce<CandidateScore | null>((acc, s) => (acc && acc.score >= s.score ? acc : s), null)

  // Pré-sélection automatique de la recommandation à la première ouverture.
  // On ne touche pas si l'utilisateur a déjà tranché (resolution !== undefined),
  // et on n'auto-pré-sélectionne que s'il y a une recommandation non bloquée.
  useEffect(() => {
    if (resolution) return
    if (!best) return
    onResolve({ action: 'update', targetId: best.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflict.line])

  const recommendedCandidate = best
    ? conflict.candidates.find((c) => c.id === best.id) ?? null
    : null
  const otherCandidates = conflict.candidates.filter((c) => c.id !== best?.id)
  const [othersOpen, setOthersOpen] = useState(false)

  return (
    <div className="md:col-span-2 space-y-3">
      <div className="rounded-lg border border-orange-500/30 bg-orange-500/5">
        <div className="px-3 py-2 border-b border-orange-500/20 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
              {conflict.matchIds.length} interventions partagent (date, adresse)
            </div>
            <p className="text-xs text-foreground/80 mt-0.5 leading-snug">
              {recommendedCandidate ? (
                <>
                  Une candidate est <span className="font-medium text-foreground">pré-sélectionnée</span> ci-dessous.
                  Tu peux la valider, en choisir une autre, ou ignorer la ligne.{' '}
                </>
              ) : (
                <>Choisis celle à mettre à jour avec la ligne CSV.{' '}</>
              )}
              <span className="text-muted-foreground">
                Les autres resteront inchangées en base — l&apos;import ne fusionne ni ne supprime aucun doublon.
              </span>
            </p>
          </div>
        </div>
        <div className="px-3 py-2 border-b border-orange-500/10 bg-amber-500/5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <Info className="h-3 w-3" />
            Aperçu de la ligne CSV
          </div>
        </div>
        <CompactRawGrid raw={conflict.raw} />
      </div>

      <div className="space-y-2">
        {recommendedCandidate && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 px-1 text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-3 w-3" />
              Recommandée
              {scoreById.get(recommendedCandidate.id)?.reasons.length ? (
                <span className="normal-case tracking-normal text-muted-foreground">
                  · {scoreById.get(recommendedCandidate.id)!.reasons.join(' · ')}
                </span>
              ) : null}
            </div>
            <CandidateCard
              candidate={recommendedCandidate}
              csvIdInter={csvIdInter}
              newPayload={newPayload}
              isSelected={resolution?.action === 'update' && resolution.targetId === recommendedCandidate.id}
              onSelect={() => onResolve({ action: 'update', targetId: recommendedCandidate.id })}
              onClear={onClear}
              tone="duplicate"
              ctaLabel="Mettre à jour celle-ci"
            />
          </div>
        )}

        {otherCandidates.length > 0 && (
          <div className="rounded-lg border border-border/50 bg-background/30">
            <button
              type="button"
              onClick={() => setOthersOpen((v) => !v)}
              className="w-full px-3 py-2 flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${othersOpen ? '' : '-rotate-90'}`}
                />
                {otherCandidates.length === 1
                  ? '1 autre candidate'
                  : `${otherCandidates.length} autres candidates`}
              </span>
              <span className="text-[10px] text-muted-foreground/70">
                {othersOpen ? 'Replier' : 'Afficher pour comparer'}
              </span>
            </button>
            {othersOpen && (
              <div className="px-2 pb-2 pt-1 space-y-2 border-t border-border/40">
                {otherCandidates.map((c) => {
                  const s = scoreById.get(c.id)
                  return (
                    <div key={c.id} className="space-y-1">
                      {s && s.reasons.length > 0 && (
                        <div className="px-1 text-[10px] text-muted-foreground italic">
                          {s.reasons.join(' · ')}
                        </div>
                      )}
                      <CandidateCard
                        candidate={c}
                        csvIdInter={csvIdInter}
                        newPayload={newPayload}
                        isSelected={resolution?.action === 'update' && resolution.targetId === c.id}
                        onSelect={() => onResolve({ action: 'update', targetId: c.id })}
                        onClear={onClear}
                        tone="duplicate"
                        ctaLabel="Choisir celle-ci à la place"
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {csvIdInter && (
        <CreateWithoutIdInterButton
          isSelected={resolution?.action === 'create_without_id_inter'}
          onSelect={() => onResolve({ action: 'create_without_id_inter' })}
          onClear={onClear}
          csvIdInter={csvIdInter}
        />
      )}

      <SkipLineButton
        isSkipped={resolution?.action === 'skip'}
        onSkip={() => onResolve({ action: 'skip' })}
        onClear={onClear}
        helperText="Si tu préfères dédupliquer en base avant, ignore cette ligne pour le moment."
      />
    </div>
  )
}

// ─── Carte candidate (partagée) ─────────────────────────────────────────────

function CandidateCard({
  candidate,
  csvIdInter,
  newPayload,
  isSelected,
  onSelect,
  onClear,
  tone,
  ctaLabel,
}: {
  candidate: ImportConflictRow['candidates'][number]
  /** id_inter présent dans le CSV pour cette ligne (pour détecter l'écrasement). */
  csvIdInter: string | null
  newPayload: Record<string, unknown>
  isSelected: boolean
  onSelect: () => void
  onClear?: () => void
  tone: 'identity' | 'duplicate'
  ctaLabel: string
}) {
  // Action bloquée : la cible porte déjà un id_inter différent. L'`id_inter`
  // d'une intervention existante est immuable côté import — l'utilisateur doit
  // choisir "créer sans id_inter" ou "skip" au niveau de la ligne.
  const updateBlocked =
    !!candidate.id_inter && !!csvIdInter && candidate.id_inter !== csvIdInter
  const formatDate = (iso: string | null) =>
    iso ? iso.slice(0, 10) : <span className="text-muted-foreground/60 italic">—</span>
  const prev = (candidate.previousDisplayPayload ?? {}) as Record<string, unknown>
  // Synonyme local pour lisibilité — la cible est-elle frappée par la règle
  // d'immutabilité de l'id_inter ?
  const overwritesIdInter = updateBlocked

  // Reflète la règle de préservation appliquée à l'apply (interventions-import.ts
  // lignes 528-557) : à l'UPDATE, un id_inter null côté CSV n'écrase jamais une
  // valeur existante en base. Sans ce miroir, la diff affichait "12646 → vide"
  // alors que l'écriture conserve 12646 — un faux signal de perte de donnée.
  const effectiveNext =
    newPayload['id_inter'] == null && candidate.id_inter
      ? { ...newPayload, id_inter: candidate.id_inter }
      : newPayload

  const sourceBadge =
    candidate.source === 'id_inter'
      ? { cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400', label: 'Désignée par ID' }
      : { cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-400', label: 'Désignée par clé métier' }

  return (
    <div
      className={`rounded-lg border transition-colors ${
        isSelected
          ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30'
          : tone === 'identity'
            ? 'border-rose-500/20 bg-background/40'
            : 'border-orange-500/20 bg-background/40'
      }`}
    >
      <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2 flex-wrap text-xs">
        <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider ${sourceBadge.cls}`}>
          {sourceBadge.label}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground truncate">
          {candidate.id.slice(0, 8)}…
        </span>
        {candidate.id_inter && (
          <span className="font-mono text-foreground/90">ID {candidate.id_inter}</span>
        )}
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{formatDate(candidate.date)}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground truncate" title={candidate.adresse ?? ''}>
          {candidate.adresse || <span className="italic">—</span>}
        </span>
      </div>

      {overwritesIdInter && (
        <div className="px-3 py-2 border-b border-border/40 bg-rose-500/10 flex items-start gap-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-medium text-rose-800 dark:text-rose-300">
              Mise à jour interdite
            </span>{' '}
            <span className="text-foreground/80">
              cette intervention porte déjà l&apos;ID{' '}
              <span className="font-mono font-medium">{candidate.id_inter}</span> ; l&apos;import ne
              réécrit jamais un id_inter existant. Choisis «&nbsp;Créer sans id_inter&nbsp;» ou
              «&nbsp;Ignorer cette ligne&nbsp;» plus bas.
            </span>
          </div>
        </div>
      )}

      <div className="px-3 py-2">
        <CurrentVsNewBlock prev={prev} next={effectiveNext} />
      </div>

      <div className="px-3 py-2 border-t border-border/40 flex items-center justify-end gap-2">
        {isSelected ? (
          <button
            type="button"
            onClick={onClear}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="h-3 w-3" />
            Choix retenu — cliquer pour annuler
          </button>
        ) : updateBlocked ? (
          <button
            type="button"
            disabled
            title="L'id_inter d'une intervention existante ne peut pas être réécrit par l'import."
            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-muted text-muted-foreground/70 cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <AlertTriangle className="h-3 w-3" />
            Mise à jour interdite
          </button>
        ) : (
          <button
            type="button"
            onClick={onSelect}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium text-white transition-colors ${
              tone === 'identity'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  )
}

function CreateWithoutIdInterButton({
  isSelected,
  onSelect,
  onClear,
  csvIdInter,
}: {
  isSelected: boolean
  onSelect: () => void
  onClear?: () => void
  /** id_inter du CSV — affiché dans le helper pour rappeler ce qui sera retiré. */
  csvIdInter: string
}) {
  return (
    <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-3 py-2 flex items-center gap-3">
      <div className="flex-1 min-w-0 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">
          Ou créer une nouvelle intervention sans id_inter :
        </span>{' '}
        l&apos;`id_inter` <span className="font-mono">{csvIdInter}</span> du CSV est retiré ;
        une nouvelle ligne est insérée en base, à arbitrer manuellement par la suite.
      </div>
      {isSelected ? (
        <button
          type="button"
          onClick={onClear}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          <CheckCircle2 className="h-3 w-3" />
          Choisi — cliquer pour annuler
        </button>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          Créer sans id_inter
        </button>
      )}
    </div>
  )
}

function SkipLineButton({
  isSkipped,
  onSkip,
  onClear,
  helperText,
}: {
  isSkipped: boolean
  onSkip: () => void
  onClear?: () => void
  helperText: string
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 flex items-center gap-3">
      <div className="flex-1 min-w-0 text-xs text-muted-foreground">
        <span className="font-medium text-foreground/80">Ou ignorer cette ligne :</span>{' '}
        {helperText}
      </div>
      {isSkipped ? (
        <button
          type="button"
          onClick={onClear}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          <CheckCircle2 className="h-3 w-3" />
          Ignorée — cliquer pour annuler
        </button>
      ) : (
        <button
          type="button"
          onClick={onSkip}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-border hover:bg-muted/60 transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          <X className="h-3 w-3" />
          Ignorer cette ligne
        </button>
      )}
    </div>
  )
}

// Aperçu compact des colonnes les plus utiles de la ligne CSV brute.
function CompactRawGrid({ raw }: { raw: Record<string, string> }) {
  const entries = Object.entries(raw).filter(([, v]) => v && String(v).trim() !== '')
  if (entries.length === 0) {
    return <p className="px-3 py-2 text-xs text-muted-foreground italic">Ligne vide</p>
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 px-3 py-2 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="min-w-0 flex items-baseline gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 shrink-0">
            {k}
          </span>
          <span className="font-mono truncate text-foreground/90" title={String(v)}>
            {String(v)}
          </span>
        </div>
      ))}
    </div>
  )
}

// Affiche tous les champs côté CURRENT (base) | NEW (CSV), avec mise en
// évidence des champs qui changeraient si l'utilisateur retenait ce candidat.
function CurrentVsNewBlock({
  prev,
  next,
}: {
  prev: Record<string, unknown>
  next: Record<string, unknown>
}) {
  const keys = diffableKeys(prev, next)
  const changedCount = keys.filter((k) => diffValue(prev[k], next[k])).length

  return (
    <div className="rounded-md border bg-background/40">
      <div className="px-3 py-1 border-b text-[10px] uppercase tracking-wide grid grid-cols-[110px_1fr_auto_1fr] gap-3 items-center">
        <span className="text-muted-foreground/70">Champ</span>
        <span className="text-muted-foreground/70">Valeur actuelle (base)</span>
        <span />
        <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
          Nouvelle valeur (CSV)
          {changedCount > 0 && (
            <span className="ml-1.5 text-muted-foreground font-normal normal-case">
              · {changedCount} modif.
            </span>
          )}
        </span>
      </div>
      <div className="divide-y">
        {keys.map((k) => {
          const changed = diffValue(prev[k], next[k])
          return (
            <div
              key={k}
              className={`px-3 py-1.5 grid grid-cols-[110px_1fr_auto_1fr] gap-3 items-baseline text-xs ${
                changed ? 'bg-blue-500/5' : ''
              }`}
            >
              <span className="text-muted-foreground/90 font-medium pt-0.5">
                {DIFF_FIELD_LABELS[k] ?? k}
              </span>
              <span
                className={`min-w-0 break-words ${
                  changed ? 'text-muted-foreground line-through decoration-rose-500/60 decoration-1' : 'text-foreground/80'
                }`}
              >
                {formatDiffValue(prev[k])}
              </span>
              <ArrowRight
                className={`h-3 w-3 shrink-0 ${changed ? 'text-muted-foreground/70' : 'text-muted-foreground/20'}`}
              />
              <span
                className={`min-w-0 break-words ${
                  changed ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-foreground/80'
                }`}
              >
                {formatDiffValue(next[k])}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PreviewRowItem({
  row,
  open,
  onToggle,
  isError = false,
  bucket = null,
  resolution,
  onResolve,
  onClearResolution,
}: {
  row: ImportPreviewRow
  open: boolean
  onToggle: () => void
  isError?: boolean
  bucket?: PreviewBucket | null
  resolution?: ImportResolutionsMap[number]
  onResolve?: (resolution: ImportResolution) => void
  onClearResolution?: () => void
}) {
  const isConflict = bucket === 'conflict'
  const conflict = isConflict ? (row as ImportConflictRow) : null
  return (
    <div
      className={`rounded-xl ring-1 overflow-hidden transition-all ${
        isError
          ? open
            ? 'ring-destructive/40 bg-destructive/10'
            : 'ring-destructive/20 bg-destructive/5 hover:ring-destructive/40 hover:bg-destructive/10'
          : open
            ? 'ring-primary/20 bg-card/80'
            : 'ring-border/50 bg-card/60 hover:ring-border hover:bg-muted/40'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex flex-col gap-1.5 text-left group"
      >
        <div className="flex items-center gap-2.5">
          <motion.div
            animate={{ rotate: open ? 90 : 0, x: open ? 0 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-[color,transform]"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </motion.div>
          <span className="px-1.5 py-0.5 rounded-md bg-muted/60 text-[10px] font-semibold text-muted-foreground tabular-nums shrink-0">
            L{row.line}
          </span>
          <div className="flex-1" />
          {bucket === 'update' && row.previousDisplayPayload && (() => {
            const prev = row.previousDisplayPayload as Record<string, unknown>
            const next = (row.displayPayload ?? {}) as Record<string, unknown>
            const changedCount = diffableKeys(prev, next).filter((k) =>
              diffValue(prev[k], next[k]),
            ).length
            return (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
                  changedCount > 0
                    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                    : 'bg-muted/60 text-muted-foreground'
                }`}
                title={changedCount > 0 ? `${changedCount} champ(s) modifié(s)` : 'Aucun changement détecté'}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${changedCount > 0 ? 'bg-blue-500' : 'bg-muted-foreground/50'}`} />
                {changedCount > 0 ? `${changedCount} modif.` : 'identique'}
              </span>
            )
          })()}
          {isConflict && resolution && (
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
                resolution.action === 'skip'
                  ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  resolution.action === 'skip' ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              {resolution.action === 'skip' ? 'ignoré' : 'résolu'}
            </span>
          )}
          {row.reason && (
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
                isError
                  ? 'bg-destructive/15 text-destructive'
                  : isConflict
                    ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isError ? 'bg-destructive' : isConflict ? 'bg-orange-500' : 'bg-amber-500'}`} />
              {row.reason}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6 min-w-0">
          {COMPACT_FIELDS.map(({ label, keys }, idx) => {
            const value = pickField(row.raw, keys)
            return (
              <Fragment key={label}>
                {idx > 0 && <span className="text-border shrink-0">·</span>}
                <span className="inline-flex items-baseline gap-1 min-w-0 truncate" title={`${label}: ${value || 'vide'}`}>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 shrink-0">
                    {label}
                  </span>
                  <span className={`truncate text-foreground/90 ${label === 'ID' ? 'font-mono' : ''}`}>
                    {value || <span className="text-muted-foreground/60 italic">vide</span>}
                  </span>
                </span>
              </Fragment>
            )
          })}
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 grid md:grid-cols-2 gap-4 border-t">
              {isConflict && conflict && onResolve ? (
                <ConflictResolver
                  conflict={conflict}
                  newPayload={(row.displayPayload ?? row.payload ?? {}) as Record<string, unknown>}
                  resolution={resolution}
                  onResolve={onResolve}
                  onClear={onClearResolution}
                />
              ) : (
                <>
                  {bucket === 'update' && row.previousDisplayPayload && (
                    <DiffBlock
                      prev={row.previousDisplayPayload}
                      next={(row.displayPayload ?? {}) as Record<string, unknown>}
                    />
                  )}
                  <KeyValueBlock title="CSV brut" entries={row.raw} mono keyOrder={rankRawKey} />
                  <KeyValueBlock
                    title="Mapping base de données"
                    entries={row.displayPayload ?? row.payload ?? {}}
                    mono
                    keyOrder={rankDbKey}
                    emptyHint="Aucun mapping (ligne invalide)"
                  />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function KeyValueBlock({
  title,
  entries,
  mono,
  emptyHint,
  keyOrder,
}: {
  title: string
  entries: Record<string, unknown>
  mono?: boolean
  emptyHint?: string
  /** Tri canonique des clés (cf. preview-field-order). Absent = ordre d'origine. */
  keyOrder?: (key: string) => number
}) {
  const keys = keyOrder
    ? orderByRank(Object.keys(entries), keyOrder)
    : Object.keys(entries)
  return (
    <div className="rounded-lg border bg-background/40">
      <div className="px-3 py-1.5 border-b text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="divide-y">
        {keys.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground italic">{emptyHint ?? 'Vide'}</p>
        )}
        {keys.map((k) => {
          const v = entries[k]
          const isEmpty = v === null || v === undefined || v === ''
          const isObj = !isEmpty && typeof v === 'object' && !Array.isArray(v)

          let display: React.ReactNode
          if (isEmpty) {
            display = <span className="text-muted-foreground italic">vide</span>
          } else if (isObj) {
            const subEntries = Object.entries(v as Record<string, unknown>)
            display = (
              <div className="flex flex-col gap-0.5">
                {subEntries.map(([sk, sv]) => {
                  const subEmpty = sv === null || sv === undefined || sv === ''
                  return (
                    <div key={sk} className="grid grid-cols-[40%_60%] gap-2">
                      <span className="text-muted-foreground/80 truncate" title={sk}>{sk}</span>
                      <span className="break-words" title={subEmpty ? undefined : String(sv)}>
                        {subEmpty
                          ? <span className="text-muted-foreground italic">vide</span>
                          : typeof sv === 'object' ? JSON.stringify(sv) : String(sv)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          } else {
            display = String(v)
          }

          const titleStr = typeof display === 'string' ? display : undefined
          return (
            <div key={k} className="px-3 py-1.5 grid grid-cols-[40%_60%] gap-2 text-xs">
              <span className="text-muted-foreground truncate" title={k}>{k}</span>
              <span className={`${isObj ? '' : 'truncate'} ${mono ? 'font-mono' : ''}`} title={titleStr}>
                {display}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
