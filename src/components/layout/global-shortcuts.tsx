"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { usePlatformKey } from "@/hooks/usePlatformKey"

const ROUTE_CYCLE = [
  "/dashboard",
  "/interventions",
  "/artisans",
  "/comptabilite",
  "/settings",
] as const

function isInputFocused(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  if ((el as HTMLElement).isContentEditable) return true
  return false
}

function isModalOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]')
}

export default function GlobalShortcuts() {
  const router = useRouter()
  const pathname = usePathname()
  const { isModifierPressed } = usePlatformKey()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isModifierPressed(e)) return
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return
      if (isInputFocused() || isModalOpen()) return

      e.preventDefault()

      const currentIndex = ROUTE_CYCLE.findIndex((route) => pathname.startsWith(route))
      if (currentIndex === -1) return

      if (e.key === "ArrowDown") {
        const next = currentIndex < ROUTE_CYCLE.length - 1 ? currentIndex + 1 : 0
        router.push(ROUTE_CYCLE[next])
      } else {
        const prev = currentIndex > 0 ? currentIndex - 1 : ROUTE_CYCLE.length - 1
        router.push(ROUTE_CYCLE[prev])
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [pathname, router, isModifierPressed])

  return null
}
