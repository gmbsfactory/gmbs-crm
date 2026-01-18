"use client"

import { usePathname } from "next/navigation"
import Topbar from "@/components/layout/topbar"

// Pages where topbar should be hidden (auth pages, portail artisan, etc.)
const HIDE_TOPBAR_PATHS = ["/login", "/set-password", "/auth/callback", "/portail"]

export default function TopbarGate() {
  const pathname = usePathname()
  const hideOnAuthPage = HIDE_TOPBAR_PATHS.some(path => pathname?.startsWith(path))
  return hideOnAuthPage ? null : <Topbar />
}

