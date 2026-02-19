"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useGestionnaires, type Gestionnaire } from "@/hooks/useGestionnaires"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { cn } from "@/lib/utils"
import { Users, Check } from "lucide-react"

const ROLES = [
  { key: "all", label: "Tous" },
  { key: "admin", label: "Admin" },
  { key: "manager", label: "Manager" },
  { key: "gestionnaire", label: "Gestionnaire" },
] as const

interface AudienceSelectorProps {
  audience: string[]
  targetUserIds: string[]
  onChange: (audience: string[], targetUserIds: string[]) => void
}

/** Retourne les utilisateurs d'un rôle */
function getUsersOfRole(gestionnaires: Gestionnaire[], role: string): Gestionnaire[] {
  return gestionnaires.filter(g =>
    (g.roles || []).some(r => r.toLowerCase() === role) ||
    (g.role || "").toLowerCase() === role
  )
}

/** Résout audience + targetUserIds en un Set d'IDs sélectionnés */
function resolveInitialSelection(
  audience: string[],
  targetUserIds: string[],
  gestionnaires: Gestionnaire[]
): Set<string> {
  const ids = new Set<string>()

  if (audience.includes("all")) {
    gestionnaires.forEach(g => ids.add(g.id))
  } else {
    for (const role of audience) {
      getUsersOfRole(gestionnaires, role).forEach(g => ids.add(g.id))
    }
  }

  targetUserIds.forEach(id => ids.add(id))
  return ids
}

/** Calcule la sortie optimale (audience + target_user_ids) depuis un Set d'IDs */
function computeOutput(
  selectedIds: Set<string>,
  gestionnaires: Gestionnaire[]
): { audience: string[]; targetUserIds: string[] } {
  if (selectedIds.size === 0) return { audience: [], targetUserIds: [] }

  // Tous sélectionnés → audience: ["all"]
  if (selectedIds.size === gestionnaires.length && gestionnaires.length > 0) {
    return { audience: ["all"], targetUserIds: [] }
  }

  // Vérifier si la sélection correspond exactement à des rôles entiers
  const matchedRoles: string[] = []
  const coveredIds = new Set<string>()

  for (const role of ROLES) {
    if (role.key === "all") continue
    const usersOfRole = getUsersOfRole(gestionnaires, role.key)
    if (usersOfRole.length > 0 && usersOfRole.every(u => selectedIds.has(u.id))) {
      matchedRoles.push(role.key)
      usersOfRole.forEach(u => coveredIds.add(u.id))
    }
  }

  const extraIds = [...selectedIds].filter(id => !coveredIds.has(id))

  // Sélection = rôles entiers uniquement → audience: [roles]
  if (extraIds.length === 0 && matchedRoles.length > 0) {
    return { audience: matchedRoles, targetUserIds: [] }
  }

  // Mix rôles + individuels → tout dans target_user_ids (car le backend ignore audience si target_user_ids est non-vide)
  return { audience: [], targetUserIds: [...selectedIds] }
}

export function AudienceSelector({ audience, targetUserIds, onChange }: AudienceSelectorProps) {
  const { data: gestionnaires } = useGestionnaires()

  // État central : Set d'IDs sélectionnés
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [initialized, setInitialized] = useState(false)

  // Initialiser depuis les props quand les gestionnaires arrivent
  useEffect(() => {
    if (!gestionnaires || gestionnaires.length === 0 || initialized) return
    setSelectedIds(resolveInitialSelection(audience, targetUserIds, gestionnaires))
    setInitialized(true)
  }, [gestionnaires, audience, targetUserIds, initialized])

  // Propager les changements
  const emitChange = useCallback((ids: Set<string>) => {
    if (!gestionnaires) return
    const output = computeOutput(ids, gestionnaires)
    onChange(output.audience, output.targetUserIds)
  }, [gestionnaires, onChange])

  // État dérivé : quel rôle est entièrement sélectionné
  const roleStates = useMemo(() => {
    if (!gestionnaires) return {} as Record<string, { total: number; selected: number }>
    const states: Record<string, { total: number; selected: number }> = {}
    for (const role of ROLES) {
      if (role.key === "all") {
        states.all = { total: gestionnaires.length, selected: selectedIds.size }
      } else {
        const users = getUsersOfRole(gestionnaires, role.key)
        states[role.key] = {
          total: users.length,
          selected: users.filter(u => selectedIds.has(u.id)).length,
        }
      }
    }
    return states
  }, [gestionnaires, selectedIds])

  // Toggle un rôle entier
  const toggleRole = useCallback((roleKey: string) => {
    if (!gestionnaires) return
    const next = new Set(selectedIds)

    if (roleKey === "all") {
      if (selectedIds.size === gestionnaires.length) {
        // Tout décocher
        next.clear()
      } else {
        // Tout cocher
        gestionnaires.forEach(g => next.add(g.id))
      }
    } else {
      const users = getUsersOfRole(gestionnaires, roleKey)
      const allSelected = users.every(u => next.has(u.id))
      if (allSelected) {
        users.forEach(u => next.delete(u.id))
      } else {
        users.forEach(u => next.add(u.id))
      }
    }

    setSelectedIds(next)
    emitChange(next)
  }, [gestionnaires, selectedIds, emitChange])

  // Toggle un utilisateur individuel
  const toggleUser = useCallback((userId: string) => {
    const next = new Set(selectedIds)
    if (next.has(userId)) {
      next.delete(userId)
    } else {
      next.add(userId)
    }
    setSelectedIds(next)
    emitChange(next)
  }, [selectedIds, emitChange])

  // Résumé textuel compact
  const summary = useMemo(() => {
    if (!gestionnaires || gestionnaires.length === 0) return "Aucun ciblage"
    if (selectedIds.size === 0) return "Aucun ciblage"
    if (selectedIds.size === gestionnaires.length) return "Tous les utilisateurs"

    const activeRoleLabels: string[] = []
    let coveredCount = 0
    for (const role of ROLES) {
      if (role.key === "all") continue
      const users = getUsersOfRole(gestionnaires, role.key)
      if (users.length > 0 && users.every(u => selectedIds.has(u.id))) {
        activeRoleLabels.push(role.label)
        coveredCount += users.length
      }
    }

    // Éviter double-comptage : un user peut avoir plusieurs rôles
    const coveredSet = new Set<string>()
    for (const role of ROLES) {
      if (role.key === "all") continue
      const users = getUsersOfRole(gestionnaires, role.key)
      if (users.length > 0 && users.every(u => selectedIds.has(u.id))) {
        users.forEach(u => coveredSet.add(u.id))
      }
    }
    const extraCount = [...selectedIds].filter(id => !coveredSet.has(id)).length

    if (activeRoleLabels.length > 0 && extraCount > 0) {
      return `${activeRoleLabels.join(", ")} + ${extraCount}`
    }
    if (activeRoleLabels.length > 0) return activeRoleLabels.join(", ")
    return `${selectedIds.size} utilisateur${selectedIds.size > 1 ? "s" : ""}`
  }, [gestionnaires, selectedIds])

  // Rôle d'un utilisateur pour l'affichage
  const getUserRole = useCallback((g: Gestionnaire): string | null => {
    const roles = (g.roles || []).map(r => r.toLowerCase())
    const role = (g.role || "").toLowerCase()
    for (const r of ROLES) {
      if (r.key === "all") continue
      if (roles.includes(r.key) || role === r.key) return r.label
    }
    return null
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Ciblage
        </label>
        <span className="text-[11px] text-muted-foreground">{summary}</span>
      </div>

      {/* Boutons de rôle (raccourcis de groupe) */}
      <div className="flex flex-wrap gap-1.5">
        {ROLES.map(rf => {
          const state = roleStates[rf.key]
          const isAll = state && state.total > 0 && state.selected === state.total
          const isPartial = state && state.selected > 0 && state.selected < state.total
          return (
            <button
              key={rf.key}
              type="button"
              onClick={() => toggleRole(rf.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all",
                isAll
                  ? "bg-primary text-primary-foreground"
                  : isPartial
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {rf.label}
              {state && state.total > 0 && (
                <span className={cn(
                  "text-[10px] tabular-nums",
                  isAll ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
                  {state.selected}/{state.total}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Grille d'utilisateurs (toujours visible) */}
      {gestionnaires && gestionnaires.length > 0 && (
        <div className="rounded-lg border bg-muted/20 p-2">
          <div className="flex flex-wrap gap-1.5">
            {gestionnaires.map(g => {
              const isSelected = selectedIds.has(g.id)
              const roleLabel = getUserRole(g)
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleUser(g.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-xs transition-all",
                    isSelected
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "bg-background opacity-50 hover:opacity-100 border border-transparent hover:border-border"
                  )}
                >
                  <div className="relative">
                    <GestionnaireBadge
                      firstname={g.firstname}
                      lastname={g.lastname}
                      color={g.color}
                      avatarUrl={g.avatar_url}
                      size="xs"
                      showBorder={false}
                    />
                    {isSelected && (
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2 w-2 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start leading-none">
                    <span className="font-medium">
                      {g.firstname} {g.lastname?.[0]}.
                    </span>
                    {roleLabel && (
                      <span className="text-[9px] text-muted-foreground mt-0.5">{roleLabel}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
