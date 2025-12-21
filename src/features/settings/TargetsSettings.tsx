"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usersApi } from "@/lib/api/v2"
import type { User, GestionnaireTarget, TargetPeriodType, CreateGestionnaireTargetData } from "@/lib/api/v2"
import { Loader2, Target, Edit2, Check, X } from "lucide-react"

export function TargetsSettings() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [targets, setTargets] = useState<GestionnaireTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editableData, setEditableData] = useState<
    Record<
      string,
      Record<
        TargetPeriodType,
        { margin_target: number; performance_target: number | null; targetId?: string }
      >
    >
  >({})
  const [creatorUsers, setCreatorUsers] = useState<Map<string, User>>(new Map()) // Map des créateurs par ID

  // Utiliser le hook centralisé useCurrentUser au lieu d'un fetch direct
  const { data: currentUserData } = useCurrentUser()
  const currentUser = useMemo(() => {
    if (!currentUserData) return null
    return { id: currentUserData.id, roles: currentUserData.roles || [] }
  }, [currentUserData])

  // Fonction helper pour obtenir la valeur par défaut de margin_target selon la période
  const getDefaultMarginTarget = (periodType: TargetPeriodType): number => {
    switch (periodType) {
      case "week":
        return 1500
      case "month":
        return 5000
      case "year":
        return 58000
      default:
        return 5000
    }
  }

  // Charger les utilisateurs et les objectifs
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser) return

      try {
        setLoading(true)
        // Charger tous les utilisateurs
        const usersResponse = await usersApi.getAll({ limit: 1000 })
        setUsers(usersResponse.data)

        // Charger tous les objectifs
        const allTargets = await usersApi.getAllTargets()
        setTargets(allTargets)

        // Charger les informations des créateurs des objectifs
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
        toast({
          title: "Erreur",
          description: error.message || "Erreur lors du chargement des données",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [currentUser, toast])

  // Vérifier si l'utilisateur est admin
  const isAdmin = currentUser?.roles?.some((role) => role.toLowerCase() === "admin") || false
  const isManager = currentUser?.roles?.some((role) => role.toLowerCase() === "manager") || false

  // Vérifier si un objectif a été créé par un admin
  const isTargetCreatedByAdmin = (target: GestionnaireTarget): boolean => {
    if (!target.created_by) return false
    const creator = creatorUsers.get(target.created_by)
    if (!creator) return false
    return creator.roles?.some((role) => role.toLowerCase() === "admin") || false
  }

  // Vérifier si l'utilisateur a les permissions (admin ou manager)
  const hasPermission = isAdmin || isManager

  // Vérifier si l'utilisateur peut modifier/supprimer un objectif
  const canModifyTarget = (target: GestionnaireTarget | null | undefined): boolean => {
    if (!target) return true // Pas d'objectif = peut créer
    if (isAdmin) return true // Les admins peuvent tout modifier
    if (!isManager) return false // Seuls les admins et managers peuvent modifier
    // Les managers ne peuvent pas modifier les objectifs créés par les admins
    return !isTargetCreatedByAdmin(target)
  }

  if (!hasPermission) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>
            Vous n&apos;avez pas les permissions nécessaires pour gérer les objectifs de marge.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Filtrer les utilisateurs pour exclure l'utilisateur avec le username "admin"
  const gestionnaires = users.filter((user) => {
    // Exclure l'utilisateur avec le username "admin"
    if (user.username?.toLowerCase() === "admin") return false
    
    // Si l'utilisateur est manager (et pas admin), exclure aussi les utilisateurs avec le rôle admin
    if (isManager && !isAdmin) {
      const userIsAdmin = user.roles?.some((role) => role.toLowerCase() === "admin")
      return !userIsAdmin
    }
    
    return true
  })

  // Initialiser les données éditables quand on entre en mode édition
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
            margin_target: getDefaultMarginTarget(period),
            performance_target: 40,
          }
        }
      })
    })
    
    setEditableData(initialData)
    setIsEditMode(true)
  }

  // Sortir du mode édition
  const handleCancelEdit = () => {
    setIsEditMode(false)
    setEditableData({})
  }

  // Mettre à jour une valeur dans editableData
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
          margin_target: existingTarget?.margin_target ?? getDefaultMarginTarget(periodType),
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

  // Appliquer tous les changements
  const handleApplyChanges = async () => {
    if (!currentUser) return

    try {
      let successCount = 0
      let errorCount = 0

      // Parcourir toutes les modifications
      for (const [userId, periods] of Object.entries(editableData)) {
        for (const [periodType, data] of Object.entries(periods)) {
          // Vérifier si on peut modifier cet objectif
          const existingTarget = targets.find(
            (t) => t.user_id === userId && t.period_type === periodType
          )

          if (existingTarget && !canModifyTarget(existingTarget)) {
            errorCount++
            continue // Skip les objectifs non modifiables
          }

          // Vérifier que margin_target est valide
          if (data.margin_target <= 0) {
            errorCount++
            continue
          }

          try {
            const targetData: CreateGestionnaireTargetData = {
              user_id: userId,
              period_type: periodType as TargetPeriodType,
              margin_target: data.margin_target,
              performance_target: data.performance_target ?? 40,
            }

            await usersApi.upsertTarget(targetData, currentUser.id)
            successCount++
          } catch (error) {
            errorCount++
            console.error(`Erreur lors de la sauvegarde pour ${userId} - ${periodType}:`, error)
          }
        }
      }

      // Recharger les objectifs
      const allTargets = await usersApi.getAllTargets()
      setTargets(allTargets)

      // Afficher le résultat
      if (errorCount === 0) {
        toast({
          title: "Succès",
          description: `${successCount} objectif(s) mis à jour avec succès`,
        })
      } else {
        toast({
          title: "Avertissement",
          description: `${successCount} objectif(s) mis à jour, ${errorCount} erreur(s)`,
          variant: "destructive",
        })
      }

      setIsEditMode(false)
      setEditableData({})
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors de la sauvegarde",
        variant: "destructive",
      })
    }
  }

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId)
    if (!user) return "Utilisateur inconnu"
    return `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.username || user.email || "Utilisateur"
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
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Objectifs de marge
              </CardTitle>
              <CardDescription>
                Configurez les objectifs de marge et de performance pour chaque gestionnaire par période (semaine,
                mois, année).
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Button onClick={handleCancelEdit} variant="outline" className="gap-2">
                    <X className="h-4 w-4" />
                    Annuler
                  </Button>
                  <Button onClick={handleApplyChanges} className="gap-2">
                    <Check className="h-4 w-4" />
                    Appliquer les changements
                  </Button>
                </>
              ) : (
                <Button onClick={handleEnterEditMode} variant="outline" className="gap-2">
                  <Edit2 className="h-4 w-4" />
                  Modifier
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto scrollbar-hide">
            <Table className={isEditMode ? "border-2 border-primary/50 bg-primary/5 dark:bg-primary/10" : ""}>
              <TableHeader>
                <TableRow className="bg-muted/50 dark:bg-muted/30 border-b-2 border-border/60 hover:bg-transparent h-14">
                  <TableHead className="w-[200px] font-bold text-foreground">Gestionnaire</TableHead>
                  {/* Colonnes Semaine */}
                  <TableHead colSpan={2} className="text-center font-bold text-foreground border-x border-border/40">
                    <div className="flex items-center justify-center w-full">Semaine</div>
                  </TableHead>
                  {/* Colonnes Mois */}
                  <TableHead colSpan={2} className="text-center font-bold text-foreground border-x border-border/40">
                    <div className="flex items-center justify-center w-full">Mois</div>
                  </TableHead>
                  {/* Colonnes Année */}
                  <TableHead colSpan={2} className="text-center font-bold text-foreground border-x border-border/40">
                    <div className="flex items-center justify-center w-full">Année</div>
                  </TableHead>
                </TableRow>
                <TableRow className="bg-muted/30 dark:bg-muted/20 border-b border-border/40 hover:bg-transparent">
                  <TableHead className="font-semibold"></TableHead>
                  {/* Sous-colonnes pour Semaine */}
                  <TableHead className="!text-center font-semibold text-sm border-l-2 border-primary/30 border-r border-border/20">
                    <div className="flex items-center justify-center w-full">Objectif Marge</div>
                  </TableHead>
                  <TableHead className="!text-center font-semibold text-sm border-r border-border/20">
                    <div className="flex items-center justify-center w-full">Objectif Pourcentage</div>
                  </TableHead>
                  {/* Sous-colonnes pour Mois */}
                  <TableHead className="!text-center font-semibold text-sm border-l-2 border-primary/30 border-r border-border/20">
                    <div className="flex items-center justify-center w-full">Objectif Marge</div>
                  </TableHead>
                  <TableHead className="!text-center font-semibold text-sm border-r border-border/20">
                    <div className="flex items-center justify-center w-full">Objectif Pourcentage</div>
                  </TableHead>
                  {/* Sous-colonnes pour Année */}
                  <TableHead className="!text-center font-semibold text-sm border-l-2 border-primary/30 border-r border-border/20">
                    <div className="flex items-center justify-center w-full">Objectif Marge</div>
                  </TableHead>
                  <TableHead className="!text-center font-semibold text-sm">
                    <div className="flex items-center justify-center w-full">Objectif Pourcentage</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gestionnaires.map((user, index) => {
                  const weekTarget = targets.find((t) => t.user_id === user.id && t.period_type === "week")
                  const monthTarget = targets.find((t) => t.user_id === user.id && t.period_type === "month")
                  const yearTarget = targets.find((t) => t.user_id === user.id && t.period_type === "year")

                  const getUserDisplayName = () => {
                    const name = getUserName(user.id)
                    return user.code_gestionnaire ? `${name} (${user.code_gestionnaire})` : name
                  }

                  const canModifyWeek = canModifyTarget(weekTarget)
                  const canModifyMonth = canModifyTarget(monthTarget)
                  const canModifyYear = canModifyTarget(yearTarget)

                  // Obtenir les valeurs à afficher (édition ou lecture)
                  const getValue = (target: GestionnaireTarget | undefined, periodType: TargetPeriodType, field: "margin_target" | "performance_target") => {
                    if (isEditMode && editableData[user.id]?.[periodType]) {
                      return editableData[user.id][periodType][field]
                    }
                    if (target) {
                      return field === "margin_target" ? target.margin_target : (target.performance_target ?? null)
                    }
                    return field === "margin_target" ? getDefaultMarginTarget(periodType) : null
                  }

                  return (
                    <TableRow 
                      key={user.id} 
                      className={`transition-colors duration-200 border-b border-border/30 ${
                        index % 2 === 0 
                          ? "bg-white dark:bg-gray-900/30"  // Ligne claire - blanc pur
                          : "bg-gray-100 dark:bg-gray-800/50"  // Ligne foncée - gris clair
                      } hover:bg-gray-200 dark:hover:bg-gray-700/60`}
                    >
                      <TableCell className="font-medium py-4">
                        {getUserDisplayName()}
                      </TableCell>
                      {/* Cellules Semaine */}
                      <TableCell className="text-center align-middle py-2 border-l-2 border-primary/30 border-r border-border/20">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={getValue(weekTarget, "week", "margin_target") as number}
                            onChange={(e) => updateEditableValue(user.id, "week", "margin_target", parseFloat(e.target.value) || 0)}
                            className="w-24 mx-auto text-center"
                            disabled={!canModifyWeek}
                          />
                        ) : (
                          <span className="inline-block text-center w-full">
                            {weekTarget ? formatCurrency(weekTarget.margin_target) : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center align-middle py-2 border-r border-border/20">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={getValue(weekTarget, "week", "performance_target") ?? ""}
                            onChange={(e) => updateEditableValue(user.id, "week", "performance_target", e.target.value === "" ? null : (parseFloat(e.target.value) || null))}
                            className="w-20 mx-auto text-center"
                            disabled={!canModifyWeek}
                            placeholder="40"
                          />
                        ) : (
                          <span className="inline-block text-center w-full">
                            {weekTarget?.performance_target !== null && weekTarget?.performance_target !== undefined
                              ? `${weekTarget.performance_target}%`
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                      {/* Cellules Mois */}
                      <TableCell className="text-center align-middle py-2 border-l-2 border-primary/30 border-r border-border/20">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={getValue(monthTarget, "month", "margin_target") as number}
                            onChange={(e) => updateEditableValue(user.id, "month", "margin_target", parseFloat(e.target.value) || 0)}
                            className="w-24 mx-auto text-center"
                            disabled={!canModifyMonth}
                          />
                        ) : (
                          <span className="inline-block text-center w-full">
                            {monthTarget ? formatCurrency(monthTarget.margin_target) : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center align-middle py-2 border-r border-border/20">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={getValue(monthTarget, "month", "performance_target") ?? ""}
                            onChange={(e) => updateEditableValue(user.id, "month", "performance_target", e.target.value === "" ? null : (parseFloat(e.target.value) || null))}
                            className="w-20 mx-auto text-center"
                            disabled={!canModifyMonth}
                            placeholder="40"
                          />
                        ) : (
                          <span className="inline-block text-center w-full">
                            {monthTarget?.performance_target !== null && monthTarget?.performance_target !== undefined
                              ? `${monthTarget.performance_target}%`
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                      {/* Cellules Année */}
                      <TableCell className="text-center align-middle py-2 border-l-2 border-primary/30 border-r border-border/20">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            step="100"
                            value={getValue(yearTarget, "year", "margin_target") as number}
                            onChange={(e) => updateEditableValue(user.id, "year", "margin_target", parseFloat(e.target.value) || 0)}
                            className="w-24 mx-auto text-center"
                            disabled={!canModifyYear}
                          />
                        ) : (
                          <span className="inline-block text-center w-full">
                            {yearTarget ? formatCurrency(yearTarget.margin_target) : "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center align-middle py-2">
                        {isEditMode ? (
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={getValue(yearTarget, "year", "performance_target") ?? ""}
                            onChange={(e) => updateEditableValue(user.id, "year", "performance_target", e.target.value === "" ? null : (parseFloat(e.target.value) || null))}
                            className="w-20 mx-auto text-center"
                            disabled={!canModifyYear}
                            placeholder="40"
                          />
                        ) : (
                          <span className="inline-block text-center w-full">
                            {yearTarget?.performance_target !== null && yearTarget?.performance_target !== undefined
                              ? `${yearTarget.performance_target}%`
                              : "—"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

