"use client"

/**
 * The status filter bar shown below the view tabs when the
 * "showStatusFilter" layout option is enabled for a table view.
 *
 * All imports use `@/` paths or same-directory `./` paths.
 */

import { Settings, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { INTERVENTION_STATUS } from "@/config/interventions"
import { mapStatusToDb } from "@/lib/interventions/mappers"
import { getStatusDisplay } from "@/lib/interventions/status-display"

import type { InterventionsStatusFilterProps, InterventionStatusValue } from "./types"

export default function InterventionsStatusFilter({
  showStatusFilter,
  selectedStatuses,
  displayedStatuses,
  isCheckFilterActive,
  workflowConfig,
  getCountByStatus,
  getCheckCount,
  handleSelectStatus,
  updateFilterForProperty,
}: InterventionsStatusFilterProps) {
  if (!showStatusFilter) return null

  return (
    <div className="flex items-center gap-2 flex-wrap pb-4 border-b flex-shrink-0">
      <div className="text-sm text-muted-foreground">Statut:</div>

      {/* "All" chip */}
      <button
        onClick={() => handleSelectStatus(null)}
        className={`status-chip ${
          selectedStatuses.length === 0
            ? "bg-foreground/90 text-background ring-2 ring-foreground/20"
            : "bg-transparent border border-border text-foreground hover:bg-muted/50"
        } transition-[opacity,transform,shadow] duration-150 ease-out`}
      >
        Toutes ({getCountByStatus(null)})
      </button>

      {/* Status chips */}
      {displayedStatuses.map((status) => {
        const label =
          INTERVENTION_STATUS[status]?.label ?? mapStatusToDb(status)
        const Icon = INTERVENTION_STATUS[status]?.icon ?? Settings
        const isSelected = selectedStatuses.includes(status)
        const statusDisplay = getStatusDisplay(status, { workflow: workflowConfig })
        const finalColor = statusDisplay.color

        return (
          <button
            key={status}
            onClick={() => handleSelectStatus(status)}
            className={`status-chip transition-[opacity,transform,shadow] duration-150 ease-out inline-flex items-center gap-1.5 ${
              isSelected
                ? "ring-2 ring-foreground/20"
                : "hover:shadow-card border border-border bg-transparent"
            }`}
            style={
              isSelected
                ? {
                    backgroundColor: `${finalColor}15`,
                    borderColor: finalColor,
                    color: finalColor,
                  }
                : {}
            }
            title={label}
          >
            <span className="inline-flex items-center">
              <Icon className="h-3.5 w-3.5 mr-1" />
              {label}
            </span>
            <span className="text-muted-foreground">({getCountByStatus(status)})</span>
          </button>
        )
      })}

      {/* CHECK chip */}
      <button
        onClick={() => {
          if (isCheckFilterActive) {
            updateFilterForProperty("isCheck", null)
          } else {
            updateFilterForProperty("isCheck", {
              property: "isCheck",
              operator: "eq",
              value: true,
            })
          }
        }}
        className={`status-chip transition-[opacity,transform,shadow] duration-150 ease-out inline-flex items-center gap-1.5 ${
          isCheckFilterActive
            ? "ring-2 ring-foreground/20"
            : "hover:shadow-card border border-border bg-transparent"
        }`}
        style={
          isCheckFilterActive
            ? {
                backgroundColor: "#EF444415",
                borderColor: "#EF4444",
                color: "#EF4444",
              }
            : {}
        }
        title="Interventions avec date d'echeance depassee (peut etre combine avec d'autres statuts)"
      >
        <span className="inline-flex items-center">
          <span className="h-3.5 w-3.5 mr-1 rounded-full bg-red-500" />
          CHECK
        </span>
        <span className="text-muted-foreground">({getCheckCount()})</span>
      </button>

      {/* Clear all button */}
      {(selectedStatuses.length > 0 || isCheckFilterActive) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => {
            handleSelectStatus(null)
            updateFilterForProperty("isCheck", null)
          }}
          title="Reinitialiser tous les filtres"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
