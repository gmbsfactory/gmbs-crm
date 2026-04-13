import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { AdminDashboardStats } from "@/lib/api"

interface ManagerPerformanceTableProps {
  data?: AdminDashboardStats["agencyStats"]
  isLoading?: boolean
}

export function ManagerPerformanceTable({ data, isLoading }: ManagerPerformanceTableProps) {
  // Formater les nombres
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("fr-FR").format(num)
  }

  // Formater les pourcentages
  const formatPercent = (num: number) => {
    return `${num.toFixed(1)}%`
  }

  // Formater les montants
  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num)
  }

  if (isLoading) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Statistiques par Agence</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Statistiques par Agence</CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agence</TableHead>
                <TableHead className="text-right">Total interventions</TableHead>
                <TableHead className="text-right">Interventions terminées</TableHead>
                <TableHead className="text-right">Taux de marge</TableHead>
                <TableHead className="text-right">CA</TableHead>
                <TableHead className="text-right">Marge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((agency) => (
                <TableRow key={agency.agencyId}>
                  <TableCell className="font-medium">{agency.agencyLabel}</TableCell>
                  <TableCell className="text-right">{formatNumber(agency.nbTotalInterventions)}</TableCell>
                  <TableCell className="text-right">{formatNumber(agency.nbInterventionsTerminees)}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      agency.tauxMarge >= 30 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-foreground"
                    )}>
                      {formatPercent(agency.tauxMarge)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(agency.ca)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(agency.marge)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Aucune donnée disponible
          </div>
        )}
      </CardContent>
    </Card>
  )
}

