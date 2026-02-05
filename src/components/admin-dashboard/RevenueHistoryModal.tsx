"use client"

import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { VerticalBarChart } from "./VerticalBarChart"
import { useRevenueHistory } from "@/hooks/useRevenueHistory"
import type { PeriodType } from "@/lib/api/v2"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"

interface RevenueHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  periodType: PeriodType
  startDate?: string
  endDate?: string
  agenceIds?: string[] | null
  gestionnaireIds?: string[] | null
  metierIds?: string[] | null
}

export function RevenueHistoryModal({
  open,
  onOpenChange,
  periodType,
  startDate,
  endDate,
  agenceIds,
  gestionnaireIds,
  metierIds,
}: RevenueHistoryModalProps) {
  const { data, isLoading, error } = useRevenueHistory(
    open
      ? {
          periodType,
          startDate,
          endDate,
          agenceIds,
          gestionnaireIds,
          metierIds,
          includeProjection: true,
        }
      : null,
    { enabled: open }
  )

  const chartData = data
    ? [
        ...data.historical.map((d) => ({
          period: d.periodLabel,
          revenue: d.revenue,
          isProjection: false,
        })),
        ...(data.projection
          ? [
              {
                period: data.projection.periodLabel,
                revenue: data.projection.revenue,
                isProjection: true,
              },
            ]
          : []),
      ]
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="premium" className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader variant="premium">
          <DialogTitle>Évolution du Chiffre d&apos;Affaires</DialogTitle>
          <DialogDescription>
            Historique des 4 dernières périodes et projection de la période suivante
          </DialogDescription>
        </DialogHeader>

        <DialogBody translucent className="overflow-y-auto">
          {isLoading ? (
            <div className="py-8">
              <Skeleton className="h-[400px] w-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-destructive font-semibold mb-1">
                Erreur lors du chargement des données
              </p>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "Une erreur est survenue"}
              </p>
            </div>
          ) : (
            <VerticalBarChart data={chartData} />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

