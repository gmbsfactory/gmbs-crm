import { ColumnDef, CellContext } from "@tanstack/react-table"
import { ArrowUpDown, ArrowDown } from "lucide-react"
import { MarginBar } from "@/components/admin-dashboard/MarginBar"
import type { AgencyStat, GestionnaireStat, MetierStat, ChartMetric } from "./types"

/** Create a sortable header button with arrow indicators */
function SortableHeader({
  label,
  metric,
  activeMetric,
  onMetricChange,
}: {
  label: string
  metric: ChartMetric
  activeMetric: ChartMetric
  onMetricChange: (metric: ChartMetric) => void
}) {
  const isActive = activeMetric === metric
  return (
    <div
      className="flex items-center justify-center gap-2 cursor-pointer hover:text-foreground select-none"
      onClick={() => onMetricChange(metric)}
    >
      <span>{label}</span>
      {isActive ? (
        <ArrowDown className="h-4 w-4" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      )}
    </div>
  )
}

/** Agency table columns */
export function createAgencyColumns(
  formatNumber: (num: number) => string,
  formatCurrency: (num: number) => string,
  chartMetric: ChartMetric,
  onChartMetricChange: (metric: ChartMetric) => void
): ColumnDef<AgencyStat, unknown>[] {
  return [
    {
      header: "Agence",
      accessorKey: "agencyLabel",
      size: 200,
      minSize: 200,
      maxSize: 200,
      cell: ({ row }: CellContext<AgencyStat, unknown>) => (
        <div className="text-center">{row.original.agencyLabel}</div>
      ),
    },
    {
      header: () => (
        <SortableHeader
          label="Prises"
          metric="volume"
          activeMetric={chartMetric}
          onMetricChange={onChartMetricChange}
        />
      ),
      accessorKey: "nbTotalInterventions",
      size: 45,
      minSize: 45,
      maxSize: 45,
      enableSorting: true,
      cell: ({ row }: CellContext<AgencyStat, unknown>) => (
        <div className="text-center">{formatNumber(row.original.nbTotalInterventions)}</div>
      ),
    },
    {
      header: "Terminées",
      accessorKey: "nbInterventionsTerminees",
      size: 75,
      minSize: 75,
      maxSize: 75,
      cell: ({ row }: CellContext<AgencyStat, unknown>) => (
        <div className="text-center">{formatNumber(row.original.nbInterventionsTerminees)}</div>
      ),
    },
    {
      header: () => (
        <SortableHeader
          label="CA"
          metric="ca"
          activeMetric={chartMetric}
          onMetricChange={onChartMetricChange}
        />
      ),
      accessorKey: "ca",
      size: 120,
      minSize: 120,
      maxSize: 120,
      enableSorting: true,
      cell: ({ row }: CellContext<AgencyStat, unknown>) => (
        <div className="text-center">{formatCurrency(row.original.ca)}</div>
      ),
    },
    {
      header: () => (
        <SortableHeader
          label="Marge"
          metric="marge"
          activeMetric={chartMetric}
          onMetricChange={onChartMetricChange}
        />
      ),
      accessorKey: "marge",
      size: 120,
      minSize: 120,
      maxSize: 120,
      enableSorting: true,
      cell: ({ row }: CellContext<AgencyStat, unknown>) => (
        <div className="text-center">{formatCurrency(row.original.marge)}</div>
      ),
    },
    {
      header: "Taux Marge",
      accessorKey: "tauxMarge",
      size: 225,
      minSize: 225,
      maxSize: 225,
      cell: ({ row }: CellContext<AgencyStat, unknown>) => (
        <div className="flex justify-center">
          <MarginBar value={row.original.tauxMarge} target={30} />
        </div>
      ),
    },
  ]
}

/** Manager (gestionnaire) table columns */
export function createManagerColumns(
  formatNumber: (num: number) => string,
  formatCurrency: (num: number) => string,
  chartMetric: ChartMetric,
  onChartMetricChange: (metric: ChartMetric) => void
): ColumnDef<GestionnaireStat, unknown>[] {
  return [
    {
      header: "Gestionnaire",
      accessorKey: "gestionnaireLabel",
      size: 200,
      minSize: 200,
      maxSize: 200,
      cell: ({ row }: CellContext<GestionnaireStat, unknown>) => (
        <div className="text-center">{row.original.gestionnaireLabel}</div>
      ),
    },
    {
      header: () => (
        <SortableHeader
          label="Prises"
          metric="volume"
          activeMetric={chartMetric}
          onMetricChange={onChartMetricChange}
        />
      ),
      accessorKey: "nbInterventionsPrises",
      size: 45,
      minSize: 45,
      maxSize: 45,
      enableSorting: true,
      cell: ({ row }: CellContext<GestionnaireStat, unknown>) => (
        <div className="text-center">{formatNumber(row.original.nbInterventionsPrises)}</div>
      ),
    },
    {
      header: "Terminées",
      accessorKey: "nbInterventionsTerminees",
      size: 75,
      minSize: 75,
      maxSize: 75,
      cell: ({ row }: CellContext<GestionnaireStat, unknown>) => (
        <div className="text-center">{formatNumber(row.original.nbInterventionsTerminees)}</div>
      ),
    },
    {
      header: () => (
        <SortableHeader
          label="CA"
          metric="ca"
          activeMetric={chartMetric}
          onMetricChange={onChartMetricChange}
        />
      ),
      accessorKey: "ca",
      size: 120,
      minSize: 120,
      maxSize: 120,
      enableSorting: true,
      cell: ({ row }: CellContext<GestionnaireStat, unknown>) => (
        <div className="text-center">{formatCurrency(row.original.ca)}</div>
      ),
    },
    {
      header: () => (
        <SortableHeader
          label="Marge"
          metric="marge"
          activeMetric={chartMetric}
          onMetricChange={onChartMetricChange}
        />
      ),
      accessorKey: "marge",
      size: 120,
      minSize: 120,
      maxSize: 120,
      enableSorting: true,
      cell: ({ row }: CellContext<GestionnaireStat, unknown>) => (
        <div className="text-center">{formatCurrency(row.original.marge)}</div>
      ),
    },
    {
      header: "Taux Marge",
      accessorKey: "tauxMarge",
      size: 225,
      minSize: 225,
      maxSize: 225,
      cell: ({ row }: CellContext<GestionnaireStat, unknown>) => (
        <div className="flex justify-center">
          <MarginBar value={row.original.tauxMarge} target={30} />
        </div>
      ),
    },
  ]
}

/** Metier table columns */
export function createMetierColumns(
  formatNumber: (num: number) => string,
  formatCurrency: (num: number) => string,
  chartMetric: ChartMetric,
  onChartMetricChange: (metric: ChartMetric) => void
): ColumnDef<MetierStat, unknown>[] {
  return [
    {
      header: "Métier",
      accessorKey: "metierLabel",
      size: 200,
      minSize: 200,
      maxSize: 200,
      cell: ({ row }: CellContext<MetierStat, unknown>) => (
        <div className="text-center">{row.original.metierLabel}</div>
      ),
    },
    {
      header: () => (
        <SortableHeader
          label="Prises"
          metric="volume"
          activeMetric={chartMetric}
          onMetricChange={onChartMetricChange}
        />
      ),
      accessorKey: "nbInterventionsPrises",
      size: 45,
      minSize: 45,
      maxSize: 45,
      enableSorting: true,
      cell: ({ row }: CellContext<MetierStat, unknown>) => (
        <div className="text-center">{formatNumber(row.original.nbInterventionsPrises)}</div>
      ),
    },
    {
      header: "Terminées",
      accessorKey: "nbInterventionsTerminees",
      size: 75,
      minSize: 75,
      maxSize: 75,
      cell: ({ row }: CellContext<MetierStat, unknown>) => (
        <div className="text-center">{formatNumber(row.original.nbInterventionsTerminees)}</div>
      ),
    },
    {
      header: () => (
        <SortableHeader
          label="CA"
          metric="ca"
          activeMetric={chartMetric}
          onMetricChange={onChartMetricChange}
        />
      ),
      accessorKey: "ca",
      size: 120,
      minSize: 120,
      maxSize: 120,
      enableSorting: true,
      cell: ({ row }: CellContext<MetierStat, unknown>) => (
        <div className="text-center">{formatCurrency(row.original.ca)}</div>
      ),
    },
    {
      header: () => (
        <SortableHeader
          label="Marge"
          metric="marge"
          activeMetric={chartMetric}
          onMetricChange={onChartMetricChange}
        />
      ),
      accessorKey: "marge",
      size: 120,
      minSize: 120,
      maxSize: 120,
      enableSorting: true,
      cell: ({ row }: CellContext<MetierStat, unknown>) => (
        <div className="text-center">{formatCurrency(row.original.marge)}</div>
      ),
    },
    {
      header: "Taux Marge",
      accessorKey: "tauxMarge",
      size: 225,
      minSize: 225,
      maxSize: 225,
      cell: ({ row }: CellContext<MetierStat, unknown>) => (
        <div className="flex justify-center">
          <MarginBar value={row.original.tauxMarge} target={30} />
        </div>
      ),
    },
  ]
}
