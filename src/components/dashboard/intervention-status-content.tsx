"use client"

import { useMemo } from "react"
import { useRecentInterventionsByStatus } from "@/hooks/useDashboardStats"
import { getMetierColor } from "@/config/metier-colors"
import Loader from "@/components/ui/Loader"

interface InterventionStatusContentProps {
  userId: string | null
  statusLabel: string
  onOpenIntervention: (id: string) => void
  period?: {
    startDate?: string
    endDate?: string
  }
}

export const InterventionStatusContent = ({
  userId,
  statusLabel,
  onOpenIntervention,
  period,
}: InterventionStatusContentProps) => {
  const { data: interventionsData, isLoading, error } = useRecentInterventionsByStatus(
    userId && statusLabel
      ? {
          userId,
          statusLabel,
          limit: 5,
          startDate: period?.startDate,
          endDate: period?.endDate,
        }
      : null
  )

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A"
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === undefined || amount === null) return "0,00 €"
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div style={{ transform: "scale(0.75)" }}>
          <Loader />
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-destructive p-2">Erreur de chargement</div>
  }

  if (!interventionsData || interventionsData.length === 0) {
    return <div className="text-sm text-muted-foreground p-2">Aucune intervention pour ce statut</div>
  }

  const isDemandeStatus = statusLabel === "Demandé"

  return (
    <div className="space-y-3">
      <h4 className="font-semibold text-sm mb-2">{statusLabel}</h4>
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {interventionsData.map((intervention) => (
          <div
            key={intervention.id}
            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1.5 rounded transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onOpenIntervention(intervention.id)
            }}
          >
            <div
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: intervention.status_color || "#6366F1" }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{intervention.id_inter || "N/A"}</div>
              <div className="text-xs text-muted-foreground">
                {isDemandeStatus ? (
                  <>
                    Métier :{" "}
                    <span style={{ color: getMetierColor(intervention.metier_code, intervention.metier_label) }}>
                      {intervention.metier_label || "N/A"}
                    </span>{" "}
                    | Agence : {intervention.agence_label || "N/A"} | Due date :{" "}
                    {intervention.due_date ? formatDate(intervention.due_date) : "N/A"}
                  </>
                ) : (
                  <>
                    Métier :{" "}
                    <span style={{ color: getMetierColor(intervention.metier_code, intervention.metier_label) }}>
                      {intervention.metier_label || "N/A"}
                    </span>{" "}
                    | Marge : {formatCurrency(intervention.marge)} | Due date :{" "}
                    {intervention.due_date ? formatDate(intervention.due_date) : "N/A"}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

