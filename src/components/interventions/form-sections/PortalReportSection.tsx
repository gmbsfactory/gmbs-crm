"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, ChevronDown, ChevronRight, ClipboardList, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PhotoLightbox } from "@/components/ui/PhotoLightbox"
import { usePermissions } from "@/hooks/usePermissions"
import {
  usePortalReportQuery,
  usePortalReportReviewMutation,
  type PortalReport,
  type PortalReportPhoto,
} from "@/hooks/usePortalReport"
import {
  artisanDisplayName,
  formatDateTime,
  PhotoGrid,
  RejectDialog,
  ReportFields,
  ReportStatusBadge,
  ReviewActions,
  ReviewVerdict,
} from "@/components/interventions/report-panel/report-parts"
import { cn } from "@/lib/utils"

interface PortalReportSectionProps {
  interventionId: string
  /** Artisan principal : la section n'est rendue que s'il est renseigné */
  artisanId: string | null
  /** Ouvre la section par défaut (ex. quand has_portal_report est vrai) */
  defaultOpen?: boolean
}

/**
 * Section « Rapport de l'artisan » — forme repliable historique.
 *
 * Le corps (badges, champs métier, décision, visionneuse) vit désormais dans
 * `report-panel/report-parts.tsx`, partagé avec le panneau « Rapport » du modal
 * (`ReportsPanel`), qui gère lui les N rapports et les sept états. Cette
 * section reste la vue « un artisan, un rapport » réutilisable telle quelle.
 */
export function PortalReportSection({ interventionId, artisanId, defaultOpen = false }: PortalReportSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
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

  if (!enabled) return null

  const photosAvant = photos.filter((p) => p.metadata?.phase === "avant")
  const photosApres = photos.filter((p) => p.metadata?.phase === "apres")
  const photosAutres = photos.filter((p) => p.metadata?.phase !== "avant" && p.metadata?.phase !== "apres")
  const openPhoto = (photo: PortalReportPhoto) => {
    const index = photos.findIndex((p) => p.id === photo.id)
    if (index >= 0) setLightboxIndex(index)
  }

  const handleApprove = () => {
    reviewMutation.mutate(
      { decision: "approved", ...(report ? { reportId: report.id } : {}) },
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
      { decision: "rejected", comment, ...(report ? { reportId: report.id } : {}) },
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

                  <ReviewVerdict report={report} />
                  <ReportFields report={report} />

                  {/* Photos */}
                  <div className="space-y-2">
                    <PhotoGrid title="Photos avant" photos={photosAvant} onOpen={openPhoto} />
                    <PhotoGrid title="Photos après" photos={photosApres} onOpen={openPhoto} />
                    {photosAutres.length > 0 && (
                      <PhotoGrid title="Autres photos" photos={photosAutres} onOpen={openPhoto} />
                    )}
                  </div>

                  {/* Actions du gestionnaire */}
                  {report.status === "submitted" && canReview && (
                    <ReviewActions
                      onApprove={handleApprove}
                      onReject={() => setIsRejectDialogOpen(true)}
                      isPending={isPending}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Boîte de dialogue : demande de correction (commentaire obligatoire) */}
      <RejectDialog
        open={isRejectDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsRejectDialogOpen(nextOpen)
          if (!nextOpen) setRejectComment("")
        }}
        comment={rejectComment}
        onCommentChange={setRejectComment}
        onSubmit={handleReject}
        isPending={isPending}
      />

      {/* Visionneuse plein écran */}
      <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        caption={artisanName}
      />
    </>
  )
}
