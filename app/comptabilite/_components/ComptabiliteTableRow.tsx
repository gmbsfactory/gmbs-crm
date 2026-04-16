"use client"

import { memo, type CSSProperties } from "react"
import { Eye, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { TruncatedCell } from "@/components/ui/truncated-cell"
import { cn } from "@/lib/utils"
import type { ColumnWidths } from "@/hooks/useColumnResize"
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

// ── Largeurs par défaut (cohérent avec COLUMNS de page.tsx) ──

const DEFAULT_WIDTHS: Record<string, number> = {
  select: 36,
  dateFact: 88,
  agence: 78,
  attribue: 128,
  id: 66,
  client: 100,
  adresse: 177,
  metier: 85,
  contexte: 133,
  materiel: 70,
  inter: 50,
  sst: 62,
  artisan: 88,
  acClient: 82,
  dateAcClient: 92,
  acArtisan: 82,
  dateAcArtisan: 92,
  action: 72,
}

// ── Props ──

interface ComptabiliteTableRowProps {
  intervention: InterventionRecord
  facturationDate: string | undefined
  isSelected: boolean
  isComptaChecked: boolean
  columnWidths: ColumnWidths
  onToggleSelect: (id: string) => void
  onToggleComptaCheck: (id: string) => void
  onOpenModal: (id: string) => void
  onExclude: (id: string) => void
  rowIndex?: number
  isHighlighted?: boolean
}

// ── Helper : style inline par colonne ──

function colStyle(widths: ColumnWidths, key: string): CSSProperties {
  const w = (widths[key] as number) ?? DEFAULT_WIDTHS[key]
  return { width: w, minWidth: w, maxWidth: w }
}

// ── Composant mémoïsé ──

export const ComptabiliteTableRow = memo(function ComptabiliteTableRow({
  intervention,
  facturationDate,
  isSelected,
  isComptaChecked,
  columnWidths,
  onToggleSelect,
  onToggleComptaCheck,
  onOpenModal,
  onExclude,
  rowIndex,
  isHighlighted = false,
}: ComptabiliteTableRowProps) {
  const acompteClient = getPaymentInfo(intervention, "acompte_client")
  const acompteArtisan = getPaymentInfo(intervention, "acompte_sst")
  const inter = intervention as any

  const rowLabel = `Intervention ${intervention.id_inter || intervention.id}`

  const cellBase = "px-2 py-2 align-middle overflow-hidden"

  return (
    <tr
      data-kb-row={rowIndex}
      data-kb-highlighted={isHighlighted ? "" : undefined}
      aria-selected={isHighlighted}
      className={cn(
        "border-b border-border/40 transition-colors",
        isSelected && !isComptaChecked && "bg-muted/50",
        isComptaChecked && "compta-checked",
      )}
      aria-label={rowLabel}
    >
      {/* select */}
      <td style={colStyle(columnWidths, "select")} className={cellBase}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(intervention.id)}
          aria-label={`Sélectionner ${rowLabel}`}
        />
      </td>
      {/* dateFact */}
      <td style={colStyle(columnWidths, "dateFact")} className={cn(cellBase, "whitespace-nowrap")}>
        <TruncatedCell content={formatDate(facturationDate)} maxWidth="100%" />
      </td>
      {/* agence */}
      <td style={colStyle(columnWidths, "agence")} className={cellBase}>
        <TruncatedCell content={inter.agenceLabel || inter.agence || "—"} maxWidth="100%" />
      </td>
      {/* attribue */}
      <td style={colStyle(columnWidths, "attribue")} className={cellBase}>
        <TruncatedCell content={inter.assignedUserName || inter.attribueA || "—"} maxWidth="100%" />
      </td>
      {/* id */}
      <td style={colStyle(columnWidths, "id")} className={cn(cellBase, "tabular-nums")}>
        <TruncatedCell content={intervention.id_inter || "—"} maxWidth="100%" />
      </td>
      {/* client */}
      <td style={colStyle(columnWidths, "client")} className={cellBase}>
        <TruncatedCell content={formatClientName(intervention)} maxWidth="100%" />
      </td>
      {/* adresse */}
      <td style={colStyle(columnWidths, "adresse")} className={cellBase}>
        <TruncatedCell content={formatAddress(intervention)} maxWidth="100%" />
      </td>
      {/* metier */}
      <td style={colStyle(columnWidths, "metier")} className={cellBase}>
        <TruncatedCell content={getMetierLabel(intervention)} maxWidth="100%" />
      </td>
      {/* contexte */}
      <td style={colStyle(columnWidths, "contexte")} className={cellBase}>
        <TruncatedCell
          content={inter.contexteIntervention ?? intervention.contexte_intervention ?? "—"}
          maxWidth="100%"
        />
      </td>
      {/* materiel */}
      <td style={colStyle(columnWidths, "materiel")} className={cn(cellBase, "tabular-nums")}>
        <TruncatedCell content={formatCurrency(getCostAmountByType(intervention, "materiel"))} maxWidth="100%" />
      </td>
      {/* inter */}
      <td style={colStyle(columnWidths, "inter")} className={cn(cellBase, "tabular-nums")}>
        <TruncatedCell content={formatCurrency(getCostAmountByType(intervention, "intervention"))} maxWidth="100%" />
      </td>
      {/* sst */}
      <td style={colStyle(columnWidths, "sst")} className={cn(cellBase, "tabular-nums")}>
        <TruncatedCell content={formatCurrency(getCostAmountByType(intervention, "sst"))} maxWidth="100%" />
      </td>
      {/* artisan */}
      <td style={colStyle(columnWidths, "artisan")} className={cellBase}>
        <TruncatedCell content={getArtisanName(intervention)} maxWidth="100%" />
      </td>
      {/* acClient */}
      <td style={colStyle(columnWidths, "acClient")} className={cn(cellBase, "tabular-nums")}>
        <TruncatedCell content={formatCurrency(acompteClient.amount)} maxWidth="100%" />
      </td>
      {/* dateAcClient */}
      <td style={colStyle(columnWidths, "dateAcClient")} className={cn(cellBase, "whitespace-nowrap")}>
        <TruncatedCell content={formatDate(acompteClient.date)} maxWidth="100%" />
      </td>
      {/* acArtisan */}
      <td style={colStyle(columnWidths, "acArtisan")} className={cn(cellBase, "tabular-nums")}>
        <TruncatedCell content={formatCurrency(acompteArtisan.amount)} maxWidth="100%" />
      </td>
      {/* dateAcArtisan */}
      <td style={colStyle(columnWidths, "dateAcArtisan")} className={cn(cellBase, "whitespace-nowrap")}>
        <TruncatedCell content={formatDate(acompteArtisan.date)} maxWidth="100%" />
      </td>
      {/* action (sticky) */}
      <td
        style={colStyle(columnWidths, "action")}
        className={cn(
          cellBase,
          "comptabilite-sticky-col",
          isComptaChecked && !isHighlighted && "compta-checked-sticky",
          isHighlighted && "compta-highlighted-sticky",
          isSelected && !isComptaChecked && !isHighlighted && "compta-selected-sticky"
        )}
      >
        <div className="flex items-center gap-1">
          <Checkbox
            checked={isComptaChecked}
            onCheckedChange={() => onToggleComptaCheck(intervention.id)}
            aria-label={isComptaChecked ? `Marquer ${rowLabel} comme non géré` : `Marquer ${rowLabel} comme géré`}
            className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenModal(intervention.id)}
            aria-label={`Voir le détail de ${rowLabel}`}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onExclude(intervention.id)}
            aria-label={`Retirer ${rowLabel} de la compta`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
})
