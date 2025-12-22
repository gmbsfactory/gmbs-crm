"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Sun, 
  Moon, 
  Monitor,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  Save,
  Check,
  Gauge,
  ChevronRight,
  Sparkles,
  Layout
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useInterface } from "@/contexts/interface-context"
import { ACCENT_PRESETS, type ColorMode, type AccentOption, type AccentPresetName, applyTheme } from "@/lib/themes"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usersApi } from "@/lib/api/v2"
import { cn } from "@/lib/utils"

const ACCENT_ORDER: AccentOption[] = ["indigo", "emerald", "violet", "amber", "rose", "custom"]

export function InterfaceSettings() {
  const { toast } = useToast()
  const { sidebarMode, setSidebarMode, sidebarEnabled, setSidebarEnabled, colorMode, setColorMode, accent, customAccent, setAccent } = useInterface()
  const { data: currentUser } = useCurrentUser()
  
  const [tempSidebarMode, setTempSidebarMode] = useState<"collapsed" | "hybrid" | "expanded">(sidebarMode)
  const [tempSidebarEnabled, setTempSidebarEnabled] = useState<boolean>(sidebarEnabled)
  const [tempColorMode, setTempColorMode] = useState<ColorMode>(colorMode)
  const [tempAccent, setTempAccent] = useState<AccentOption>(accent)
  const [tempCustomAccent, setTempCustomAccent] = useState<string>(customAccent ?? "#6366f1")
  const [saving, setSaving] = useState(false)
  
  // Dashboard preferences
  const [speedometerMarginAverageShowPercentage, setSpeedometerMarginAverageShowPercentage] = useState<boolean>(true)
  const [speedometerMarginTotalShowPercentage, setSpeedometerMarginTotalShowPercentage] = useState<boolean>(true)
  const [preferencesLoading, setPreferencesLoading] = useState(true)
  const [savingPreferences, setSavingPreferences] = useState(false)
  
  // Section expansion states
  const [expandedSection, setExpandedSection] = useState<string | null>("theme")

  // Synchroniser les états temporaires avec les valeurs persistées
  useEffect(() => {
    setTempSidebarMode(sidebarMode)
    setTempSidebarEnabled(sidebarEnabled)
    setTempAccent(accent)
    if (accent === "custom" && customAccent) {
      setTempCustomAccent(customAccent)
    }
  }, [sidebarMode, sidebarEnabled, accent, customAccent])

  // Charger les préférences utilisateur
  useEffect(() => {
    if (!currentUser?.id) {
      setPreferencesLoading(false)
      return
    }
    
    const loadPreferences = async () => {
      try {
        const preferences = await usersApi.getUserPreferences(currentUser.id)
        if (preferences) {
          setSpeedometerMarginAverageShowPercentage(preferences.speedometer_margin_average_show_percentage)
          setSpeedometerMarginTotalShowPercentage(preferences.speedometer_margin_total_show_percentage)
        }
      } catch (err) {
        console.error("Erreur lors du chargement des préférences:", err)
      } finally {
        setPreferencesLoading(false)
      }
    }
    loadPreferences()
  }, [currentUser?.id])

  const handleSidebarModeChange = (mode: "collapsed" | "hybrid" | "expanded") => {
    setTempSidebarMode(mode)
  }

  const handleColorModeChange = (mode: ColorMode) => {
    setTempColorMode(mode)
    applyTheme(
      mode,
      tempAccent,
      tempAccent === "custom" ? tempCustomAccent : undefined,
    )
  }

  const handleAccentChange = (value: AccentOption) => {
    setTempAccent(value)
    if (value === "custom") {
      applyTheme(tempColorMode, "custom", tempCustomAccent)
    } else {
      applyTheme(tempColorMode, value)
    }
  }

  const handleCustomAccentChange = (value: string) => {
    setTempAccent("custom")
    setTempCustomAccent(value)
    applyTheme(tempColorMode, "custom", value)
  }

  const hasUnsavedChanges =
    tempSidebarMode !== sidebarMode ||
    tempSidebarEnabled !== sidebarEnabled ||
    tempColorMode !== colorMode ||
    tempAccent !== accent ||
    (tempAccent === "custom" &&
      accent === "custom" &&
      tempCustomAccent.toLowerCase() !== (customAccent ?? "").toLowerCase())

  const handleSaveInterfaceSettings = async () => {
    setSaving(true)
    try {
      // Mettre à jour les states du contexte
      setSidebarMode(tempSidebarMode)
      setSidebarEnabled(tempSidebarEnabled)
      setColorMode(tempColorMode)
      if (tempAccent === "custom") {
        setAccent("custom", tempCustomAccent)
      } else {
        setAccent(tempAccent)
      }

      // Pré-applique les préférences pour éviter un flash en attendant la persistance
      applyTheme(
        tempColorMode,
        tempAccent,
        tempAccent === "custom" ? tempCustomAccent : undefined,
      )

      localStorage.setItem("sidebar-mode", tempSidebarMode)

      const accentLabel =
        tempAccent === "custom"
          ? `personnalisé (${tempCustomAccent})`
          : ACCENT_PRESETS[tempAccent as AccentPresetName]?.displayName ?? tempAccent

      toast({
        title: "Paramètres d'interface sauvegardés",
        description: `Sidebar: ${tempSidebarMode}, Mode: ${
          tempColorMode === "dark" ? "sombre" : tempColorMode === "system" ? "système" : "clair"
        }, Accent: ${accentLabel}`,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    if (!currentUser?.id) return
    setSavingPreferences(true)
    try {
      await usersApi.updateUserPreferences(currentUser.id, {
        speedometer_margin_average_show_percentage: speedometerMarginAverageShowPercentage,
        speedometer_margin_total_show_percentage: speedometerMarginTotalShowPercentage,
      })
      toast({ title: 'Préférences du tableau de bord sauvegardées' })
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de sauvegarder les préférences', variant: 'destructive' as any })
    } finally {
      setSavingPreferences(false)
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  // Color mode options
  const colorModes = [
    { id: "light", label: "Mode Clair", icon: Sun, description: "Interface claire et lumineuse" },
    { id: "dark", label: "Mode Sombre", icon: Moon, description: "Interface sombre pour les yeux" },
    { id: "system", label: "Système", icon: Monitor, description: "S'adapte à votre système" },
  ]

  // Sidebar mode options
  const sidebarModes = [
    { id: "collapsed", label: "Collapsed", icon: PanelLeftClose, description: "Icons only, always collapsed" },
    { id: "hybrid", label: "Hybrid", icon: PanelLeft, description: "Expands on hover" },
    { id: "expanded", label: "Expanded", icon: PanelLeftOpen, description: "Always expanded" },
  ]

  return (
    <div className="space-y-6">
      {/* Alerte modifications non sauvegardées */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 bg-amber-500 rounded-full animate-pulse" />
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Vous avez des modifications non sauvegardées
                </p>
              </div>
              <motion.button
                onClick={handleSaveInterfaceSettings}
                disabled={saving}
                className="px-4 py-2 rounded-lg font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors text-sm flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {saving ? (
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Sauvegarder
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section Thème */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("theme")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center">
              <Palette className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Thème et couleurs</h3>
              <p className="text-sm text-muted-foreground">
                Mode d&apos;affichage et couleur d&apos;accent
              </p>
            </div>
          </div>
          <ChevronRight className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            expandedSection === "theme" && "rotate-90"
          )} />
        </button>
        
        <AnimatePresence>
          {expandedSection === "theme" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 pt-2 space-y-8 border-t">
                {/* Mode d'affichage */}
                <div className="space-y-4">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Mode d&apos;affichage
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {colorModes.map((mode) => {
                      const Icon = mode.icon
                      const isSelected = tempColorMode === mode.id
                      
                      return (
                        <motion.button
                          key={mode.id}
                          type="button"
                          onClick={() => handleColorModeChange(mode.id as ColorMode)}
                          className={cn(
                            "relative p-4 rounded-xl border-2 transition-all text-left",
                            isSelected 
                              ? "border-primary bg-primary/5" 
                              : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                          )}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="space-y-3">
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center",
                              isSelected ? "bg-primary/10" : "bg-muted"
                            )}>
                              <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            
                            {/* Mini preview - GARDER LA TAILLE ORIGINALE */}
                            <div
                              className={cn(
                                "border rounded-lg p-4 transition-colors cursor-pointer",
                                mode.id === "light" && "bg-white hover:bg-gray-50",
                                mode.id === "dark" && "bg-gray-900 hover:bg-gray-800",
                                mode.id === "system" && "bg-gradient-to-br from-gray-50 to-gray-900"
                              )}
                            >
                              {mode.id === "light" && (
                                <div className="flex flex-col gap-2 h-16">
                                  <div className="flex gap-2 h-4">
                                    <div className="w-12 bg-white border border-gray-200 rounded flex items-center justify-center">
                                      <Sun className="h-2 w-2 text-gray-600" />
                                    </div>
                                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded"></div>
                                  </div>
                                  <div className="flex gap-1">
                                    <div className="w-8 h-3 bg-blue-500 rounded"></div>
                                    <div className="w-8 h-3 bg-gray-200 rounded"></div>
                                    <div className="w-8 h-3 bg-gray-200 rounded"></div>
                                  </div>
                                  <div className="flex-1 bg-white border border-gray-200 rounded"></div>
                                </div>
                              )}
                              {mode.id === "dark" && (
                                <div className="flex flex-col gap-2 h-16">
                                  <div className="flex gap-2 h-4">
                                    <div className="w-12 bg-gray-800 border border-gray-600 rounded flex items-center justify-center">
                                      <Moon className="h-2 w-2 text-gray-300" />
                                    </div>
                                    <div className="flex-1 bg-gray-700 border border-gray-600 rounded"></div>
                                  </div>
                                  <div className="flex gap-1">
                                    <div className="w-8 h-3 bg-blue-400 rounded"></div>
                                    <div className="w-8 h-3 bg-gray-600 rounded"></div>
                                    <div className="w-8 h-3 bg-gray-600 rounded"></div>
                                  </div>
                                  <div className="flex-1 bg-gray-800 border border-gray-600 rounded"></div>
                                </div>
                              )}
                              {mode.id === "system" && (
                                <div className="flex flex-col gap-2 h-16 relative">
                                  {/* Moitié claire */}
                                  <div className="absolute left-0 top-0 w-1/2 h-full bg-white rounded-l border-r">
                                    <div className="flex flex-col gap-1 p-2 h-full">
                                      <div className="flex gap-1 h-3">
                                        <div className="w-6 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
                                          <Sun className="h-1 w-1 text-gray-600" />
                                        </div>
                                        <div className="flex-1 bg-gray-50 border border-gray-200 rounded"></div>
                                      </div>
                                      <div className="flex gap-1">
                                        <div className="w-4 h-2 bg-blue-500 rounded"></div>
                                        <div className="w-4 h-2 bg-gray-200 rounded"></div>
                                      </div>
                                      <div className="flex-1 bg-white border border-gray-200 rounded"></div>
                                    </div>
                                  </div>
                                  {/* Moitié sombre */}
                                  <div className="absolute right-0 top-0 w-1/2 h-full bg-gray-900 rounded-r border-l border-gray-600">
                                    <div className="flex flex-col gap-1 p-2 h-full">
                                      <div className="flex gap-1 h-3">
                                        <div className="w-6 bg-gray-800 border border-gray-600 rounded flex items-center justify-center">
                                          <Moon className="h-1 w-1 text-gray-300" />
                                        </div>
                                        <div className="flex-1 bg-gray-700 border border-gray-600 rounded"></div>
                                      </div>
                                      <div className="flex gap-1">
                                        <div className="w-4 h-2 bg-blue-400 rounded"></div>
                                        <div className="w-4 h-2 bg-gray-600 rounded"></div>
                                      </div>
                                      <div className="flex-1 bg-gray-800 border border-gray-600 rounded"></div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <p className="font-medium">{mode.label}</p>
                              <p className="text-xs text-muted-foreground">{mode.description}</p>
                            </div>
                          </div>
                          
                          {isSelected && (
                            <motion.div
                              className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                            >
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </motion.div>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
                
                {/* Couleur d'accent */}
                <div className="space-y-4 pt-6 border-t">
                  <label className="text-sm font-semibold flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    Couleur d&apos;accent
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {ACCENT_ORDER.map((option) => {
                      if (option === "custom") {
                        const isActive = tempAccent === "custom"
                        const accentPreview = tempCustomAccent
                        
                        return (
                          <motion.button
                            key="custom"
                            type="button"
                            onClick={() => handleAccentChange("custom")}
                            className={cn(
                              "relative p-4 rounded-xl border-2 transition-all text-left",
                              isActive 
                                ? "border-primary bg-primary/5" 
                                : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                            )}
                            style={isActive ? { borderColor: accentPreview } : undefined}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="flex items-center gap-4">
                              <span
                                className="h-12 w-12 rounded-xl border-2 shadow-sm flex-shrink-0"
                                style={{ background: accentPreview, borderColor: accentPreview }}
                              />
                              <div className="flex-1 space-y-2">
                                <p className="font-medium">Personnalisée</p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    aria-label="Choisir une couleur personnalisée"
                                    value={tempCustomAccent}
                                    onChange={(event) => handleCustomAccentChange(event.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="h-8 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                                  />
                                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-mono">
                                    {tempCustomAccent.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {isActive && (
                              <motion.div
                                className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: accentPreview }}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                              >
                                <Check className="h-3 w-3 text-white" />
                              </motion.div>
                            )}
                          </motion.button>
                        )
                      }
                      
                      const accentKey = option as AccentPresetName
                      const preset = ACCENT_PRESETS[accentKey]
                      const isActive = tempAccent === accentKey
                      const accentPreview = `hsl(${preset.light.accentHsl})`
                      const accentPreviewDark = `hsl(${preset.dark.accentHsl})`
                      
                      return (
                        <motion.button
                          key={accentKey}
                          type="button"
                          onClick={() => handleAccentChange(accentKey)}
                          className={cn(
                            "relative p-4 rounded-xl border-2 transition-all text-left",
                            isActive 
                              ? "border-primary bg-primary/5" 
                              : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                          )}
                          style={isActive ? { borderColor: accentPreview } : undefined}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center gap-4">
                            <span
                              className="h-12 w-12 rounded-xl border-2 shadow-sm flex-shrink-0"
                              style={{ background: accentPreview, borderColor: accentPreview }}
                            />
                            <div className="flex-1 space-y-2">
                              <p className="font-medium">{preset.displayName}</p>
                              <div className="flex gap-2">
                                <div className="h-3 w-10 rounded-full" style={{ background: accentPreview }}></div>
                                <div className="h-3 w-10 rounded-full" style={{ background: accentPreviewDark }}></div>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">{preset.description}</p>
                            </div>
                          </div>
                          
                          {isActive && (
                            <motion.div
                              className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: accentPreview }}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                            >
                              <Check className="h-3 w-3 text-white" />
                            </motion.div>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cette couleur s&apos;applique aux boutons primaires, survols, focus et autres éléments interactifs.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section Sidebar */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("sidebar")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center">
              <Layout className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Configuration de la sidebar</h3>
              <p className="text-sm text-muted-foreground">
                Comportement et affichage de la navigation
              </p>
            </div>
          </div>
          <ChevronRight className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            expandedSection === "sidebar" && "rotate-90"
          )} />
        </button>
        
        <AnimatePresence>
          {expandedSection === "sidebar" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 pt-2 space-y-6 border-t">
                {/* Toggle sidebar */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <PanelLeft className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Sidebar active</p>
                      <p className="text-sm text-muted-foreground">
                        {tempSidebarEnabled ? "La sidebar est affichée" : "Navigation via le logo uniquement"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTempSidebarEnabled(!tempSidebarEnabled)}
                    className={cn(
                      "relative h-7 w-12 rounded-full transition-colors",
                      tempSidebarEnabled ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                      tempSidebarEnabled ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>
                
                {/* Modes de sidebar - GARDER LA TAILLE ORIGINALE DES PREVIEWS */}
                {tempSidebarEnabled && (
                  <div className="space-y-4">
                    <label className="text-sm font-semibold">Mode de la sidebar</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {sidebarModes.map((mode) => {
                        const Icon = mode.icon
                        const isSelected = tempSidebarMode === mode.id
                        
                        return (
                          <motion.button
                            key={mode.id}
                            type="button"
                            onClick={() => handleSidebarModeChange(mode.id as "collapsed" | "hybrid" | "expanded")}
                            className={cn(
                              "relative p-4 rounded-xl border-2 transition-all text-left",
                              isSelected 
                                ? "border-primary bg-primary/5" 
                                : "border-muted hover:border-muted-foreground/30 hover:bg-muted/30"
                            )}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <div className="space-y-3">
                              <div className={cn(
                                "h-10 w-10 rounded-xl flex items-center justify-center",
                                isSelected ? "bg-primary/10" : "bg-muted"
                              )}>
                                <Icon className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                              </div>
                              
                              {/* Preview avec animations - GARDER LA TAILLE ORIGINALE (h-24) */}
                              <div className="border rounded-lg p-4 bg-muted/30">
                                <div className="flex gap-2 h-24">
                                  {mode.id === "collapsed" && (
                                    <>
                                      <div className="w-8 bg-sidebar border rounded flex flex-col items-center py-2 gap-1 animate-pulse">
                                        <PanelLeftClose className="h-3 w-3 text-muted-foreground" />
                                        <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                                        <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                                        <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                                        <div className="flex-1"></div>
                                        <div className="w-4 h-4 bg-muted-foreground/40 rounded-full"></div>
                                      </div>
                                      <div className="flex-1 bg-background border rounded p-2">
                                        <div className="w-full h-2 bg-muted-foreground/20 rounded mb-2"></div>
                                        <div className="w-3/4 h-2 bg-muted-foreground/20 rounded"></div>
                                      </div>
                                    </>
                                  )}
                                  {mode.id === "hybrid" && (
                                    <>
                                      <div className="w-8 bg-sidebar border rounded flex flex-col items-center py-2 gap-1 relative overflow-hidden animate-[expand-contract_2s_ease-in-out_infinite]">
                                        <PanelLeft className="h-3 w-3 text-muted-foreground" />
                                        <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                                        <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                                        <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                                        <div className="flex-1"></div>
                                        <div className="w-4 h-4 bg-muted-foreground/40 rounded-full"></div>
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-sidebar/50 opacity-30 animate-[shimmer_2s_ease-in-out_infinite]"></div>
                                      </div>
                                      <div className="flex-1 bg-background border rounded p-2">
                                        <div className="w-full h-2 bg-muted-foreground/20 rounded mb-2"></div>
                                        <div className="w-3/4 h-2 bg-muted-foreground/20 rounded"></div>
                                      </div>
                                    </>
                                  )}
                                  {mode.id === "expanded" && (
                                    <>
                                      <div className="w-16 bg-sidebar border rounded flex flex-col py-2 px-2 gap-1 animate-[breathing_3s_ease-in-out_infinite]">
                                        <div className="flex items-center gap-1 mb-1">
                                          <PanelLeftOpen className="h-3 w-3 text-muted-foreground" />
                                          <div className="w-8 h-1 bg-muted-foreground/40 rounded"></div>
                                        </div>
                                        <div className="w-full h-1 bg-muted-foreground/40 rounded"></div>
                                        <div className="w-full h-1 bg-muted-foreground/40 rounded"></div>
                                        <div className="w-full h-1 bg-muted-foreground/40 rounded"></div>
                                        <div className="flex-1"></div>
                                        <div className="flex items-center gap-1">
                                          <div className="w-3 h-3 bg-muted-foreground/40 rounded-full"></div>
                                          <div className="w-6 h-1 bg-muted-foreground/40 rounded"></div>
                                        </div>
                                      </div>
                                      <div className="flex-1 bg-background border rounded p-2">
                                        <div className="w-full h-2 bg-muted-foreground/20 rounded mb-2"></div>
                                        <div className="w-3/4 h-2 bg-muted-foreground/20 rounded"></div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <p className="font-medium">{mode.label}</p>
                                <p className="text-xs text-muted-foreground">{mode.description}</p>
                              </div>
                            </div>
                            
                            {isSelected && (
                              <motion.div
                                className="absolute top-3 right-3 h-5 w-5 rounded-full bg-primary flex items-center justify-center"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                              >
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </motion.div>
                            )}
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section Préférences du tableau de bord */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("dashboard")}
          className="w-full px-6 py-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center">
              <Gauge className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Préférences du tableau de bord</h3>
              <p className="text-sm text-muted-foreground">
                Personnalisez l&apos;affichage des speedometers
              </p>
            </div>
          </div>
          <ChevronRight className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            expandedSection === "dashboard" && "rotate-90"
          )} />
        </button>
        
        <AnimatePresence>
          {expandedSection === "dashboard" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-6 pt-2 space-y-4 border-t">
                {preferencesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Speedometer marge moyenne */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Gauge className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="font-medium">Speedometer marge moyenne</p>
                          <p className="text-sm text-muted-foreground">
                            Afficher le pourcentage sous le speedometer
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSpeedometerMarginAverageShowPercentage(!speedometerMarginAverageShowPercentage)}
                        className={cn(
                          "relative h-7 w-12 rounded-full transition-colors",
                          speedometerMarginAverageShowPercentage ? "bg-primary" : "bg-muted-foreground/20"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                          speedometerMarginAverageShowPercentage ? "translate-x-6" : "translate-x-1"
                        )} />
                      </button>
                    </div>
                    
                    {/* Speedometer marge totale */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Gauge className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-medium">Speedometer marge totale</p>
                          <p className="text-sm text-muted-foreground">
                            Afficher le pourcentage sous le speedometer
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSpeedometerMarginTotalShowPercentage(!speedometerMarginTotalShowPercentage)}
                        className={cn(
                          "relative h-7 w-12 rounded-full transition-colors",
                          speedometerMarginTotalShowPercentage ? "bg-primary" : "bg-muted-foreground/20"
                        )}
                      >
                        <div className={cn(
                          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                          speedometerMarginTotalShowPercentage ? "translate-x-6" : "translate-x-1"
                        )} />
                      </button>
                    </div>
                    
                    {/* Bouton de sauvegarde des préférences */}
                    <div className="flex justify-end pt-2">
                      <motion.button
                        type="button"
                        onClick={handleSavePreferences}
                        disabled={savingPreferences || !currentUser?.id}
                        className="px-5 py-2.5 rounded-xl font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {savingPreferences ? (
                          <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Sauvegarder les préférences
                      </motion.button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bouton de sauvegarde global */}
      <div className="flex justify-end">
        <motion.button
          type="button"
          onClick={handleSaveInterfaceSettings}
          disabled={saving || !hasUnsavedChanges}
          className={cn(
            "px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 shadow-lg",
            hasUnsavedChanges 
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20" 
              : "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
          )}
          whileHover={hasUnsavedChanges ? { scale: 1.02 } : {}}
          whileTap={hasUnsavedChanges ? { scale: 0.98 } : {}}
        >
          {saving ? (
            <>
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Enregistrement...
            </>
          ) : hasUnsavedChanges ? (
            <>
              <Save className="h-4 w-4" />
              Sauvegarder l&apos;interface
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Paramètres sauvegardés
            </>
          )}
        </motion.button>
      </div>
    </div>
  )
}

