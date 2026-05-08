"use client"

import { useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import {
  ChevronRight,
  ChevronDown,
  X,
  Loader2,
  Upload,
  MessageSquare,
  UserCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ModeIcons } from "@/components/ui/mode-selector"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { IbanField } from "./_components/IbanField"
import { PendingAbsencesSection } from "./_components/PendingAbsencesSection"
import { DeletedArtisanDialog } from "./_components/DeletedArtisanDialog"
import { GestionnaireAssignee } from "./_components/GestionnaireAssignee"
import { StatusPicker } from "./_components/StatusPicker"
import { ArtisanInfoCard } from "./_components/ArtisanInfoCard"
import { CompanyParamsCard } from "./_components/CompanyParamsCard"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { cn } from "@/lib/utils"
import type { ModalDisplayMode } from "@/types/modal-display"
import { UnsavedChangesDialog } from "@/components/interventions/UnsavedChangesDialog"
import {
  type ArtisanFormValues,
  buildDefaultFormValues,
} from "./_lib/artisan-form-mapper"
import { useArtisanForm } from "./_hooks/useArtisanForm"
import { useArtisanCreate } from "./_hooks/useArtisanCreate"

type Props = {
  mode: ModalDisplayMode
  onClose: () => void
  onCycleMode?: () => void
  onUnsavedChangesStateChange?: (hasChanges: boolean, submitting: boolean) => void
  onRegisterShowDialog?: (showDialog: () => void) => void
  onStatusReasonModalOpenChange?: (isOpen: boolean) => void
  onUnsavedDialogOpenChange?: (isOpen: boolean) => void
}

export function NewArtisanModalContent({
  mode,
  onClose,
  onCycleMode,
  onUnsavedChangesStateChange,
  onRegisterShowDialog,
  onUnsavedDialogOpenChange,
}: Props) {
  const ModeIcon = ModeIcons[mode]
  const { data: referenceData, loading: referenceLoading } = useReferenceDataQuery()
  const formRef = useRef<HTMLFormElement>(null)
  const { can } = usePermissions()
  const canWriteArtisans = can("write_artisans")

  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)

  const { data: currentUserData } = useCurrentUser()
  const currentUser = useMemo(() => {
    if (!currentUserData) return null
    return {
      id: currentUserData.id,
      avatarUrl: currentUserData.avatar_url ?? null,
    }
  }, [currentUserData])

  const form = useForm<ArtisanFormValues>({
    defaultValues: buildDefaultFormValues(),
  })
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty, isSubmitted },
  } = form

  const isLoading = referenceLoading && !referenceData

  const create = useArtisanCreate({
    form,
    referenceData,
    currentUser,
    onClose,
  })

  const formPlumbing = useArtisanForm({
    formRef,
    isSubmitting: create.isSubmitting,
    hasUnsavedChanges: isDirty && !create.isSubmitting && !isLoading,
    onClose,
    onUnsavedChangesStateChange,
    onRegisterShowDialog,
    onUnsavedDialogOpenChange,
  })

  const watchedLat = watch("intervention_latitude")
  const watchedLng = watch("intervention_longitude")

  const metierOptions = useMemo(
    () =>
      (referenceData?.metiers ?? []).map((metier) => ({
        id: metier.id,
        label: metier.label ?? metier.code ?? metier.id,
        color: metier.color ?? null,
      })),
    [referenceData],
  )

  const handleSubmitClick = () => {
    if (formRef.current) formRef.current.requestSubmit()
  }

  const surfaceVariantClass = mode === "fullpage" ? "modal-config-surface-full" : undefined
  const surfaceModeClass = `modal-config--${mode}`
  const labelClass = "text-xs font-medium text-foreground/80"

  const isSubmitting = create.isSubmitting

  return (
    <TooltipProvider>
      <div className={cn("modal-config-surface", surfaceVariantClass, surfaceModeClass)}>
        <header className="modal-config-columns-header relative bg-[#8DA5CE] dark:bg-transparent">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="modal-config-columns-icon-button"
                  onClick={formPlumbing.handleCancel}
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="modal-config-columns-tooltip">Fermer (Esc)</TooltipContent>
            </Tooltip>

            {onCycleMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="modal-config-columns-icon-button"
                    onClick={onCycleMode}
                    aria-label="Changer le mode d'affichage"
                  >
                    <ModeIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="modal-config-columns-tooltip">
                  Ajuster l&apos;affichage ({mode})
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className="modal-config-columns-icon-placeholder" />
            )}
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3">
            <div className="flex flex-col items-center">
              <div className="modal-config-columns-title flex items-center gap-2">
                Créer un artisan
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2" />
        </header>

        <form ref={formRef} onSubmit={handleSubmit(create.onSubmit)} className="flex flex-1 min-h-0 flex-col">
          <div className="modal-config-columns-body flex-1 min-h-0 bg-[#C6CEDC] dark:bg-transparent">
            {!canWriteArtisans ? (
              <div className="px-4 py-3 md:px-6">
                <div className="rounded border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  Vous n&apos;avez pas la permission de créer ou modifier un artisan.
                </div>
              </div>
            ) : isLoading ? (
              <div className="grid gap-4 md:grid-cols-2 px-4 py-3 md:px-6">
                <div className="h-64 rounded-lg bg-muted animate-pulse" />
                <div className="h-64 rounded-lg bg-muted animate-pulse" />
              </div>
            ) : (
              <div className="flex gap-4 h-full px-4 py-3 md:px-6">
                {/* ===== COLONNE GAUCHE ===== */}
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
                      required
                      isSubmitted={isSubmitted}
                    />

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
                          {(() => {
                            const currentStatusId = watch("statut_id")
                            const currentStatus = referenceData?.artisanStatuses?.find(
                              (s) => s.id === currentStatusId
                            ) ?? null
                            return (
                              <StatusPicker
                                control={control}
                                options={create.availableStatusesForModification}
                                fallbackStatusId={create.defaultCandidatStatusId}
                                readOnly={!canWriteArtisans}
                                readOnlyFallback={currentStatus as any}
                              />
                            )
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* ===== COLONNE DROITE ===== */}
                <div className="flex-1 min-w-0 overflow-y-auto min-h-0 scrollbar-minimal">
                  <div className="space-y-4 pb-4">
                    <CompanyParamsCard
                      control={control}
                      register={register}
                      numeroAssocieReadOnlyValue={create.generatedNumeroAssocie}
                    />

                    <IbanField control={control} />

                    <PendingAbsencesSection
                      absences={create.pendingAbsences}
                      onAdd={create.handleAddAbsence}
                      onRemove={create.handleRemovePendingAbsence}
                    />

                    <Collapsible open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen}>
                      <Card>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50">
                            <CardTitle className="flex items-center gap-2 text-sm">
                              <Upload className="h-4 w-4" />
                              Documents de l&apos;entreprise
                              {isDocumentsOpen ? (
                                <ChevronDown className="ml-auto h-4 w-4" />
                              ) : (
                                <ChevronRight className="ml-auto h-4 w-4" />
                              )}
                            </CardTitle>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="px-4 pb-4 pt-0">
                            <div className="text-center py-6 space-y-2">
                              <Upload className="h-8 w-8 mx-auto text-muted-foreground/50" />
                              <p className="text-xs italic text-muted-foreground">
                                Les documents pourront être ajoutés après la création de l&apos;artisan
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                (KBIS, Attestation d&apos;assurance, CNI, IBAN, Décharge partenariat, Photo de profil)
                              </p>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>

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
                            <div className="space-y-1">
                              <Label className={labelClass}>Commentaire initial</Label>
                              <Textarea
                                placeholder="Commentaire sur l'artisan..."
                                className="text-sm resize-none min-h-[80px]"
                                {...register("commentaire_initial")}
                              />
                              <p className="text-[10px] text-muted-foreground">
                                Ce commentaire sera enregistré lors de la sauvegarde
                              </p>
                            </div>
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  </div>
                </div>
              </div>
            )}
          </div>

          <footer className="modal-config-columns-footer flex items-center justify-end gap-2 px-4 py-3 md:px-6 bg-[#8DA5CE] dark:bg-transparent">
            <Button type="button" variant="outline" size="sm" onClick={formPlumbing.handleCancel} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmitClick}
              disabled={isSubmitting || !canWriteArtisans}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  Créer l&apos;artisan
                  <kbd className="ml-2 pointer-events-none hidden md:inline-flex h-5 select-none items-center gap-0.5 rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground/70">
                    {formPlumbing.shortcutHint}
                  </kbd>
                </>
              )}
            </Button>
          </footer>
        </form>

        <DeletedArtisanDialog
          isOpen={create.deletedArtisanDialog.isOpen}
          artisan={create.deletedArtisanDialog.artisan}
          deletedAt={create.deletedArtisanDialog.deletedAt}
          isSubmitting={create.isRestoringOrDeleting}
          onClose={create.handleCloseDeletedDialog}
          onRestore={create.handleRestoreArtisan}
          onOverwrite={create.handleOverwriteAndCreate}
        />

        <UnsavedChangesDialog
          open={formPlumbing.showUnsavedDialog}
          onCancel={formPlumbing.handleCancelClose}
          onConfirm={formPlumbing.handleConfirmClose}
          onSaveAndConfirm={formPlumbing.handleSaveAndClose}
        />
      </div>
    </TooltipProvider>
  )
}

export default NewArtisanModalContent
