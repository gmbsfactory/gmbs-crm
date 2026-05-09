"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import {
  ChevronRight,
  ChevronDown,
  Upload,
  UserCheck,
  MessageSquare,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { TooltipProvider } from "@/components/ui/tooltip"
import { DocumentManager } from "@/components/documents"
import { DocumentReclassificationModal } from "@/components/documents/DocumentReclassificationModal"
import { ModeIcons } from "@/components/ui/mode-selector"
import { CommentSection } from "@/components/shared/CommentSection"
import { StatusReasonModal } from "@/components/shared/StatusReasonModal"
import { ArtisanHistoryPanel } from "@/components/artisans/history/ArtisanHistoryPanel"
import { ArtisanFinancesSection } from "./ArtisanFinancesSection"
import { ArtisanInterventionsTable } from "./ArtisanInterventionsTable"
import { IbanField } from "./_components/IbanField"
import { GestionnaireAssignee } from "./_components/GestionnaireAssignee"
import { ArtisanInfoCard } from "./_components/ArtisanInfoCard"
import { CompanyParamsCard } from "./_components/CompanyParamsCard"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { toast } from "sonner"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import type { StatusReasonType } from "@/lib/comments/statusReason"
import { cn } from "@/lib/utils"
import type { ModalDisplayMode } from "@/types/modal-display"
import { useSubmitShortcut } from "@/hooks/useSubmitShortcut"
import { UnsavedChangesDialog } from "@/components/interventions/UnsavedChangesDialog"
import { useArtisanPresence } from "@/hooks/useArtisanPresence"
import { ReadOnlyBanner } from "@/components/ui/intervention-modal/ReadOnlyBanner"
import { usePagePresenceContext } from "@/contexts/PagePresenceContext"
import { useDocumentReclassification } from "@/hooks/useDocumentReclassification"

import { ARTISAN_DOCUMENT_KINDS } from "./_lib/constants"
import {
  type ArtisanFormValues,
  buildDefaultFormValues,
} from "./_lib/artisan-form-mapper"
import { useArtisanMutations } from "./_hooks/useArtisanMutations"
import { useArtisanStatusTransition } from "./_hooks/useArtisanStatusTransition"
import { useArtisanAbsences } from "./_hooks/useArtisanAbsences"
import { useArtisanForm } from "./_hooks/useArtisanForm"
import { useArtisanModalData } from "./_hooks/useArtisanModalData"
import { useArtisanFormInitialization } from "./_hooks/useArtisanFormInitialization"
import { useArtisanDerivedData } from "./_hooks/useArtisanDerivedData"
import { AbsencesSection } from "./_components/AbsencesSection"
import { ArtisanModalHeader } from "./_components/ArtisanModalHeader"
import { ArtisanModalFooter } from "./_components/ArtisanModalFooter"

type Props = {
  artisanId: string
  mode: ModalDisplayMode
  onClose: () => void
  onNext?: () => void
  onPrevious?: () => void
  canNext?: boolean
  canPrevious?: boolean
  onCycleMode?: () => void
  activeIndex?: number
  totalCount?: number
  defaultView?: "informations" | "statistics"
  onUnsavedChangesStateChange?: (hasChanges: boolean, submitting: boolean) => void
  onRegisterShowDialog?: (showDialog: () => void) => void
  onStatusReasonModalOpenChange?: (isOpen: boolean) => void
  onUnsavedDialogOpenChange?: (isOpen: boolean) => void
  onReclassifyModalOpenChange?: (isOpen: boolean) => void
}

export function ArtisanModalContent({
  artisanId,
  mode,
  onClose,
  onNext,
  onPrevious,
  canNext,
  canPrevious,
  onCycleMode,
  activeIndex,
  totalCount,
  defaultView,
  onUnsavedChangesStateChange,
  onRegisterShowDialog,
  onStatusReasonModalOpenChange,
  onUnsavedDialogOpenChange,
  onReclassifyModalOpenChange,
}: Props) {
  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`
  const ModeIcon = ModeIcons[mode]

  const { data: referenceData } = useReferenceDataQuery()
  const formRef = useRef<HTMLFormElement>(null)
  const shouldCloseAfterSave = useRef(false)

  // États pour les sections collapsibles
  const [isAbsencesOpen, setIsAbsencesOpen] = useState(false)
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isReclassifyModalOpen, setIsReclassifyModalOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(true) // Toujours déplié par défaut

  const handleReclassifyModalOpenChange = useCallback((open: boolean) => {
    setIsReclassifyModalOpen(open)
    onReclassifyModalOpenChange?.(open)
  }, [onReclassifyModalOpenChange])

  const { documentsToReclassify } = useDocumentReclassification({
    entityType: "artisan",
    entityId: artisanId,
    enabled: !!artisanId,
  })

  // Toggle entre vue Informations et vue Statistiques
  // Initialiser avec la vue par défaut si spécifiée
  const [showStats, setShowStats] = useState(defaultView === "statistics")
  const [showHistoryPanel, setShowHistoryPanel] = useState(false)


  const inputClass = "h-8 text-sm bg-background border-input/80 focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
  const labelClass = "text-xs font-medium text-foreground/80"

  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    watch,
    setValue,
    formState: { isDirty, dirtyFields, errors },
  } = useForm<ArtisanFormValues>({
    defaultValues: buildDefaultFormValues(),
  })

  // Watch les coordonnées GPS
  const watchedLat = watch("intervention_latitude")
  const watchedLng = watch("intervention_longitude")

  const {
    artisan,
    isLoading,
    error,
    refetchArtisan,
    artisanInterventions,
  } = useArtisanModalData(artisanId)

  // Utiliser le hook centralisé useCurrentUser au lieu d'un fetch direct
  const { data: currentUserData } = useCurrentUser()
  const currentUser = useMemo(() => {
    if (!currentUserData) return null
    const first = currentUserData.firstname ?? currentUserData.prenom ?? ""
    const last = currentUserData.lastname ?? currentUserData.nom ?? ""
    const displayNameCandidate = [first, last].filter(Boolean).join(" ").trim()
    const displayName = displayNameCandidate || currentUserData.username || currentUserData.email || "Vous"
    return {
      id: currentUserData.id,
      displayName,
      code: currentUserData.code_gestionnaire ?? null,
      color: currentUserData.color ?? null,
      avatarUrl: currentUserData.avatar_url ?? null,
    }
  }, [currentUserData])
  const { can } = usePermissions()
  const canWriteArtisans = can("write_artisans")

  // ─── Presence: who is currently viewing/editing this artisan? ─────────────
  const { viewers, activeEditor, fieldLockMap, trackField, clearField } = useArtisanPresence(artisanId)

  // Read-only mode: another user is the active editor
  const isReadOnly = Boolean(activeEditor && currentUserData && activeEditor.userId !== currentUserData.id)

  // Ref for auto-refetch on editor promotion
  const refetchRef = useRef<(() => void) | null>(null)
  refetchRef.current = refetchArtisan

  const prevReadOnlyRef = useRef(false)
  useEffect(() => {
    if (prevReadOnlyRef.current && !isReadOnly) {
      refetchRef.current?.()
    }
    prevReadOnlyRef.current = isReadOnly
  }, [isReadOnly])

  // Page presence — signal that this modal is showing an artisan
  const pagePresenceCtx = usePagePresenceContext()
  useEffect(() => {
    if (!pagePresenceCtx?.updateActiveArtisan) return
    pagePresenceCtx.updateActiveArtisan(artisanId)
    return () => {
      pagePresenceCtx.updateActiveArtisan(null)
    }
  }, [artisanId, pagePresenceCtx])

  const { isFormInitialized } = useArtisanFormInitialization({ artisanId, artisan, reset })

  const { updateArtisan, submitArtisanUpdate: submitArtisanUpdateRaw, invalidateArtisanDetail } =
    useArtisanMutations(artisanId, currentUser?.id)

  const submitArtisanUpdate = useCallback(
    async (
      values: ArtisanFormValues,
      reasonPayload?: { type: StatusReasonType; comment: string },
    ) => {
      await submitArtisanUpdateRaw(values, {
        reasonPayload,
        onSuccess: () => {
          reset(values)
          shouldCloseAfterSave.current = false
          onClose()
        },
      })
    },
    [submitArtisanUpdateRaw, reset, onClose, shouldCloseAfterSave],
  )

  const {
    pendingReason,
    pendingArchive,
    isStatusReasonModalOpen,
    getArtisanStatusCode,
    onSubmit,
    handleReasonCancel,
    handleReasonConfirm,
    handleArchiveClick,
    handleArchiveCancel,
  } = useArtisanStatusTransition({
    artisanId,
    artisan,
    artisanStatuses: referenceData?.artisanStatuses,
    getValues,
    submitArtisanUpdate,
    onModalOpenChange: onStatusReasonModalOpenChange,
  })

  const {
    displayName,
    photoProfilMetadata,
    avatarInitials,
    attachmentCount,
    metierOptions,
    fullArtisanAddress,
    companyName,
  } = useArtisanDerivedData(artisan, referenceData)

  const dossierStatus = artisan?.statutDossier ?? null
  const dossierBadge = (() => {
    if (!dossierStatus) {
      return <Badge variant="outline">Non renseigné</Badge>
    }

    // Si le statut est "À compléter", utiliser un style rouge
    const statusLower = dossierStatus.toLowerCase()
    if (statusLower === "à compléter" || statusLower === "a compléter") {
      return (
        <Badge className={cn("border border-red-500/30 bg-red-500/15 text-red-700")}>
          {dossierStatus}
        </Badge>
      )
    }

    // Pour les autres statuts, utiliser les thèmes par défaut
    const slug = dossierStatus.toLowerCase().replace(/\s+/g, "_")
    const dossierStatusTheme: Record<string, string> = {
      complet: "bg-emerald-100 text-emerald-700 border-emerald-300",
      en_attente: "bg-amber-100 text-amber-700 border-amber-300",
      incomplet: "bg-red-100 text-red-700 border-red-300",
      a_verifier: "bg-blue-100 text-blue-700 border-blue-300",
      bloque: "bg-gray-200 text-gray-700 border-gray-300",
    }
    const theme = dossierStatusTheme[slug] ?? "bg-slate-100 text-slate-700 border-slate-200"
    return (
      <Badge className={cn("border", theme)}>
        {dossierStatus}
      </Badge>
    )
  })()

  const { newAbsence, setNewAbsence, absences, handleAddAbsence, handleDeleteAbsence } =
    useArtisanAbsences(artisanId, artisan, invalidateArtisanDetail)

  const handleDocumentsChange = invalidateArtisanDetail

  const isSaving = updateArtisan.isPending

  const hasUnsavedChanges =
    isFormInitialized && isDirty && !isSaving && !isLoading && artisan !== undefined

  const {
    showUnsavedDialog,
    handleCancel,
    handleConfirmClose,
    handleCancelClose,
    handleSaveAndClose,
    shortcutHint,
  } = useArtisanForm({
    formRef,
    isSubmitting: isSaving,
    hasUnsavedChanges,
    onClose,
    onUnsavedChangesStateChange,
    onRegisterShowDialog,
    onUnsavedDialogOpenChange,
    isEscapeSuppressed: isStatusReasonModalOpen || showHistoryPanel,
    shouldCloseAfterSave,
  })

  return (
    <TooltipProvider>
      <div className={cn("modal-config-surface", surfaceVariantClass, surfaceModeClass)}>
        <ArtisanModalHeader
          artisan={artisan}
          mode={mode}
          ModeIcon={ModeIcon}
          onCycleMode={onCycleMode}
          onCancel={handleCancel}
          showStats={showStats}
          onToggleStats={() => setShowStats((v) => !v)}
          onOpenHistory={() => setShowHistoryPanel(true)}
          viewers={viewers}
          photoProfilMetadata={photoProfilMetadata}
          avatarInitials={avatarInitials}
          displayName={displayName}
          companyName={companyName}
          activeIndex={activeIndex}
          totalCount={totalCount}
          artisanStatuses={referenceData?.artisanStatuses}
        />
        <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="flex flex-1 min-h-0 flex-col">
          <fieldset
            disabled={!canWriteArtisans || isReadOnly}
            className={cn("flex flex-col flex-1 min-h-0", (!canWriteArtisans || isReadOnly) && "opacity-70")}
          >
            {isReadOnly && activeEditor && (
              <ReadOnlyBanner editor={activeEditor} entityLabel="cet artisan" />
            )}
            <div className="modal-config-columns-body flex-1 min-h-0 h-full overflow-hidden bg-[#C6CEDC] dark:bg-transparent">
              {!canWriteArtisans ? (
                <div className="px-4 py-3 md:px-6">
                  <div className="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Cet artisan est en lecture seule. Permission requise : write_artisans.
                  </div>
                </div>
              ) : (isLoading || !isFormInitialized) ? (
                <div className="grid gap-4 md:grid-cols-2 px-4 py-3 md:px-6">
                  <div className="h-64 rounded-lg bg-muted animate-pulse" />
                  <div className="h-64 rounded-lg bg-muted animate-pulse" />
                </div>
              ) : error ? (
                <div className="px-4 py-3 md:px-6">
                  <div className="rounded border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    {(error as Error).message}
                  </div>
                </div>
              ) : !artisan ? (
                <div className="px-4 py-3 md:px-6">
                  <div className="rounded border border-muted bg-muted/20 p-4 text-sm text-muted-foreground">
                    Artisan introuvable ou inaccessible.
                  </div>
                </div>
              ) : showStats ? (
                /* ========== VUE STATISTIQUES ========== */
                <div
                  className="h-full px-4 py-3 md:px-6"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gridTemplateRows: 'repeat(7, 1fr)',
                    gap: '12px',
                  }}
                >
                  {/* DIV1: Finances (col 1-3, row 1-7) */}
                  <div
                    className="overflow-hidden"
                    style={{
                      gridColumn: 'span 3 / span 3',
                      gridRow: 'span 7 / span 7',
                    }}
                  >
                    <ArtisanFinancesSection interventions={artisanInterventions} artisanId={artisanId} />
                  </div>

                  {/* DIV2: Interventions (col 4-8, row 1-7) */}
                  <div
                    className="overflow-hidden"
                    style={{
                      gridColumn: 'span 5 / span 5',
                      gridColumnStart: 4,
                      gridRow: 'span 7 / span 7',
                    }}
                  >
                    <ArtisanInterventionsTable artisanId={artisanId} enableInternalScroll />
                  </div>
                </div>
              ) : (
                /* ========== VUE INFORMATIONS (par défaut) ========== */
                <div className="flex gap-4 h-full px-4 py-3 md:px-6">
                  {/* ===== COLONNE GAUCHE - Scroll indépendant ===== */}
                  <div className="flex-1 min-w-0 overflow-y-auto min-h-0 scrollbar-minimal">
                    <div className="space-y-4 pb-4">
                      <ArtisanInfoCard
                        control={control}
                        register={register}
                        watch={watch}
                        setValue={setValue}
                        metierOptions={metierOptions}
                        latitude={watchedLat}
                        longitude={watchedLng}
                        initialAddress={fullArtisanAddress}
                        addressFieldKey={isFormInitialized ? artisan?.id ?? "new" : "loading"}
                        headerExtra={
                          <>
                            <span className="text-[10px] uppercase text-muted-foreground">Dossier</span>
                            {dossierBadge}
                            {isDirty && (
                              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-700 text-[10px]">
                                Non enregistré
                              </Badge>
                            )}
                          </>
                        }
                      />

                      {/* Attribution */}
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <UserCheck className="h-4 w-4" />
                            Attribution
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                          <div className="grid grid-cols-2 gap-2 items-end">
                            <div className="space-y-1">
                              <Label className={labelClass}>Attribué à</Label>
                              <GestionnaireAssignee
                                control={control}
                                users={referenceData?.users ?? []}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className={labelClass}>Statut</Label>
                              {(() => {
                                const currentStatusId = watch("statut_id")
                                const currentStatus = referenceData?.artisanStatuses?.find(
                                  (s) => s.id === currentStatusId
                                )
                                return (
                                  <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2 h-8 text-sm">
                                    {currentStatus ? (
                                      <>
                                        <span
                                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                                          style={{ backgroundColor: currentStatus.color ?? '#6B7280' }}
                                        />
                                        <span className="truncate">{currentStatus.label}</span>
                                      </>
                                    ) : (
                                      <span className="text-muted-foreground">Non défini</span>
                                    )}
                                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                                      (Auto)
                                    </span>
                                  </div>
                                )
                              })()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* ===== COLONNE DROITE - Scroll indépendant ===== */}
                  <div className="flex-1 min-w-0 overflow-y-auto min-h-0 scrollbar-minimal">
                    <div className="space-y-4 pb-4">
                      <CompanyParamsCard control={control} register={register} />

                      <IbanField control={control} />

                      <AbsencesSection
                        open={isAbsencesOpen}
                        onOpenChange={setIsAbsencesOpen}
                        absences={absences}
                        newAbsence={newAbsence}
                        setNewAbsence={setNewAbsence}
                        onAdd={handleAddAbsence}
                        onDelete={handleDeleteAbsence}
                        inputClass={inputClass}
                        labelClass={labelClass}
                      />

                      {/* Documents de l'entreprise (collapsible) */}
                      <Collapsible open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen}>
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50 group">
                              <CardTitle className="flex items-center gap-2 text-sm justify-between">
                                <div className="flex items-center gap-2">
                                  <Upload className="h-4 w-4" />
                                  Documents de l&apos;entreprise
                                  {attachmentCount > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {attachmentCount}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {documentsToReclassify.length > 0 && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 transition-opacity"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleReclassifyModalOpenChange(true)
                                      }}
                                    >
                                      <Wand2 className="h-4 w-4 mr-1" />
                                      <span className="text-xs hidden sm:inline">Reclassifier</span>
                                      <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                                        {documentsToReclassify.length}
                                      </Badge>
                                    </Button>
                                  )}
                                  {isDocumentsOpen ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </div>
                              </CardTitle>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="px-4 pb-4 pt-0">
                              <DocumentManager
                                entityType="artisan"
                                entityId={artisan?.id ?? artisanId}
                                kinds={ARTISAN_DOCUMENT_KINDS}
                                currentUser={currentUser ?? undefined}
                                onChange={handleDocumentsChange}
                              />
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>

                      {/* Modal de reclassification */}
                      <DocumentReclassificationModal
                        open={isReclassifyModalOpen}
                        onOpenChange={handleReclassifyModalOpenChange}
                        entityType="artisan"
                        entityId={artisanId}
                        documentKinds={ARTISAN_DOCUMENT_KINDS}
                      />

                      {/* Commentaires (collapsible) */}
                      <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
                        <Card>
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50">
                              <CardTitle className="flex items-center gap-2 text-sm">
                                <MessageSquare className="h-4 w-4" />
                                Commentaires
                                {isCommentsOpen ? (
                                  <ChevronDown className="ml-auto h-4 w-4" />
                                ) : (
                                  <ChevronRight className="ml-auto h-4 w-4" />
                                )}
                              </CardTitle>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="px-4 pb-4 pt-0">
                              <CommentSection
                                entityType="artisan"
                                entityId={artisanId}
                                currentUserId={currentUser?.id ?? undefined}
                              />
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </fieldset>

          <ArtisanModalFooter
            artisan={artisan}
            canWriteArtisans={canWriteArtisans}
            isReadOnly={isReadOnly}
            isSaving={isSaving}
            isLoading={isLoading}
            shortcutHint={shortcutHint}
            isArchived={
              artisan ? getArtisanStatusCode(artisan.statut_id ?? null) === "ARCHIVE" : false
            }
            onArchive={handleArchiveClick}
            onCancel={handleCancel}
          />
        </form>
        <StatusReasonModal
          open={isStatusReasonModalOpen}
          type={pendingArchive ? "archive" : (pendingReason?.type ?? "archive")}
          onCancel={pendingArchive ? handleArchiveCancel : handleReasonCancel}
          onConfirm={(reason) => {
            void handleReasonConfirm(reason)
          }}
          isSubmitting={isSaving}
        />
        <UnsavedChangesDialog
          open={showUnsavedDialog}
          onCancel={handleCancelClose}
          onConfirm={handleConfirmClose}
          onSaveAndConfirm={handleSaveAndClose}
        />
        <ArtisanHistoryPanel
          artisanId={artisanId}
          isOpen={showHistoryPanel}
          onClose={() => setShowHistoryPanel(false)}
        />
      </div >
    </TooltipProvider >
  )
}

export default ArtisanModalContent
