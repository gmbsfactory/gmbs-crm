"use client"

import React from "react"
import { ArrowRight, UserPlus, FileText, Mail, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AISuggestedAction } from "@/lib/ai/types"
import { cn } from "@/lib/utils"

interface AIActionButtonProps {
  action: AISuggestedAction
  onExecute: (action: AISuggestedAction) => void
}

const ACTION_ICONS: Record<string, React.ElementType> = {
  'arrow-right': ArrowRight,
  'user-plus': UserPlus,
  'file-text': FileText,
  'mail': Mail,
  'message-square': MessageSquare,
}

export function AIActionButton({ action, onExecute }: AIActionButtonProps) {
  const Icon = ACTION_ICONS[action.icon ?? ''] ?? ArrowRight

  const isStatusChange = action.action_type === 'change_status'
  const statusColor = isStatusChange ? action.status_color : undefined

  const button = (
    <Button
      variant={action.disabled ? "ghost" : isStatusChange ? "outline" : "ghost"}
      size="sm"
      disabled={action.disabled}
      onClick={() => onExecute(action)}
      className={cn(
        "justify-start gap-2 h-auto py-2 px-3 text-left w-full",
        action.disabled && "opacity-50 cursor-not-allowed",
        !action.disabled && !isStatusChange && "hover:bg-muted",
        isStatusChange && !action.disabled && "border",
      )}
      style={
        isStatusChange && statusColor && !action.disabled
          ? {
              borderColor: `${statusColor}40`,
              backgroundColor: `${statusColor}08`,
            }
          : undefined
      }
    >
      <span
        className={cn(
          "flex-shrink-0 flex items-center justify-center w-6 h-6 rounded",
          isStatusChange && statusColor ? "text-white" : "text-muted-foreground bg-muted",
        )}
        style={
          isStatusChange && statusColor
            ? { backgroundColor: statusColor }
            : undefined
        }
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">{action.label}</span>
        <span className="text-xs text-muted-foreground truncate">{action.description}</span>
      </span>
    </Button>
  )

  if (action.disabled && action.disabled_reason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" className="max-w-[200px]">
          <p className="text-xs">{action.disabled_reason}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return button
}
