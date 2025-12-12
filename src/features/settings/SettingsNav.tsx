"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useUserRoles } from "@/hooks/useUserRoles"
import {
  User,
  Palette,
  Users,
  Target,
  Shield,
  Cog,
} from "lucide-react"

const ALL_TABS = [
  { key: "profile", label: "Profile", icon: User, requiresRole: null },
  { key: "interface", label: "Interface", icon: Palette, requiresRole: null },
  { key: "team", label: "Team", icon: Users, requiresRole: "admin" },
  { key: "enums", label: "Configuration Enums", icon: Cog, requiresRole: "admin" },
  { key: "targets", label: "Perf", icon: Target, requiresRole: ["admin", "manager"] },
  { key: "security", label: "Security", icon: Shield, requiresRole: null },
]

export default function SettingsNav() {
  const pathname = usePathname()
  const router = useRouter()
  // Extraire l'onglet actif depuis le pathname
  const pathSegment = pathname?.split("/")[2] ?? "profile"
  const active = pathSegment === "targets" ? "targets" : pathSegment
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollYRef = useRef(0)
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const tickingRef = useRef(false)
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null)

  // Utiliser le hook centralisé pour les rôles
  const { hasRole, hasAnyRole, isLoading: rolesLoading } = useUserRoles()

  // Filtrer les onglets selon les permissions
  const visibleTabs = ALL_TABS.filter((tab) => {
    if (!tab.requiresRole) return true // Onglets accessibles à tous
    if (rolesLoading) return false // Masquer les onglets restreints pendant le chargement
    
    if (Array.isArray(tab.requiresRole)) {
      // Pour les onglets nécessitant plusieurs rôles (OR)
      return hasAnyRole(tab.requiresRole)
    } else {
      // Pour les onglets nécessitant un seul rôle
      return hasRole(tab.requiresRole)
    }
  })

  useEffect(() => {
    const run = () => visibleTabs.forEach((t) => {
      const url = t.key === "targets" ? "/settings/targets" : `/settings/${t.key}`
      router.prefetch(url)
    })
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(run)
      return () => (window as any).cancelIdleCallback?.(id)
    }
    const id = setTimeout(run, 150)
    return () => clearTimeout(id)
  }, [router, visibleTabs])

  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = scrollContainerRef.current
      if (!scrollContainer) return

      if (!tickingRef.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = scrollContainer.scrollTop
          const scrollDifference = Math.abs(currentScrollY - lastScrollYRef.current)
          
          // Seuil minimum de 5px pour éviter les micro-mouvements
          if (scrollDifference < 5) {
            tickingRef.current = false
            return
          }

          // Si on est tout en haut (moins de 20px), toujours afficher
          if (currentScrollY < 20) {
            setIsVisible(true)
            lastScrollYRef.current = currentScrollY
            scrollDirectionRef.current = null
            tickingRef.current = false
            return
          }

          // Vérifier si on est proche du bas (dans les 50px du bas)
          const scrollHeight = scrollContainer.scrollHeight
          const clientHeight = scrollContainer.clientHeight
          const distanceFromBottom = scrollHeight - currentScrollY - clientHeight
          
          // Si on est proche du bas, garder l'état actuel pour éviter les oscillations
          if (distanceFromBottom < 50) {
            lastScrollYRef.current = currentScrollY
            tickingRef.current = false
            return
          }

          // Détecter la direction du scroll avec un seuil de 10px pour plus de stabilité
          const isScrollingDown = currentScrollY > lastScrollYRef.current + 10
          const isScrollingUp = currentScrollY < lastScrollYRef.current - 10

          if (isScrollingDown && scrollDirectionRef.current !== 'down') {
            scrollDirectionRef.current = 'down'
            setIsVisible(false)
          } else if (isScrollingUp && scrollDirectionRef.current !== 'up') {
            scrollDirectionRef.current = 'up'
            setIsVisible(true)
          }

          lastScrollYRef.current = currentScrollY
          tickingRef.current = false
        })

        tickingRef.current = true
      }
    }

    // Attendre que le DOM soit prêt avec un petit délai pour s'assurer que le conteneur existe
    const timeoutId = setTimeout(() => {
      const scrollContainer = document.querySelector('[data-settings-scroll-container]') as HTMLElement
      if (scrollContainer) {
        scrollContainerRef.current = scrollContainer
        scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
      }
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      if (scrollContainerRef.current) {
        scrollContainerRef.current.removeEventListener('scroll', handleScroll)
        scrollContainerRef.current = null
      }
    }
  }, [])

  return (
    <div 
      className={cn(
        "sticky top-0 z-40 bg-background border-b shadow-sm overflow-hidden transition-all duration-300 ease-in-out",
        isVisible ? "max-h-[80px] opacity-100" : "max-h-0 opacity-0 border-b-0"
      )}
    >
      <div className="mx-auto max-w-5xl px-4">
        <Tabs value={active} className="py-3">
          <TabsList className={`grid h-10 -ml-6 w-[calc(100%+30px)] ${
            visibleTabs.length === 2 ? "grid-cols-2" :
            visibleTabs.length === 3 ? "grid-cols-3" :
            visibleTabs.length === 4 ? "grid-cols-2 sm:grid-cols-4" :
            visibleTabs.length === 5 ? "grid-cols-2 sm:grid-cols-5" :
            visibleTabs.length === 6 ? "grid-cols-3 sm:grid-cols-6" :
            "grid-cols-2 sm:grid-cols-4"
          }`}>
            {visibleTabs.map((t) => {
              const href = t.key === "targets" ? "/settings/targets" : `/settings/${t.key}`
              const isActive = active === t.key
              const Icon = t.icon
              return (
                <TabsTrigger key={t.key} value={t.key} asChild>
                  <Link
                    href={href}
                    prefetch
                    aria-current={isActive ? "page" : undefined}
                    onMouseEnter={() => router.prefetch(href)}
                    className="flex items-center gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </Link>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  )
}
