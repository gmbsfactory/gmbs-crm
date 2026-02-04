"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { interventionsApi } from "@/lib/api/v2"
import type { InterventionStatsByStatus } from "@/lib/api/v2"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { AlertCircle } from "lucide-react"
import Loader from "@/components/ui/Loader"
import { Pie, PieChart, Cell, LabelList } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import useModal from "@/hooks/useModal"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { INTERVENTION_STATUS } from "@/config/interventions"
import { useInterventionStatuses } from "@/hooks/useInterventionStatuses"
import { getMetierColor } from "@/config/metier-colors"
import { InterventionStatusContent } from "./intervention-status-content"
import { navigateWithModifier } from "@/lib/utils/navigation"

interface InterventionStatsPieChartProps {
  period?: {
    startDate?: string
    endDate?: string
  }
}

export function InterventionStatsPieChart({ period }: InterventionStatsPieChartProps) {
  const [stats, setStats] = useState<InterventionStatsByStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { open: openModal } = useModal()
  const { open: openInterventionModal } = useInterventionModal()
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null)
  const [hoveredSegmentIndex, setHoveredSegmentIndex] = useState<number | null>(null)
  const [hoverCardOpen, setHoverCardOpen] = useState(false)
  const triggerPositionRef = useRef<{ x: number; y: number } | null>(null)
  const fixedTriggerPositionRef = useRef<{ x: number; y: number } | null>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const router = useRouter()

  // Utiliser le hook React Query pour charger l'utilisateur (cache partagé)
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser()
  const userId = currentUser?.id ?? null

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

  // Suivre la position de la souris pour positionner le trigger du HoverCard
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!hoverCardOpen) {
        triggerPositionRef.current = { x: event.clientX, y: event.clientY }
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [hoverCardOpen])

  // Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Charger les statistiques une fois l'utilisateur chargé
  useEffect(() => {
    if (!userId || isLoadingUser) {
      setLoading(isLoadingUser)
      return
    }

    let cancelled = false

    const loadStats = async () => {
      try {
        setLoading(true)
        setError(null)

        // Calculer les dates si non fournies (mois en cours par défaut)
        let startDate = period?.startDate
        let endDate = period?.endDate

        if (!startDate || !endDate) {
          const now = new Date()
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

          startDate = startDate || startOfMonth.toISOString()
          endDate = endDate || endOfMonth.toISOString()
        }

        // Charger les stats
        const statsData = await interventionsApi.getStatsByUser(userId, startDate, endDate)

        if (!cancelled) {
          setStats(statsData)
          setLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Erreur lors du chargement des statistiques")
          setLoading(false)
        }
      }
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [userId, isLoadingUser, period?.startDate, period?.endDate])

  // Fonction helper pour obtenir la couleur d'un statut
  const getStatusColor = (statusLabel: string): string => {
    // Cas spécial pour "Check" qui n'est pas dans INTERVENTION_STATUS
    if (statusLabel === "Check") {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Dashboard Colors] "Check" → #EF4444 (statut spécial)`)
      }
      return "#EF4444"
    }

    // 1. PRIORITÉ : Chercher dans la DB par label
    const dbStatusByLabel = statusesByLabel.get(statusLabel.toLowerCase())
    if (dbStatusByLabel?.color) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Dashboard Colors] "${statusLabel}" → DB (${dbStatusByLabel.code}) → ${dbStatusByLabel.color}`)
      }
      return dbStatusByLabel.color
    }

    // 2. Chercher dans la DB par code
    const labelToCodeMap: Record<string, string> = {
      "Inter en cours": "INTER_EN_COURS",
      "Inter terminée": "INTER_TERMINEE",
      "Inter Terminée": "INTER_TERMINEE",
      "En cours": "INTER_EN_COURS", // Alias legacy
      "Terminé": "INTER_TERMINEE", // Alias legacy
      "Visite technique": "VISITE_TECHNIQUE",
      "Visite Technique": "VISITE_TECHNIQUE",
      "Devis envoyé": "DEVIS_ENVOYE",
      "Devis Envoyé": "DEVIS_ENVOYE",
    }

    const mappedCode = labelToCodeMap[statusLabel]
    if (mappedCode) {
      const dbStatusByCode = statusesByCode.get(mappedCode)
      if (dbStatusByCode?.color) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Dashboard Colors] "${statusLabel}" → DB (${mappedCode}) → ${dbStatusByCode.color}`)
        }
        return dbStatusByCode.color
      }
    }

    // 3. Chercher dans INTERVENTION_STATUS (fallback)
    const normalizedLabel = statusLabel === "Inter en cours" ? "En cours" : statusLabel
    const statusConfig = Object.values(INTERVENTION_STATUS).find(
      s => s.label === normalizedLabel || s.label.toLowerCase() === normalizedLabel.toLowerCase()
    )

    if (statusConfig?.hexColor) {
      console.warn(`[Dashboard Colors] "${statusLabel}" → INTERVENTION_STATUS (${statusConfig.value}) → ${statusConfig.hexColor} (fallback, pas en DB)`)
      return statusConfig.hexColor
    }

    // 4. Dernier fallback
    const fallbackColor = "#6366F1" // Couleur par défaut fixe
    console.warn(`[Dashboard Colors] "${statusLabel}" → FALLBACK → ${fallbackColor}`)
    return fallbackColor
  }

  // Statuts fondamentaux à afficher
  const fundamentalStatuses = ["Demandé", "Inter en cours", "Visite technique", "Accepté", "Check"]

  // Créer le chartConfig avec les couleurs pour chaque statut possible
  const chartConfig: ChartConfig = {
    value: {
      label: "Valeur",
      color: "hsl(var(--chart-1))",
    },
  }

  // Ajouter une entrée pour chaque statut possible dans le config
  fundamentalStatuses.forEach((status) => {
    chartConfig[status] = {
      label: status,
      color: getStatusColor(status),
    }
  })
  chartConfig["Check"] = {
    label: "Check",
    color: getStatusColor("Check"),
  }

  // Préparer les données pour le graphique
  const chartData = stats?.by_status_label
    ? Object.entries(stats.by_status_label)
      .map(([label, count]) => {
        const color = getStatusColor(label)
        return {
          name: label,
          value: count,
          isCheck: false,
          fill: color,
        }
      })
      .filter((item) => item.value > 0 && fundamentalStatuses.includes(item.name))
      .sort((a, b) => {
        const indexA = fundamentalStatuses.indexOf(a.name)
        const indexB = fundamentalStatuses.indexOf(b.name)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
      .concat(
        stats.interventions_a_checker && stats.interventions_a_checker > 0
          ? [
            {
              name: "Check",
              value: stats.interventions_a_checker,
              isCheck: true,
              fill: "#EF4444",
            },
          ]
          : []
      )
    : []

  // Composant pour afficher les deux labels (intérieur et extérieur)
  const CustomPieLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, payload } = props

    // Vérifier que les props nécessaires existent
    if (!cx || !cy || innerRadius === undefined || outerRadius === undefined || !payload) {
      return null
    }

    const RADIAN = Math.PI / 180

    // Position pour le label intérieur (nombre)
    const innerRadius_pos = innerRadius + (outerRadius - innerRadius) * 0.5
    const innerX = cx + innerRadius_pos * Math.cos(-midAngle * RADIAN)
    const innerY = cy + innerRadius_pos * Math.sin(-midAngle * RADIAN)

    // Position pour le label extérieur (nom)
    const outerRadius_pos = outerRadius + 30
    const outerX = cx + outerRadius_pos * Math.cos(-midAngle * RADIAN)
    const outerY = cy + outerRadius_pos * Math.sin(-midAngle * RADIAN)

    return (
      <g>
        {/* Label intérieur - nombre */}
        <text
          x={innerX}
          y={innerY}
          fill="currentColor"
          textAnchor={innerX > cx ? 'start' : 'end'}
          dominantBaseline="central"
          className="fill-foreground font-semibold text-sm"
        >
          {payload.value}
        </text>
        {/* Label extérieur - nom */}
        <text
          x={outerX}
          y={outerY}
          fill="currentColor"
          textAnchor={outerX > cx ? 'start' : 'end'}
          dominantBaseline="central"
          className="fill-foreground text-sm font-medium"
        >
          {payload.name}
        </text>
      </g>
    )
  }

  if (loading) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30 hover:shadow-lg hover:border-border/50 transition-all duration-300">
        <CardHeader>
          <CardTitle>Mes interventions</CardTitle>
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
          <CardTitle>Mes interventions</CardTitle>
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
          <CardTitle>Mes interventions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucune intervention trouvée pour cette période
          </p>
        </CardContent>
      </Card>
    )
  }

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

  // Fonction pour assombrir une couleur hex
  const adjustColor = (color: string, amount: number) => {
    const hex = color.replace('#', '')
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount))
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount))
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount))
    return `#${[r, g, b].map(x => {
      const hex = x.toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')}`
  }

  return (
    <Card
      className="bg-background border-border/5 shadow-sm/30 hover:shadow-lg hover:border-border/50 transition-all duration-300"
    >
      <CardHeader>
        <CardTitle>Mes interventions</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-2">
        <div className="w-full flex items-center justify-center">
          <ChartContainer config={chartConfig} className="h-[350px] w-full max-w-md">
            <PieChart>
              {/* Désactiver le tooltip de Recharts pour éviter le double hover */}
              <ChartTooltip
                content={() => null}
                cursor={false}
              />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                labelLine={false}
                label={<CustomPieLabel />}
                onMouseEnter={(data: any, index: number) => {
                  if (closeTimeoutRef.current) {
                    clearTimeout(closeTimeoutRef.current)
                    closeTimeoutRef.current = null
                  }

                  setHoveredSegmentIndex(index)

                  const statusLabel = chartData[index]?.name
                  if (statusLabel) {
                    fixedTriggerPositionRef.current = triggerPositionRef.current || {
                      x: window.innerWidth / 2,
                      y: window.innerHeight / 2
                    }
                    setHoveredStatus(statusLabel)
                    setHoverCardOpen(true)
                  }
                }}
                onMouseLeave={() => {
                  setHoveredSegmentIndex(null)
                  closeTimeoutRef.current = setTimeout(() => {
                    setHoverCardOpen(false)
                    setTimeout(() => {
                      setHoveredStatus(null)
                      fixedTriggerPositionRef.current = null
                    }, 150)
                    closeTimeoutRef.current = null
                  }, 500)
                }}
                onClick={(data: any, index: number, event: any) => {
                  const clickedSegment = chartData[index]
                  if (clickedSegment?.isCheck) {
                    navigateWithModifier({
                      router,
                      path: "/interventions",
                      event,
                      sessionStorageKey: 'pending-intervention-filter',
                      sessionStorageValue: {
                        viewId: "mes-interventions-a-check",
                        property: "isCheck",
                        operator: "eq",
                        value: true
                      }
                    })
                  }
                }}
              >
                {chartData.map((entry, index) => {
                  const statusColor = entry.fill || getStatusColor(entry.name)
                  const isHovered = hoveredSegmentIndex === index
                  const hoverColor = isHovered ? adjustColor(statusColor, -20) : statusColor

                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={hoverColor}
                      style={{
                        cursor: "pointer",
                        transition: "fill 0.2s ease-in-out",
                      }}
                    />
                  )
                })}
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>

        {/* HoverCard pour afficher les détails au survol */}
        {hoveredStatus && fixedTriggerPositionRef.current && (
          <HoverCard
            open={hoverCardOpen}
            onOpenChange={(open) => {
              setHoverCardOpen(open)
              if (open && closeTimeoutRef.current) {
                clearTimeout(closeTimeoutRef.current)
                closeTimeoutRef.current = null
              }
              if (!open) {
                setTimeout(() => {
                  setHoveredStatus(null)
                  fixedTriggerPositionRef.current = null
                }, 100)
              }
            }}
            openDelay={150}
            closeDelay={400}
          >
            <HoverCardTrigger asChild>
              <div
                className="fixed pointer-events-none z-0"
                style={{
                  left: `${fixedTriggerPositionRef.current.x}px`,
                  top: `${fixedTriggerPositionRef.current.y}px`,
                  width: 16,
                  height: 16,
                }}
                aria-hidden="true"
              />
            </HoverCardTrigger>
            <HoverCardContent
              className="w-96 max-h-[500px] overflow-y-auto z-50"
              side="right"
              align="start"
              sideOffset={12}
              onMouseEnter={() => {
                if (closeTimeoutRef.current) {
                  clearTimeout(closeTimeoutRef.current)
                  closeTimeoutRef.current = null
                }
              }}
              onMouseLeave={() => {
                if (closeTimeoutRef.current) {
                  clearTimeout(closeTimeoutRef.current)
                }
                closeTimeoutRef.current = setTimeout(() => {
                  setHoverCardOpen(false)
                  closeTimeoutRef.current = null
                }, 300)
              }}
            >
              <InterventionStatusContent
                userId={userId}
                statusLabel={hoveredStatus}
                onOpenIntervention={(id: string) => openInterventionModal(id)}
                period={period}
              />
            </HoverCardContent>
          </HoverCard>
        )}

        {/* Ligne pour les interventions à checker */}
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
                    viewId: "mes-interventions-a-check",
                    property: "isCheck",
                    operator: "eq",
                    value: true
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

