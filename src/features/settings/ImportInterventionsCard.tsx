"use client"

import { Fragment, useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Upload, Loader2, AlertTriangle, FileUp, CheckCircle2,
  XCircle, Info, ChevronDown, ArrowRight, Search, X,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { usePermissions } from "@/hooks/usePermissions"
import { parseCSV } from "@/utils/import-export/parsers/csv-parser"
import type {
  ImportMode,
  ImportResponse,
  ImportPreviewRow,
} from "@/utils/import-export/import-types"
import { ImportProgressPanel } from "./ImportProgressPanel"
import { useImportStream } from "./useImportStream"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

type PreviewBucket = 'insert' | 'update' | 'skipped' | 'error'

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
  const { can, isLoading: permsLoading } = usePermissions()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [mode, setMode] = useState<ImportMode>('upsert')
  const [dryRun, setDryRun] = useState(false)
  const [report, setReport] = useState<ImportResponse | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState<ImportResponse | null>(null)
  const [previewBucket, setPreviewBucket] = useState<PreviewBucket | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { stages, running, run, cancel, reset: resetStages } = useImportStream()
  const importing = running

  const canImport = can("import_interventions")

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

  async function runImport(opts: { dryRun: boolean }) {
    if (!file) return null
    setReport(null)
    setErrorMessage(null)

    const result = await run({ file, mode, dryRun: opts.dryRun })

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
    const r = await runImport({ dryRun: false })
    if (r) {
      setReport(r)
      toast({
        title: 'Import terminé',
        description: `${r.inserted} créées, ${r.updated} mises à jour, ${r.skipped} ignorées`,
      })
    }
  }

  function reset() {
    setFile(null)
    setPreview(null)
    setReport(null)
    setPendingConfirm(null)
    setErrorMessage(null)
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
                      <Stat label="Valides" value={report.valid} />
                      {!report.dry_run && (
                        <>
                          <Stat label="Créées" value={report.inserted} color="text-emerald-600" />
                          <Stat label="Mises à jour" value={report.updated} color="text-blue-600" />
                          <Stat label="Ignorées" value={report.skipped} color="text-muted-foreground" />
                        </>
                      )}
                      <Stat
                        label="Erreurs"
                        value={report.errors.length}
                        color={report.errors.length > 0 ? 'text-destructive' : undefined}
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
                      <Stat label="Valides" value={pendingConfirm.valid} />
                      <Stat
                        label="À créer"
                        value={pendingConfirm.inserted}
                        color="text-emerald-600"
                        onClick={
                          pendingConfirm.inserted > 0
                            ? () => setPreviewBucket('insert')
                            : undefined
                        }
                      />
                      <Stat
                        label="À mettre à jour"
                        value={pendingConfirm.updated}
                        color="text-blue-600"
                        onClick={
                          pendingConfirm.updated > 0
                            ? () => setPreviewBucket('update')
                            : undefined
                        }
                      />
                      <Stat
                        label="Ignorées"
                        value={pendingConfirm.skipped}
                        color="text-muted-foreground"
                        onClick={
                          pendingConfirm.skipped > 0
                            ? () => setPreviewBucket('skipped')
                            : undefined
                        }
                      />
                      <Stat
                        label="Erreurs"
                        value={pendingConfirm.errors.length}
                        color={pendingConfirm.errors.length > 0 ? 'text-destructive' : undefined}
                        onClick={
                          pendingConfirm.errors.length > 0
                            ? () => setPreviewBucket('error')
                            : undefined
                        }
                      />
                    </div>
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
                        disabled={pendingConfirm.valid === 0}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PreviewDialog
        bucket={previewBucket}
        response={pendingConfirm ?? report}
        onClose={() => setPreviewBucket(null)}
      />
    </div>
  )
}

function Stat({
  label,
  value,
  color,
  onClick,
}: {
  label: string
  value: number
  color?: string
  onClick?: () => void
}) {
  const interactive = !!onClick
  const Comp = interactive ? 'button' : 'div'
  return (
    <Comp
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={`flex justify-between items-center p-2 rounded-lg bg-muted/30 w-full text-left ${
        interactive ? 'hover:bg-muted/60 transition-colors cursor-pointer' : ''
      }`}
    >
      <span className="text-muted-foreground inline-flex items-center gap-1">
        {label}
        {interactive && <ArrowRight className="h-3 w-3 opacity-60" />}
      </span>
      <span className={`font-semibold tabular-nums ${color ?? ''}`}>{value}</span>
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
  error: 'Lignes en erreur',
}

const BUCKET_DESCRIPTIONS: Record<PreviewBucket, string> = {
  insert: 'comparaison entre le CSV brut et le mapping vers la base.',
  update: 'comparaison entre le CSV brut et le mapping vers la base.',
  skipped: 'comparaison entre le CSV brut et le mapping vers la base.',
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
  insert:  { rail: 'bg-emerald-500',    dot: 'bg-emerald-500',    title: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-500/40' },
  update:  { rail: 'bg-blue-500',       dot: 'bg-blue-500',       title: 'text-blue-700 dark:text-blue-400',       ring: 'ring-blue-500/40' },
  skipped: { rail: 'bg-amber-500',      dot: 'bg-amber-500',      title: 'text-amber-700 dark:text-amber-400',     ring: 'ring-amber-500/40' },
  error:   { rail: 'bg-destructive',    dot: 'bg-destructive',    title: 'text-destructive',                       ring: 'ring-destructive/40' },
}

function PreviewDialog({
  bucket,
  response,
  onClose,
}: {
  bucket: PreviewBucket | null
  response: ImportResponse | null
  onClose: () => void
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
              <PreviewRowList rows={rows} bucket={bucket} />
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
}: {
  rows: ImportPreviewRow[]
  bucket: PreviewBucket | null
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

// Compare deux valeurs scalaires/objets pour la diff. Pour les objets
// (locataire/propriétaire), on stringifie de manière stable.
function diffValue(a: unknown, b: unknown): boolean {
  if (a === b) return false
  if (a == null && b == null) return false
  if (a == null || b == null) return true
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
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  for (const k of keys) {
    if (diffValue(prev[k], next[k])) return true
  }
  return false
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
  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]))
    .filter((k) => diffValue(prev[k], next[k]))

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

function PreviewRowItem({
  row,
  open,
  onToggle,
  isError = false,
  bucket = null,
}: {
  row: ImportPreviewRow
  open: boolean
  onToggle: () => void
  isError?: boolean
  bucket?: PreviewBucket | null
}) {
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
            const changedCount = Array.from(new Set([
              ...Object.keys(row.previousDisplayPayload),
              ...Object.keys((row.displayPayload ?? {}) as Record<string, unknown>),
            ])).filter((k) => diffValue(
              (row.previousDisplayPayload as Record<string, unknown>)[k],
              ((row.displayPayload ?? {}) as Record<string, unknown>)[k],
            )).length
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
          {row.reason && (
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] shrink-0 ${
                isError
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isError ? 'bg-destructive' : 'bg-amber-500'}`} />
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
              {bucket === 'update' && row.previousDisplayPayload && (
                <DiffBlock
                  prev={row.previousDisplayPayload}
                  next={(row.displayPayload ?? {}) as Record<string, unknown>}
                />
              )}
              <KeyValueBlock title="CSV brut" entries={row.raw} mono />
              <KeyValueBlock
                title="Mapping base de données"
                entries={row.displayPayload ?? row.payload ?? {}}
                mono
                emptyHint="Aucun mapping (ligne invalide)"
              />
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
}: {
  title: string
  entries: Record<string, unknown>
  mono?: boolean
  emptyHint?: string
}) {
  const keys = Object.keys(entries)
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
