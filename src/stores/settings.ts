"use client"

import { create } from "zustand"

export type SidebarMode = "collapsed" | "icons" | "hybrid" | "expanded"
export type ThemeMode = "light" | "dark" | "system"

interface SettingsState {
  sidebarMode: SidebarMode
  theme: ThemeMode
  classEffect: boolean
  statusMock: "online" | "busy" | "dnd" | "offline"
  setSidebarMode: (m: SidebarMode) => void
  setTheme: (t: ThemeMode) => void
  setClassEffect: (v: boolean) => void
  setStatusMock: (s: SettingsState["statusMock"]) => void
  hydrate: () => void
}

export const useSettings = create<SettingsState>((set) => ({
  sidebarMode: "hybrid",
  theme: "system",
  classEffect: true,
  statusMock: "online",
  setSidebarMode: (sidebarMode) => set({ sidebarMode }),
  setTheme: (theme) => set({ theme }),
  setClassEffect: (classEffect) => set({ classEffect }),
  setStatusMock: (statusMock) => set({ statusMock }),
  hydrate: () => {
    try {
      // PRIORITÉ: Lire color-mode en premier (source de vérité)
      let theme: ThemeMode = "system"
      try {
        const colorMode = localStorage.getItem("color-mode")
        if (colorMode && ["light", "dark", "system"].includes(colorMode)) {
          theme = colorMode as ThemeMode
        }
      } catch {}
      
      const raw = localStorage.getItem("gmbs:settings")
      if (raw) {
        const parsed = JSON.parse(raw)
        // Utiliser color-mode si disponible, sinon utiliser parsed.theme
        if (!theme || theme === "system") {
          theme = parsed.theme || "system"
        }
        // Backward compatibility: map legacy statuses
        const rawStatus = parsed.statusMock as string | undefined
        let statusMock = rawStatus === "syncing" ? "busy" : (rawStatus as any)
        const allowed = new Set(["online", "busy", "dnd", "offline"]) as Set<string>
        const safeStatus = allowed.has(statusMock as string) ? (statusMock as SettingsState["statusMock"]) : "online"
        set({ ...parsed, theme, statusMock: safeStatus })
      } else if (theme && theme !== "system") {
        // Si gmbs:settings n'existe pas mais color-mode existe, initialiser avec color-mode
        set({ theme })
      }
    } catch {}
  },
}))
