"use client"

import { useEffect, useMemo, useCallback, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { AlertCircle, Calendar } from "lucide-react"
import Loader from "@/components/ui/Loader"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis, Cell } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { useRouter } from "next/navigation"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { getInterventionStatusColor } from "@/config/status-colors"
import { INTERVENTION_STATUS } from "@/config/interventions"
import { useInterventionStatuses } from "@/hooks/useInterventionStatuses"
import { InterventionStatusContent } from "./intervention-status-content"
import { navigateWithModifier } from "@/lib/utils/navigation"
import { startOfYear, endOfYear, getYear } from "date-fns"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface InterventionStatsBarChartProps {
  /** Période pour filtrer les interventions dans le HoverCard uniquement (le count reste global) */
  hoverPeriod?: {
    startDate?: string
    endDate?: string
  }
  userId?: string | null
}

// Composants de labels supprimés car remplacés par une disposition plus lisible (YAxis pour les noms, LabelList position right pour les valeurs)


export function InterventionStatsBarChart({ hoverPeriod, userId: propUserId }: InterventionStatsBarChartProps) {
  const { open: openInterventionModal } = useInterventionModal()
  const router = useRouter()

  // Filtre temporel local : "all" (complet) ou "year" (année en cours)
  const [viewMode, setViewMode] = useState<"all" | "year">("year")
  const currentYear = useMemo(() => getYear(new Date()), [])

  // Utiliser le hook React Query pour charger l'utilisateur (cache partagé)
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser()
  // Utiliser le prop userId s'il est fourni, sinon utiliser currentUser
  const userId = propUserId ?? currentUser?.id ?? null

  // Déterminer la période de filtrage selon le viewMode
  const statsFilterPeriod = useMemo(() => {
    if (viewMode === "year") {
      const now = new Date()
      return {
        startDate: startOfYear(now).toISOString(),
        endDate: endOfYear(now).toISOString()
      }
    }
    // "all" : pas de filtre temporel pour les stats globales de l'utilisateur
    return undefined
  }, [viewMode])

  // Utiliser TanStack Query pour charger les stats (cache partagé et déduplication automatique)
  // Utiliser statsFilterPeriod s'il est défini
  const { data: stats, isLoading: loading, error: queryError } = useDashboardStats(statsFilterPeriod, userId)
  const error = queryError ? (queryError instanceof Error ? queryError.message : String(queryError)) : null

  // Charger les statuts depuis la DB pour avoir les couleurs exactes
  const { statuses: dbStatuses, statusesByCode, statusesByLabel } = useInterventionStatuses()

  // Log les statuts chargés depuis la DB pour déboguer
  useEffect(() => {
    if (dbStatuses.length > 0 && process.env.NODE_ENV === 'development') {
      console.log(`[Dashboard Colors] Statuts chargés depuis la DB (${dbStatuses.length}):`,
        dbStatuses.map(s => ({ code: s.code, label: s.label, color: s.color }))
      )
    }
  }, [dbStatuses])

  // Créer une version stable de la liste des statuts pour éviter les boucles infinies
  // Utiliser une sérialisation JSON pour comparer le contenu plutôt que la référence
  const statsByStatusLabelKey = useMemo(() => {
    if (!stats?.by_status_label) return null
    return JSON.stringify(stats.by_status_label)
  }, [stats?.by_status_label])


  // Statuts fondamentaux à afficher
  const fundamentalStatuses = useMemo(() => ["Demandé", "Inter en cours", "Visite technique", "Accepté"], [])

  // Fonction helper pour obtenir la couleur d'un statut
  // Priorité : 1) DB (source de vérité), 2) INTERVENTION_STATUS, 3) Fallback
  // Mémorisée pour éviter les recalculs constants
  const getStatusColor = useCallback((statusLabel: string): string => {
    // Cas spécial pour "Check" qui n'est pas dans INTERVENTION_STATUS
    if (statusLabel === "Check") {
      return "#EF4444" // Rouge pour Check
    }

    // 1. PRIORITÉ : Chercher dans la DB par label (insensible à la casse)
    // Le hook useInterventionStatuses stocke les labels en minuscule dans statusesByLabel
    const dbStatusByLabel = statusesByLabel.get(statusLabel.toLowerCase())
    if (dbStatusByLabel?.color) {
      return dbStatusByLabel.color
    }

    // 2. Chercher dans la DB par code (via mapping label → code)
    // Mapping basé sur les labels exacts de la DB
    const labelToCodeMap: Record<string, string> = {
      "Inter en cours": "INTER_EN_COURS",
      "Inter terminée": "INTER_TERMINEE",
      "Inter Terminée": "INTER_TERMINEE",
      "En cours": "INTER_EN_COURS", // Alias legacy
      "Terminé": "INTER_TERMINEE", // Alias legacy
      "Visite technique": "VISITE_TECHNIQUE", // Variante minuscule
      "Visite Technique": "VISITE_TECHNIQUE", // Label exact de la DB
      "Devis envoyé": "DEVIS_ENVOYE", // Variante minuscule
      "Devis Envoyé": "DEVIS_ENVOYE", // Label exact de la DB
    }

    const mappedCode = labelToCodeMap[statusLabel]
    if (mappedCode) {
      const dbStatusByCode = statusesByCode.get(mappedCode)
      if (dbStatusByCode?.color) {
        return dbStatusByCode.color
      }
    }

    // 3. Chercher dans INTERVENTION_STATUS (fallback)
    const normalizedLabel = statusLabel === "Inter en cours" ? "En cours" : statusLabel
    const statusConfig = Object.values(INTERVENTION_STATUS).find(
      s => s.label === normalizedLabel || s.label.toLowerCase() === normalizedLabel.toLowerCase()
    )

    if (statusConfig?.hexColor) {
      return statusConfig.hexColor
    }

    // 4. Dernier fallback
    return getInterventionStatusColor(statusLabel) || "#6366F1"
  }, [statusesByLabel, statusesByCode])

  // Créer le chartConfig avec les couleurs pour chaque statut possible
  // Mémorisé pour éviter les recalculs constants
  const chartConfig: ChartConfig = useMemo(() => {
    const config: ChartConfig = {
      value: {
        label: "Valeur",
        color: "hsl(var(--chart-1))",
      },
    }

    // Ajouter une entrée pour chaque statut possible dans le config (pour les tooltips)
    fundamentalStatuses.forEach((status) => {
      config[status] = {
        label: status,
        color: getStatusColor(status),
      }
    })
    config["Check"] = {
      label: "Check",
      color: getStatusColor("Check"),
    }

    return config
  }, [fundamentalStatuses, getStatusColor])

  // Préparer les données pour le graphique (uniquement les statuts fondamentaux)
  // Mémorisé pour éviter les recalculs constants qui causent la boucle infinie
  const chartData = useMemo(() => {
    if (!stats?.by_status_label) return []

    return Object.entries(stats.by_status_label)
      .map(([label, count]) => {
        const color = getStatusColor(label)
        return {
          name: label,
          value: count,
          isCheck: false,
          color: color, // Ajouter la couleur directement dans les données
        }
      })
      .filter((item) => item.value > 0 && fundamentalStatuses.includes(item.name))
      .sort((a, b) => {
        // Trier selon l'ordre des statuts fondamentaux
        const indexA = fundamentalStatuses.indexOf(a.name)
        const indexB = fundamentalStatuses.indexOf(b.name)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
  }, [stats?.by_status_label, fundamentalStatuses, getStatusColor])

  // Mémoriser les cellules avec leurs couleurs pour éviter les recalculs
  const chartCells = useMemo(() => {
    if (chartData.length === 0) return []
    return chartData.map((entry, index) => {
      const statusColor = entry.color || getStatusColor(entry.name)

      return (
        <Cell
          key={`cell-${index}`}
          fill={statusColor}
          style={{
            cursor: "pointer",
          }}
        />
      )
    })
  }, [chartData, getStatusColor])

  const handleBarClick = useCallback((data: any, index: number, event: any) => {
    const clickedBar = chartData[index]

    // Gérer le clic sur les barres de statut
    if (clickedBar?.name) {
      // Mapper le label vers le code de statut
      const labelToCodeMap: Record<string, string> = {
        "Demandé": "DEMANDE",
        "Devis envoyé": "DEVIS_ENVOYE",
        "Devis Envoyé": "DEVIS_ENVOYE",
        "Visite technique": "VISITE_TECHNIQUE",
        "Visite Technique": "VISITE_TECHNIQUE",
        "Accepté": "ACCEPTE",
        "Inter en cours": "INTER_EN_COURS",
        "En cours": "INTER_EN_COURS",
        "Inter terminée": "INTER_TERMINEE",
        "Inter Terminée": "INTER_TERMINEE",
        "Terminé": "INTER_TERMINEE",
        "SAV": "SAV",
        "Stand-by": "STAND_BY",
        "Refusé": "REFUSE",
        "Annulé": "ANNULE",
        "Att. acompte": "ATT_ACOMPTE",
      }

      const statusCode = labelToCodeMap[clickedBar.name]
      if (statusCode) {
        // Mapping des codes de statuts vers les IDs de vues pour navigation directe
        const statusToViewId: Record<string, string> = {
          "DEMANDE": "mes-demandes",
          "INTER_EN_COURS": "ma-liste-en-cours",
          "VISITE_TECHNIQUE": "mes-visites-technique",
          "ACCEPTE": "ma-liste-accepte",
          "ATT_ACOMPTE": "ma-liste-att-acompte",
        }

        navigateWithModifier({
          router,
          path: "/interventions",
          event,
          sessionStorageKey: 'pending-intervention-filter',
          sessionStorageValue: {
            viewId: statusToViewId[statusCode] || "liste-generale",
            statusFilter: statusCode,
            ...(viewMode === "year" && statsFilterPeriod ? {
              startDate: statsFilterPeriod.startDate,
              endDate: statsFilterPeriod.endDate
            } : {})
          }
        })
      }
    }
  }, [chartData, router])

  if (loading) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30 hover:shadow-lg hover:border-border/50 transition-all duration-300">
        <CardHeader>
          <CardTitle
            className={userId ? "cursor-pointer hover:text-primary transition-colors" : ""}
            onClick={(e) => {
              e.stopPropagation()
              if (userId) {
                sessionStorage.setItem('pending-intervention-filter', JSON.stringify({
                  viewId: "liste-generale",
                  property: "attribueA",
                  operator: "eq",
                  value: userId
                }))
                router.push("/interventions")
              }
            }}
          >
            Mes interventions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[350px]">
            <div style={{ transform: 'scale(1.25)' }}>
              <Loader />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30 hover:shadow-lg hover:border-border/50 transition-all duration-300">
        <CardHeader>
          <CardTitle
            className={userId ? "cursor-pointer hover:text-primary transition-colors" : ""}
            onClick={(e) => {
              e.stopPropagation()
              if (userId) {
                sessionStorage.setItem('pending-intervention-filter', JSON.stringify({
                  viewId: "liste-generale",
                  property: "attribueA",
                  operator: "eq",
                  value: userId
                }))
                router.push("/interventions")
              }
            }}
          >
            Mes interventions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!userId) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30 hover:shadow-lg hover:border-border/50 transition-all duration-300">
        <CardHeader>
          <CardTitle>Mes interventions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Veuillez vous connecter pour voir vos statistiques
          </p>
        </CardContent>
      </Card>
    )
  }

  if (chartData.length === 0) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30 hover:shadow-lg hover:border-border/50 transition-all duration-300">
        <CardHeader>
          <CardTitle
            className={userId ? "cursor-pointer hover:text-primary transition-colors" : ""}
            onClick={(e) => {
              e.stopPropagation()
              if (userId) {
                sessionStorage.setItem('pending-intervention-filter', JSON.stringify({
                  viewId: "liste-generale",
                  property: "attribueA",
                  operator: "eq",
                  value: userId
                }))
                router.push("/interventions")
              }
            }}
          >
            Mes interventions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucune intervention trouvée pour cette période
          </p>
        </CardContent>
      </Card>
    )
  }


  return (
    <Card
      className="bg-background border-border/5 shadow-sm/30 hover:shadow-lg hover:border-border/50 transition-all duration-300"
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle
          className="cursor-pointer hover:text-primary transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            if (userId) {
              navigateWithModifier({
                router,
                path: "/interventions",
                event: e,
                sessionStorageKey: 'pending-intervention-filter',
                sessionStorageValue: {
                  property: "attribueA",
                  operator: "eq",
                  value: userId
                }
              })
            }
          }}
        >
          Mes interventions
        </CardTitle>

        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "all" | "year")}
          className="h-8"
        >
          <TabsList className="h-8 p-1 bg-muted/50">
            <TabsTrigger value="all" className="h-6 text-[11px] px-3 font-medium">
              Tout
            </TabsTrigger>
            <TabsTrigger value="year" className="h-6 text-[11px] px-3 font-medium flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              {currentYear}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="px-2 pt-2">
        <div className="w-full overflow-x-auto">
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 50, left: 120, bottom: 25 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
              <XAxis
                type="number"
                hide={false}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                domain={[0, 'dataMax + 10']}
              />
              <YAxis
                type="category"
                dataKey="name"
                hide={false}
                width={110}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fontWeight: 500, fill: "hsl(var(--foreground))" }}
              />
              <ChartTooltip
                cursor={false}
                content={() => null}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                onClick={handleBarClick}
                isAnimationActive={false} // Disable Recharts animation to avoid StrictMode setState loop
                barSize={32}
              >
                <LabelList
                  dataKey="value"
                  position="right"
                  offset={10}
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    fill: "hsl(var(--foreground))",
                    pointerEvents: 'none'
                  }}
                />
                {chartCells}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        {/* Bloc spécial "Interventions à checker" */}
        {stats && (stats.interventions_a_checker ?? 0) > 0 && (
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={(e) => {
                e.stopPropagation()
                navigateWithModifier({
                  router,
                  path: "/interventions",
                  event: e,
                  sessionStorageKey: 'pending-intervention-filter',
                  sessionStorageValue: {
                    viewId: "mes-interventions-a-check", // Redirige vers la vue spécifique
                    property: "isCheck",
                    operator: "eq",
                    value: true,
                    ...(viewMode === "year" && statsFilterPeriod ? {
                      startDate: statsFilterPeriod.startDate,
                      endDate: statsFilterPeriod.endDate
                    } : {})
                  }
                })
              }}
              className="w-full flex items-center justify-between p-3 rounded-lg border bg-red-50 border-red-200 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-900">Interventions à checker</span>
              </div>
              <span className="text-sm font-semibold text-red-700">{stats.interventions_a_checker}</span>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
