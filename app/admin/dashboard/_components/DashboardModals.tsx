"use client"

import { RevenueHistoryModal } from "@/components/admin-dashboard/RevenueHistoryModal"
import { InterventionsHistoryModal } from "@/components/admin-dashboard/InterventionsHistoryModal"
import { TransformationRateHistoryModal } from "@/components/admin-dashboard/TransformationRateHistoryModal"
import { CycleTimeHistoryModal } from "@/components/admin-dashboard/CycleTimeHistoryModal"
import { MarginHistoryModal } from "@/components/admin-dashboard/MarginHistoryModal"
import type { ModalFilterProps } from "./types"

interface DashboardModalsProps extends ModalFilterProps {
  isRevenueModalOpen: boolean
  onRevenueModalChange: (open: boolean) => void
  isInterventionsModalOpen: boolean
  onInterventionsModalChange: (open: boolean) => void
  isTransformationModalOpen: boolean
  onTransformationModalChange: (open: boolean) => void
  isCycleTimeModalOpen: boolean
  onCycleTimeModalChange: (open: boolean) => void
  isMarginModalOpen: boolean
  onMarginModalChange: (open: boolean) => void
}

export function DashboardModals({
  periodType,
  startDate,
  endDate,
  agenceIds,
  gestionnaireIds,
  metierIds,
  isRevenueModalOpen,
  onRevenueModalChange,
  isInterventionsModalOpen,
  onInterventionsModalChange,
  isTransformationModalOpen,
  onTransformationModalChange,
  isCycleTimeModalOpen,
  onCycleTimeModalChange,
  isMarginModalOpen,
  onMarginModalChange,
}: DashboardModalsProps) {
  return (
    <>
      <RevenueHistoryModal
        open={isRevenueModalOpen}
        onOpenChange={onRevenueModalChange}
        periodType={periodType}
        startDate={startDate}
        endDate={endDate}
        agenceIds={agenceIds}
        gestionnaireIds={gestionnaireIds}
        metierIds={metierIds}
      />
      <InterventionsHistoryModal
        open={isInterventionsModalOpen}
        onOpenChange={onInterventionsModalChange}
        periodType={periodType}
        startDate={startDate}
        endDate={endDate}
        agenceIds={agenceIds}
        gestionnaireIds={gestionnaireIds}
        metierIds={metierIds}
      />
      <TransformationRateHistoryModal
        open={isTransformationModalOpen}
        onOpenChange={onTransformationModalChange}
        periodType={periodType}
        startDate={startDate}
        endDate={endDate}
        agenceIds={agenceIds}
        gestionnaireIds={gestionnaireIds}
        metierIds={metierIds}
      />
      <CycleTimeHistoryModal
        open={isCycleTimeModalOpen}
        onOpenChange={onCycleTimeModalChange}
        periodType={periodType}
        startDate={startDate}
        endDate={endDate}
        agenceIds={agenceIds}
        gestionnaireIds={gestionnaireIds}
        metierIds={metierIds}
      />
      <MarginHistoryModal
        open={isMarginModalOpen}
        onOpenChange={onMarginModalChange}
        periodType={periodType}
        startDate={startDate}
        endDate={endDate}
        agenceIds={agenceIds}
        gestionnaireIds={gestionnaireIds}
        metierIds={metierIds}
      />
    </>
  )
}
