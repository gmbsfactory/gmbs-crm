"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Target, 
  Edit2, 
  Check, 
  X, 
  TrendingUp,
  Calendar,
  CalendarDays,
  CalendarRange,
  Percent,
  Euro,
  Lock,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usersApi } from "@/lib/api/v2"
import type { User, GestionnaireTarget, TargetPeriodType, CreateGestionnaireTargetData } from "@/lib/api/v2"
import { cn } from "@/lib/utils"

const PERIOD_CONFIG = {
  week: { 
    icon: Calendar, 
    label: 'Semaine', 
    shortLabel: 'Sem.',
    defaultMargin: 1500,
    color: 'from-blue-500/20 to-indigo-500/10',
    iconColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  month: { 
    icon: CalendarDays, 
    label: 'Mois', 
    shortLabel: 'Mois',
    defaultMargin: 5000,
    color: 'from-emerald-500/20 to-green-500/10',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  year: { 
    icon: CalendarRange, 
    label: 'Année', 
    shortLabel: 'An',
    defaultMargin: 58000,
    color: 'from-amber-500/20 to-orange-500/10',
    iconColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
}

export function TargetsSettings() {
  const [users, setUsers] = useState<User[]>([])
  const [targets, setTargets] = useState<GestionnaireTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editableData, setEditableData] = useState<
    Record<
      string,
      Record<
        TargetPeriodType,
        { margin_target: number; performance_target: number | null; targetId?: string }
      >
    >
  >({})
  const [creatorUsers, setCreatorUsers] = useState<Map<string, User>>(new Map())

  const { data: currentUserData } = useCurrentUser()
  const currentUser = useMemo(() => {
    if (!currentUserData) return null
    return { id: currentUserData.id, roles: currentUserData.roles || [] }
  }, [currentUserData])

  // Load data
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return

      try {
        setLoading(true)
        const usersResponse = await usersApi.getAll({ limit: 1000 })
        setUsers(usersResponse.data)

        const allTargets = await usersApi.getAllTargets()
        setTargets(allTargets)

        const creatorIds = new Set<string>()
        allTargets.forEach((target) => {
          if (target.created_by) {
            creatorIds.add(target.created_by)
          }
        })

        const creatorsMap = new Map<string, User>()
        for (const creatorId of creatorIds) {
          try {
            const creator = await usersApi.getById(creatorId)
            creatorsMap.set(creatorId, creator)
          } catch (error) {
            console.error(`Erreur lors du chargement du créateur ${creatorId}:`, error)
          }
        }
        setCreatorUsers(creatorsMap)
      } catch (error: any) {
        toast.error("Erreur", {
          description: error.message || "Erreur lors du chargement des données",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentUser, toast])

  const isAdmin = currentUser?.roles?.some((role) => role.toLowerCase() === "admin") || false
  const isManager = currentUser?.roles?.some((role) => role.toLowerCase() === "manager") || false
  const hasPermission = isAdmin || isManager

  const isTargetCreatedByAdmin = (target: GestionnaireTarget): boolean => {
    if (!target.created_by) return false
    const creator = creatorUsers.get(target.created_by)
    if (!creator) return false
    return creator.roles?.some((role) => role.toLowerCase() === "admin") || false
  }

  const canModifyTarget = (target: GestionnaireTarget | null | undefined): boolean => {
    if (!target) return true
    if (isAdmin) return true
    if (!isManager) return false
    return !isTargetCreatedByAdmin(target)
  }

  if (!hasPermission) {
    return (
      <div className="rounded-2xl border bg-card/50 p-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <Lock className="h-8 w-8 text-red-500" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Accès refusé</h3>
            <p className="text-muted-foreground mt-1">
              Vous n&apos;avez pas les permissions nécessaires pour gérer les objectifs de marge.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const gestionnaires = users.filter((user) => {
    if (user.username?.toLowerCase() === "admin") return false
    if (isManager && !isAdmin) {
      const userIsAdmin = user.roles?.some((role) => role.toLowerCase() === "admin")
      return !userIsAdmin
    }
    return true
  })

  const handleEnterEditMode = () => {
    const initialData: typeof editableData = {}
    
    gestionnaires.forEach((user) => {
      const periods: TargetPeriodType[] = ["week", "month", "year"]
      initialData[user.id] = {} as Record<TargetPeriodType, { margin_target: number; performance_target: number | null; targetId?: string }>
      
      periods.forEach((period) => {
        const target = targets.find((t) => t.user_id === user.id && t.period_type === period)
        if (target) {
          initialData[user.id][period] = {
            margin_target: target.margin_target,
            performance_target: target.performance_target ?? null,
            targetId: target.id,
          }
        } else {
          initialData[user.id][period] = {
            margin_target: PERIOD_CONFIG[period].defaultMargin,
            performance_target: 40,
          }
        }
      })
    })
    
    setEditableData(initialData)
    setIsEditMode(true)
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    setEditableData({})
  }

  const updateEditableValue = (
    userId: string,
    periodType: TargetPeriodType,
    field: "margin_target" | "performance_target",
    value: number | null
  ) => {
    setEditableData((prev) => {
      const newData = { ...prev }
      if (!newData[userId]) {
        newData[userId] = {} as Record<TargetPeriodType, { margin_target: number; performance_target: number | null; targetId?: string }>
      }
      if (!newData[userId][periodType]) {
        const existingTarget = targets.find((t) => t.user_id === userId && t.period_type === periodType)
        newData[userId][periodType] = {
          margin_target: existingTarget?.margin_target ?? PERIOD_CONFIG[periodType].defaultMargin,
          performance_target: existingTarget?.performance_target ?? null,
          targetId: existingTarget?.id,
        }
      }
      newData[userId][periodType] = {
        ...newData[userId][periodType],
        [field]: value,
      }
      return newData
    })
  }

  const handleApplyChanges = async () => {
    if (!currentUser) return

    setSaving(true)
    try {
      const updates: Array<{
        userId: string
        userName: string
        periodType: TargetPeriodType
        periodLabel: string
        marginTarget: number
        performanceTarget: number | null
      }> = []
      const errors: Array<{ userId: string; periodType: string; error: string }> = []

      // Préparer toutes les mises à jour
      for (const [userId, periods] of Object.entries(editableData)) {
        const user = users.find((u) => u.id === userId)
        const userName = user ? getUserName(user) : userId

        for (const [periodType, data] of Object.entries(periods)) {
          const existingTarget = targets.find(
            (t) => t.user_id === userId && t.period_type === periodType
          )

          if (existingTarget && !canModifyTarget(existingTarget)) {
            errors.push({
              userId,
              periodType,
              error: "Objectif verrouillé (créé par admin)",
            })
            continue
          }

          if (data.margin_target <= 0) {
            errors.push({
              userId,
              periodType,
              error: "Marge cible doit être supérieure à 0",
            })
            continue
          }

          updates.push({
            userId,
            userName,
            periodType: periodType as TargetPeriodType,
            periodLabel: PERIOD_CONFIG[periodType as TargetPeriodType].label,
            marginTarget: data.margin_target,
            performanceTarget: data.performance_target ?? null,
          })
        }
      }

      // Exécuter toutes les sauvegardes en parallèle
      const savePromises = updates.map(async (update) => {
        try {
          const targetData: CreateGestionnaireTargetData = {
            user_id: update.userId,
            period_type: update.periodType,
            margin_target: update.marginTarget,
            performance_target: update.performanceTarget ?? 40,
          }

          await usersApi.upsertTarget(targetData, currentUser.id)
          return { success: true, update }
        } catch (error: any) {
          errors.push({
            userId: update.userId,
            periodType: update.periodType,
            error: error.message || "Erreur inconnue",
          })
          return { success: false, update }
        }
      })

      const results = await Promise.all(savePromises)
      const successCount = results.filter((r) => r.success).length

      // Recharger les targets (une seule fois)
      const allTargets = await usersApi.getAllTargets()
      setTargets(allTargets)

      // Ne recharger les créateurs que si nécessaire (seulement les nouveaux créateurs)
      const newCreatorIds = new Set<string>()
      allTargets.forEach((target) => {
        if (target.created_by && !creatorUsers.has(target.created_by)) {
          newCreatorIds.add(target.created_by)
        }
      })

      if (newCreatorIds.size > 0) {
        const newCreatorsMap = new Map<string, User>()
        const creatorPromises = Array.from(newCreatorIds).map(async (creatorId) => {
          try {
            const creator = await usersApi.getById(creatorId)
            newCreatorsMap.set(creatorId, creator)
          } catch (error) {
            console.error(`Erreur lors du chargement du créateur ${creatorId}:`, error)
          }
        })
        await Promise.all(creatorPromises)
        setCreatorUsers((prev) => new Map([...prev, ...newCreatorsMap]))
      }

      // Afficher les toasts pour chaque mise à jour réussie
      const successfulUpdates = results.filter((r) => r.success).map((r) => r.update!)
      successfulUpdates.forEach((update) => {
        toast.success("Objectif mis à jour", {
          description: `${update.userName} - ${update.periodLabel}: ${formatCurrency(update.marginTarget)}${update.performanceTarget ? ` (${update.performanceTarget}%)` : ""}`,
        })
      })

      // Afficher un toast d'erreur s'il y en a
      if (errors.length > 0) {
        toast.error("Erreurs", {
          description: `${errors.length} erreur(s) lors de la sauvegarde`,
        })
      }

      // Si aucune mise à jour n'a été effectuée
      if (successfulUpdates.length === 0 && errors.length === 0) {
        toast.info("Aucune modification", {
          description: "Aucun objectif à mettre à jour",
        })
      }

      setIsEditMode(false)
      setEditableData({})
    } catch (error: any) {
      console.error("Erreur lors de la sauvegarde:", error)
      toast.error("Erreur", {
        description: error.message || "Erreur lors de la sauvegarde",
      })
    } finally {
      setSaving(false)
    }
  }

  const getUserName = (user: User) => {
    const name = `${user.firstname || ""} ${user.lastname || ""}`.trim()
    return name || user.username || user.email || "Utilisateur"
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Chargement des objectifs...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-br from-amber-500/5 via-background to-background border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center">
                <Target className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Objectifs de marge</h2>
                <p className="text-sm text-muted-foreground">
                  {gestionnaires.length} gestionnaire{gestionnaires.length > 1 ? 's' : ''} • Semaine, Mois, Année
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isEditMode ? (
                <>
                  <motion.button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <X className="h-4 w-4" />
                    Annuler
                  </motion.button>
                  <motion.button
                    onClick={handleApplyChanges}
                    disabled={saving}
                    className="px-4 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {saving ? (
                      <>
                        <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Appliquer
                      </>
                    )}
                  </motion.button>
                </>
              ) : (
                <motion.button
                  onClick={handleEnterEditMode}
                  className="px-4 py-2.5 rounded-xl font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Edit2 className="h-4 w-4" />
                  Modifier
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Period Headers */}
        <div className="grid grid-cols-4 border-b bg-muted/30">
          <div className="px-6 py-3 font-medium text-sm text-muted-foreground">
            Gestionnaire
          </div>
          {(['week', 'month', 'year'] as TargetPeriodType[]).map((period) => {
            const config = PERIOD_CONFIG[period]
            const Icon = config.icon
            return (
              <div key={period} className="px-4 py-3 text-center border-l">
                <div className="flex items-center justify-center gap-2">
                  <Icon className={cn("h-4 w-4", config.iconColor)} />
                  <span className="font-medium text-sm">{config.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Data rows */}
        <div className="divide-y">
          {gestionnaires.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Aucun gestionnaire trouvé</p>
            </div>
          ) : (
            gestionnaires.map((user, index) => {
              const weekTarget = targets.find((t) => t.user_id === user.id && t.period_type === "week")
              const monthTarget = targets.find((t) => t.user_id === user.id && t.period_type === "month")
              const yearTarget = targets.find((t) => t.user_id === user.id && t.period_type === "year")

              const canModifyWeek = canModifyTarget(weekTarget)
              const canModifyMonth = canModifyTarget(monthTarget)
              const canModifyYear = canModifyTarget(yearTarget)

              const getValue = (target: GestionnaireTarget | undefined, periodType: TargetPeriodType, field: "margin_target" | "performance_target") => {
                if (isEditMode && editableData[user.id]?.[periodType]) {
                  return editableData[user.id][periodType][field]
                }
                if (target) {
                  return field === "margin_target" ? target.margin_target : (target.performance_target ?? null)
                }
                return field === "margin_target" ? PERIOD_CONFIG[periodType].defaultMargin : null
              }

              const targetsByPeriod = [
                { period: 'week' as TargetPeriodType, target: weekTarget, canModify: canModifyWeek },
                { period: 'month' as TargetPeriodType, target: monthTarget, canModify: canModifyMonth },
                { period: 'year' as TargetPeriodType, target: yearTarget, canModify: canModifyYear },
              ]

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    "grid grid-cols-4 hover:bg-muted/30 transition-colors",
                    isEditMode && "bg-primary/5"
                  )}
                >
                  {/* User info */}
                  <div className="px-6 py-4 flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md"
                      style={{ backgroundColor: user.color || '#6366f1' }}
                    >
                      {(user.firstname?.[0] || '').toUpperCase()}{(user.lastname?.[0] || '').toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{getUserName(user)}</p>
                      {user.code_gestionnaire && (
                        <span 
                          className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                          style={{ backgroundColor: user.color || '#6366f1' }}
                        >
                          {user.code_gestionnaire}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Period cells */}
                  {targetsByPeriod.map(({ period, target, canModify }) => {
                    const config = PERIOD_CONFIG[period]
                    const marginValue = getValue(target, period, "margin_target") as number
                    const perfValue = getValue(target, period, "performance_target")
                    const isLocked = isEditMode && !canModify

                    return (
                      <div key={period} className="px-4 py-4 border-l flex flex-col items-center justify-center gap-2">
                        {isEditMode ? (
                          <div className="space-y-2 w-full max-w-[140px]">
                            {/* Margin input */}
                            <div className="relative">
                              <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={marginValue}
                                onChange={(e) => updateEditableValue(user.id, period, "margin_target", parseFloat(e.target.value) || 0)}
                                disabled={isLocked}
                                className={cn(
                                  "w-full pl-8 pr-3 py-1.5 rounded-lg border text-sm text-center transition-all outline-none",
                                  isLocked 
                                    ? "bg-muted/50 text-muted-foreground cursor-not-allowed" 
                                    : "bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20"
                                )}
                              />
                              {isLocked && (
                                <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            {/* Performance input */}
                            <div className="relative">
                              <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                value={perfValue ?? ''}
                                onChange={(e) => updateEditableValue(user.id, period, "performance_target", e.target.value === "" ? null : (parseFloat(e.target.value) || null))}
                                disabled={isLocked}
                                placeholder="40"
                                className={cn(
                                  "w-full pl-8 pr-3 py-1.5 rounded-lg border text-sm text-center transition-all outline-none",
                                  isLocked 
                                    ? "bg-muted/50 text-muted-foreground cursor-not-allowed" 
                                    : "bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20"
                                )}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            {target ? (
                              <>
                                <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-lg", config.bgColor)}>
                                  <Euro className={cn("h-3.5 w-3.5", config.iconColor)} />
                                  <span className={cn("font-semibold text-sm", config.iconColor)}>
                                    {formatCurrency(target.margin_target)}
                                  </span>
                                </div>
                                {target.performance_target !== null && target.performance_target !== undefined && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <TrendingUp className="h-3 w-3" />
                                    <span>{target.performance_target}%</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Euro className="h-3.5 w-3.5" />
          <span>Objectif de marge</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Objectif de performance (%)</span>
        </div>
        {isEditMode && (
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            <span>Verrouillé (créé par admin)</span>
          </div>
        )}
      </div>
    </div>
  )
}
