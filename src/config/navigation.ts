import {
  Home,
  HardHat,
  Settings,
  Calculator,
  Wrench,
} from "lucide-react"
import { t } from "./domain"
import type { PermissionKey } from "@/hooks/usePermissions"

/**
 * Type partagé pour les items de navigation
 * Utilisé par app-sidebar.tsx et topbar.tsx
 */
export type NavItem =
  | { type: "link"; name: string; href: string; icon: React.ComponentType<{ className?: string }> }
  | { type: "spacer" }

/**
 * Configuration d'une route avec ses permissions
 */
type RouteConfig = {
  name: string | (() => string) // Support pour traductions dynamiques
  href: string
  icon: React.ComponentType<{ className?: string }>
  permission?: {
    type: "simple" | "page_override"
    key: PermissionKey
    pageOverrideKey?: string // Pour comptabilité
  }
}

/**
 * Configuration statique des routes (ordre et structure)
 * Cette configuration définit toutes les routes disponibles dans l'application
 */
const ROUTE_CONFIG: (RouteConfig | { type: "spacer" })[] = [
  {
    name: () => t("dashboard"),
    href: "/dashboard",
    icon: Home,
  },
  { type: "spacer" },
  {
    name: () => t("deals"),
    href: "/interventions",
    icon: Wrench,
    permission: { type: "simple", key: "read_interventions" },
  },
  {
    name: "Comptabilité",
    href: "/comptabilite",
    icon: Calculator,
    permission: {
      type: "page_override",
      key: "view_comptabilite",
      pageOverrideKey: "comptabilite",
    },
  },
  {
    name: () => t("contacts"),
    href: "/artisans",
    icon: HardHat,
    permission: { type: "simple", key: "read_artisans" },
  },
  { type: "spacer" },
  {
    name: "Paramètres",
    href: "/settings",
    icon: Settings,
  },
]

/**
 * Fonction pour construire la navigation basée sur les permissions de l'utilisateur
 * 
 * @param can - Fonction pour vérifier une permission simple
 * @param canAccessPage - Fonction pour vérifier une permission avec override de page
 * @returns Tableau d'items de navigation filtrés selon les permissions
 */
export function buildNavigation(
  can: (permission: PermissionKey) => boolean,
  canAccessPage: (permission: PermissionKey, pageKey?: string) => boolean
): NavItem[] {
  const navigation: NavItem[] = []

  for (const item of ROUTE_CONFIG) {
    // Gérer les séparateurs (spacers)
    if ("type" in item && item.type === "spacer") {
      navigation.push({ type: "spacer" })
      continue
    }

    const route = item as RouteConfig

    // Vérifier les permissions si nécessaire
    if (route.permission) {
      if (route.permission.type === "page_override") {
        // Permission avec override de page (ex: comptabilité)
        if (!canAccessPage(route.permission.key, route.permission.pageOverrideKey)) {
          continue // Skip cette route si pas de permission
        }
      } else {
        // Permission simple
        if (!can(route.permission.key)) {
          continue // Skip cette route si pas de permission
        }
      }
    }

    // Résoudre le nom (support pour fonctions de traduction)
    const name = typeof route.name === "function" ? route.name() : route.name

    // Ajouter la route à la navigation
    navigation.push({
      type: "link",
      name,
      href: route.href,
      icon: route.icon,
    })
  }

  return navigation
}


