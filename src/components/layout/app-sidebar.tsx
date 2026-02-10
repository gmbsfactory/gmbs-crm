"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useInterface } from "@/contexts/interface-context"
import { usePermissions } from "@/hooks/usePermissions"
import { buildNavigation, type NavItem } from "@/config/navigation"

export function AppSidebar() {
  const pathname = usePathname()
  // Source sidebar mode from Interface context to reflect Settings → Interface choices
  const { sidebarMode } = useInterface()
  const { can, canAccessPage } = usePermissions()

  const navigation = buildNavigation(can, canAccessPage)

  const collapses = sidebarMode === "collapsed" || sidebarMode === "hybrid"
  const expandOnHover = sidebarMode === "hybrid"

  return (
    <div
      className={cn(
        "sticky top-0 group/sidebar flex flex-col bg-transparent transition-[width] duration-200 ease-out z-[45]",
        sidebarMode === "expanded" ? "w-72" : "w-20",
        // Hybrid expands only on hover (not focus) to avoid sticking open after click
        expandOnHover && "hover:w-72"
      )}
      style={{ height: "calc(100vh - 4rem)" }}
      data-mode={sidebarMode}
      aria-label="Application Sidebar"
    >
      <nav className={cn(
        "flex-1 space-y-1 pr-5 py-10 rounded-r-lg liquid-glass-sidebar",
        sidebarMode === "expanded" ? "pl-7" : "pl-9",
        expandOnHover && "group-hover/sidebar:pl-7"
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
                    sidebarMode === "hybrid" && "justify-center group-hover/sidebar:justify-start",
                    sidebarMode === "collapsed" && "justify-center",
                    isActive && "bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span
                    className={cn(
                      "text-sm transition-opacity duration-200",
                      sidebarMode === "expanded" ? "opacity-100" : "opacity-0",
                      sidebarMode === "hybrid" && "hidden group-hover/sidebar:inline group-hover/sidebar:opacity-100",
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
