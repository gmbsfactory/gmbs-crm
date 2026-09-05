"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Hammer,
  Loader2,
  UserPlus,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PhotoLightbox } from "@/components/ui/PhotoLightbox"
import { usePermissions } from "@/hooks/usePermissions"
import {
  PHOTOS_HORS_RAPPORT,
  usePortalReportQuery,
  usePortalReportReviewMutation,
  type PortalAssignment,
  type PortalReportEntry,
  type PortalReportPhoto,
} from "@/hooks/usePortalReport"
import { PORTAL_REPORT_REVIEW_COLOR } from "@/lib/interventions/portal-report-status"
import { cn } from "@/lib/utils"
import {
  artisanShortName,
  formatAmount,
  formatDateTime,
  formatElapsed,
  formatShortDateTime,
  PhotoGrid,
  ReportFields,
  ReportStatusBadge,
  RejectDialog,
  ReviewActions,
  ReviewVerdict,
  WorkBanner,
} from "./report-parts"

/** Statut où le client a accepté le devis GMBS : le chantier peut démarrer. */
const STATUS_ACCEPTE = "ACCEPTE"
/** Statut depuis lequel une correction peut rouvrir l'intervention. */
const STATUS_INTER_TERMINEE = "INTER_TERMINEE"

/** Rafraîchissement du compteur « en cours depuis … » (chantier non terminé). */
const TICK_MS = 60_000

export interface ReportsPanelProps {
  interventionId: string
  /** Code du statut courant de l'intervention (formulaire, pas la base). */
  statutCode?: string | null
  /**
   * Champs encore manquants pour la transition vers `INTER_EN_COURS`
   * (`getInterventionEmailMissingFields`) : alimente le badge
   * « Démarré · n champs manquants ».
   */
  missingFields?: string[]
  /** Bascule sur l'onglet « Infos » (section Artisan). */
  onGoToInfos?: () => void
  /**
   * Repli gestionnaire « démarré par téléphone » (route L7). Tant qu'il n'est
   * pas fourni, le bouton n'est pas rendu plutôt que rendu inopérant.
   */
  onDeclareStartByPhone?: (artisanId: string) => void
}

interface LightboxState {
  photos: PortalReportPhoto[]
  index: number
  caption: string | null
}

/** État de l'affectation, dans l'ordre des sept situations de la spécification. */
export type AssignmentState =
  | "aucun_artisan"
  | "prix_non_pose"
  | "prix_propose"
  | "prix_refuse"
  | "accepte_non_demarre"
  | "demarre"
  | "rapport_recu"

/**
 * Détermine l'état affiché pour un artisan affecté.
 * Un rapport reçu prime sur tout le reste ; sinon on descend le parcours
 * prix → démarrage, et l'absence de coût SST est prioritaire car c'est elle qui
 * rend la mission invisible dans l'application.
 */
export function resolveAssignmentState(assignment: PortalAssignment, hasReport: boolean): AssignmentState {
  if (hasReport) return "rapport_recu"
  if (assignment.work.started_at) return "demarre"
  if (assignment.price.response === "refused") return "prix_refuse"
  if (assignment.price.response === "accepted") return "accepte_non_demarre"
  if (assignment.cout_sst === null || assignment.cout_sst === undefined) return "prix_non_pose"
  return "prix_propose"
}

function photosOf(ids: string[] | undefined, byId: Map<string, PortalReportPhoto>): PortalReportPhoto[] {
  return (ids ?? []).map((id) => byId.get(id)).filter((photo): photo is PortalReportPhoto => Boolean(photo))
}

/** Grilles avant / après / autres d'une version, dans l'ordre du portail. */
function ReportPhotos({
  photos,
  onOpen,
}: {
  photos: PortalReportPhoto[]
  onOpen: (photos: PortalReportPhoto[], index: number) => void
}) {
  const avant = photos.filter((p) => p.metadata?.phase === "avant")
  const apres = photos.filter((p) => p.metadata?.phase === "apres")
  const autres = photos.filter((p) => p.metadata?.phase !== "avant" && p.metadata?.phase !== "apres")
  const openFrom = (photo: PortalReportPhoto) => onOpen(photos, photos.findIndex((p) => p.id === photo.id))

  return (
    <div className="space-y-2">
      <PhotoGrid title="Photos avant" photos={avant} onOpen={openFrom} />
      <PhotoGrid title="Photos après" photos={apres} onOpen={openFrom} />
      {autres.length > 0 && <PhotoGrid title="Autres photos" photos={autres} onOpen={openFrom} />}
    </div>
  )
}

/**
 * Panneau « Rapport » du modal d'intervention.
 *
 * **Ne renvoie jamais `null`** : un bloc par artisan affecté, chacun dans l'un
 * des sept états du parcours (pas d'artisan, prix non posé, prix proposé, prix
 * refusé, accepté non démarré, démarré depuis X, rapport reçu). Le sélecteur de
 * versions n'apparaît qu'à partir de deux rapports pour un même artisan : à
 * 250 px de large, tout chrome inutile coûte une ligne de rapport.
 */
export function ReportsPanel({
  interventionId,
  statutCode,
  missingFields = [],
  onGoToInfos,
  onDeclareStartByPhone,
}: ReportsPanelProps) {
  const { can } = usePermissions()
  // Valider un rapport n'est pas éditer l'intervention : la décision reste
  // ouverte au gestionnaire même quand le formulaire est verrouillé.
  const canReview = can("write_interventions")

  const { data, isLoading, isError, error } = usePortalReportQuery(interventionId, Boolean(interventionId))
  const reviewMutation = usePortalReportReviewMutation(interventionId)

  const [selectedByArtisan, setSelectedByArtisan] = useState<Record<string, string>>({})
  const [openHistory, setOpenHistory] = useState<Record<string, boolean>>({})
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PortalReportEntry | null>(null)
  const [rejectComment, setRejectComment] = useState("")
  const [reopen, setReopen] = useState(false)
  const [, setTick] = useState(0)

  const reports = useMemo(() => data?.reports ?? [], [data?.reports])
  const assignments = useMemo(() => data?.assignments ?? [], [data?.assignments])
  const photosById = useMemo(
    () => new Map((data?.photos ?? []).map((photo) => [photo.id, photo])),
    [data?.photos],
  )
  const photosByReport = data?.photosByReport ?? {}

  const reportsByArtisan = useMemo(() => {
    const map = new Map<string, PortalReportEntry[]>()
    for (const report of reports) {
      const key = report.artisan_id ?? report.artisan?.id ?? "sans-artisan"
      const list = map.get(key) ?? []
      list.push(report)
      map.set(key, list)
    }
    return map
  }, [reports])

  // Un chantier démarré affiche « en cours depuis 5 h 22 » : compteur vivant.
  const hasRunningWork = assignments.some(
    (assignment) => assignment.work.started_at && (reportsByArtisan.get(assignment.artisan_id ?? "")?.length ?? 0) === 0,
  )
  useEffect(() => {
    if (!hasRunningWork) return
    const timer = setInterval(() => setTick((value) => value + 1), TICK_MS)
    return () => clearInterval(timer)
  }, [hasRunningWork])

  const openLightbox = useCallback((photos: PortalReportPhoto[], index: number, caption: string | null = null) => {
    if (photos.length === 0 || index < 0) return
    setLightbox({ photos, index, caption })
  }, [])

  const isPending = reviewMutation.isPending

  const handleApprove = (report: PortalReportEntry) => {
    reviewMutation.mutate(
      { decision: "approved", reportId: report.id },
      {
        onSuccess: () => toast.success("Rapport validé"),
        onError: (err) => toast.error(err instanceof Error ? err.message : "Impossible de valider le rapport"),
      },
    )
  }

  const handleReject = () => {
    const comment = rejectComment.trim()
    if (!comment || !rejectTarget) return
    reviewMutation.mutate(
      { decision: "rejected", comment, reportId: rejectTarget.id, reopenIntervention: reopen },
      {
        onSuccess: () => {
          toast.success("Correction demandée à l'artisan")
          setRejectTarget(null)
          setRejectComment("")
          setReopen(false)
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Impossible de demander une correction"),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement du rapport…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 p-3 text-xs text-destructive">
        <AlertTriangle className="h-4 w-4" />
        {error instanceof Error ? error.message : "Impossible de charger le rapport de l'artisan"}
      </div>
    )
  }

  const orphanPhotos = photosOf(photosByReport[PHOTOS_HORS_RAPPORT], photosById)

  return (
    <div className="pointer-events-auto flex flex-col gap-2 px-1 pb-4">
      {assignments.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-3">
            <p className="text-xs text-muted-foreground">Aucun artisan sur cette intervention.</p>
            {onGoToInfos && (
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onGoToInfos}>
                <UserPlus className="mr-1 h-3.5 w-3.5" />
                Choisir un artisan
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        assignments.map((assignment, index) => {
          const artisanId = assignment.artisan_id ?? assignment.artisan?.id ?? `assignment-${index}`
          const name = artisanShortName(assignment.artisan)
          const artisanReports = reportsByArtisan.get(artisanId) ?? []
          const state = resolveAssignmentState(assignment, artisanReports.length > 0)
          const selectedId = selectedByArtisan[artisanId] ?? artisanReports[0]?.id ?? null
          const selected = artisanReports.find((report) => report.id === selectedId) ?? artisanReports[0] ?? null
          const previous = artisanReports.filter((report) => report.id !== selected?.id)
          const historyOpen = openHistory[artisanId] ?? false

          return (
            <Card
              key={artisanId}
              className={cn(selected?.status === "submitted" && "ring-2 ring-purple-400/50")}
              data-testid={`report-block-${artisanId}`}
              data-state={state}
            >
              <CardContent className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate text-xs font-medium">{name}</span>
                  {assignment.is_primary && artisanReports.length === 0 && (
                    <span className="text-[10px] text-muted-foreground">principal</span>
                  )}
                  {selected && <ReportStatusBadge status={selected.status} />}
                </div>

                {state === "prix_non_pose" && (
                  <p className="text-xs text-muted-foreground">
                    {name} ne voit pas encore la mission : le coût SST n&apos;est pas renseigné.{" "}
                    {onGoToInfos && (
                      <button
                        type="button"
                        onClick={onGoToInfos}
                        className="pointer-events-auto underline underline-offset-2 hover:text-foreground"
                      >
                        Renseigner le coût SST
                      </button>
                    )}
                  </p>
                )}

                {state === "prix_propose" && (
                  <p className="text-xs text-muted-foreground">
                    Prix de{" "}
                    <span className="font-medium text-foreground">{formatAmount(assignment.cout_sst)}</span> proposé.
                    En attente de la réponse de {name}.
                  </p>
                )}

                {state === "prix_refuse" && (
                  <div className="space-y-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-100">
                    <div className="flex items-center gap-2 font-medium">
                      <XCircle className="h-4 w-4 shrink-0" />
                      Refusé{assignment.price.responded_at ? ` le ${formatDateTime(assignment.price.responded_at)}` : ""}
                      {assignment.price.refused_reason ? ` — ${assignment.price.refused_reason}` : ""}
                    </div>
                    {onGoToInfos && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="pointer-events-auto h-7 text-xs"
                        onClick={onGoToInfos}
                      >
                        <UserPlus className="mr-1 h-3.5 w-3.5" />
                        Proposer à un autre artisan
                      </Button>
                    )}
                  </div>
                )}

                {state === "accepte_non_demarre" && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Accepté
                      {assignment.price.responded_at ? ` le ${formatDateTime(assignment.price.responded_at)}` : ""}
                      {assignment.price.source === "crm" ? " (par téléphone)" : " (application)"}.{" "}
                      {assignment.price.accepted_amount !== null && (
                        <span className="font-medium text-foreground">
                          {formatAmount(assignment.price.accepted_amount)}
                        </span>
                      )}{" "}
                      Chantier non démarré.
                    </p>
                    {assignment.price.drift && (
                      <p className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                        {name} a accepté {formatAmount(assignment.price.accepted_amount)} ; le coût SST enregistré est
                        aujourd&apos;hui {formatAmount(assignment.cout_sst)}.
                      </p>
                    )}
                    {onDeclareStartByPhone && assignment.artisan_id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="pointer-events-auto h-7 text-xs"
                        onClick={() => onDeclareStartByPhone(assignment.artisan_id as string)}
                      >
                        <Hammer className="mr-1 h-3.5 w-3.5" />
                        Démarré par téléphone
                      </Button>
                    )}
                  </div>
                )}

                {state === "demarre" && assignment.work.started_at && (
                  <p className="text-xs text-muted-foreground">
                    Démarré le {formatShortDateTime(assignment.work.started_at)} —{" "}
                    <span className="font-medium text-foreground">
                      en cours depuis {formatElapsed(assignment.work.started_at)}
                    </span>
                  </p>
                )}

                {state === "demarre" && statutCode === STATUS_ACCEPTE && (
                  <div className="space-y-1">
                    <Badge
                      variant="outline"
                      className="gap-1 border-transparent text-[10px] text-white"
                      style={{ backgroundColor: PORTAL_REPORT_REVIEW_COLOR }}
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {missingFields.length > 0
                        ? `Démarré · ${missingFields.length} champ${missingFields.length > 1 ? "s" : ""} manquant${missingFields.length > 1 ? "s" : ""}`
                        : "Démarré · statut non avancé"}
                    </Badge>
                    {missingFields.length > 0 && (
                      <ul className="list-disc pl-5 text-[11px] text-muted-foreground">
                        {missingFields.map((field) => (
                          <li key={field}>{field}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {selected && (
                  <div className="space-y-2">
                    <WorkBanner report={selected} />
                    <ReviewVerdict report={selected} />
                    <ReportFields report={selected} />
                    <ReportPhotos
                      photos={photosOf(photosByReport[selected.id], photosById)}
                      onOpen={(list, photoIndex) =>
                        openLightbox(list, photoIndex, `v${selected.version} · ${name}`)
                      }
                    />

                    {previous.length > 0 && (
                      <Collapsible
                        open={historyOpen}
                        onOpenChange={(open) => setOpenHistory((current) => ({ ...current, [artisanId]: open }))}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="pointer-events-auto flex w-full items-center gap-1 rounded px-1 py-1 text-[11px] text-muted-foreground hover:bg-muted/50"
                          >
                            {historyOpen ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            {previous.length} version{previous.length > 1 ? "s" : ""} précédente
                            {previous.length > 1 ? "s" : ""}
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <ul className="space-y-1 border-l pl-2">
                            {previous.map((report) => (
                              <li key={report.id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedByArtisan((current) => ({ ...current, [artisanId]: report.id }))
                                  }
                                  className="pointer-events-auto flex w-full flex-col items-start gap-0.5 rounded px-1 py-1 text-left hover:bg-muted/50"
                                >
                                  <span className="flex items-center gap-1 text-[11px]">
                                    <span className="font-medium">v{report.version}</span>
                                    <span className="text-muted-foreground">
                                      {formatShortDateTime(report.submitted_at)}
                                    </span>
                                    <ReportStatusBadge status={report.status} />
                                  </span>
                                  {report.review_comment && (
                                    <span className="text-[11px] text-muted-foreground line-clamp-2">
                                      {report.review_comment}
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {selected.status === "submitted" && canReview && (
                      <div className="pointer-events-auto">
                        <ReviewActions
                          onApprove={() => handleApprove(selected)}
                          onReject={() => {
                            setRejectTarget(selected)
                            setRejectComment("")
                            setReopen(statutCode === STATUS_INTER_TERMINEE)
                          }}
                          isPending={isPending}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })
      )}

      {orphanPhotos.length > 0 && (
        <Card>
          <CardContent className="space-y-1 p-3">
            <p className="text-[11px] text-muted-foreground">
              Photos déposées hors d&apos;un rapport ({orphanPhotos.length})
            </p>
            <ReportPhotos
              photos={orphanPhotos}
              onOpen={(list, photoIndex) => openLightbox(list, photoIndex, "Hors rapport")}
            />
          </CardContent>
        </Card>
      )}

      <RejectDialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setRejectComment("")
            setReopen(false)
          }
        }}
        comment={rejectComment}
        onCommentChange={setRejectComment}
        onSubmit={handleReject}
        isPending={isPending}
        canReopen={statutCode === STATUS_INTER_TERMINEE}
        reopen={reopen}
        onReopenChange={setReopen}
      />

      <PhotoLightbox
        photos={lightbox?.photos ?? []}
        index={lightbox ? lightbox.index : null}
        caption={lightbox?.caption ?? null}
        onClose={() => setLightbox(null)}
      />
    </div>
  )
}
