"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { INTERVENTION_STATUS } from "@/config/interventions"
import { mapStatusFromDb } from "@/lib/interventions/mappers"
import type { InterventionWithDocuments } from "@/types/interventions"
import { InterventionContextMenuContent } from "@/components/interventions/InterventionContextMenu"
import { useInterventionModal } from "@/hooks/useInterventionModal"

export type InterventionTableRow = InterventionWithDocuments & {
  managerLabel?: string | null
  managerColor?: string | null
}

export type InterventionTableProps = {
  interventions: InterventionTableRow[]
  onRowClick?: (intervention: InterventionWithDocuments, index: number) => void
  onRowDoubleClick?: (intervention: InterventionWithDocuments, index: number) => void
}

function hslToHex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l)
  const toHex = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(Math.min(k - 3, 9 - k), 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, "0")
  }
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`
}

function generateColorFromString(value: string) {
  const seed = value
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const hue = seed % 360
  return hslToHex(hue, 0.65, 0.48)
}

const FALLBACK_STATUS_COLOR = "#4B5563"
const FALLBACK_ASSIGNEE_COLOR = "#4F46E5"

function normalizeHex(hex?: string | null): string {
  if (!hex) return FALLBACK_STATUS_COLOR
  let value = hex.trim()
  if (!value.startsWith("#")) {
    value = `#${value}`
  }
  if (value.length === 4) {
    const r = value[1]
    const g = value[2]
    const b = value[3]
    value = `#${r}${r}${g}${g}${b}${b}`
  }
  if (value.length !== 7) {
    return FALLBACK_STATUS_COLOR
  }
  return value.toUpperCase()
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized)
  if (!match) return null
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  }
}

function hexToRgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex)
  if (!rgb) {
    return `rgba(99, 102, 241, ${alpha})`
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function getReadableTextColor(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#0F172A"
  const srgb = [rgb.r, rgb.g, rgb.b].map((value) => {
    const channel = value / 255
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  })
  const luminance = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2]
  return luminance > 0.58 ? "#1F2937" : "#F9FAFB"
}

function buildSolidPillStyles(hex: string) {
  const normalized = normalizeHex(hex)
  return {
    backgroundColor: normalized,
    border: `1px solid ${hexToRgba(normalized, 0.35)}`,
    color: getReadableTextColor(normalized),
    boxShadow: `0 1px 0 ${hexToRgba(normalized, 0.28)}`,
  }
}

export default function InterventionTable({ interventions, onRowClick, onRowDoubleClick }: InterventionTableProps) {
  const { open: openInterventionModal } = useInterventionModal()

  const columns = useMemo<ColumnDef<InterventionTableRow>[]>(
    () => [
      {
        header: "Nom",
        accessorKey: "name",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        header: "Statut",
        accessorKey: "status",
        cell: ({ row }) => {
          const statusKey = mapStatusFromDb(row.original.status)
          const status = INTERVENTION_STATUS[statusKey]
          const hex = status?.hexColor ?? FALLBACK_STATUS_COLOR
          const pillStyles = buildSolidPillStyles(hex)
          return (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: normalizeHex(hex) }} />
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm"
                style={pillStyles}
              >
                {status?.label ?? statusKey}
              </span>
            </span>
          )
        },
      },
      {
        header: "Assigné à",
        accessorKey: "managerLabel",
        cell: ({ row }) => {
          const label = row.original.managerLabel || row.original.managerId || "Non assigné"
          const baseColor = row.original.managerColor || (label !== "Non assigné" ? generateColorFromString(label) : FALLBACK_ASSIGNEE_COLOR)
          const pillStyles = buildSolidPillStyles(baseColor)
          return (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: normalizeHex(baseColor) }} />
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium shadow-sm"
                style={pillStyles}
              >
                {label}
              </span>
            </span>
          )
        },
      },
      {
        header: "Adresse",
        accessorKey: "address",
        cell: ({ row }) => <span className="line-clamp-1 text-muted-foreground">{row.original.address}</span>,
      },
      {
        header: "Agence",
        accessorKey: "agency",
        cell: ({ row }) => row.original.agency || "—",
      },
      {
        header: "Échéance",
        accessorKey: "dueAt",
        cell: ({ row }) => (row.original.dueAt ? format(new Date(row.original.dueAt), "dd/MM/yyyy") : "—"),
      },
      {
        header: "Validation",
        accessorKey: "isValidated",
        cell: ({ row }) => (row.original.isValidated ? "Validée" : "À confirmer"),
      },
    ],
    [],
  )

  const table = useReactTable({
    data: interventions,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="data-table-wrapper">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => {
              const intervention = row.original
              return (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => onRowClick?.(intervention, row.index)}
                      onDoubleClick={() => onRowDoubleClick?.(intervention, row.index)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  </ContextMenuTrigger>
                  <InterventionContextMenuContent
                    intervention={intervention as any}
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
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                Aucune intervention pour le moment.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
