"use client"

import { useState, useEffect, useCallback } from "react"
import { X, Copy, Check, ChevronDown, ChevronUp, RefreshCw } from "lucide-react"

type DebugValues = {
  blur: number
  opacity: number
  saturation: number
  color: string
}

const DEFAULT_VALUES: DebugValues = {
  blur: 16,
  opacity: 0.25,
  saturation: 1.4,
  color: "#ffffff",
}

// Convertir hex en rgba
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function DesignDebugBar() {
  const [isOpen, setIsOpen] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [copied, setCopied] = useState(false)
  const [values, setValues] = useState<DebugValues>(DEFAULT_VALUES)
  const [activeModals, setActiveModals] = useState(0)

  // Fonction pour appliquer les styles directement aux éléments du DOM
  const applyStylesToModals = useCallback(() => {
    const bgColor = hexToRgba(values.color, values.opacity)
    const backdropFilter = `blur(${values.blur}px) saturate(${values.saturation})`

    // Cibler tous les modals ouverts (centerpage et halfpage)
    const modalSurfaces = document.querySelectorAll<HTMLElement>(".modal-surface")
    const sheetContents = document.querySelectorAll<HTMLElement>(".shadcn-sheet-content")

    let count = 0

    modalSurfaces.forEach((el) => {
      el.style.setProperty("background", bgColor, "important")
      el.style.setProperty("backdrop-filter", backdropFilter, "important")
      el.style.setProperty("-webkit-backdrop-filter", backdropFilter, "important")
      count++
    })

    sheetContents.forEach((el) => {
      el.style.setProperty("background", bgColor, "important")
      el.style.setProperty("backdrop-filter", backdropFilter, "important")
      el.style.setProperty("-webkit-backdrop-filter", backdropFilter, "important")
      count++
    })

    setActiveModals(count)
  }, [values])

  // Observer les changements dans le DOM pour détecter l'ouverture/fermeture des modals
  useEffect(() => {
    // Appliquer immédiatement
    applyStylesToModals()

    // Observer les mutations du DOM pour détecter les nouveaux modals
    const observer = new MutationObserver(() => {
      applyStylesToModals()
    })

    // Observer le body et le portal root
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    // Aussi observer le portal container s'il existe
    const portalRoot = document.getElementById("modal-portal-root")
    if (portalRoot) {
      observer.observe(portalRoot, {
        childList: true,
        subtree: true,
      })
    }

    return () => {
      observer.disconnect()
    }
  }, [applyStylesToModals])

  // Réappliquer les styles quand les valeurs changent
  useEffect(() => {
    applyStylesToModals()
  }, [values, applyStylesToModals])

  // Générer le code CSS à copier
  const generateCSSCode = () => {
    return `/* Valeurs trouvées avec DesignDebugBar */
background: ${hexToRgba(values.color, values.opacity)};
backdrop-filter: blur(${values.blur}px) saturate(${values.saturation});
-webkit-backdrop-filter: blur(${values.blur}px) saturate(${values.saturation});`
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generateCSSCode())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReset = () => {
    setValues(DEFAULT_VALUES)
  }

  const handleRefresh = () => {
    applyStylesToModals()
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-[9999] px-3 py-2 bg-violet-600 text-white text-xs font-medium rounded-lg shadow-lg hover:bg-violet-700 transition-colors"
      >
        🎨 Design Debug
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎨</span>
          <span className="font-semibold text-sm">Modal Design Debug</span>
          {activeModals > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded">
              {activeModals} actif{activeModals > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            className="p-1.5 hover:bg-slate-700 rounded-md transition-colors"
            title="Réappliquer les styles"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-slate-700 rounded-md transition-colors"
          >
            {isMinimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-slate-700 rounded-md transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Status */}
          <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700/50">
            <p className="text-[10px] text-slate-400">
              {activeModals > 0
                ? `✅ Styles appliqués à ${activeModals} modal(s)`
                : "⏳ Ouvre un modal pour voir les changements en live"}
            </p>
          </div>

          {/* Controls */}
          <div className="p-4 space-y-4">
            {/* Blur */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Blur</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={values.blur}
                    onChange={(e) => setValues({ ...values, blur: Number(e.target.value) })}
                    className="w-14 px-2 py-1 text-xs font-mono bg-slate-800 border border-slate-600 rounded text-right"
                  />
                  <span className="text-xs text-slate-500">px</span>
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={values.blur}
                onChange={(e) => setValues({ ...values, blur: Number(e.target.value) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            {/* Opacity */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Opacité</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={values.opacity}
                    onChange={(e) => setValues({ ...values, opacity: Number(e.target.value) })}
                    className="w-14 px-2 py-1 text-xs font-mono bg-slate-800 border border-slate-600 rounded text-right"
                  />
                </div>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={values.opacity}
                onChange={(e) => setValues({ ...values, opacity: Number(e.target.value) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            {/* Saturation */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Saturation</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value={values.saturation}
                    onChange={(e) => setValues({ ...values, saturation: Number(e.target.value) })}
                    className="w-14 px-2 py-1 text-xs font-mono bg-slate-800 border border-slate-600 rounded text-right"
                  />
                </div>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={values.saturation}
                onChange={(e) => setValues({ ...values, saturation: Number(e.target.value) })}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            {/* Color */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Couleur</label>
                <span className="text-xs font-mono text-violet-400">{values.color}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={values.color}
                  onChange={(e) => setValues({ ...values, color: e.target.value })}
                  className="w-10 h-8 rounded cursor-pointer border border-slate-600"
                />
                <input
                  type="text"
                  value={values.color}
                  onChange={(e) => {
                    const val = e.target.value
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      setValues({ ...values, color: val })
                    }
                  }}
                  className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-xs font-mono"
                  placeholder="#ffffff"
                />
              </div>
            </div>

            {/* Preview color swatch */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Aperçu couleur finale</label>
              <div
                className="h-8 rounded-lg border border-slate-600"
                style={{
                  background: hexToRgba(values.color, values.opacity),
                  backdropFilter: `blur(${values.blur}px) saturate(${values.saturation})`,
                }}
              />
            </div>
          </div>

          {/* Preview CSS */}
          <div className="px-4 pb-3">
            <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-400">CSS Output</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                >
                  {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                  {copied ? "Copié!" : "Copier"}
                </button>
              </div>
              <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {generateCSSCode()}
              </pre>
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 px-3 py-2 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
            >
              Reset
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 px-3 py-2 text-xs font-medium bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
            >
              Copier CSS
            </button>
          </div>
        </>
      )}
    </div>
  )
}
