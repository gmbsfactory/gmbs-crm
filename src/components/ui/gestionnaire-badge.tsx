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
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
  onClick?: () => void
  showBorder?: boolean
  children?: React.ReactNode
}

const sizeMap = {
  xs: { container: "h-6 w-6", border: "border", text: "text-[0.65rem]" },
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
  const first = firstname || prenom || ''
  const last = lastname || name || ''
  const firstInitial = first?.[0]?.toUpperCase() || ''
  const lastInitial = last?.[0]?.toUpperCase() || ''
  const initials = (firstInitial + lastInitial) || '?'
  const displayName = `${first} ${last}`.trim() || 'User'

  // Couleur par défaut si aucune couleur assignée
  const defaultColor = "#6b7280" // gris neutre
  const userColor = color || defaultColor
  const sizeConfig = sizeMap[size]

  // Calcul dynamique du contraste texte noir/blanc selon luminosité du fond
  const getTextColor = (bgColor: string): string => {
    const hex = bgColor.startsWith('#') ? bgColor.slice(1) : bgColor
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#ffffff'
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.65 ? '#000000' : '#ffffff'
  }
  const fallbackTextColor = getTextColor(userColor)

  // Structure identique à SettingsRoot.tsx qui fonctionne
  return (
    <div
      className={cn(
        "rounded-full overflow-hidden flex-shrink-0 inline-flex items-center justify-center",
        sizeConfig.container,
        showBorder && sizeConfig.border,
        onClick && "cursor-pointer transition-transform hover:scale-110",
        className
      )}
      style={{ 
        borderColor: showBorder ? userColor : undefined,
        backgroundColor: userColor,
        minWidth: size === 'xs' ? '24px' : size === 'sm' ? '32px' : size === 'md' ? '36px' : '48px',
        minHeight: size === 'xs' ? '24px' : size === 'sm' ? '32px' : size === 'md' ? '36px' : '48px',
      }}
      onClick={onClick}
      title={displayName}
    >
      <Avatar className="h-full w-full" style={{ background: userColor }}>
        {avatarUrl && (
          <AvatarImage
            src={avatarUrl}
            alt={displayName}
            className="object-cover"
          />
        )}
        <AvatarFallback 
          className={cn(sizeConfig.text, "font-semibold uppercase")}
          style={{ 
            background: userColor,
            color: fallbackTextColor,
          }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {children}
    </div>
  )
}

