export type ColorMode = "light" | "dark" | "system"
export type AccentPresetName = "indigo" | "emerald" | "violet" | "amber" | "rose"
export type AccentOption = AccentPresetName | "custom"
export type ResolvedTheme = "light" | "dark"

interface AccentTone {
  accentHsl: string
  accentOklch?: string
  accentLightOklch?: string
  ringHsl?: string
  primaryHsl?: string
  primaryForeground?: string
  accentForeground?: string
}

export interface AccentConfig {
  name: AccentPresetName
  displayName: string
  description: string
  light: AccentTone
  dark: AccentTone
}

interface StoredAccent {
  option: AccentOption
  customColor?: string
}

export const DEFAULT_ACCENT: AccentPresetName = "indigo"
const THEME_FORMAL_CLASS = "theme-formal"

export const ACCENT_PRESETS: Record<AccentPresetName, AccentConfig> = {
  indigo: {
    name: "indigo",
    displayName: "Indigo",
    description: "Accent bleu indigo moderne",
    light: {
      accentHsl: "228 78% 55%",
      accentOklch: "oklch(0.63 0.20 260)",
      accentLightOklch: "oklch(0.78 0.14 260)",
      ringHsl: "228 82% 58%",
      primaryHsl: "228 78% 55%",
      primaryForeground: "0 0% 100%",
      accentForeground: "0 0% 100%",
    },
    dark: {
      accentHsl: "228 88% 70%",
      accentOklch: "oklch(0.82 0.18 260)",
      accentLightOklch: "oklch(0.90 0.12 260)",
      ringHsl: "228 90% 72%",
      primaryHsl: "228 88% 70%",
      primaryForeground: "222 84% 4.9%",
      accentForeground: "222 84% 4.9%",
    },
  },
  emerald: {
    name: "emerald",
    displayName: "Émeraude",
    description: "Accent vert émeraude rafraîchissant",
    light: {
      accentHsl: "152 65% 45%",
      accentOklch: "oklch(0.62 0.17 150)",
      accentLightOklch: "oklch(0.78 0.12 150)",
      ringHsl: "152 70% 48%",
      primaryHsl: "152 65% 45%",
      primaryForeground: "0 0% 100%",
      accentForeground: "0 0% 100%",
    },
    dark: {
      accentHsl: "152 55% 62%",
      accentOklch: "oklch(0.78 0.14 150)",
      accentLightOklch: "oklch(0.86 0.10 150)",
      ringHsl: "152 58% 60%",
      primaryHsl: "152 55% 62%",
      primaryForeground: "222 84% 4.9%",
      accentForeground: "222 84% 4.9%",
    },
  },
  violet: {
    name: "violet",
    displayName: "Violet",
    description: "Accent violet profond historique",
    light: {
      accentHsl: "270 75% 36%",
      accentOklch: "oklch(0.55 0.21 300)",
      accentLightOklch: "oklch(0.78 0.18 300)",
      ringHsl: "270 75% 36%",
      primaryHsl: "270 75% 36%",
      primaryForeground: "0 0% 100%",
      accentForeground: "0 0% 100%",
    },
    dark: {
      accentHsl: "270 75% 76%",
      accentOklch: "oklch(0.78 0.21 300)",
      accentLightOklch: "oklch(0.88 0.15 300)",
      ringHsl: "270 75% 72%",
      primaryHsl: "270 75% 72%",
      primaryForeground: "222 84% 4.9%",
      accentForeground: "0 0% 12%",
    },
  },
  amber: {
    name: "amber",
    displayName: "Ambre",
    description: "Accent ambre chaleureux",
    light: {
      accentHsl: "35 92% 55%",
      accentOklch: "oklch(0.72 0.15 75)",
      accentLightOklch: "oklch(0.84 0.12 75)",
      ringHsl: "35 95% 58%",
      primaryHsl: "35 92% 55%",
      primaryForeground: "0 0% 0%",
      accentForeground: "0 0% 12%",
    },
    dark: {
      accentHsl: "35 90% 68%",
      accentOklch: "oklch(0.86 0.12 75)",
      accentLightOklch: "oklch(0.92 0.09 75)",
      ringHsl: "35 92% 70%",
      primaryHsl: "35 90% 68%",
      primaryForeground: "24 90% 14%",
      accentForeground: "24 90% 10%",
    },
  },
  rose: {
    name: "rose",
    displayName: "Rose",
    description: "Accent rose vibrant",
    light: {
      accentHsl: "345 80% 58%",
      accentOklch: "oklch(0.65 0.24 20)",
      accentLightOklch: "oklch(0.82 0.16 20)",
      ringHsl: "345 82% 60%",
      primaryHsl: "345 80% 58%",
      primaryForeground: "0 0% 100%",
      accentForeground: "0 0% 100%",
    },
    dark: {
      accentHsl: "345 82% 72%",
      accentOklch: "oklch(0.84 0.18 20)",
      accentLightOklch: "oklch(0.90 0.12 20)",
      ringHsl: "345 84% 74%",
      primaryHsl: "345 82% 72%",
      primaryForeground: "222 84% 4.9%",
      accentForeground: "222 84% 4.9%",
    },
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function normalizeHex(hex?: string | null): string | null {
  if (!hex) return null
  const value = hex.trim()
  if (/^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(value)) {
    if (value.length === 4) {
      // Expand shorthand form (#abc -> #aabbcc)
      return (
        "#" +
        value
          .slice(1)
          .split("")
          .map((char) => char + char)
          .join("")
      )
    }
    return value
  }
  return null
}

function hexToHslParts(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]

  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function pickForeground(luminance: number) {
  return luminance > 55 ? "222 84% 4.9%" : "0 0% 100%"
}

function buildCustomAccent(hex: string) {
  const [h, s, l] = hexToHslParts(hex)
  const accentBase = `${h} ${s}% ${l}%`
  const lighter = `${h} ${clamp(s - 8, 0, 100)}% ${clamp(l + 18, 0, 100)}%`
  const brighter = `${h} ${clamp(s + 5, 0, 100)}% ${clamp(l + 10, 0, 100)}%`

  const lightTone: AccentTone = {
    accentHsl: accentBase,
    accentOklch: `hsl(${accentBase})`,
    accentLightOklch: `hsl(${lighter})`,
    ringHsl: accentBase,
    primaryHsl: accentBase,
    primaryForeground: pickForeground(l),
    accentForeground: pickForeground(l),
  }

  const darkTone: AccentTone = {
    accentHsl: brighter,
    accentOklch: `hsl(${brighter})`,
    accentLightOklch: `hsl(${lighter})`,
    ringHsl: brighter,
    primaryHsl: brighter,
    primaryForeground: "222 84% 4.9%",
    accentForeground: "222 84% 4.9%",
  }

  return { light: lightTone, dark: darkTone }
}

function shouldApplyDarkMode(colorMode: ColorMode): boolean {
  if (colorMode === "dark") return true
  if (colorMode === "light") return false
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  }
  return false
}

function resolveAccent(
  accent: AccentOption,
  resolvedTheme: ResolvedTheme,
  customAccent?: string,
): { tone: AccentTone; storageValue: string; storedCustom?: string } {
  if (accent !== "custom") {
    const preset = ACCENT_PRESETS[accent] ?? ACCENT_PRESETS[DEFAULT_ACCENT]
    return {
      tone: resolvedTheme === "dark" ? preset.dark : preset.light,
      storageValue: preset.name,
    }
  }

  const normalized = normalizeHex(customAccent) ?? "#6366f1"
  const custom = buildCustomAccent(normalized)
  return {
    tone: resolvedTheme === "dark" ? custom.dark : custom.light,
    storageValue: `custom:${normalized}`,
    storedCustom: normalized,
  }
}

function applyAccentTokens(root: HTMLElement, tone: AccentTone) {
  root.style.setProperty("--accent-hsl", tone.accentHsl)
  root.style.setProperty("--accent", tone.accentHsl)
  root.style.setProperty("--accent-color", tone.accentOklch ?? `hsl(${tone.accentHsl})`)
  root.style.setProperty("--accent-color-light", tone.accentLightOklch ?? `hsl(${tone.accentHsl})`)
  root.style.setProperty("--ring", tone.ringHsl ?? tone.accentHsl)
  root.style.setProperty("--accent-foreground", tone.accentForeground ?? "0 0% 100%")
  root.style.setProperty("--primary", tone.primaryHsl ?? tone.accentHsl)
  root.style.setProperty("--primary-foreground", tone.primaryForeground ?? tone.accentForeground ?? "0 0% 100%")
}

function readStoredAccent(): StoredAccent {
  if (typeof window === "undefined") {
    return { option: DEFAULT_ACCENT }
  }

  const raw = window.localStorage.getItem("ui-accent")
  if (!raw) {
    return { option: DEFAULT_ACCENT }
  }

  if (raw.startsWith("custom:")) {
    const maybeHex = normalizeHex(raw.substring(7))
    if (maybeHex) {
      return { option: "custom", customColor: maybeHex }
    }
  }

  if (raw in ACCENT_PRESETS) {
    return { option: raw as AccentPresetName }
  }

  return { option: DEFAULT_ACCENT }
}

export function applyTheme(colorMode: ColorMode, accent: AccentOption, customAccent?: string) {
  if (typeof window === "undefined") return

  const root = document.documentElement
  const shouldUseDark = shouldApplyDarkMode(colorMode)
  const resolvedTheme: ResolvedTheme = shouldUseDark ? "dark" : "light"

  if (shouldUseDark) {
    root.classList.add("dark")
  } else {
    root.classList.remove("dark")
  }
  root.setAttribute("data-theme", resolvedTheme)

  const { tone, storageValue, storedCustom } = resolveAccent(accent, resolvedTheme, customAccent)
  applyAccentTokens(root, tone)

  root.classList.remove("theme-glass", "theme-color")
  root.classList.add(THEME_FORMAL_CLASS)

  window.localStorage.setItem("theme-mode", "formal")
  window.localStorage.setItem("color-mode", colorMode)
  window.localStorage.setItem("ui-accent", storageValue)
  if (storedCustom) {
    window.localStorage.setItem("ui-accent-custom", storedCustom)
  } else {
    window.localStorage.removeItem("ui-accent-custom")
  }
}

export function getCurrentColorMode(): ColorMode {
  if (typeof window === "undefined") return "system"
  const saved = window.localStorage.getItem("color-mode") as ColorMode | null
  return saved && ["light", "dark", "system"].includes(saved) ? saved : "system"
}

export function getCurrentAccent(): StoredAccent {
  return readStoredAccent()
}

export function initializeTheme() {
  if (typeof window === "undefined") {
    return {
      colorMode: "system" as ColorMode,
      accent: DEFAULT_ACCENT as AccentOption,
      customAccent: undefined as string | undefined,
    }
  }

  const colorMode = getCurrentColorMode()
  const storedAccent = readStoredAccent()
  applyTheme(colorMode, storedAccent.option, storedAccent.customColor)

  return {
    colorMode,
    accent: storedAccent.option,
    customAccent: storedAccent.customColor,
  }
}

export function hexToHsl(hex: string): string {
  const normalized = normalizeHex(hex)
  if (!normalized) return "0 0% 0%"
  const [h, s, l] = hexToHslParts(normalized)
  return `${h} ${s}% ${l}%`
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

/**
 * Récupère la couleur hex de l'accent actuel (preset ou custom)
 * Prend en compte le thème clair/sombre
 */
export function getAccentHexColor(accent: AccentOption, customAccent?: string): string {
  if (typeof window === "undefined") return "#6366f1" // Fallback indigo
  
  const isDark = document.documentElement.classList.contains("dark")
  const resolvedTheme: ResolvedTheme = isDark ? "dark" : "light"
  
  if (accent === "custom" && customAccent) {
    const normalized = normalizeHex(customAccent)
    return normalized ?? "#6366f1"
  }
  
  const preset = ACCENT_PRESETS[accent as AccentPresetName] ?? ACCENT_PRESETS[DEFAULT_ACCENT]
  const tone = resolvedTheme === "dark" ? preset.dark : preset.light
  
  // Convertir HSL en hex
  const hslMatch = tone.accentHsl.match(/(\d+)\s+(\d+)%\s+(\d+)%/)
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10)
    const s = parseInt(hslMatch[2], 10)
    const l = parseInt(hslMatch[3], 10)
    return hslToHex(h, s, l)
  }
  
  return "#6366f1" // Fallback
}
