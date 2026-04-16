"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { interventionsApi } from "@/lib/api"
import { GestionnaireField } from "@/components/interventions/GestionnaireField"

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
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: async (newUserId: string) => {
      return interventionsApi.update(interventionId, { assigned_user_id: newUserId || null })
    },
    onSuccess: (_, newUserId) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] })
      const user = referenceData?.allUsers?.find(u => u.id === newUserId)
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
    <GestionnaireField
      value={currentUserId}
      onChange={(userId) => updateMutation.mutate(userId)}
      interventionDate={dateIntervention}
      stopPropagation
      triggerDisplay={{
        firstname: currentUserFirstname,
        lastname: currentUserLastname,
        color: currentUserColor,
        avatarUrl: currentUserAvatarUrl,
      }}
    />
  )
}
