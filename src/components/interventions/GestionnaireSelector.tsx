"use client"

import { useMemo } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import type { ReferenceData } from "@/lib/reference-api"
import { interventionsApi } from "@/lib/api/v2"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { GestionnairePopover } from "@/components/ui/gestionnaire-popover"

/**
 * Returns selectable users for an intervention:
 * - All active users
 * - Archived users whose archived_at > dateIntervention (still active at intervention time)
 */
function getSelectableUsers(
  activeUsers: ReferenceData["users"] | undefined,
  allUsers: ReferenceData["allUsers"] | undefined,
  dateIntervention?: string | null,
) {
  const active = activeUsers ?? []
  if (!allUsers || !dateIntervention) return active

  const interventionDate = new Date(dateIntervention)
  if (Number.isNaN(interventionDate.getTime())) return active

  const activeIds = new Set(active.map(u => u.id))

  const archivedEligible = allUsers.filter(
    u => u.status === "archived" && u.archived_at && !activeIds.has(u.id) && new Date(u.archived_at) > interventionDate
  )

  return [...active, ...archivedEligible]
}

interface GestionnaireSelectorProps {
  interventionId: string
  currentUserId: string | null
  currentUserFirstname: string
  currentUserLastname?: string
  currentUserColor?: string
  currentUserAvatarUrl?: string
  dateIntervention?: string | null
  onUpdate?: (userId: string) => void
}

export function GestionnaireSelector({
  interventionId,
  currentUserId,
  currentUserFirstname,
  currentUserLastname,
  currentUserColor,
  currentUserAvatarUrl,
  dateIntervention,
  onUpdate,
}: GestionnaireSelectorProps) {
  const { data: referenceData } = useReferenceDataQuery()
  const { data: loggedInUser } = useCurrentUser()
  const queryClient = useQueryClient()

  const selectableUsers = useMemo(() => {
    const users = getSelectableUsers(referenceData?.users, referenceData?.allUsers, dateIntervention)
    return users.sort((a, b) => {
      if (a.id === loggedInUser?.id) return -1
      if (b.id === loggedInUser?.id) return 1
      return 0
    })
  }, [referenceData?.users, referenceData?.allUsers, dateIntervention, loggedInUser?.id])

  const updateMutation = useMutation({
    mutationFn: async (newUserId: string) => {
      return interventionsApi.update(interventionId, { assigned_user_id: newUserId || undefined })
    },
    onSuccess: (_, newUserId) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] })
      const user = selectableUsers.find(u => u.id === newUserId)
      const userName = user
        ? [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username
        : "Non assigné"
      toast.success(`Intervention assignée à ${userName}`)
      onUpdate?.(newUserId)
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour de l'assignation")
    },
  })

  return (
    <GestionnairePopover
      users={selectableUsers}
      currentUserId={currentUserId}
      onSelect={(userId) => updateMutation.mutate(userId)}
      triggerProps={{
        className: "flex items-center justify-center h-7 w-7 cursor-pointer group rounded-full",
        onClick: (e) => e.stopPropagation(),
      }}
      trigger={
        <GestionnaireBadge
          firstname={currentUserFirstname}
          lastname={currentUserLastname}
          color={currentUserColor}
          avatarUrl={currentUserAvatarUrl}
          size="sm"
          className="transition-transform group-hover:scale-110 h-7 w-7"
        />
      }
    />
  )
}
