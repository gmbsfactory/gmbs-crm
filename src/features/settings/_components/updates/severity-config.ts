import {
  Info,
  AlertTriangle,
  Zap,
  Sparkles,
  Bug,
} from "lucide-react"
import type { AppUpdateSeverity } from "@/types/app-updates"

export interface SeverityConfig {
  label: string
  color: string
  icon: typeof Info
}

const SEVERITY_MAP: Record<AppUpdateSeverity, SeverityConfig> = {
  info: {
    label: "Info",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    icon: Info,
  },
  important: {
    label: "Important",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    icon: AlertTriangle,
  },
  breaking: {
    label: "Breaking",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    icon: Zap,
  },
  feature: {
    label: "Feature",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    icon: Sparkles,
  },
  fix: {
    label: "Fix",
    color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    icon: Bug,
  },
}

export const ALL_SEVERITIES: AppUpdateSeverity[] = ['info', 'important', 'breaking', 'feature', 'fix']

export function getSeverityConfig(severity: AppUpdateSeverity): SeverityConfig {
  return SEVERITY_MAP[severity] || SEVERITY_MAP.info
}
