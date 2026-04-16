"use client"

import { useMemo } from "react"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { getSelectableUsers } from "@/lib/interventions/derivations"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { GestionnairePopover } from "@/components/ui/gestionnaire-popover"
import { cn } from "@/lib/utils"

interface TriggerDisplay {
  firstname?: string
  lastname?: string
  color?: string | null
  avatarUrl?: string | null
}

interface GestionnaireFieldProps {
  /** Currently assigned user id (controlled). */
  value: string | null | undefined
  /** Called with the new user id, or "" for "Non attribué". */
  onChange: (userId: string) => void
  /** Intervention date — filters archived users eligible at that time. */
  interventionDate?: string | null
  /** When true, draws an orange ring + pulse dot if no user is assigned. */
  required?: boolean
  /** Notifies parent of popover open/close (useful for FocusTrap pause). */
  onOpenChange?: (isOpen: boolean) => void
  /** Stop propagation on trigger click (for table rows, etc). */
  stopPropagation?: boolean
  /**
   * Optional override for the trigger badge display. When omitted, the badge
   * is resolved from reference data using `value`. Pass this when the parent
   * already has denormalized user fields (e.g. TableView rows).
   */
  triggerDisplay?: TriggerDisplay
}

export function GestionnaireField({
  value,
  onChange,
  interventionDate,
  required = false,
  onOpenChange,
  stopPropagation = false,
  triggerDisplay,
}: GestionnaireFieldProps) {
  const { data: refData } = useReferenceDataQuery()
  const { data: currentUser } = useCurrentUser()

  const selectableUsers = useMemo(
    () =>
      getSelectableUsers({
        activeUsers: refData?.users ?? [],
        allUsers: refData?.allUsers,
        interventionDate: interventionDate ?? null,
        currentUserId: currentUser?.id,
      }),
    [refData?.users, refData?.allUsers, interventionDate, currentUser?.id],
  )

  const resolvedDisplay: TriggerDisplay = useMemo(() => {
    if (triggerDisplay) return triggerDisplay
    if (!value) return { firstname: "?", color: "#9ca3af" }
    const user =
      selectableUsers.find((u) => u.id === value) ??
      refData?.allUsers?.find((u) => u.id === value)
    return {
      firstname: user?.firstname,
      lastname: user?.lastname,
      color: user?.color,
      avatarUrl: user?.avatar_url,
    }
  }, [triggerDisplay, value, selectableUsers, refData?.allUsers])

  const showMissingRing = required && !value

  return (
    <div className="flex items-center relative">
      <GestionnairePopover
        users={selectableUsers}
        currentUserId={value ?? null}
        onSelect={onChange}
        onOpenChange={onOpenChange}
        triggerProps={{
          className: cn(
            "flex items-center justify-center h-7 w-7 cursor-pointer group rounded-full",
            showMissingRing && "ring-2 ring-orange-400 ring-offset-1",
          ),
          title: showMissingRing ? "Attribution obligatoire pour ce statut" : undefined,
          onClick: stopPropagation ? (e) => e.stopPropagation() : undefined,
        }}
        trigger={
          <GestionnaireBadge
            firstname={resolvedDisplay.firstname}
            lastname={resolvedDisplay.lastname}
            color={resolvedDisplay.color ?? undefined}
            avatarUrl={resolvedDisplay.avatarUrl ?? undefined}
            size="sm"
            className="transition-transform group-hover:scale-110 h-7 w-7"
          />
        }
      />
      {showMissingRing && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
      )}
    </div>
  )
}
