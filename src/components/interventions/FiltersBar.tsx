"use client"

import * as React from "react"
import {
  Search,
  MoreHorizontal,
  Settings,
  Pin,
  PinOff,
  X,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DateRangePicker, type DateRange } from "@/components/interventions/DateRangePicker"
import { persistInterventionStatusColor } from "@/lib/interventions/status-updates"
import { invalidateReferenceCache } from "@/lib/api"
import type { InterventionStatusValue } from "@/types/interventions"
import type { WorkflowConfig } from "@/types/intervention-workflow"
import { INTERVENTION_STATUS } from "@/config/interventions"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useWorkflowConfig } from "@/hooks/useWorkflowConfig"
import { getStatusDisplay } from "@/lib/interventions/status-display"

export type { DateRange }

export type SortField = "cree" | "echeance" | "marge"
export type SortDir = "asc" | "desc"

export function FiltersBar({
  search,
  onSearch,
  users,
  user,
  onUser,
  dateRange,
  onDateRange,
  sortField,
  onSortField,
  sortDir,
  onSortDir,
  displayedStatuses,
  selectedStatus,
  onSelectStatus,
  pinnedStatuses,
  onPinStatus,
  onUnpinStatus,
  additionalStatuses,
  getCountByStatus,
  workflow,
}: {
  search: string
  onSearch: (s: string) => void
  users: string[]
  user: string
  onUser: (u: string) => void
  dateRange: DateRange
  onDateRange: (r: DateRange) => void
  sortField: SortField
  onSortField: (f: SortField) => void
  sortDir: SortDir
  onSortDir: (d: SortDir) => void
  displayedStatuses: InterventionStatusValue[]
  selectedStatus: InterventionStatusValue[]
  onSelectStatus: (s: InterventionStatusValue | null) => void
  pinnedStatuses: InterventionStatusValue[]
  onPinStatus: (s: InterventionStatusValue) => void
  onUnpinStatus: (s: InterventionStatusValue) => void
  additionalStatuses: InterventionStatusValue[]
  getCountByStatus: (s: InterventionStatusValue | null) => number
  workflow: WorkflowConfig
}) {
  const selectUserValue = user === "" ? undefined : (user as string | undefined)
  const [isStatusSettingsOpen, setStatusSettingsOpen] = React.useState(false)

  const { updateStatus: updateWorkflowStatus } = useWorkflowConfig()

  const pinnedFromWorkflow = React.useMemo(
    () =>
      workflow.statuses
        .filter((status) => status.isPinned)
        .sort((a, b) => (a.pinnedOrder ?? 0) - (b.pinnedOrder ?? 0))
        .map((status) => status.key as InterventionStatusValue),
    [workflow.statuses],
  )

  const effectivePinnedStatuses = React.useMemo(() => {
    if (pinnedFromWorkflow.length > 0) return pinnedFromWorkflow
    return pinnedStatuses
  }, [pinnedFromWorkflow, pinnedStatuses])

  const statusesToRender = React.useMemo(() => {
    if (effectivePinnedStatuses.length === 0) {
      return displayedStatuses
    }

    // Inclure les statuts sélectionnés qui ne sont pas dans les épinglés
    const selectedNotPinned = selectedStatus.filter((s) => !effectivePinnedStatuses.includes(s))
    if (selectedNotPinned.length > 0) {
      return Array.from(new Set([...effectivePinnedStatuses, ...selectedNotPinned]))
    }

    return effectivePinnedStatuses
  }, [displayedStatuses, effectivePinnedStatuses, selectedStatus])

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Left cluster: Tous / Sélectionner / Statut */}
      <div className="flex items-center gap-2">
        {/* DESIGN v1.4 - Boutons masqués temporairement */}
        {false && (
          <>
            <Button variant="outline" size="sm" onClick={() => onUser("")}>Tous</Button>
            <Button variant="outline" size="sm" disabled title="TODO: mode sélection">Sélectionner</Button>
          </>
        )}
        <div className="text-sm text-muted-foreground ml-2">Statut:</div>
        <button
          onClick={() => onSelectStatus(null)}
          className={`status-chip ${
            selectedStatus.length === 0 
              ? "bg-foreground/90 text-background ring-2 ring-foreground/20" 
              : "bg-transparent border border-border text-foreground hover:bg-muted/50"
          } transition-[opacity,transform,shadow] duration-150 ease-out`}
        >
          Toutes ({getCountByStatus(null)})
        </button>
        {statusesToRender.map((status) => {
          const statusDisplay = getStatusDisplay(status, { workflow })
          const isSelected = selectedStatus.includes(status)
          const statusColor = statusDisplay.color
          
          return (
            <button
              key={status}
              onClick={() => onSelectStatus(status)}
              className={`status-chip transition-[opacity,transform,shadow] duration-150 ease-out inline-flex items-center gap-1.5 ${
                isSelected
                  ? "ring-2 ring-foreground/20"
                  : "hover:shadow-card border border-border bg-transparent"
              }`}
              style={isSelected ? { 
                backgroundColor: `${statusColor}15`, 
                borderColor: statusColor,
                color: statusColor 
              } : {}}
              title={statusDisplay.label}
            >
              {statusDisplay.icon && (
                <span className="inline-flex items-center mr-1">
                  {statusDisplay.icon}
                </span>
              )}
              <span>
                {statusDisplay.label}
              </span>
              <span className="text-muted-foreground">({getCountByStatus(status)})</span>
            </button>
          )
        })}
        {selectedStatus.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onSelectStatus(null)}
            title="Réinitialiser les filtres"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <Popover open={isStatusSettingsOpen} onOpenChange={setStatusSettingsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2 h-8 w-8"
              title="Paramètres des statuts"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Paramètres des statuts
              </div>
              {workflow.statuses.map((status) => {
                const statusKey = status.key as InterventionStatusValue
                const statusDisplay = getStatusDisplay(statusKey, { workflow })
                const config = INTERVENTION_STATUS[statusKey]
                const Icon = config?.icon ?? Settings
                const colorValue = status.color ?? statusDisplay.color

                const handlePinToggle = () => {
                  if (status.isPinned) {
                    onUnpinStatus(statusKey)
                  } else {
                    onPinStatus(statusKey)
                  }
                }

                const handleColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
                  const nextColor = event.target.value
                  if (!nextColor || nextColor === status.color) return
                  updateWorkflowStatus(status.id, { color: nextColor })
                  void (async () => {
                    try {
                      await persistInterventionStatusColor(statusKey, nextColor)
                      invalidateReferenceCache()
                    } catch (error) {
                      console.error("[FiltersBar] Statut non mis à jour", error)
                    }
                  })()
                }

                return (
                  <div
                    key={status.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted/30 px-2 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">{statusDisplay.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={colorValue}
                        onChange={handleColorChange}
                        className="h-7 w-7 cursor-pointer rounded-full border border-border bg-background"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${status.isPinned ? "text-primary" : "text-muted-foreground"}`}
                        onClick={handlePinToggle}
                        title={status.isPinned ? "Retirer du filtre" : "Épingler dans le filtre"}
                      >
                        {status.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right cluster: misc + advanced filters */}
      <div className="flex items-center gap-2">
        {/* DESIGN v1.4 - DateRangePicker masqué, disponible via le menu "Plus" */}
        {false && <DateRangePicker value={dateRange} onChange={onDateRange} />}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <MoreHorizontal className="h-4 w-4 mr-2" /> Plus
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
                          <div className="px-2 py-1.5 text-xs text-muted-foreground">Filtres avancés</div>
              <div className="px-2 py-2 space-y-2">
                <div className="text-xs text-muted-foreground">Statut</div>
                <Select
                  value={selectedStatus.length === 0 ? "__ALL__" : selectedStatus[0] ?? "__ALL__"}
                  onValueChange={(value) => {
                    if (value === "__ALL__") {
                      onSelectStatus(null)
                    } else {
                      onSelectStatus(value as InterventionStatusValue)
                    }
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Filtrer par statut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">Tous les statuts</SelectItem>
                    {displayedStatuses.map((status) => {
                      const statusDisplay = getStatusDisplay(status, { workflow })
                      return (
                        <SelectItem key={status} value={status}>
                          {statusDisplay.label}
                        </SelectItem>
                      )
                    })}
                    {additionalStatuses.map((status) => {
                      const statusDisplay = getStatusDisplay(status, { workflow })
                      return (
                        <SelectItem key={status} value={status}>
                          {statusDisplay.label}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">Utilisateur</div>
                <Select value={selectUserValue} onValueChange={(v) => onUser(v === "__ALL__" ? "" : v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Filtrer par utilisateur" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ALL__">Tous</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              <div className="text-xs text-muted-foreground pt-2">Recherche</div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Recherche (contexte, client)"
                  className="pl-8"
                  value={search}
                  onChange={(e) => onSearch(e.target.value)}
                />
              </div>
              <div className="text-xs text-muted-foreground pt-2">Tri</div>
              <div className="flex items-center gap-2">
                <Select value={sortField} onValueChange={(v) => onSortField(v as SortField)}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Trier par" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cree">Création</SelectItem>
                    <SelectItem value="echeance">Échéance</SelectItem>
                    <SelectItem value="marge">Marge</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortDir} onValueChange={(v) => onSortDir(v as SortDir)}>
                  <SelectTrigger className="w-[120px]"><SelectValue placeholder="Ordre" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">Asc</SelectItem>
                    <SelectItem value="desc">Desc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-2 border-t">
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Statuts épinglés</div>
                {additionalStatuses
                  .filter((status) => !effectivePinnedStatuses.includes(status))
                  .map((status) => {
                  const statusDisplay = getStatusDisplay(status, { workflow })
                  return (
                    <DropdownMenuItem key={status} onClick={() => onPinStatus(status)}>
                      + {statusDisplay.label}
                    </DropdownMenuItem>
                  )
                })}
                {effectivePinnedStatuses.length > 0 && (
                  <>
                    <div className="px-2 pt-2 text-xs text-muted-foreground">Épinglés</div>
                    {effectivePinnedStatuses.map((status) => {
                      const statusDisplay = getStatusDisplay(status, { workflow })
                      return (
                        <DropdownMenuItem key={status} onClick={() => onUnpinStatus(status)}>
                          − {statusDisplay.label}
                        </DropdownMenuItem>
                      )
                    })}
                  </>
                )}
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
