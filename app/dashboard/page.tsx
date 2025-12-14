"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { InterventionStatsBarChart } from "@/components/dashboard/intervention-stats-barchart"
import { ArtisanStatsList } from "@/components/dashboard/artisan-stats-list"
import { MarginStatsCard } from "@/components/dashboard/margin-stats-card"
import { MarginTotalCard } from "@/components/dashboard/margin-total-card"
import { GestionnaireRankingPodium } from "@/components/dashboard/gestionnaire-ranking-podium"
import { WeeklyStatsTable } from "@/components/dashboard/weekly-stats-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { t } from "@/config/domain"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Plus, Shield } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { interventionsApi } from "@/lib/api/v2"
import { useRevealTransition } from "@/hooks/useRevealTransition"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useUserRoles } from "@/hooks/useUserRoles"
import useModal from "@/hooks/useModal"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { AvatarGroup, AvatarGroupTooltip } from "@/components/ui/avatar-group"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { useGestionnaires, type Gestionnaire } from "@/hooks/useGestionnaires"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { AppleBienvenueEffect } from "@/components/ui/shadcn-io/apple-hello-effect"
import {
  addDays,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfYear,
  format,
  getYear,
  parseISO,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "date-fns"
import { fr } from "date-fns/locale"

type PeriodType = "week" | "month" | "year"

const STORAGE_KEY = "dashboard-period-type"
const STORAGE_KEY_SELECTED = "dashboard-period-selected"

export default function DashboardPage() {
  // Initialiser avec "month" par défaut pour éviter les erreurs d'hydratation
  const [periodType, setPeriodType] = useState<PeriodType>("month")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("") // Format: "yyyy-MM" pour month, "yyyy-MM-dd" pour week, "yyyy" pour year
  const [isMounted, setIsMounted] = useState(false)
  const [totalInterventions, setTotalInterventions] = useState<number | null>(null)
  const [showTransition, setShowTransition] = useState(false)
  const [showBienvenue, setShowBienvenue] = useState(false)
  const [selectedGestionnaireId, setSelectedGestionnaireId] = useState<string | null>(null)
  const { open: openModal } = useModal()
  const artisanModal = useArtisanModal()
  const router = useRouter()
  
  // Utiliser le hook React Query pour charger l'utilisateur (cache partagé)
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser()
  const { data: gestionnaires = [], isLoading: isLoadingGestionnaires } = useGestionnaires()
  const { isAdmin } = useUserRoles()
  
  // Initialiser avec l'utilisateur courant par défaut
  useEffect(() => {
    if (currentUser?.id && !selectedGestionnaireId) {
      setSelectedGestionnaireId(currentUser.id)
    }
  }, [currentUser?.id, selectedGestionnaireId])
  
  // Fonction pour obtenir le nom d'affichage
  const getDisplayName = (gestionnaire: Gestionnaire) => {
    const parts = [
      gestionnaire.firstname || gestionnaire.prenom,
      gestionnaire.lastname || gestionnaire.name
    ].filter(Boolean)
    return parts.length > 0
      ? parts.join(" ")
      : gestionnaire.code_gestionnaire || gestionnaire.username || "Gestionnaire"
  }
  
  // Filtrer les données selon le gestionnaire sélectionné
  const effectiveUserId = selectedGestionnaireId || currentUser?.id || null
  
  // Références pour l'animation
  const dashboardContentRef = useRef<HTMLDivElement>(null)
  const loginIframeRef = useRef<HTMLIFrameElement>(null)
  
  // Hook pour l'animation de transition
  const {
    isAnimating,
    circleSizeMotion,
    buttonPosition,
    startAnimationFromPosition,
  } = useRevealTransition()

  // Charger depuis localStorage après le montage côté client
  useEffect(() => {
    setIsMounted(true)
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "week" || saved === "month" || saved === "year") {
      setPeriodType(saved as PeriodType)
    }
    const savedSelected = localStorage.getItem(STORAGE_KEY_SELECTED)
    if (savedSelected) {
      setSelectedPeriod(savedSelected)
    }
  }, [])

  // Détecter la transition depuis login et démarrer l'animation
  useEffect(() => {
    if (!isMounted) return

    const transitionData = sessionStorage.getItem('revealTransition')
    
    if (transitionData) {
      try {
        const data = JSON.parse(transitionData)
        const isRecent = Date.now() - data.timestamp < 5000
        
        if (data.from === 'login' && isRecent) {
          setShowTransition(true)
          setTimeout(() => {
            startAnimationFromPosition(data.buttonPosition)
          }, 100)
          // Délai de 2.5s avant d'afficher l'animation de bienvenue après connexion
          setTimeout(() => {
            setShowBienvenue(true)
          }, 2500)
        }
        // Toujours nettoyer sessionStorage, même si timestamp expiré
        // Cela évite que des données obsolètes persistent entre sessions
        sessionStorage.removeItem('revealTransition')
      } catch (e) {
        console.error('Erreur lors de la lecture des données de transition:', e)
        // Nettoyer en cas d'erreur aussi
        sessionStorage.removeItem('revealTransition')
      }
    }
    // Ne pas afficher l'animation si on ne vient pas de la page login
  }, [isMounted, startAnimationFromPosition])

  // Effect to check for lateness notification and show toast
  useEffect(() => {
    if (!isMounted || !currentUser?.id) return

    const checkLateness = async () => {
      try {
        // Check if we should show the lateness notification
        const checkResponse = await fetch('/api/lateness/check', {
          credentials: 'include',
          cache: 'no-store'
        })

        if (!checkResponse.ok) return

        const checkData = await checkResponse.json()

        if (checkData.showNotification && checkData.latenessCount > 0) {
          const message = `Tu as eu ${checkData.latenessCount} retard${checkData.latenessCount > 1 ? 's' : ''} cette année`

          toast.info(message, {
            duration: 8000,
            icon: '⏰',
            description: 'Pense à respecter les horaires de travail (8h00-18h00)'
          })
        }
      } catch (error) {
        console.error('Failed to check lateness:', error)
      }
    }

    checkLateness()
  }, [isMounted, currentUser?.id])

  // Appliquer le clipPath au contenu dashboard pendant l'animation
  useEffect(() => {
    if (!isAnimating || !buttonPosition || !dashboardContentRef.current) return

    // Optimiser avec requestAnimationFrame pour throttler les mises à jour
    let rafId: number | null = null
    const unsubscribe = circleSizeMotion.on('change', (size: number) => {
      if (rafId !== null) return // Ignorer si une frame est déjà planifiée
      
      rafId = requestAnimationFrame(() => {
        if (dashboardContentRef.current) {
          const clipPath = `circle(${size}px at ${buttonPosition.x}px ${buttonPosition.y}px)`
          const element = dashboardContentRef.current
          element.style.clipPath = clipPath
          ;(element.style as any).webkitClipPath = clipPath
        }
        rafId = null
      })
    })

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      unsubscribe()
    }
  }, [isAnimating, buttonPosition, circleSizeMotion])

  // Appliquer le mask inversé à l'iframe login pendant l'animation
  useEffect(() => {
    if (!isAnimating || !buttonPosition || !loginIframeRef.current) return

    // Optimiser avec requestAnimationFrame pour throttler les mises à jour
    let rafId: number | null = null
    const unsubscribe = circleSizeMotion.on('change', (size: number) => {
      if (rafId !== null) return // Ignorer si une frame est déjà planifiée
      
      rafId = requestAnimationFrame(() => {
        if (loginIframeRef.current) {
          const mask = size === 0
            ? 'black' // Tout visible au début
            : `radial-gradient(circle ${size}px at ${buttonPosition.x}px ${buttonPosition.y}px, transparent ${size}px, black ${size + 0.1}px)`
          const element = loginIframeRef.current
          element.style.mask = mask
          ;(element.style as any).webkitMask = mask
        }
        rafId = null
      })
    })

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      unsubscribe()
    }
  }, [isAnimating, buttonPosition, circleSizeMotion])

  // Nettoyer après la fin de l'animation (3 secondes)
  useEffect(() => {
    if (!isAnimating) return

    const timer = setTimeout(() => {
      if (dashboardContentRef.current) {
        dashboardContentRef.current.style.clipPath = 'none'
        ;(dashboardContentRef.current.style as any).webkitClipPath = 'none'
      }
      if (loginIframeRef.current) {
        loginIframeRef.current.style.display = 'none'
      }
      setShowTransition(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [isAnimating])

  // Sauvegarder dans localStorage quand la période change
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(STORAGE_KEY, periodType)
    }
  }, [periodType, isMounted])

  // Sauvegarder la sélection spécifique
  useEffect(() => {
    if (isMounted && selectedPeriod) {
      localStorage.setItem(STORAGE_KEY_SELECTED, selectedPeriod)
    }
  }, [selectedPeriod, isMounted])

  // Générer les listes selon le type de période
  const periodOptions = useMemo(() => {
    const currentYear = getYear(new Date())
    const years = [currentYear - 1, currentYear, currentYear + 1]

    if (periodType === "month") {
      const months: Date[] = []
      years.forEach((year) => {
        const start = startOfYear(new Date(year, 0, 1))
        const end = endOfYear(new Date(year, 0, 1))
        months.push(...eachMonthOfInterval({ start, end }))
      })
      return months.map((month) => ({
        value: format(month, "yyyy-MM"),
        label: format(month, "MMM yyyy", { locale: fr }),
        year: getYear(month),
      }))
    }

    if (periodType === "week") {
      const weeks: Date[] = []
      years.forEach((year) => {
        const start = startOfYear(new Date(year, 0, 1))
        const end = endOfYear(new Date(year, 0, 1))
        weeks.push(...eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }))
      })
      // Dédupliquer les semaines qui peuvent se chevaucher entre années
      const uniqueWeeks = new Map<string, Date>()
      weeks.forEach((week) => {
        const weekStart = startOfWeek(week, { weekStartsOn: 1 })
        const key = format(weekStart, "yyyy-MM-dd")
        if (!uniqueWeeks.has(key)) {
          uniqueWeeks.set(key, weekStart)
        }
      })
      return Array.from(uniqueWeeks.values())
        .sort((a, b) => a.getTime() - b.getTime())
        .map((weekStart) => {
          const weekEnd = addDays(weekStart, 6)
          return {
            value: format(weekStart, "yyyy-MM-dd"),
            label: `${format(weekStart, "d MMM", { locale: fr })} – ${format(weekEnd, "d MMM yyyy", { locale: fr })}`,
            year: getYear(weekStart),
          }
        })
    }

    // Pour year
    return years.map((year) => ({
      value: year.toString(),
      label: year.toString(),
      year,
    }))
  }, [periodType])

  // Obtenir la valeur actuelle pour le Select
  const getCurrentSelectValue = () => {
    if (selectedPeriod) return selectedPeriod
    
    // Par défaut, utiliser la période courante
    const now = new Date()
    if (periodType === "month") {
      return format(now, "yyyy-MM")
    }
    if (periodType === "week") {
      const weekStart = startOfWeek(now, { weekStartsOn: 1 })
      return format(weekStart, "yyyy-MM-dd")
    }
    return getYear(now).toString()
  }

  // Gérer le changement de sélection
  const handlePeriodSelect = (value: string) => {
    setSelectedPeriod(value)
  }

  // Réinitialiser la sélection quand on change de type
  useEffect(() => {
    setSelectedPeriod("")
  }, [periodType])

  // Calculer les dates selon la période sélectionnée
  const period = useMemo(() => {
    let startDate: Date
    let endDate: Date

    if (selectedPeriod) {
      // Utiliser la période sélectionnée
      if (periodType === "month") {
        const [year, month] = selectedPeriod.split("-").map(Number)
        startDate = new Date(year, month - 1, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(year, month, 0, 23, 59, 59, 999)
      } else if (periodType === "week") {
        const selectedDate = parseISO(selectedPeriod)
        startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 4) // Vendredi
        endDate.setHours(23, 59, 59, 999)
      } else {
        const year = parseInt(selectedPeriod)
        startDate = new Date(year, 0, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(year, 11, 31, 23, 59, 59, 999)
      }
    } else {
      // Comportement par défaut (période courante)
      const now = new Date()
      if (periodType === "week") {
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        startDate = new Date(now.getFullYear(), now.getMonth(), diff)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(startDate)
        endDate.setDate(startDate.getDate() + 4)
        endDate.setHours(23, 59, 59, 999)
      } else if (periodType === "month") {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
      } else {
        startDate = new Date(now.getFullYear(), 0, 1)
        startDate.setHours(0, 0, 0, 0)
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
      }
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  }, [periodType, selectedPeriod])

  const periodLabel = useMemo(() => {
    if (selectedPeriod) {
      const option = periodOptions.find((opt) => opt.value === selectedPeriod)
      if (option) return option.label
    }

    // Comportement par défaut
    const now = new Date()
    if (periodType === "week") {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(now.getFullYear(), now.getMonth(), diff)
      const friday = new Date(monday)
      friday.setDate(monday.getDate() + 4)
      
      return `Semaine du ${monday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} au ${friday.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
    } else if (periodType === "month") {
      return format(now, "MMM yyyy", { locale: fr })
    } else {
      return now.getFullYear().toString()
    }
  }, [periodType, selectedPeriod, periodOptions])

  // Charger le nombre total d'interventions pour la période
  useEffect(() => {
    if (!effectiveUserId || isLoadingUser || !period.startDate || !period.endDate) {
      setTotalInterventions(null)
      return
    }

    let cancelled = false

    const loadTotalInterventions = async () => {
      try {
        const statsData = await interventionsApi.getStatsByUser(effectiveUserId, period.startDate, period.endDate)
        if (!cancelled) {
          setTotalInterventions(statsData.total)
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Erreur lors du chargement du total d'interventions:", err)
          setTotalInterventions(null)
        }
      }
    }

    loadTotalInterventions()

    return () => {
      cancelled = true
    }
  }, [effectiveUserId, isLoadingUser, period.startDate, period.endDate])

  return (
    <>
      {/* Iframe login pour l'animation de transition */}
      {showTransition && (
        <iframe
          ref={loginIframeRef}
          src="/login"
          className="fixed inset-0 w-full h-full border-none pointer-events-none z-[90]"
          style={{
            mask: 'black',
          } as React.CSSProperties & { WebkitMask?: string }}
          aria-hidden="true"
          title="Login transition"
        />
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            ref={dashboardContentRef}
            className="flex flex-col h-full relative z-10"
            style={{ willChange: isAnimating ? 'clip-path' : 'auto' } as React.CSSProperties}
          >
            <div className="flex flex-col h-full p-6">
              {/* Layout Grid avec la structure demandée */}
              <div 
                className="parent grid h-full overflow-hidden"
                style={{
                  gridTemplateColumns: 'repeat(3, 33%)',
                  gridTemplateRows: '10% repeat(3, 1fr)',
                  gridColumnGap: '10px',
                  gridRowGap: '1px',
                }}
              >
                {/* div1 : Filterbar - grid-area: 1 / 1 / 2 / 4 */}
                <div 
                  className="div1 relative grid items-center p-3 bg-muted/50 rounded-lg overflow-x-auto overflow-y-hidden"
                  style={{
                    gridArea: '1 / 1 / 2 / 4',
                    maxHeight: '100%',
                    gridTemplateColumns: '1fr auto',
                    gap: 'clamp(0.5rem, 1.5vw, 2rem)',
                  }}
                >
                  {/* Partie gauche : Sélecteur de période */}
                  <div className="flex items-center gap-2 min-w-fit flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium whitespace-nowrap">Période :</span>
                      {isMounted ? (
                        <Select value={periodType} onValueChange={(value) => setPeriodType(value as PeriodType)}>
                          <SelectTrigger className="w-fit min-w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="week">Semaine</SelectItem>
                            <SelectItem value="month">Mois</SelectItem>
                            <SelectItem value="year">Année</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="w-[110px] h-10 rounded-md border bg-background flex items-center px-3">
                          <span className="text-sm text-muted-foreground">Chargement...</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Deuxième filtre adaptatif */}
                    <div className="flex items-center gap-2">
                      {isMounted ? (
                        <Select
                          value={getCurrentSelectValue()}
                          onValueChange={handlePeriodSelect}
                        >
                          <SelectTrigger className={cn(
                            "w-auto min-w-[120px]",
                            periodType === "week" && "min-w-[180px]",
                            periodType === "month" && "min-w-[140px]",
                            periodType === "year" && "min-w-[100px]"
                          )}>
                            <SelectValue>
                              {periodOptions.find((opt) => opt.value === getCurrentSelectValue())?.label || "Sélectionner"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="max-h-[300px]">
                            {(() => {
                              const currentYear = getYear(new Date())
                              const years = [currentYear - 1, currentYear, currentYear + 1]
                              
                              if (periodType === "month") {
                                return years.map((year) => {
                                  const yearMonths = periodOptions.filter((opt) => opt.year === year)
                                  if (yearMonths.length === 0) return null
                                  return (
                                    <div key={year}>
                                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground sticky top-0 bg-popover">
                                        {year}
                                      </div>
                                      {yearMonths.map((month) => (
                                        <SelectItem key={month.value} value={month.value}>
                                          {month.label}
                                        </SelectItem>
                                      ))}
                                    </div>
                                  )
                                })
                              }
                              
                              if (periodType === "week") {
                                return years.map((year) => {
                                  const yearWeeks = periodOptions.filter((opt) => opt.year === year)
                                  if (yearWeeks.length === 0) return null
                                  return (
                                    <div key={year}>
                                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground sticky top-0 bg-popover">
                                        {year}
                                      </div>
                                      {yearWeeks.map((week) => (
                                        <SelectItem key={week.value} value={week.value}>
                                          {week.label}
                                        </SelectItem>
                                      ))}
                                    </div>
                                  )
                                })
                              }
                              
                              // Pour year
                              return periodOptions.map((year) => (
                                <SelectItem key={year.value} value={year.value}>
                                  {year.label}
                                </SelectItem>
                              ))
                            })()}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="w-[180px] h-10 rounded-md border bg-background flex items-center px-3">
                          <span className="text-sm text-muted-foreground">Chargement...</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Dates et interventions à droite des boutons de sélection */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-foreground font-medium hidden xl:inline whitespace-nowrap">
                        {new Date(period.startDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })} - {new Date(period.endDate).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                      {totalInterventions !== null && (
                        <Badge variant="secondary" className="text-foreground font-medium whitespace-nowrap">
                          {totalInterventions} intervention{totalInterventions > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Partie centrale : Bienvenue centré absolument */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none z-10">
                    {/* Effet "Bienvenue" centré */}
                    {showBienvenue && currentUser?.id && selectedGestionnaireId === currentUser.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center"
                      >
                        <AppleBienvenueEffect speed={0.2} className="text-primary h-6 lg:h-8" />
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Partie droite : Badge gestionnaire sélectionné + Nom + AvatarGroup */}
                  <div className="flex items-center gap-2 justify-end flex-shrink-0 min-w-fit">
                    {/* Badge du gestionnaire sélectionné */}
                    {selectedGestionnaireId && (() => {
                      const selectedGestionnaire = gestionnaires.find(g => g.id === selectedGestionnaireId)
                      if (!selectedGestionnaire) return null
                      const displayName = getDisplayName(selectedGestionnaire)
                      
                      return (
                        <>
                          <motion.div
                            key={selectedGestionnaireId}
                            layoutId={`gestionnaire-badge-${selectedGestionnaireId}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{ width: "2.25rem", height: "2.25rem" }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                          >
                            <GestionnaireBadge
                              firstname={selectedGestionnaire.firstname}
                              lastname={selectedGestionnaire.lastname}
                              prenom={selectedGestionnaire.prenom}
                              name={selectedGestionnaire.name}
                              color={selectedGestionnaire.color}
                              size="md"
                              className="ring-2 ring-primary ring-offset-2"
                            />
                          </motion.div>
                          <motion.span 
                            className="text-sm font-medium text-foreground whitespace-nowrap"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.1 }}
                          >
                            {displayName}
                          </motion.span>
                        </>
                      )
                    })()}
                    
                    {/* AvatarGroup des gestionnaires */}
                    {isLoadingGestionnaires ? (
                      <div className="h-9 w-9 rounded-full bg-muted animate-pulse flex-shrink-0" />
                    ) : gestionnaires.length === 0 ? (
                      <div className="text-sm text-muted-foreground whitespace-nowrap">Aucun gestionnaire</div>
                    ) : (
                      <motion.div
                        layout
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="flex-shrink-0"
                      >
                        <AvatarGroup variant="motion" className="h-9 -space-x-2">
                          {gestionnaires
                            .filter((gestionnaire) => gestionnaire.id !== selectedGestionnaireId)
                            .map((gestionnaire) => {
                              const isCurrentUser = currentUser?.id === gestionnaire.id
                              const displayName = getDisplayName(gestionnaire)
                              
                              return (
                                <motion.div
                                  key={gestionnaire.id}
                                  layoutId={`gestionnaire-badge-${gestionnaire.id}`}
                                  layout
                                  initial={false}
                                  style={{ width: "2.25rem", height: "2.25rem" }}
                                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                >
                                  <GestionnaireBadge
                                    firstname={gestionnaire.firstname}
                                    lastname={gestionnaire.lastname}
                                    prenom={gestionnaire.prenom}
                                    name={gestionnaire.name}
                                    color={gestionnaire.color}
                                    size="md"
                                    className={cn(
                                      "transition-all",
                                      isCurrentUser && "ring-2 ring-green-500/50"
                                    )}
                                    onClick={() => setSelectedGestionnaireId(gestionnaire.id)}
                                  >
                                    <AvatarGroupTooltip>
                                      <div className="flex flex-col gap-1">
                                        <p className="font-semibold">{displayName}</p>
                                        {isCurrentUser && (
                                          <Badge variant="secondary" className="w-fit text-xs">
                                            Vous
                                          </Badge>
                                        )}
                                        {gestionnaire.code_gestionnaire && (
                                          <p className="text-xs text-muted-foreground">
                                            {gestionnaire.code_gestionnaire}
                                          </p>
                                        )}
                                      </div>
                                    </AvatarGroupTooltip>
                                  </GestionnaireBadge>
                                </motion.div>
                              )
                            })}
                        </AvatarGroup>
                      </motion.div>
                    )}
                    
                    {/* Bouton Mode Admin (visible uniquement pour les admins) */}
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/admin/dashboard")}
                        className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                      >
                        <Shield className="h-4 w-4" />
                        <span className="hidden lg:inline">Mode Admin</span>
                        <span className="lg:hidden">Admin</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* div2 : Mes interventions - grid-area: 2 / 1 / 4 / 2 */}
                <div 
                  className="div2 overflow-hidden"
                  style={{
                    gridArea: '2 / 1 / 4 / 2',
                  }}
                >
                  <div className="h-full">
                    <InterventionStatsBarChart period={period} userId={effectiveUserId} />
                  </div>
                </div>

                {/* div3 : Mes artisans - grid-area: 2 / 2 / 4 / 3 */}
                <div 
                  className="div3 overflow-hidden"
                  style={{
                    gridArea: '2 / 2 / 4 / 3',
                  }}
                >
                  <div className="h-full">
                    <ArtisanStatsList period={period} userId={effectiveUserId} />
                  </div>
                </div>

                {/* div4 : Les deux speedomètres - grid-area: 2 / 3 / 3 / 4 */}
                <div 
                  className="div4 overflow-hidden"
                  style={{
                    gridArea: '2 / 3 / 3 / 4',
                    maxHeight: '100%',
                  }}
                >
                  <div className="h-full flex flex-col p-2">
                    {/* Titres au-dessus */}
                    <div className="grid grid-cols-2 gap-4 mb-2 flex-shrink-0">
                      <h3 className="text-sm text-muted-foreground font-medium">Marge moyenne</h3>
                      <h3 className="text-sm text-muted-foreground font-medium">Marge totale</h3>
                    </div>
                    {/* Speedomètres côte à côte */}
                    <div className="flex-1 grid grid-cols-2 gap-2 overflow-hidden">
                      <div className="h-full overflow-hidden">
                        <MarginStatsCard period={period} userId={effectiveUserId} compact />
                      </div>
                      <div className="h-full overflow-hidden">
                        <MarginTotalCard period={period} userId={effectiveUserId} compact />
                      </div>
                    </div>
                  </div>
                </div>

                {/* div5 : Podium - grid-area: 3 / 3 / 5 / 4 */}
                <div 
                  className="div5 overflow-hidden"
                  style={{
                    gridArea: '3 / 3 / 5 / 4',
                    minHeight: '90%',
                  }}
                >
                  <div className="h-full flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-hidden">
                      <GestionnaireRankingPodium period={period} />
                    </div>
                  </div>
                </div>

                {/* div6 : Table - grid-area: 4 / 1 / 5 / 3 */}
                <div 
                  className="div6 overflow-hidden"
                  style={{
                    gridArea: '4 / 1 / 5 / 3',
                  }}
                >
                  <div className="h-full">
                    <WeeklyStatsTable period={period} userId={effectiveUserId} />
                  </div>
                </div>
              </div>
            </div>
          </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => openModal("new", { content: "new-intervention" })} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle intervention
        </ContextMenuItem>
        <ContextMenuItem onClick={() => artisanModal.openNew()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nouvel artisan
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
    </>
  )
}
