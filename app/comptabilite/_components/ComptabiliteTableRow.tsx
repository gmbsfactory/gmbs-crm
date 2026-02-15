"use client"

import { memo } from "react"
import { Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { TableCell, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { TruncatedCell } from "@/components/ui/truncated-cell"
import { cn } from "@/lib/utils"
import type { InterventionRecord } from "@/lib/comptabilite/formatters"
import {
  formatCurrency,
  formatDate,
  formatClientName,
  formatAddress,
  getMetierLabel,
  getCostAmountByType,
  getPaymentInfo,
  getArtisanName,
} from "@/lib/comptabilite/formatters"

// ── Props ──

interface ComptabiliteTableRowProps {
  intervention: InterventionRecord
  facturationDate: string | undefined
  isSelected: boolean
  isComptaChecked: boolean
  onToggleSelect: (id: string) => void
  onToggleComptaCheck: (id: string) => void
  onOpenModal: (id: string) => void
}

// ── Composant mémoïsé ──

export const ComptabiliteTableRow = memo(function ComptabiliteTableRow({
  intervention,
  facturationDate,
  isSelected,
  isComptaChecked,
  onToggleSelect,
  onToggleComptaCheck,
  onOpenModal,
}: ComptabiliteTableRowProps) {
  const acompteClient = getPaymentInfo(intervention, "acompte_client")
  const acompteArtisan = getPaymentInfo(intervention, "acompte_sst")
  const inter = intervention as any

  return (
    <TableRow
      className={cn(
        "transition-colors",
        isSelected && !isComptaChecked && "bg-muted/50",
        isComptaChecked && "compta-checked"
      )}
    >
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(intervention.id)}
          aria-label={`Sélectionner la ligne ${intervention.id_inter || intervention.id}`}
        />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatDate(facturationDate)} maxWidth="80px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={inter.agenceLabel || inter.agence || "—"} maxWidth="70px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={inter.assignedUserName || inter.attribueA || "—"} maxWidth="70px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={intervention.id_inter || "—"} maxWidth="60px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatClientName(intervention)} maxWidth="90px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatAddress(intervention)} maxWidth="110px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={getMetierLabel(intervention)} maxWidth="65px" />
      </TableCell>
      <TableCell>
        <TruncatedCell
          content={inter.contexteIntervention ?? intervention.contexte_intervention ?? "—"}
          maxWidth="130px"
        />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatCurrency(getCostAmountByType(intervention, "materiel"))} maxWidth="75px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatCurrency(getCostAmountByType(intervention, "intervention"))} maxWidth="65px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatCurrency(getCostAmountByType(intervention, "sst"))} maxWidth="60px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={getArtisanName(intervention)} maxWidth="80px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatCurrency(acompteClient.amount)} maxWidth="85px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatDate(acompteClient.date)} maxWidth="90px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatCurrency(acompteArtisan.amount)} maxWidth="90px" />
      </TableCell>
      <TableCell>
        <TruncatedCell content={formatDate(acompteArtisan.date)} maxWidth="100px" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Checkbox
            checked={isComptaChecked}
            onCheckedChange={() => onToggleComptaCheck(intervention.id)}
            aria-label="Marquer comme géré"
            className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenModal(intervention.id)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
})
