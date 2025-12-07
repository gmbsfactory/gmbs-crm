"use client"

import * as React from "react"
import { useSettings } from "@/stores/settings"

// Fonction utilitaire pour appliquer le thème complet (identique au script inline)
function applyCompleteTheme(themeFromStore?: string, classEffectFromStore?: boolean) {
  if (typeof document === "undefined") return
  
  try {
    const root = document.documentElement
    let rawSettings = null
    let settings = null
    try {
      rawSettings = localStorage.getItem('gmbs:settings')
    } catch (e) {
      console.warn('localStorage inaccessible pour gmbs:settings:', e)
    }
    if (rawSettings) {
      try {
        settings = JSON.parse(rawSettings) || {}
      } catch (e) {
        // Données corrompues, nettoyer
        console.warn('Données corrompues dans gmbs:settings, nettoyage...', e)
        try {
          localStorage.removeItem('gmbs:settings')
        } catch (_) {}
        settings = {}
      }
    }
    // PRIORITÉ: Lire color-mode en premier (source de vérité, écrit par applyTheme)
    let storedMode = null
    try {
      storedMode = localStorage.getItem('color-mode')
    } catch (e) {
      console.warn('localStorage inaccessible pour color-mode:', e)
    }
    // Ensuite, utiliser themeFromStore si color-mode n'existe pas
    if (!storedMode && themeFromStore) {
      storedMode = themeFromStore
    }
    // En dernier recours, utiliser settings.theme
    if (!storedMode && settings && typeof settings.theme === 'string') {
      storedMode = settings.theme
    }
    const classEffect = classEffectFromStore !== undefined ? classEffectFromStore : (settings && settings.classEffect === false ? false : true)
    const accents = {
      indigo: { light: { h: "228 78% 55%", c: "oklch(0.63 0.20 260)", l: "oklch(0.78 0.14 260)", r: "228 82% 58%", p: "228 78% 55%", pf: "0 0% 100%", af: "0 0% 100%" }, dark: { h: "228 88% 70%", c: "oklch(0.82 0.18 260)", l: "oklch(0.90 0.12 260)", r: "228 90% 72%", p: "228 88% 70%", pf: "222 84% 4.9%", af: "222 84% 4.9%" } },
      emerald: { light: { h: "152 65% 45%", c: "oklch(0.62 0.17 150)", l: "oklch(0.78 0.12 150)", r: "152 70% 48%", p: "152 65% 45%", pf: "0 0% 100%", af: "0 0% 100%" }, dark: { h: "152 55% 62%", c: "oklch(0.78 0.14 150)", l: "oklch(0.86 0.10 150)", r: "152 58% 60%", p: "152 55% 62%", pf: "222 84% 4.9%", af: "222 84% 4.9%" } },
      violet: { light: { h: "270 75% 36%", c: "oklch(0.55 0.21 300)", l: "oklch(0.78 0.18 300)", r: "270 75% 36%", p: "270 75% 36%", pf: "0 0% 100%", af: "0 0% 100%" }, dark: { h: "270 75% 76%", c: "oklch(0.78 0.21 300)", l: "oklch(0.88 0.15 300)", r: "270 75% 72%", p: "270 75% 72%", pf: "222 84% 4.9%", af: "0 0% 12%" } },
      amber: { light: { h: "35 92% 55%", c: "oklch(0.72 0.15 75)", l: "oklch(0.84 0.12 75)", r: "35 95% 58%", p: "35 92% 55%", pf: "0 0% 0%", af: "0 0% 12%" }, dark: { h: "35 90% 68%", c: "oklch(0.86 0.12 75)", l: "oklch(0.92 0.09 75)", r: "35 92% 70%", p: "35 90% 68%", pf: "24 90% 14%", af: "24 90% 10%" } },
      rose: { light: { h: "345 80% 58%", c: "oklch(0.65 0.24 20)", l: "oklch(0.82 0.16 20)", r: "345 82% 60%", p: "345 80% 58%", pf: "0 0% 100%", af: "0 0% 100%" }, dark: { h: "345 82% 72%", c: "oklch(0.84 0.18 20)", l: "oklch(0.90 0.12 20)", r: "345 84% 74%", p: "345 82% 72%", pf: "222 84% 4.9%", af: "222 84% 4.9%" } }
    }
    function clamp(value: number, min: number, max: number) {
      return Math.min(Math.max(value, min), max)
    }
    function normalizeHex(hex: string | null): string | null {
      if (!hex) return null
      const value = hex.trim()
      const short = /^#([0-9a-f]{3})$/i
      const full = /^#([0-9a-f]{6})$/i
      if (full.test(value)) return value.toLowerCase()
      if (short.test(value)) {
        return '#' + value.slice(1).split('').map((c) => c + c).join('').toLowerCase()
      }
      return null
    }
    function hexToHslParts(hex: string): [number, number, number] {
      const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      if (!match) return [0, 0, 0]
      const r = parseInt(match[1], 16) / 255
      const g = parseInt(match[2], 16) / 255
      const b = parseInt(match[3], 16) / 255
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      let h = 0
      let s = 0
      const l = (max + min) / 2
      if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break
          case g: h = (b - r) / d + 2; break
          case b: h = (r - g) / d + 4; break
        }
        h /= 6
      }
      return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
    }
    function pickForeground(l: number): string {
      return l > 55 ? '222 84% 4.9%' : '0 0% 100%'
    }
    function buildCustomAccent(hex: string) {
      const parts = hexToHslParts(hex)
      const h = parts[0]
      const s = parts[1]
      const l = parts[2]
      const base = h + ' ' + s + '% ' + l + '%'
      const lighter = h + ' ' + clamp(s - 8, 0, 100) + '% ' + clamp(l + 18, 0, 100) + '%'
      const brighter = h + ' ' + clamp(s + 5, 0, 100) + '% ' + clamp(l + 10, 0, 100) + '%'
      return {
        light: { h: base, c: 'hsl(' + base + ')', l: 'hsl(' + lighter + ')', r: base, p: base, pf: pickForeground(l), af: pickForeground(l) },
        dark: { h: brighter, c: 'hsl(' + brighter + ')', l: 'hsl(' + lighter + ')', r: brighter, p: brighter, pf: '222 84% 4.9%', af: '222 84% 4.9%' }
      }
    }
    let rawAccent = 'indigo'
    let storedCustom = null
    try {
      rawAccent = localStorage.getItem('ui-accent') || 'indigo'
      storedCustom = localStorage.getItem('ui-accent-custom')
    } catch (e) {
      console.warn('localStorage inaccessible pour ui-accent:', e)
    }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const mode = storedMode === 'light' || storedMode === 'dark' || storedMode === 'system' ? storedMode : 'system'
    const resolved = classEffect && (mode === 'dark' || (mode === 'system' && prefersDark)) ? 'dark' : 'light'
    if (resolved === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    root.setAttribute('data-theme', resolved)
    let tone
    if (rawAccent.startsWith('custom:')) {
      const customHex = normalizeHex(rawAccent.slice(7)) || normalizeHex(storedCustom) || '#6366f1'
      if (customHex) {
        const customTone = buildCustomAccent(customHex)
        tone = resolved === 'dark' ? customTone.dark : customTone.light
      }
    } else if (accents[rawAccent as keyof typeof accents]) {
      const preset = accents[rawAccent as keyof typeof accents]
      tone = resolved === 'dark' ? preset.dark : preset.light
    } else {
      const preset = accents.indigo
      tone = resolved === 'dark' ? preset.dark : preset.light
    }
    root.classList.add('theme-formal')
    root.classList.remove('theme-color')
    root.classList.remove('theme-glass')
    if (tone) {
      root.style.setProperty('--accent-hsl', tone.h)
      root.style.setProperty('--accent', tone.h)
      root.style.setProperty('--accent-color', tone.c)
      root.style.setProperty('--accent-color-light', tone.l)
      root.style.setProperty('--ring', tone.r)
      root.style.setProperty('--accent-foreground', tone.af || '0 0% 100%')
      root.style.setProperty('--primary', tone.p || tone.h)
      root.style.setProperty('--primary-foreground', tone.pf || tone.af || '0 0% 100%')
    }
  } catch (_) {}
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useSettings((s) => s.hydrate)
  const theme = useSettings((s) => s.theme)
  const classEffect = useSettings((s) => s.classEffect)

  // Hydrate from localStorage on mount
  React.useEffect(() => {
    try {
      hydrate()
    } catch {}
  }, [hydrate])

  // Persist on change
  React.useEffect(() => {
    const unsub = useSettings.subscribe((state) => {
      try {
        const persist = {
          sidebarMode: state.sidebarMode,
          theme: state.theme,
          classEffect: state.classEffect,
          statusMock: state.statusMock,
        }
        localStorage.setItem("gmbs:settings", JSON.stringify(persist))
      } catch {}
    })
    return () => unsub()
  }, [])

  // Apply complete theme (including accent colors and theme classes)
  React.useEffect(() => {
    applyCompleteTheme(theme, classEffect)
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => applyCompleteTheme(theme, classEffect)
    mq.addEventListener?.("change", handler)
    return () => mq.removeEventListener?.("change", handler)
  }, [theme, classEffect])

  return <>{children}</>
}
