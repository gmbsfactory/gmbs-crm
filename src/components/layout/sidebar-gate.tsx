"use client"

import { usePathname } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { useInterface } from "@/contexts/interface-context"

// Pages where sidebar should be hidden (auth pages, portail artisan, etc.)
const HIDE_SIDEBAR_PATHS = ["/login", "/set-password", "/auth/callback", "/portail"]

export default function SidebarGate({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname()
  const { sidebarEnabled } = useInterface()
  // Hide sidebar on auth-related pages
  const hideOnAuthPage = HIDE_SIDEBAR_PATHS.some(path => pathname?.startsWith(path))
  // Requirement: sidebar should be hidden on auth pages
  const show = !hideOnAuthPage && sidebarEnabled
  return show ? <AppSidebar /> : null
}
