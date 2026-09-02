"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Loader2,
  MessageSquareWarning,
  X,
  XCircle,
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { usePermissions } from "@/hooks/usePermissions"
import {
  usePortalReportQuery,
  usePortalReportReviewMutation,
  type PortalReport,
  type PortalReportPhoto,
  type PortalReportStatus,
} from "@/hooks/usePortalReport"
import { PORTAL_REPORT_REVIEW_COLOR, PORTAL_REPORT_REVIEW_LABEL } from "@/lib/interventions/portal-report-status"
import { cn } from "@/lib/utils"

interface PortalReportSectionProps {
  interventionId: string
  /** Artisan principal : la section n'est rendue que s'il est renseigné */
  artisanId: string | null
  /** Ouvre la section par défaut (ex. quand has_portal_report est vrai) */
  defaultOpen?: boolean
}

const STATUS_COPY: Record<PortalReportStatus, { label: string; className: string; icon: React.ReactNode }> = {
  submitted: {
    label: PORTAL_REPORT_REVIEW_LABEL,
    className: "text-white border-transparent",
    icon: <ClipboardList className="h-3 w-3" />,
  },
  approved: {
    label: "Validé",
    className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  rejected: {
    label: "Correction demandée",
    className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200",
    icon: <XCircle className="h-3 w-3" />,
  },
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return format(date, "d MMM yyyy 'à' HH:mm", { locale: fr })
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, "0")}`
}

function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value ? "Oui" : "Non"
}

function artisanDisplayName(artisan: { prenom: string | null; nom: string | null } | null): string | null {
  if (!artisan) return null
  const name = `${artisan.prenom ?? ""} ${artisan.nom ?? ""}`.trim()
  return name || null
}

function ReportStatusBadge({ status }: { status: PortalReportStatus }) {
  const copy = STATUS_COPY[status]
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[10px] px-1.5 py-0", copy.className)}
      style={status === "submitted" ? { backgroundColor: PORTAL_REPORT_REVIEW_COLOR } : undefined}
    >
      {copy.icon}
      {copy.label}
    </Badge>
  )
}

function ReportField({ label, value, fullWidth }: { label: string; value: React.ReactNode; fullWidth?: boolean }) {
  return (
    <div className={cn("space-y-0.5 min-w-0", fullWidth && "sm:col-span-2")}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-xs text-foreground whitespace-pre-wrap break-words">{value ?? "—"}</div>
    </div>
  )
}

function PhotoGrid({
  title,
  photos,
  onOpen,
}: {
  title: string
  photos: PortalReportPhoto[]
  onOpen: (photo: PortalReportPhoto) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Camera className="h-3 w-3" />
        {title} ({photos.length})
      </p>
      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune photo</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onOpen(photo)}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted hover:ring-2 hover:ring-primary/60 focus:outline-none focus:ring-2 focus:ring-primary"
              title={photo.metadata?.comment || photo.filename || "Ouvrir la photo"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.metadata?.comment || photo.filename || "Photo de l'artisan"}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {photo.metadata?.comment && (
                <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[9px] text-white line-clamp-2 text-left">
                  {photo.metadata.comment}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Section « Rapport de l'artisan » du modal d'intervention.
 *
 * Affiche le rapport envoyé depuis le portail artisans (champs structurés,
 * photos avant/après) et permet au gestionnaire de le valider ou de demander
 * une correction. Ne change jamais le statut de l'intervention.
 */
export function PortalReportSection({ interventionId, artisanId, defaultOpen = false }: PortalReportSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [lightboxPhoto, setLightboxPhoto] = useState<PortalReportPhoto | null>(null)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState("")

  const { can } = usePermissions()
  const canReview = can("write_interventions")

  const enabled = Boolean(interventionId && artisanId)
  const { data, isLoading, isError, error } = usePortalReportQuery(interventionId, enabled)
  const reviewMutation = usePortalReportReviewMutation(interventionId)

  const report: PortalReport | null = data?.report ?? null
  const photos = data?.photos ?? []
  const artisanName = artisanDisplayName(data?.artisan ?? null)

  // Ouvrir automatiquement la section dès qu'un rapport est en attente
  useEffect(() => {
    if (report?.status === "submitted") setIsOpen(true)
  }, [report?.status])

  // Fermer la visionneuse avec Échap
  useEffect(() => {
    if (!lightboxPhoto) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxPhoto(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [lightboxPhoto])

  if (!enabled) return null

  const photosAvant = photos.filter((p) => p.metadata?.phase === "avant")
  const photosApres = photos.filter((p) => p.metadata?.phase === "apres")
  const photosAutres = photos.filter((p) => p.metadata?.phase !== "avant" && p.metadata?.phase !== "apres")

  const handleApprove = () => {
    reviewMutation.mutate(
      { decision: "approved" },
      {
        onSuccess: () => toast.success("Rapport validé"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Impossible de valider le rapport"),
      },
    )
  }

  const handleReject = () => {
    const comment = rejectComment.trim()
    if (!comment) return
    reviewMutation.mutate(
      { decision: "rejected", comment },
      {
        onSuccess: () => {
          toast.success("Correction demandée à l'artisan")
          setIsRejectDialogOpen(false)
          setRejectComment("")
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Impossible de demander une correction"),
      },
    )
  }

  const isPending = reviewMutation.isPending
  const submittedAt = formatDateTime(report?.submitted_at)
  const reviewedAt = formatDateTime(report?.reviewed_at)

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className={cn(report?.status === "submitted" && "ring-2 ring-purple-400/50")}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
              <CardTitle className="flex items-center gap-2 text-xs">
                <ClipboardList className="h-3 w-3" />
                Rapport de l&apos;artisan
                {report && <ReportStatusBadge status={report.status} />}
                {isOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 px-3 pb-3">
              {isLoading ? (
                <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground" role="status">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Chargement du rapport…
                </div>
              ) : isError ? (
                <div className="flex items-center gap-2 py-3 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {error instanceof Error ? error.message : "Impossible de charger le rapport de l'artisan"}
                </div>
              ) : !report ? (
                <p className="py-3 text-xs text-muted-foreground">
                  L&apos;artisan n&apos;a pas encore envoyé de rapport.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* En-tête : version, date, artisan */}
                  <p className="text-[11px] text-muted-foreground">
                    Version {report.version}
                    {submittedAt && <> · envoyé le {submittedAt}</>}
                    {artisanName && <> · par {artisanName}</>}
                  </p>

                  {/* Décision déjà prise */}
                  {report.status === "approved" && (
                    <div className="flex items-start gap-2 rounded-md border border-green-300 bg-green-50 p-2 text-xs text-green-900 dark:bg-green-950/40 dark:text-green-100">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Rapport validé{reviewedAt ? ` le ${reviewedAt}` : ""}.</span>
                    </div>
                  )}
                  {report.status === "rejected" && (
                    <div className="space-y-1 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-100">
                      <div className="flex items-center gap-2 font-medium">
                        <MessageSquareWarning className="h-4 w-4 shrink-0" />
                        Correction demandée{reviewedAt ? ` le ${reviewedAt}` : ""}
                      </div>
                      {report.review_comment && (
                        <p className="whitespace-pre-wrap pl-6">{report.review_comment}</p>
                      )}
                    </div>
                  )}

                  {/* Champs structurés */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <ReportField label="Travaux réalisés" value={report.travaux_realises} fullWidth />
                    <ReportField label="Durée" value={formatDuration(report.duree_minutes)} />
                    <ReportField label="Client présent" value={yesNo(report.client_present)} />
                    <ReportField label="Matériel utilisé" value={report.materiel_utilise} fullWidth />
                    <ReportField
                      label="Reste à faire"
                      value={
                        report.reste_a_faire
                          ? (
                            <span>
                              <span className="font-medium text-orange-600">Oui</span>
                              {report.reste_a_faire_detail ? ` — ${report.reste_a_faire_detail}` : ""}
                            </span>
                          )
                          : yesNo(report.reste_a_faire)
                      }
                      fullWidth
                    />
                    <ReportField label="Anomalies" value={report.anomalies} fullWidth />
                  </div>

                  {/* Photos */}
                  <div className="space-y-2">
                    <PhotoGrid title="Photos avant" photos={photosAvant} onOpen={setLightboxPhoto} />
                    <PhotoGrid title="Photos après" photos={photosApres} onOpen={setLightboxPhoto} />
                    {photosAutres.length > 0 && (
                      <PhotoGrid title="Autres photos" photos={photosAutres} onOpen={setLightboxPhoto} />
                    )}
                  </div>

                  {/* Actions du gestionnaire */}
                  {report.status === "submitted" && canReview && (
                    <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={isPending}
                        onClick={() => setIsRejectDialogOpen(true)}
                      >
                        <MessageSquareWarning className="mr-1 h-3.5 w-3.5" />
                        Demander une correction
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                        disabled={isPending}
                        onClick={handleApprove}
                      >
                        {isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                        Valider le rapport
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Boîte de dialogue : demande de correction (commentaire obligatoire) */}
      <Dialog
        open={isRejectDialogOpen}
        onOpenChange={(nextOpen) => {
          if (isPending) return
          setIsRejectDialogOpen(nextOpen)
          if (!nextOpen) setRejectComment("")
        }}
        modal
      >
        <DialogContent className="sm:max-w-md !z-[1300]" overlayClassName="!z-[1200]">
          <DialogHeader>
            <DialogTitle>Demander une correction</DialogTitle>
            <DialogDescription>
              Expliquez à l&apos;artisan ce qui doit être corrigé. Il recevra votre commentaire dans le portail
              et pourra renvoyer une nouvelle version du rapport.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="portal-report-reject-comment">Commentaire (obligatoire)</Label>
            <Textarea
              id="portal-report-reject-comment"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              placeholder="Ex : photo après illisible, préciser le matériel remplacé…"
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsRejectDialogOpen(false)} disabled={isPending}>
              Annuler
            </Button>
            <Button type="button" onClick={handleReject} disabled={isPending || !rejectComment.trim()}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Visionneuse plein écran */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Photo agrandie"
          onClick={() => setLightboxPhoto(null)}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-white/10"
            onClick={() => setLightboxPhoto(null)}
            aria-label="Fermer"
          >
            <X className="h-6 w-6" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxPhoto.url}
            alt={lightboxPhoto.metadata?.comment || lightboxPhoto.filename || "Photo de l'artisan"}
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
          {lightboxPhoto.metadata?.comment && (
            <p className="absolute inset-x-0 bottom-4 text-center text-sm text-white/90 px-4">
              {lightboxPhoto.metadata.comment}
            </p>
          )}
        </div>
      )}
    </>
  )
}
