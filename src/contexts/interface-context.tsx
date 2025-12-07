"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type ColorMode, type AccentOption, DEFAULT_ACCENT, applyTheme, initializeTheme } from "@/lib/themes"
import { useSettings } from "@/stores/settings"

type SidebarMode = "collapsed" | "hybrid" | "expanded"

interface InterfaceContextType {
  sidebarMode: SidebarMode
  setSidebarMode: (mode: SidebarMode) => void
  sidebarEnabled: boolean
  setSidebarEnabled: (enabled: boolean) => void
  colorMode: ColorMode
  setColorMode: (mode: ColorMode) => void
  accent: AccentOption
  customAccent?: string
  setAccent: (accent: AccentOption, customColor?: string) => void
  setCustomAccent: (color: string) => void
  saveSettings: () => void
}

const InterfaceContext = createContext<InterfaceContextType | undefined>(undefined)

export function InterfaceProvider({ children }: { children: ReactNode }) {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("hybrid")
  const [sidebarEnabled, setSidebarEnabled] = useState<boolean>(true)
  const [colorMode, setColorMode] = useState<ColorMode>("system")
  const [accent, setAccent] = useState<AccentOption>(DEFAULT_ACCENT)
  const [customAccent, setCustomAccent] = useState<string | undefined>()

  useEffect(() => {
    const init = initializeTheme()
    setColorMode(init.colorMode)
    setAccent(init.accent)
    setCustomAccent(init.customAccent)

    const savedMode = localStorage.getItem("sidebar-mode") as SidebarMode
    if (savedMode && ["collapsed", "hybrid", "expanded"].includes(savedMode)) {
      setSidebarMode(savedMode)
    }

    const savedEnabled = localStorage.getItem("sidebar-enabled")
    if (savedEnabled !== null) {
      setSidebarEnabled(savedEnabled === "true")
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleSystemThemeChange = () => {
      if (colorMode === "system") {
        applyTheme(colorMode, accent, customAccent)
      }
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange)
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange)
  }, [colorMode, accent, customAccent])

  const handleColorModeChange = (mode: ColorMode) => {
    setColorMode(mode)
    applyTheme(mode, accent, customAccent)
    // Synchroniser avec le store Zustand pour que SettingsProvider soit au courant
    const { setTheme } = useSettings.getState()
    setTheme(mode)
  }

  const handleAccentChange = (value: AccentOption, overrideColor?: string) => {
    if (value === "custom") {
      const picked = overrideColor ?? customAccent ?? "#6366f1"
      setAccent("custom")
      setCustomAccent(picked)
      applyTheme(colorMode, "custom", picked)
      return
    }

    setAccent(value)
    applyTheme(colorMode, value)
  }

  const handleCustomAccentChange = (color: string) => {
    setAccent("custom")
    setCustomAccent(color)
    applyTheme(colorMode, "custom", color)
  }

  const handleSidebarEnabledChange = (enabled: boolean) => {
    setSidebarEnabled(enabled)
    localStorage.setItem("sidebar-enabled", String(enabled))
  }

  const saveSettings = () => {
    localStorage.setItem("sidebar-mode", sidebarMode)
    localStorage.setItem("sidebar-enabled", String(sidebarEnabled))
    // Les autres préférences sont persistées via applyTheme
  }

  return (
    <InterfaceContext.Provider
      value={{
        sidebarMode,
        setSidebarMode,
        sidebarEnabled,
        setSidebarEnabled: handleSidebarEnabledChange,
        colorMode,
        setColorMode: handleColorModeChange,
        accent,
        customAccent,
        setAccent: handleAccentChange,
        setCustomAccent: handleCustomAccentChange,
        saveSettings,
      }}
    >
      {children}
    </InterfaceContext.Provider>
  )
}

export function useInterface() {
  const context = useContext(InterfaceContext)
  if (context === undefined) {
    throw new Error("useInterface must be used within an InterfaceProvider")
  }
  return context
}
