"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import {
  DEFAULT_MODAL_DISPLAY_MODE,
  MODAL_DISPLAY_CONFIGS,
  type ModalDisplayContextType,
  type ModalDisplayMode,
} from "@/types/modal-display"
import { useInterventionModalState } from "@/hooks/useInterventionModalState"
import { useAIPanelStore } from "@/stores/ai-panel-store"

const PREFERRED_STORAGE_KEY = "gmbs:modal-display:preferred"
const DEFAULT_STORAGE_KEY = "gmbs:modal-display:default"
const LEGACY_STORAGE_KEY = "gmbs:modal-display-mode"

const ModalDisplayContext = createContext<ModalDisplayContextType | undefined>(undefined)

const resolveStoredMode = (value: string | null): ModalDisplayMode => {
  if (!value) return DEFAULT_MODAL_DISPLAY_MODE
  return value === "halfpage" || value === "centerpage" || value === "fullpage" ? value : DEFAULT_MODAL_DISPLAY_MODE
}

export function ModalDisplayProvider({ children }: { children: React.ReactNode }) {
  const [defaultMode, setDefaultModeState] = useState<ModalDisplayMode>(DEFAULT_MODAL_DISPLAY_MODE)
  const [preferredMode, setPreferredModeState] = useState<ModalDisplayMode>(DEFAULT_MODAL_DISPLAY_MODE)
  const [effectiveMode, setEffectiveMode] = useState<ModalDisplayMode>(DEFAULT_MODAL_DISPLAY_MODE)
  const [isDefaultModeModified, setIsDefaultModeModified] = useState(false)
  const overrideMode = useInterventionModalState((state) => state.overrideMode)
  const isAIPanelOpen = useAIPanelStore((state) => state.isPanelOpen)

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedDefault = resolveStoredMode(window.localStorage.getItem(DEFAULT_STORAGE_KEY))
    let storedPreferred = window.localStorage.getItem(PREFERRED_STORAGE_KEY)
    if (!storedPreferred) {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy) {
        storedPreferred = legacy
        window.localStorage.removeItem(LEGACY_STORAGE_KEY)
        window.localStorage.setItem(PREFERRED_STORAGE_KEY, legacy)
      }
    }
    const resolvedPreferred = storedPreferred ? resolveStoredMode(storedPreferred) : storedDefault

    setDefaultModeState(storedDefault)
    setPreferredModeState(resolvedPreferred)
    setIsDefaultModeModified(storedDefault !== DEFAULT_MODAL_DISPLAY_MODE)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const handleResize = () => {
      const width = window.innerWidth
      // Forcer halfpage quand le panneau IA est ouvert sur grand ecran
      if (isAIPanelOpen && width >= 1280) {
        setEffectiveMode("halfpage")
        return
      }
      const baseMode = overrideMode ?? preferredMode
      if (width < 640) {
        setEffectiveMode("fullpage")
        return
      }
      if (width < 1024 && baseMode === "halfpage") {
        setEffectiveMode("centerpage")
        return
      }
      setEffectiveMode(baseMode)
    }
    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [overrideMode, preferredMode, isAIPanelOpen])

  const setPreferredMode = useCallback((mode: ModalDisplayMode) => {
    setPreferredModeState(mode)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PREFERRED_STORAGE_KEY, mode)
    }
  }, [])

  const setDefaultMode = useCallback(
    (mode: ModalDisplayMode) => {
      setDefaultModeState(mode)
      setIsDefaultModeModified(mode !== DEFAULT_MODAL_DISPLAY_MODE)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(DEFAULT_STORAGE_KEY, mode)
      }
      setPreferredMode(mode)
    },
    [setPreferredMode],
  )

  const resetToDefault = useCallback(() => {
    setDefaultModeState(DEFAULT_MODAL_DISPLAY_MODE)
    setPreferredModeState(DEFAULT_MODAL_DISPLAY_MODE)
    setIsDefaultModeModified(false)
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DEFAULT_STORAGE_KEY)
      window.localStorage.removeItem(PREFERRED_STORAGE_KEY)
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    }
  }, [])

  const value = useMemo<ModalDisplayContextType>(
    () => ({
      preferredMode,
      defaultMode,
      effectiveMode: overrideMode ?? effectiveMode,
      setPreferredMode,
      setDefaultMode,
      resetToDefault,
      isDefaultModeModified,
      configs: MODAL_DISPLAY_CONFIGS,
    }),
    [defaultMode, effectiveMode, isDefaultModeModified, overrideMode, preferredMode, setDefaultMode, setPreferredMode, resetToDefault],
  )

  return <ModalDisplayContext.Provider value={value}>{children}</ModalDisplayContext.Provider>
}

export function useModalDisplay() {
  const context = useContext(ModalDisplayContext)
  if (!context) {
    throw new Error("useModalDisplay must be used within a ModalDisplayProvider")
  }
  return context
}