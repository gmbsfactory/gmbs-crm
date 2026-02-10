"use client"

import { ArtisanDossierStatusIcon } from "@/components/ui/ArtisanDossierStatusIcon"
import { ArtisanStatusBadge } from "@/components/ui/ArtisanStatusBadge"
import { AgenceBadge, MetierBadge } from "@/components/ui/BadgeComponents"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { InterventionContextMenuContent } from "@/components/interventions/InterventionContextMenu"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import AnimatedCard from "@/features/interventions/components/AnimatedCard"
import { EditableCell } from "@/features/interventions/components/EditableCell"
import type { InterventionView } from "@/types/intervention-view"
import { isCheckStatus } from "@/lib/interventions/checkStatus"
import { getStatusDisplayLabel } from "@/lib/interventions/deposit-helpers"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Euro,
  ExternalLink,
  FilePlus,
  FileText,
  Mail,
  MapPin,
  Phone,
  Pin,
  PinOff,
  Settings,
  User,
  Wrench,
  XCircle,
} from "lucide-react"
import * as React from "react"
import { createPortal } from "react-dom"

export type StatusConfig = {
  key: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  defaultColor: string
}

export const INTERVENTION_STATUS_CONFIG: StatusConfig[] = [
  { key: "Demandé", label: "Demandé", icon: Clock, defaultColor: "#3B82F6" },
  { key: "Devis_Envoyé", label: "Devis envoyé", icon: FileText, defaultColor: "#8B5CF6" },
  { key: "Accepté", label: "Accepté", icon: CheckCircle, defaultColor: "#10B981" },
  { key: "En_cours", label: "En cours", icon: AlertCircle, defaultColor: "#F59E0B" },
  { key: "Annulé", label: "Annulé", icon: XCircle, defaultColor: "#EF4444" },
  { key: "Terminé", label: "Terminé", icon: CheckCircle, defaultColor: "#059669" },
  { key: "Visite_Technique", label: "Visite technique", icon: MapPin, defaultColor: "#6366F1" },
  { key: "Refusé", label: "Refusé", icon: XCircle, defaultColor: "#DC2626" },
  { key: "STAND_BY", label: "Stand by", icon: Clock, defaultColor: "#EAB308" },
  { key: "SAV", label: "SAV", icon: Wrench, defaultColor: "#6B7280" },
]

const DEFAULT_QUICK_STATUS_KEYS = ["Demandé", "Devis_Envoyé", "Accepté", "En_cours"]

const DEFAULT_STATUS_COLORS = INTERVENTION_STATUS_CONFIG.reduce<Record<string, string>>((acc, current) => {
  acc[current.key] = current.defaultColor
  return acc
}, {})

const USERS_MOCK = [
  { id: 1, code: "GM", label: "GM", username: "GM", fullName: "Grégoire Morin", color: "#222222" },
  { id: 2, code: "AD", label: "AD", username: "admin", fullName: "Admin", color: "#000000" },
  { id: 3, code: "AB", label: "AB", username: "Andre", fullName: "André Bertea", color: "#6366F1" },
  { id: 4, code: "TB", label: "TB", username: "Tom", fullName: "Tom Birckel", color: "#EAB308" },
]

function hexToRgb(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value)
}

function safeDate(value?: string) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export interface InterventionCardProps {
  intervention: InterventionView
  onEdit?: (intervention: InterventionView) => void
  onSendEmail?: (intervention: InterventionView) => void
  onCall?: (intervention: InterventionView) => void
  onAddDocument?: (intervention: InterventionView) => void
  onCreateTask?: (intervention: InterventionView) => void
  onStatusChange?: (intervention: InterventionView, newStatus: string) => void
  onAmountChange?: (intervention: InterventionView, amount: number) => void
  onDateChange?: (intervention: InterventionView, field: string, date: string) => void
  onAddressChange?: (intervention: InterventionView, address: string) => void
  onArtisanChange?: (intervention: InterventionView, artisan: string) => void
  onArtisanStatusChange?: (intervention: InterventionView, newStatus: string) => void
  onArtisanDossierStatusChange?: (intervention: InterventionView, newStatus: string) => void
  onClientChange?: (intervention: InterventionView, client: string) => void
  onDescriptionChange?: (intervention: InterventionView, description: string) => void
  onNotesChange?: (intervention: InterventionView, notes: string) => void
  onCoutSSTChange?: (intervention: InterventionView, amount: number) => void
  onCoutMateriauxChange?: (intervention: InterventionView, amount: number) => void
  onCoutInterventionsChange?: (intervention: InterventionView, amount: number) => void
  onUserChange?: (intervention: InterventionView, code: string) => void
  className?: string
  hideBorder?: boolean
  keyboardHovered?: boolean
  selectedActionIndex?: number
  selectedCardIndex?: number
  expanded?: boolean
  onToggle?: () => void
  pinnedStatuses?: string[]
  statusColors?: Record<string, string>
  onTogglePinnedStatus?: (statusKey: string) => void
  onStatusColorChange?: (statusKey: string, color: string) => void
  onDoubleClick?: (id: string) => void
}

export default function InterventionCard({
  intervention,
  onEdit: _onEdit,
  onSendEmail,
  onCall,
  onAddDocument,
  onCreateTask,
  onStatusChange,
  onAmountChange: _onAmountChange,
  onDateChange: _onDateChange,
  onAddressChange: _onAddressChange,
  onArtisanChange: _onArtisanChange,
  onArtisanStatusChange: _onArtisanStatusChange,
  onArtisanDossierStatusChange: _onArtisanDossierStatusChange,
  onClientChange: _onClientChange,
  onDescriptionChange: _onDescriptionChange,
  onNotesChange: _onNotesChange,
  onCoutSSTChange,
  onCoutMateriauxChange,
  onCoutInterventionsChange,
  onUserChange,
  className = "",
  hideBorder = false,
  keyboardHovered = false,
  selectedActionIndex = -1,
  selectedCardIndex = -1,
  expanded,
  onToggle,
  pinnedStatuses: pinnedStatusesProp,
  statusColors: statusColorsProp,
  onTogglePinnedStatus,
  onStatusColorChange,
  onDoubleClick,
}: InterventionCardProps) {
  const [isHovered, setIsHovered] = React.useState(false)
  const [isExpanded, setIsExpanded] = React.useState(expanded ?? false)
  const [statusMenuOpen, setStatusMenuOpen] = React.useState(false)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [showDocumentAnimation, setShowDocumentAnimation] = React.useState(false)
  const [animationPosition, setAnimationPosition] = React.useState({ top: 0, left: 0 })

  const [localStatusColors, setLocalStatusColors] = React.useState<Record<string, string>>(DEFAULT_STATUS_COLORS)
  const [localPinnedStatuses, setLocalPinnedStatuses] = React.useState<string[]>(DEFAULT_QUICK_STATUS_KEYS)

  const mergedStatusColors = statusColorsProp ?? localStatusColors
  const quickStatusKeys = React.useMemo(() => {
    const base = pinnedStatusesProp ?? localPinnedStatuses
    const sanitized = base.length ? base : DEFAULT_QUICK_STATUS_KEYS
    return Array.from(new Set(sanitized))
  }, [localPinnedStatuses, pinnedStatusesProp])

  const statusConfigMap = React.useMemo(() => {
    return INTERVENTION_STATUS_CONFIG.reduce<Record<string, StatusConfig>>((acc, item) => {
      acc[item.key] = item
      return acc
    }, {})
  }, [])

  const statusKey = (intervention.statut ?? intervention.statusValue ?? "DEMANDE") as string
  const currentStatus = statusConfigMap[statusKey] || INTERVENTION_STATUS_CONFIG[0]
  const statusColor = mergedStatusColors[statusKey] || currentStatus?.defaultColor || "#3B82F6"

  // DAT-001 : Vérifier si l'intervention doit afficher le statut "Check"
  const datePrevue = (intervention as any).date_prevue ?? (intervention as any).datePrevue ?? null
  // Utiliser le code du statut depuis l'objet status si disponible, sinon utiliser statusKey
  const statusCode = (intervention as any).status?.code ?? statusKey
  const isCheck = isCheckStatus(statusCode, datePrevue)

  const sstPayment = intervention.payments?.find(p => p.payment_type === 'acompte_sst')
  const clientPayment = intervention.payments?.find(p => p.payment_type === 'acompte_client')
  const statusDisplayLabel = getStatusDisplayLabel(
    statusCode,
    currentStatus?.label || intervention.statut || statusKey,
    sstPayment,
    clientPayment
  )

  const isAnyHovered = isHovered || keyboardHovered
  const isDocActive = selectedActionIndex === 2 && keyboardHovered

  const dateCreated = safeDate((intervention.date || intervention.dateIntervention) ?? undefined)
  const dateIntervention = safeDate(intervention.dateIntervention ?? undefined)

  const getMarge = React.useCallback(() => {
    if (typeof intervention.marge === "number") return intervention.marge
    const montant = intervention.coutIntervention ?? 0
    const couts = (intervention.coutMateriel ?? 0) + (intervention.coutSST ?? 0)
    return montant - couts
  }, [intervention.coutIntervention, intervention.coutMateriel, intervention.coutSST, intervention.marge])

  const marginValue = getMarge()

  const marginPct = React.useMemo(() => {
    const base = intervention.coutIntervention ?? 0
    if (!base) return 0
    return Math.round((marginValue / base) * 100)
  }, [intervention.coutIntervention, marginValue])

  const commentaire = intervention.commentaire ?? intervention.commentaireAgent ?? null

  const assignedUserCode = intervention.assignedUserCode ?? intervention.attribueA ?? ""
  const matchedMockUser = assignedUserCode
    ? USERS_MOCK.find(
      (user) =>
        user.code === assignedUserCode ||
        user.username === assignedUserCode ||
        user.label === assignedUserCode,
    )
    : undefined
  const assignedUserColor = intervention.assignedUserColor ?? matchedMockUser?.color
  const assignedUserDisplay = assignedUserCode || "Non assigné"
  const assignedUserInitials = assignedUserCode ? assignedUserCode.slice(0, 2).toUpperCase() : "NA"

  const getMargeColor = React.useCallback(() => {
    if (marginValue < 0) return "text-red-600"
    if (marginPct < 15) return "text-amber-600"
    return "text-emerald-600"
  }, [marginPct, marginValue])

  React.useEffect(() => {
    if (typeof expanded === "boolean") {
      setIsExpanded(expanded)
    }
  }, [expanded])

  const toggleExpand = () => {
    onToggle?.()
    if (typeof expanded !== "boolean") {
      setIsExpanded((prev) => !prev)
    }
  }

  const applyStatusChange = (statusKey: string) => {
    if (statusKey === intervention.statut) return
    onStatusChange?.(intervention, statusKey)
  }

  const togglePinnedStatus = React.useCallback(
    (statusKey: string) => {
      if (onTogglePinnedStatus) {
        onTogglePinnedStatus(statusKey)
      } else {
        setLocalPinnedStatuses((prev) =>
          prev.includes(statusKey) ? prev.filter((item) => item !== statusKey) : [...prev, statusKey],
        )
      }
    },
    [onTogglePinnedStatus],
  )

  const updateStatusColor = React.useCallback(
    (statusKey: string, color: string) => {
      if (onStatusColorChange) {
        onStatusColorChange(statusKey, color)
      } else {
        setLocalStatusColors((prev) => ({ ...prev, [statusKey]: color }))
      }
    },
    [onStatusColorChange],
  )

  React.useEffect(() => {
    if (isDocActive) {
      const button = document.querySelector(
        `[data-intervention-id="${intervention.id}"] .document-action-button`,
      ) as HTMLElement | null
      if (button) {
        const rect = button.getBoundingClientRect()
        setAnimationPosition({ top: rect.top - 200, left: rect.left - 90 })
        setShowDocumentAnimation(true)
      }
    } else {
      setShowDocumentAnimation(false)
    }
  }, [intervention.id, isDocActive])

  const handleNavigateToDetail = () => {
    if (onCreateTask) {
      onCreateTask(intervention)
    } else {
      window.open(`/interventions/${intervention.id}`, "_blank")
    }
  }

  const artisanStatus = intervention.sousStatutText || undefined
  const artisanDossierStatus = intervention.sousStatutTextColor || undefined
  const metier = intervention.metier || intervention.type

  const statusToneStyles = (statusKey: string, isActive = false) => {
    const color = mergedStatusColors[statusKey] ?? "#6B7280"
    const rgb = hexToRgb(color)
    if (!rgb) {
      return {
        style: {},
        iconColor: isActive ? "text-white" : "text-foreground",
      }
    }
    const alphaBg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isActive ? 1 : 0.12})`
    const alphaBorder = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${isActive ? 1 : 0.4})`
    return {
      style: {
        backgroundColor: alphaBg,
        borderColor: alphaBorder,
        color: isActive ? "#ffffff" : color,
        boxShadow: isActive ? `0 6px 18px ${alphaBorder}` : undefined,
      } as React.CSSProperties,
      iconColor: isActive ? "text-white" : "text-foreground",
    }
  }

  const documentButtonRef = React.useRef<HTMLButtonElement | null>(null)

  const quickStatuses = React.useMemo(() => quickStatusKeys.filter((key) => statusConfigMap[key]), [quickStatusKeys, statusConfigMap])
  const { open: openInterventionModal } = useInterventionModal()

  return (
    <div className={className}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Card
            data-intervention-id={intervention.id}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={(event) => {
              const target = event.target as HTMLElement
              if (target.closest("button, a, input, textarea, [data-no-toggle]")) return
              toggleExpand()
            }}
            onDoubleClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (onDoubleClick) {
                onDoubleClick(intervention.id)
              } else {
                handleNavigateToDetail()
              }
            }}
            className={cn(
              "group relative cursor-pointer overflow-hidden transition-all duration-300",
              isExpanded ? "shadow-lg" : "hover:shadow-lg",
              hideBorder ? "border-0" : "",
            )}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ease-out"
              style={{
                backgroundColor: statusColor,
                width: isAnyHovered ? 8 : 4,
              }}
            />

            <CardHeader className="py-3">
              <div className="grid gap-4 lg:grid-cols-[0.4fr_0.35fr_0.25fr]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3
                      className="flex-1 text-xl font-semibold leading-tight text-foreground"
                      title={intervention.contexteIntervention ?? undefined}
                    >
                      {intervention.contexteIntervention || "Intervention"}
                    </h3>
                  </div>
                  <p
                    className="text-sm text-muted-foreground"
                    title={commentaire ?? intervention.contexteIntervention ?? undefined}
                  >
                    {commentaire ?? intervention.contexteIntervention ?? ""}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span className="truncate" title={intervention.adresse ?? undefined}>
                      {intervention.adresse || "Adresse inconnue"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Créé le {dateCreated ? dateCreated.toLocaleDateString("fr-FR") : "—"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu open={statusMenuOpen} onOpenChange={setStatusMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
                            isCheck && "check-status-badge"
                          )}
                          style={{
                            backgroundColor: isCheck ? "hsl(var(--status-cancelled-fg))" : `${statusColor}10`,
                            borderColor: isCheck ? "hsl(var(--status-cancelled-fg))" : `${statusColor}40`,
                            color: isCheck ? "#FFFFFF" : statusColor,
                          }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {!isCheck && currentStatus?.icon ? React.createElement(currentStatus.icon, { className: "h-4 w-4" }) : null}
                          {isCheck ? "CHECK" : statusDisplayLabel}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64">
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                          Changer le statut
                        </div>
                        <div className="space-y-1">
                          {INTERVENTION_STATUS_CONFIG.map((status) => {
                            const isActive = status.key === intervention.statut
                            return (
                              <DropdownMenuItem
                                key={status.key}
                                className={cn("flex items-center gap-2", isActive && "bg-primary/10 text-primary")}
                                style={{ color: isActive ? statusColor : status.defaultColor }}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  applyStatusChange(status.key)
                                  setStatusMenuOpen(false)
                                }}
                              >
                                <status.icon className="h-4 w-4" />
                                <span>{status.label}</span>
                              </DropdownMenuItem>
                            )
                          })}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {intervention.agence && <AgenceBadge agence={intervention.agence} size="sm" />}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>{assignedUserDisplay}</span>
                    {assignedUserCode ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="user-menu-trigger h-6 w-6 rounded-full text-[10px] font-bold text-white"
                            style={{
                              backgroundColor: assignedUserColor ?? "#6B7280",
                            }}
                            title="Changer l’opérateur"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {assignedUserInitials}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Opérateur</div>
                          {USERS_MOCK.map((user) => (
                            <DropdownMenuItem
                              key={user.id}
                              className={cn(
                                "flex items-center gap-3",
                                assignedUserCode === user.code && "bg-primary/10 text-primary",
                              )}
                              onClick={(event) => {
                                event.stopPropagation()
                                onUserChange?.(intervention, user.code)
                              }}
                            >
                              <span
                                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                style={{ backgroundColor: user.color }}
                              >
                                {user.label}
                              </span>
                              <div className="flex flex-col text-xs">
                                <span className="font-medium text-foreground">{user.fullName}</span>
                                <span className="text-muted-foreground">{user.username}</span>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                    {artisanDossierStatus && <ArtisanDossierStatusIcon status={artisanDossierStatus} size="sm" />}
                    {artisanStatus && <ArtisanStatusBadge status={artisanStatus} size="sm" />}
                    {metier && <MetierBadge metier={metier} />}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Échéance : {dateIntervention ? dateIntervention.toLocaleDateString("fr-FR") : "—"}</span>
                  </div>
                </div>

                <div className="space-y-3 text-right">
                  <div className="inline-flex flex-col items-end">
                    <span className={cn("flex items-center gap-2 text-xl font-semibold", getMargeColor())}>
                      <Euro className="h-5 w-5" />
                      {formatCurrency(marginValue)}
                    </span>
                    <span className="text-xs text-muted-foreground">Marge actuelle : {marginPct}%</span>
                  </div>

                  {intervention.numeroSST && (
                    <div className="text-xs text-muted-foreground">Réf. : {intervention.numeroSST}</div>
                  )}

                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Envoyer un email"
                      className={cn(
                        "h-8 w-8 transition-all",
                        "hover:bg-blue-100 hover:text-blue-600",
                        selectedActionIndex === 0 && keyboardHovered && "bg-blue-100 text-blue-600 ring-2 ring-blue-500",
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        onSendEmail?.(intervention)
                      }}
                    >
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Appeler"
                      className={cn(
                        "h-8 w-8 transition-all",
                        "hover:bg-emerald-100 hover:text-emerald-600",
                        selectedActionIndex === 1 && keyboardHovered && "bg-emerald-100 text-emerald-600 ring-2 ring-emerald-500",
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        onCall?.(intervention)
                      }}
                    >
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      ref={documentButtonRef}
                      variant="ghost"
                      size="icon"
                      title="Ajouter un document"
                      className={cn(
                        "document-action-button h-8 w-8 transition-all",
                        "hover:bg-purple-100 hover:text-purple-600",
                        selectedActionIndex === 2 && keyboardHovered && "bg-purple-100 text-purple-600 ring-2 ring-purple-500",
                      )}
                      onClick={(event) => {
                        event.stopPropagation()
                        onAddDocument?.(intervention)
                      }}
                      onMouseEnter={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect()
                        setAnimationPosition({ top: rect.top - 200, left: rect.left - 90 })
                        setShowDocumentAnimation(true)
                      }}
                      onMouseLeave={() => {
                        if (!isDocActive) setShowDocumentAnimation(false)
                      }}
                    >
                      <FilePlus className="h-4 w-4" />
                    </Button>

                    {showDocumentAnimation &&
                      createPortal(
                        <div
                          className="fixed z-[2000]"
                          style={{ top: animationPosition.top, left: animationPosition.left }}
                          onMouseEnter={() => setShowDocumentAnimation(true)}
                          onMouseLeave={() => {
                            if (!isDocActive) setShowDocumentAnimation(false)
                          }}
                        >
                          <AnimatedCard
                            statusColor={statusColor}
                            isKeyboardMode={keyboardHovered}
                            selectedCardIndex={selectedCardIndex}
                            selectedActionIndex={selectedActionIndex}
                            onCardSelect={(index) => {
                              if (keyboardHovered && selectedActionIndex === 2) return
                              if (!keyboardHovered) {
                                setShowDocumentAnimation(true)
                              }
                            }}
                          />
                        </div>,
                        document.body,
                      )}
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div
                className={cn(
                  "absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-primary/5 to-primary/10 transition-opacity",
                  isAnyHovered ? "opacity-100" : "opacity-0",
                )}
              />

              <div className={cn("transition-all duration-500", isExpanded ? "max-h-[900px] opacity-100" : "max-h-0 opacity-0")}
                aria-expanded={isExpanded}
              >
                <div className="space-y-6 border-t pt-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-semibold text-muted-foreground">Statut de l’intervention</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:inline">Raccourcis rapides</span>
                        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Paramètres des statuts"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72" onClick={(event) => event.stopPropagation()}>
                            <div className="space-y-3">
                              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Paramètres des statuts
                              </div>
                              {INTERVENTION_STATUS_CONFIG.map((status) => {
                                const isPinned = quickStatusKeys.includes(status.key)
                                return (
                                  <div key={status.key} className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-2">
                                    <div className="flex items-center gap-2">
                                      <status.icon className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium text-foreground">{status.label}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="color"
                                        value={mergedStatusColors[status.key] ?? status.defaultColor}
                                        onChange={(event) => updateStatusColor(status.key, event.target.value)}
                                        className="h-7 w-7 cursor-pointer rounded-full border border-border"
                                      />
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className={cn("h-7 w-7", isPinned ? "text-primary" : "text-muted-foreground")}
                                        title={isPinned ? "Retirer du raccourci" : "Épingler"}
                                        onClick={() => togglePinnedStatus(status.key)}
                                      >
                                        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                      </Button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "grid gap-2",
                        quickStatuses.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4 lg:grid-cols-6",
                      )}
                    >
                      {quickStatuses.map((statusKey) => {
                        const config = statusConfigMap[statusKey]
                        if (!config) return null
                        const isActive = statusKey === intervention.statut
                        const tone = statusToneStyles(statusKey, isActive)
                        const Icon = config.icon
                        return (
                          <button
                            key={statusKey}
                            type="button"
                            className={cn(
                              "flex h-10 w-full items-center justify-start gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                              isActive ? "shadow-lg" : "hover:shadow-md",
                            )}
                            style={tone.style}
                            onClick={(event) => {
                              event.stopPropagation()
                              applyStatusChange(statusKey)
                            }}
                          >
                            <Icon className={cn("h-4 w-4", tone.iconColor)} />
                            <span>{config.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-muted-foreground">Détail des coûts</h4>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="text-xs font-medium text-muted-foreground">SST</div>
                        <EditableCell
                          value={intervention.coutSST ?? 0}
                          onChange={(value) => onCoutSSTChange?.(intervention, value)}
                          type="currency"
                          className="mt-2 text-blue-600"
                        />
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="text-xs font-medium text-muted-foreground">Matériaux</div>
                        <EditableCell
                          value={intervention.coutMateriel ?? 0}
                          onChange={(value) => onCoutMateriauxChange?.(intervention, value)}
                          type="currency"
                          className="mt-2 text-purple-600"
                        />
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-3">
                        <div className="text-xs font-medium text-muted-foreground">Intervention</div>
                        <EditableCell
                          value={intervention.coutIntervention ?? 0}
                          onChange={(value) => onCoutInterventionsChange?.(intervention, value)}
                          type="currency"
                          className="mt-2 text-emerald-600"
                        />
                      </div>
                    </div>

                    <div className="rounded-lg border bg-background/80 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Coûts déduits :</span>
                          <span className="ml-2 font-semibold text-red-600">
                            {formatCurrency((intervention.coutSST ?? 0) + (intervention.coutMateriel ?? 0))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Marge actuelle :</span>
                          <span className={cn("font-semibold", getMargeColor())}>
                            {formatCurrency(marginValue)} ({marginPct}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <h5 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <User className="h-4 w-4" /> Informations client
                      </h5>
                      <div className="space-y-2 text-sm">
                        <div className="font-medium text-foreground">
                          {(intervention.prenomClient || "") + " " + (intervention.nomClient || "") || intervention.locataire || "Client inconnu"}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" /> {intervention.adresse || "—"}
                        </div>
                        {intervention.commentaireAgent && (
                          <div className="rounded-md bg-background/80 p-2 text-xs text-muted-foreground">
                            {intervention.commentaireAgent}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <h5 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <Clock className="h-4 w-4" /> Informations intervention
                      </h5>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" /> Créé le {dateCreated ? dateCreated.toLocaleDateString("fr-FR") : "—"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" /> Échéance {dateIntervention ? dateIntervention.toLocaleDateString("fr-FR") : "—"}
                        </div>
                        {intervention.demandeIntervention && (
                          <div className="rounded-md bg-background/80 p-2 text-xs text-muted-foreground">
                            {intervention.demandeIntervention}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 border-t pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        onSendEmail?.(intervention)
                      }}
                    >
                      <Mail className="mr-2 h-4 w-4" /> Email client
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        onCall?.(intervention)
                      }}
                    >
                      <Phone className="mr-2 h-4 w-4" /> Appeler
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        onAddDocument?.(intervention)
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" /> Document
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleNavigateToDetail()
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" /> Page complète
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </ContextMenuTrigger>
        <InterventionContextMenuContent
          intervention={intervention}
          onOpen={() => openInterventionModal(intervention.id)}
          onOpenInNewTab={() => {
            const newWindow = window.open(`/interventions?i=${intervention.id}`, '_blank')
            // Remettre le focus sur la fenêtre actuelle après un court délai
            if (newWindow) {
              setTimeout(() => {
                window.focus()
              }, 100)
            }
          }}
        />
      </ContextMenu>
    </div>
  )
}
