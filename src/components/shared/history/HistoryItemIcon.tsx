"use client"

import {
  Activity,
  Archive,
  ArrowRight,
  CalendarOff,
  CreditCard,
  DollarSign,
  Edit,
  FileText,
  FileX,
  MapPin,
  MessageSquare,
  Plus,
  RotateCcw,
  UserMinus,
  UserPlus,
  Wrench,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type IconVariant = "success" | "info" | "warning" | "danger" | "neutral" | "primary"

type IconConfig = {
  icon: LucideIcon
  variant: IconVariant
}

const VARIANT_CLASSES: Record<IconVariant, { container: string; icon: string }> = {
  success: {
    container: "history-icon--success",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  info: {
    container: "history-icon--info",
    icon: "text-sky-600 dark:text-sky-400",
  },
  warning: {
    container: "history-icon--warning",
    icon: "text-amber-600 dark:text-amber-400",
  },
  danger: {
    container: "history-icon--danger",
    icon: "text-rose-600 dark:text-rose-400",
  },
  neutral: {
    container: "history-icon--neutral",
    icon: "text-slate-500 dark:text-slate-400",
  },
  primary: {
    container: "history-icon--primary",
    icon: "text-violet-600 dark:text-violet-400",
  },
}

const DEFAULT_CONFIG: IconConfig = {
  icon: Activity,
  variant: "neutral",
}

const getConfig = (actionType: string | null | undefined): IconConfig => {
  const normalized = (actionType || "").toUpperCase()

  // Creation
  if (normalized === "CREATE") {
    return { icon: Plus, variant: "success" }
  }

  // Update
  if (normalized === "UPDATE") {
    return { icon: Edit, variant: "info" }
  }

  // Archive
  if (normalized === "ARCHIVE") {
    return { icon: Archive, variant: "neutral" }
  }

  // Restore
  if (normalized === "RESTORE") {
    return { icon: RotateCcw, variant: "success" }
  }

  // Status change
  if (normalized === "STATUS_CHANGE") {
    return { icon: ArrowRight, variant: "primary" }
  }

  // Costs (intervention-specific)
  if (normalized.startsWith("COST_")) {
    if (normalized.endsWith("DELETE")) {
      return { icon: DollarSign, variant: "danger" }
    }
    return { icon: DollarSign, variant: "success" }
  }

  // Payments (intervention-specific)
  if (normalized.startsWith("PAYMENT_")) {
    if (normalized.endsWith("DELETE")) {
      return { icon: CreditCard, variant: "danger" }
    }
    return { icon: CreditCard, variant: "warning" }
  }

  // Documents
  if (normalized.startsWith("DOCUMENT_")) {
    if (normalized.endsWith("DELETE")) {
      return { icon: FileX, variant: "danger" }
    }
    return { icon: FileText, variant: "info" }
  }

  // Comments
  if (normalized.startsWith("COMMENT_")) {
    if (normalized.endsWith("DELETE")) {
      return { icon: MessageSquare, variant: "danger" }
    }
    return { icon: MessageSquare, variant: "warning" }
  }

  // Artisan assignment (intervention-specific)
  if (normalized.startsWith("ARTISAN_")) {
    if (normalized === "ARTISAN_ASSIGN") {
      return { icon: UserPlus, variant: "primary" }
    }
    if (normalized === "ARTISAN_UNASSIGN") {
      return { icon: UserMinus, variant: "danger" }
    }
    return { icon: Wrench, variant: "primary" }
  }

  // Metiers (artisan-specific)
  if (normalized.startsWith("METIER_")) {
    if (normalized === "METIER_REMOVE") {
      return { icon: Wrench, variant: "danger" }
    }
    return { icon: Wrench, variant: "success" }
  }

  // Zones (artisan-specific)
  if (normalized.startsWith("ZONE_")) {
    if (normalized === "ZONE_REMOVE") {
      return { icon: MapPin, variant: "danger" }
    }
    return { icon: MapPin, variant: "success" }
  }

  // Absences (artisan-specific)
  if (normalized.startsWith("ABSENCE_")) {
    if (normalized === "ABSENCE_DELETE") {
      return { icon: CalendarOff, variant: "danger" }
    }
    if (normalized === "ABSENCE_UPDATE") {
      return { icon: CalendarOff, variant: "info" }
    }
    return { icon: CalendarOff, variant: "warning" }
  }

  return DEFAULT_CONFIG
}

interface HistoryItemIconProps {
  actionType?: string | null
  size?: "sm" | "md"
}

export function HistoryItemIcon({ actionType, size = "md" }: HistoryItemIconProps) {
  const config = getConfig(actionType)
  const variantClasses = VARIANT_CLASSES[config.variant]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "history-icon",
        variantClasses.container,
        size === "sm" && "history-icon--sm"
      )}
    >
      <Icon className={cn(
        size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
        variantClasses.icon
      )} />
    </div>
  )
}
