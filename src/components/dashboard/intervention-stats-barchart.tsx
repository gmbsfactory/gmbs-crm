"use client"

import { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { interventionsApi } from "@/lib/api/v2"
import type { InterventionStatsByStatus } from "@/lib/api/v2"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useDashboardStats } from "@/hooks/useDashboardStats"
import { AlertCircle } from "lucide-react"
import Loader from "@/components/ui/Loader"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis, Cell } from "recharts"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import useModal from "@/hooks/useModal"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { getInterventionStatusColor } from "@/config/status-colors"
import { INTERVENTION_STATUS } from "@/config/interventions"
import { useInterventionStatuses } from "@/hooks/useInterventionStatuses"
import { getMetierColor } from "@/config/metier-colors"

interface InterventionStatsBarChartProps {
  period?: {
    startDate?: string
    endDate?: string
  }
  userId?: string | null
}

// Déplacer les composants de labels EN DEHORS du composant pour éviter leur recréation
const CustomValueLabel = (props: any) => {
  const { x, y, width, value } = props
  
  if (x === undefined || y === undefined || width === undefined || value === undefined) {
    return null
  }
  
  // Si la barre est assez large (>80px), mettre le nombre à l'intérieur à droite
  // Sinon, le mettre à l'extérieur pour éviter qu'il dépasse
  if (width > 80) {
    return (
      <text
        x={x + width - 8}
        y={y + 12}
        fill="hsl(var(--foreground))"
        textAnchor="end"
        fontSize={12}
        fontWeight={600}
      >
        {value}
      </text>
    )
  } else {
    // Barre trop petite, mettre le nombre à l'extérieur
    return (
      <text
        x={x + width + 8}
        y={y + 12}
        fill="hsl(var(--foreground))"
        textAnchor="start"
        fontSize={12}
        fontWeight={600}
      >
        {value}
      </text>
    )
  }
}

const CustomNameLabel = (props: any) => {
  const { x, y, width, value } = props
  
  if (x === undefined || y === undefined || width === undefined || value === undefined) {
    return null
  }
  
  // Calculer la largeur approximative du texte (environ 7px par caractère)
  const textWidth = value.length * 7
  
  // Si la barre est très petite (<50px), mettre le nom à l'extérieur à gauche
  if (width < 50) {
    return (
      <text
        x={x - 8}
        y={y + 12}
        fill="hsl(var(--foreground))"
        textAnchor="end"
        fontSize={11}
        fontWeight={500}
      >
        {value}
      </text>
    )
  }
  
  // Si le texte dépasse mais la barre est moyenne, tronquer avec "..."
  if (textWidth > width - 16 && width < 80) {
    const maxChars = Math.floor((width - 24) / 7) // -24 pour l'espace et "..."
    const truncated = value.substring(0, Math.max(1, maxChars)) + "..."
    return (
      <text
        x={x + 8}
        y={y + 12}
        fill="#FFFFFF"
        textAnchor="start"
        fontSize={12}
        fontWeight={600}
      >
        {truncated}
      </text>
    )
  }
  
  // Sinon, afficher normalement à l'intérieur
  return (
    <text
      x={x + 8}
      y={y + 12}
      fill="#FFFFFF"
      textAnchor="start"
      fontSize={12}
      fontWeight={600}
    >
      {value}
    </text>
  )
}

export function InterventionStatsBarChart({ period, userId: propUserId }: InterventionStatsBarChartProps) {
  const { open: openModal } = useModal()
  const { open: openInterventionModal } = useInterventionModal()
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null)
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null)
  const [hoverCardOpen, setHoverCardOpen] = useState(false)
  const triggerPositionRef = useRef<{ x: number; y: number } | null>(null)
  const fixedTriggerPositionRef = useRef<{ x: number; y: number } | null>(null)
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Cache optimisé avec timestamp pour expiration
  const interventionsCacheRef = useRef<Map<string, {
    data: Array<{
      id: string;
      id_inter: string | null;
      due_date: string | null;
      status_label: string | null;
      status_color: string | null;
      agence_label: string | null;
      metier_label: string | null;
      metier_code: string | null;
      marge: number;
    }>;
    timestamp: number;
  }>>(new Map())
  
  const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes de cache
  
  const router = useRouter()

  // Utiliser le hook React Query pour charger l'utilisateur (cache partagé)
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser()
  // Utiliser le prop userId s'il est fourni, sinon utiliser currentUser
  const userId = propUserId ?? currentUser?.id ?? null

  // Normaliser period pour correspondre au type attendu par useDashboardStats
  const normalizedPeriod = period?.startDate && period?.endDate
    ? { startDate: period.startDate, endDate: period.endDate }
    : null

  // Utiliser TanStack Query pour charger les stats (cache partagé et déduplication automatique)
  const { data: stats, isLoading: loading, error: queryError } = useDashboardStats(normalizedPeriod, userId)
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

  // Suivre la position de la souris pour positionner le trigger du HoverCard
  // Utiliser une ref pour éviter les re-enregistrements du listener
  const hoverCardOpenRef = useRef(false)
  useEffect(() => {
    hoverCardOpenRef.current = hoverCardOpen
  }, [hoverCardOpen])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Mettre à jour seulement si le HoverCard n'est pas ouvert
      // Utiliser la ref pour éviter les re-renders
      if (!hoverCardOpenRef.current) {
        triggerPositionRef.current = { x: event.clientX, y: event.clientY }
      }
    }

    window.addEventListener("mousemove", handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, []) // Plus de dépendance sur hoverCardOpen

  // Nettoyer le timeout au démontage
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  // Créer une version stable de la liste des statuts pour éviter les boucles infinies
  // Utiliser une sérialisation JSON pour comparer le contenu plutôt que la référence
  const statsByStatusLabelKey = useMemo(() => {
    if (!stats?.by_status_label) return null
    return JSON.stringify(stats.by_status_label)
  }, [stats?.by_status_label])


  // Statuts fondamentaux à afficher
  const fundamentalStatuses = useMemo(() => ["Demandé", "Inter en cours", "Visite technique", "Accepté", "Check"], [])

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
      .concat(
        // Ajouter la barre "Check" si elle existe
        stats.interventions_a_checker && stats.interventions_a_checker > 0
          ? [
              {
                name: "Check",
                value: stats.interventions_a_checker,
                isCheck: true,
                color: "#EF4444", // Rouge pour Check
              },
            ]
          : []
      )
  }, [stats?.by_status_label, stats?.interventions_a_checker, fundamentalStatuses, getStatusColor])

  // Tous les hooks doivent être appelés AVANT les retours conditionnels
  // Fonction pour assombrir une couleur hex - mémorisée avec useCallback
  const adjustColor = useCallback((color: string, amount: number) => {
    // Convertir hex en RGB
    const hex = color.replace('#', '')
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount))
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount))
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount))
    return `#${[r, g, b].map(x => {
      const hex = x.toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')}`
  }, [])

  // Mémoriser les cellules avec leurs couleurs pour éviter les recalculs
  const chartCells = useMemo(() => {
    if (chartData.length === 0) return []
    return chartData.map((entry, index) => {
      const statusColor = entry.color || getStatusColor(entry.name)
      const isHovered = hoveredBarIndex === index
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
    })
  }, [chartData, hoveredBarIndex, adjustColor, getStatusColor])

  // Mémoriser les handlers pour éviter les recréations
  const handleBarMouseEnter = useCallback((data: any, index: number) => {
    // Annuler tout timeout de fermeture en cours
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    
    setHoveredBarIndex(index)
    
    const statusLabel = chartData[index]?.name
    if (statusLabel) {
      // Fixer la position du trigger au moment de l'ouverture
      const position = triggerPositionRef.current || { 
        x: window.innerWidth / 2, 
        y: window.innerHeight / 2 
      }
      fixedTriggerPositionRef.current = position
      // Mettre à jour l'état pour déclencher le re-render
      setTriggerPosition({
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: 16,
        height: 16,
      })
      setHoveredStatus(statusLabel)
      setHoverCardOpen(true)
    }
  }, [chartData])

  const handleBarMouseLeave = useCallback(() => {
    setHoveredBarIndex(null)
    // Ne pas fermer immédiatement - laisser un délai plus long pour permettre
    // de déplacer la souris vers le HoverCard de manière fluide
    closeTimeoutRef.current = setTimeout(() => {
      setHoverCardOpen(false)
      // Nettoyer les positions après la fermeture
      setTimeout(() => {
        setHoveredStatus(null)
        fixedTriggerPositionRef.current = null
        setTriggerPosition(null)
      }, 150)
      closeTimeoutRef.current = null
    }, 500) // Délai plus long pour une transition très fluide
  }, [])

  const handleBarClick = useCallback((data: any, index: number) => {
    const clickedBar = chartData[index]
    if (clickedBar?.isCheck) {
      sessionStorage.setItem('pending-intervention-filter', JSON.stringify({
        property: "isCheck",
        operator: "eq",
        value: true
      }))
      router.push("/interventions")
    }
  }, [chartData, router])

  // État pour suivre la position du trigger (les refs ne déclenchent pas de re-renders)
  const [triggerPosition, setTriggerPosition] = useState<{ left: string; top: string; width: number; height: number } | null>(null)

  // Précharger les données des interventions pour tous les statuts visibles
  // Cela garantit un affichage instantané au survol
  // Utiliser des dépendances stables pour éviter les boucles infinies
  useEffect(() => {
    if (!userId || !stats?.by_status_label || !period?.startDate || !period?.endDate) return

    const preloadInterventions = async () => {
      const startDate = period.startDate
      const endDate = period.endDate

      // Précharger les données pour chaque statut visible en parallèle
      // Utiliser directement stats.by_status_label au lieu de chartData pour éviter les dépendances circulaires
      const statusLabels = Object.entries(stats.by_status_label)
        .filter(([label, count]) => count > 0 && fundamentalStatuses.includes(label))
        .map(([label]) => label)

      const preloadPromises = statusLabels.map(async (statusLabel) => {
        const cacheKey = `${statusLabel}-${startDate}-${endDate}`
        
        // Vérifier si déjà en cache
        const cachedEntry = interventionsCacheRef.current.get(cacheKey)
        const isCacheValid = cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION)
        
        if (isCacheValid) {
          return // Déjà en cache, pas besoin de recharger
        }

        try {
          // Précharger en arrière-plan sans bloquer
          const data = await interventionsApi.getRecentInterventionsByStatusAndUser(
            userId,
            statusLabel,
            5,
            startDate,
            endDate
          )
          
          // Mettre en cache
          interventionsCacheRef.current.set(cacheKey, {
            data,
            timestamp: Date.now()
          })
        } catch (err) {
          // Ignorer les erreurs de préchargement silencieusement
          console.warn(`[Dashboard] Erreur préchargement ${statusLabel}:`, err)
        }
      })

      // Lancer tous les préchargements en parallèle sans attendre
      Promise.all(preloadPromises).catch(() => {
        // Ignorer les erreurs
      })
    }

    preloadInterventions()
  }, [userId, statsByStatusLabelKey, period, fundamentalStatuses, CACHE_DURATION, stats?.by_status_label])

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

  // Composant pour afficher les interventions dans le tooltip avec format conditionnel selon le statut
  const InterventionStatusContent = ({ 
    statusLabel,
    onOpenIntervention,
    period
  }: { 
    statusLabel: string
    onOpenIntervention: (id: string) => void
    period?: { startDate?: string; endDate?: string }
  }) => {
    // Créer la clé de cache avec useMemo pour éviter les recalculs
    const cacheKey = useMemo(() => 
      `${statusLabel}-${period?.startDate || ''}-${period?.endDate || ''}`,
      [statusLabel, period?.startDate, period?.endDate]
    )

    // Vérifier le cache immédiatement pour initialiser le state
    const getCachedData = () => {
      const cachedEntry = interventionsCacheRef.current.get(cacheKey)
      const isValid = cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION)
      return isValid ? cachedEntry.data : null
    }
    
    // Initialiser directement avec les données du cache si disponibles
    const [interventionsData, setInterventionsData] = useState<Array<{
      id: string;
      id_inter: string | null;
      due_date: string | null;
      status_label: string | null;
      status_color: string | null;
      agence_label: string | null;
      metier_label: string | null;
      metier_code: string | null;
      marge: number;
    }> | null>(getCachedData())
    
    // Ne pas afficher le loading si on a déjà des données en cache
    const [loading, setLoading] = useState(() => getCachedData() === null)
    const [error, setError] = useState<string | null>(null)

    // Charger les données seulement si nécessaire (pas en cache)
    useEffect(() => {
      if (!userId || !statusLabel) return

      // Vérifier le cache à nouveau dans le useEffect
      const cachedEntry = interventionsCacheRef.current.get(cacheKey)
      const isCacheValid = cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_DURATION)
      
      // Si le cache est valide, mettre à jour les données et ne rien faire d'autre
      if (isCacheValid) {
        setInterventionsData(cachedEntry.data)
        setLoading(false)
        return
      }

      // Si pas en cache, charger (normalement ça ne devrait jamais arriver grâce au préchargement)
      let cancelled = false

      const loadData = async () => {
        try {
          setLoading(true)
          setError(null)
          const data = await interventionsApi.getRecentInterventionsByStatusAndUser(
            userId, 
            statusLabel,
            5,
            period?.startDate,
            period?.endDate
          )
          if (!cancelled) {
            // Mettre en cache avec timestamp
            interventionsCacheRef.current.set(cacheKey, {
              data,
              timestamp: Date.now()
            })
            setInterventionsData(data)
            setLoading(false)
          }
        } catch (err: any) {
          if (!cancelled) {
            setError(err.message || "Erreur lors du chargement")
            setLoading(false)
          }
        }
      }

      loadData()

      return () => {
        cancelled = true
      }
    }, [statusLabel, cacheKey, period])

    // 🚀 OPTIMISATION: Supprimé le setInterval de cleanup cache (redondant)
    // Le cache expire naturellement via la vérification isCacheValid lors du chargement

    if (loading) {
      return (
        <div className="flex items-center justify-center p-4">
          <div style={{ transform: 'scale(0.75)' }}>
            <Loader />
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="text-sm text-destructive p-2">
          Erreur de chargement
        </div>
      )
    }

    if (!interventionsData || interventionsData.length === 0) {
      return (
        <div className="text-sm text-muted-foreground p-2">
          Aucune intervention pour ce statut
        </div>
      )
    }

    // Déterminer le format d'affichage selon le statut
    const isDemandeStatus = statusLabel === "Demandé"

    return (
      <div className="space-y-3">
        <h4 className="font-semibold text-sm mb-2">{statusLabel}</h4>
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {interventionsData.map((intervention) => (
            <div
              key={intervention.id}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1.5 rounded transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onOpenIntervention(intervention.id)
              }}
            >
              <div 
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: intervention.status_color || "#6366F1" }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">
                  {intervention.id_inter || "N/A"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isDemandeStatus ? (
                    <>
                      Métier : <span style={{ color: getMetierColor(intervention.metier_code, intervention.metier_label) }}>{intervention.metier_label || "N/A"}</span> | Agence : {intervention.agence_label || "N/A"} | Due date : {intervention.due_date ? formatDate(intervention.due_date) : "N/A"}
                    </>
                  ) : (
                    <>
                      Métier : <span style={{ color: getMetierColor(intervention.metier_code, intervention.metier_label) }}>{intervention.metier_label || "N/A"}</span> | Marge : {formatCurrency(intervention.marge)} | Due date : {intervention.due_date ? formatDate(intervention.due_date) : "N/A"}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }


  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Card 
          className="bg-background border-border/5 shadow-sm/30 hover:shadow-lg hover:border-border/50 transition-all duration-300"
        >
          <CardHeader>
            <CardTitle 
              className="cursor-pointer hover:text-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                if (userId) {
                  // Stocker l'intention de filtre dans sessionStorage
                  sessionStorage.setItem('pending-intervention-filter', JSON.stringify({
                    property: "attribueA",
                    operator: "eq",
                    value: userId
                  }))
                  // Naviguer vers la page interventions
                  router.push("/interventions")
                }
              }}
            >
              Mes interventions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pt-2">
            <div className="w-full overflow-x-auto">
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    hide
                  />
                  <ChartTooltip
                    cursor={false}
                    content={() => null}
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 4, 4, 0]}
                    onMouseEnter={handleBarMouseEnter}
                    onMouseLeave={handleBarMouseLeave}
                    onClick={handleBarClick}
                    isAnimationActive={false} // Disable Recharts animation to avoid StrictMode setState loop
                  >
                    <LabelList
                      dataKey="name"
                      content={<CustomNameLabel />}
                    />
                    <LabelList
                      dataKey="value"
                      content={<CustomValueLabel />}
                    />
                    {chartCells}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>

            {/* HoverCard pour afficher les détails au survol */}
            {hoveredStatus && triggerPosition && (
              <HoverCard 
                open={hoverCardOpen} 
                onOpenChange={(open) => {
                  setHoverCardOpen(open)
                  // Annuler le timeout si on rouvre le HoverCard
                  if (open && closeTimeoutRef.current) {
                    clearTimeout(closeTimeoutRef.current)
                    closeTimeoutRef.current = null
                  }
                  if (!open) {
                    // Nettoyer le statut et la position fixe après un court délai
                    setTimeout(() => {
                      setHoveredStatus(null)
                      fixedTriggerPositionRef.current = null
                      setTriggerPosition(null)
                    }, 100)
                  }
                }} 
                openDelay={150} 
                closeDelay={400}
              >
                <HoverCardTrigger asChild>
                  <div
                    className="fixed pointer-events-none z-0"
                    style={triggerPosition}
                    aria-hidden="true"
                  />
                </HoverCardTrigger>
                <HoverCardContent
                  className="w-96 max-h-[500px] overflow-y-auto z-50"
                  side="right"
                  align="start"
                  sideOffset={12}
                  onMouseEnter={() => {
                    // Annuler le timeout quand on entre dans le HoverCard
                    if (closeTimeoutRef.current) {
                      clearTimeout(closeTimeoutRef.current)
                      closeTimeoutRef.current = null
                    }
                  }}
                  onMouseLeave={() => {
                    // Fermer le HoverCard quand on quitte son contenu avec un délai
                    // pour permettre de revenir rapidement si nécessaire
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
                    // Stocker l'intention de filtre dans sessionStorage
                    sessionStorage.setItem('pending-intervention-filter', JSON.stringify({
                      property: "isCheck",
                      operator: "eq",
                      value: true
                    }))
                    // Naviguer vers la page interventions
                    router.push("/interventions")
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
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => openModal("new", { content: "new-intervention" })} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle intervention
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
