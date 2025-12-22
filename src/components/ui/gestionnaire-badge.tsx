"use client"

import * as React from "react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export interface GestionnaireBadgeProps {
  firstname?: string | null
  lastname?: string | null
  prenom?: string | null
  name?: string | null
  color?: string | null
  avatarUrl?: string | null
  size?: "sm" | "md" | "lg"
  className?: string
  onClick?: () => void
  showBorder?: boolean
  children?: React.ReactNode
}

const sizeMap = {
  sm: { container: "h-8 w-8", border: "border-2", text: "text-xs" },
  md: { container: "h-9 w-9", border: "border-4", text: "text-sm" },
  lg: { container: "h-12 w-12", border: "border-4", text: "text-base" },
}

export function GestionnaireBadge({
  firstname,
  lastname,
  prenom,
  name,
  color,
  avatarUrl,
  size = "md",
  className,
  onClick,
  showBorder = true,
  children,
}: GestionnaireBadgeProps) {
  const initials = React.useMemo(() => {
    const first = firstname || prenom
    const last = lastname || name
    const firstInitial = first?.[0] || ""
    const lastInitial = last?.[0] || ""
    return (firstInitial + lastInitial).toUpperCase() || "?"
  }, [firstname, lastname, prenom, name])

  // Couleur par défaut si aucune couleur assignée
  const defaultColor = "#6b7280" // gris neutre
  const borderColor = color || defaultColor
  const bgColor = color || defaultColor
  const textColor = "#ffffff" // toujours blanc pour lisibilité
  const sizeConfig = sizeMap[size]

  return (
    <div
      className={cn(
        "rounded-full overflow-hidden select-none",
        sizeConfig.container,
        showBorder && sizeConfig.border,
        onClick && "cursor-pointer transition-transform hover:scale-110",
        className
      )}
      style={{
        borderColor: showBorder ? borderColor : undefined,
        background: bgColor,
      }}
      onClick={onClick}
    >
      <Avatar className="h-full w-full" style={{ background: bgColor }}>
        {avatarUrl && (
          <AvatarImage
            src={avatarUrl}
            alt={`${firstname || prenom || ''} ${lastname || name || ''}`.trim() || 'User'}
            className="object-cover"
          />
        )}
        <AvatarFallback
          className={cn(sizeConfig.text, "font-semibold uppercase")}
          style={{
            background: bgColor,
            color: textColor,
          }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {children}
    </div>
  )
}

