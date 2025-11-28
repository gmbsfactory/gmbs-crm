"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Home,
  HardHat,
  Settings,
  Calculator,
  Wrench,
} from "lucide-react"
import { useInterface } from "@/contexts/interface-context"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { t } from "@/config/domain"

type NavItem = { type: "link"; name: string; href: string; icon: React.ComponentType<{ className?: string }> } | { type: "spacer" }

export function AppSidebar() {
  const pathname = usePathname()
  // Source sidebar mode from Interface context to reflect Settings → Interface choices
  const { sidebarMode } = useInterface()
  const { data: currentUser } = useCurrentUser()

  const roles = currentUser?.roles || []
  const hasRoleAccess = roles.some((role) => {
    const normalized = (role || "").toLowerCase()
    return normalized === "admin" || normalized === "manager"
  })
  const hasPagePermission = currentUser?.page_permissions?.comptabilite !== false
  const canAccessComptabilite = hasRoleAccess && hasPagePermission

  const navigation: NavItem[] = [
    { type: "link", name: t("dashboard"), href: "/dashboard", icon: Home },
    { type: "spacer" },
    { type: "link", name: t("deals"), href: "/interventions", icon: Wrench },
    ...(canAccessComptabilite
      ? [{ type: "link", name: "Comptabilité", href: "/comptabilite", icon: Calculator }] as NavItem[]
      : []),
    { type: "link", name: t("contacts"), href: "/artisans", icon: HardHat },
    { type: "spacer" },
    { type: "link", name: "Paramètres", href: "/settings", icon: Settings },
  ]

  const collapses = sidebarMode === "collapsed" || sidebarMode === "hybrid"
  const expandOnHover = sidebarMode === "hybrid"

  return (
    <div
      className={cn(
        "relative group/sidebar flex flex-col bg-transparent transition-[width] duration-200 ease-out",
        sidebarMode === "expanded" ? "w-72" : "w-20",
        // Hybrid expands only on hover (not focus) to avoid sticking open after click
        expandOnHover && "hover:w-72"
      )}
      style={{ height: "calc(100vh - 4rem)" }}
      data-mode={sidebarMode}
      aria-label="Application Sidebar"
    >
      <nav className={cn(
        "flex-1 space-y-1 pr-5 py-10 rounded-r-lg border-r bg-background",
        sidebarMode === "collapsed" ? "pl-9" : "pl-7"
      )}>
        {navigation.map((item, idx) => {
          if (item.type === "spacer") {
            return <div key={`sp-${idx}`} className="h-0" aria-hidden="true" />
          }
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <div key={item.name}>
              <Link href={item.href} className="block outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full gap-3",
                    sidebarMode === "expanded" && "justify-start",
                    sidebarMode === "hybrid" && "justify-start",
                    sidebarMode === "collapsed" && "justify-center",
                    isActive && "bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span
                    className={cn(
                      "text-sm transition-opacity duration-200",
                      sidebarMode === "expanded" ? "opacity-100" : "opacity-0",
                      sidebarMode === "hybrid" && "group-hover/sidebar:opacity-100",
                      sidebarMode === "collapsed" && "hidden"
                    )}
                  >
                    {item.name}
                  </span>
                </Button>
              </Link>
            </div>
          )
        })}
      </nav>
    </div>
  )
}
