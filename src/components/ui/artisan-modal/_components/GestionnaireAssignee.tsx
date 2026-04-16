"use client"

import { Controller, type Control } from "react-hook-form"
import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { GestionnairePopover, type SelectableUser } from "@/components/ui/gestionnaire-popover"

type Props = {
  control: Control<any>
  name?: string
  users: SelectableUser[]
}

export function GestionnaireAssignee({ control, name = "gestionnaire_id", users }: Props) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        const assignedUser = users.find(u => u.id === field.value)
        const displayName =
          [assignedUser?.firstname, assignedUser?.lastname].filter(Boolean).join(" ").trim() ||
          assignedUser?.username

        return (
          <div className="flex items-center gap-2">
            <GestionnairePopover
              trigger={
                <GestionnaireBadge
                  firstname={assignedUser?.firstname}
                  lastname={assignedUser?.lastname}
                  color={assignedUser?.color}
                  avatarUrl={assignedUser?.avatar_url}
                  size="sm"
                  className="transition-transform hover:scale-110 h-8 w-8"
                />
              }
              users={users}
              currentUserId={field.value || null}
              onSelect={(userId) => field.onChange(userId)}
            />
            {assignedUser && (
              <Badge
                variant="secondary"
                className="text-xs px-2 py-0.5 h-auto flex items-center gap-1"
                style={{
                  backgroundColor: assignedUser.color ? `${assignedUser.color}20` : undefined,
                  borderColor: assignedUser.color || undefined,
                  color: assignedUser.color || undefined,
                }}
              >
                {displayName}
                <button
                  type="button"
                  className="ml-0.5 hover:text-destructive focus:outline-none"
                  onClick={() => field.onChange("")}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )
      }}
    />
  )
}
