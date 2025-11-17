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

interface GestionnaireStat {
  gestionnaireId: string
  gestionnaireLabel: string
  nbInterventionsPrises: number
  nbInterventionsTerminees: number
  tauxTransformation: number
  tauxMarge: number
  ca?: number
  marge?: number
}

interface GestionnairePerformanceTableProps {
  data?: GestionnaireStat[]
  isLoading?: boolean
}

export function GestionnairePerformanceTable({ data, isLoading }: GestionnairePerformanceTableProps) {
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
          <CardTitle className="text-lg font-semibold text-foreground">Performance par Gestionnaire</CardTitle>
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
        <CardTitle className="text-lg font-semibold text-foreground">Performance par Gestionnaire</CardTitle>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom du gestionnaire</TableHead>
                <TableHead className="text-right">Interventions prises</TableHead>
                <TableHead className="text-right">Interventions terminées</TableHead>
                <TableHead className="text-right">Taux de transformation</TableHead>
                <TableHead className="text-right">Taux de marge</TableHead>
                {data[0]?.ca !== undefined && (
                  <>
                    <TableHead className="text-right">CA</TableHead>
                    <TableHead className="text-right">Marge</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((gestionnaire) => (
                <TableRow key={gestionnaire.gestionnaireId}>
                  <TableCell className="font-medium">{gestionnaire.gestionnaireLabel}</TableCell>
                  <TableCell className="text-right">{formatNumber(gestionnaire.nbInterventionsPrises)}</TableCell>
                  <TableCell className="text-right">{formatNumber(gestionnaire.nbInterventionsTerminees)}</TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      gestionnaire.tauxTransformation >= 90 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-foreground"
                    )}>
                      {formatPercent(gestionnaire.tauxTransformation)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      gestionnaire.tauxMarge >= 30 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-foreground"
                    )}>
                      {formatPercent(gestionnaire.tauxMarge)}
                    </span>
                  </TableCell>
                  {gestionnaire.ca !== undefined && (
                    <>
                      <TableCell className="text-right">{formatCurrency(gestionnaire.ca)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(gestionnaire.marge || 0)}</TableCell>
                    </>
                  )}
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




