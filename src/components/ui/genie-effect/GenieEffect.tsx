"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"

export interface GenieEffectConfig {
  /** ID de l'intervention animée */
  interventionId: string
  /** Élément source (la ligne de tableau) */
  sourceElement: HTMLElement
  /** Élément cible (la pastille de la vue destination) */
  targetElement: HTMLElement
  /** Durée de l'animation en ms */
  duration?: number
  /** Callback appelé quand l'animation est terminée */
  onComplete?: () => void
  /** Callback pour déclencher l'effet de rebond sur la pastille */
  onBadgeBounce?: () => void
}

interface GenieEffectState {
  isAnimating: boolean
  config: GenieEffectConfig | null
}

// Store global pour gérer l'état de l'animation
let genieState: GenieEffectState = {
  isAnimating: false,
  config: null,
}

let genieListeners: Set<() => void> = new Set()

function notifyListeners() {
  genieListeners.forEach((listener) => listener())
}

export function triggerGenieEffect(config: GenieEffectConfig) {
  genieState = {
    isAnimating: true,
    config,
  }
  notifyListeners()
}

export function clearGenieEffect() {
  genieState = {
    isAnimating: false,
    config: null,
  }
  notifyListeners()
}

export function useGenieEffect() {
  const [state, setState] = useState(genieState)

  useEffect(() => {
    const listener = () => {
      setState({ ...genieState })
    }
    genieListeners.add(listener)
    return () => {
      genieListeners.delete(listener)
    }
  }, [])

  return state
}

/**
 * Composant GenieEffect - Animation de succion style macOS Dock
 * Affiche un clone de la ligne qui s'envole vers la pastille cible
 */
export function GenieEffectOverlay() {
  const { isAnimating, config } = useGenieEffect()
  const cloneRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<"idle" | "shrinking" | "complete">("idle")

  useEffect(() => {
    if (!isAnimating || !config) {
      setPhase("idle")
      return
    }

    const { sourceElement, targetElement, duration = 800, onComplete, onBadgeBounce } = config

    // Récupérer les positions
    const sourceRect = sourceElement.getBoundingClientRect()
    const targetRect = targetElement.getBoundingClientRect()

    // Position de départ (ligne source)
    const startX = sourceRect.left
    const startY = sourceRect.top
    const startWidth = sourceRect.width
    const startHeight = sourceRect.height

    // Position cible (centre de la pastille)
    const endX = targetRect.left + targetRect.width / 2
    const endY = targetRect.top + targetRect.height / 2

    // Configurer le clone
    if (cloneRef.current) {
      // Copier le contenu de la ligne
      cloneRef.current.innerHTML = sourceElement.outerHTML
      
      // Style initial
      Object.assign(cloneRef.current.style, {
        position: "fixed",
        left: `${startX}px`,
        top: `${startY}px`,
        width: `${startWidth}px`,
        height: `${startHeight}px`,
        zIndex: "9999",
        pointerEvents: "none",
        transformOrigin: "center center",
        willChange: "transform, opacity",
        // Effet de glow initial
        boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
        borderRadius: "8px",
        overflow: "hidden",
      })

      // Démarrer l'animation après un frame
      requestAnimationFrame(() => {
        setPhase("shrinking")

        if (!cloneRef.current) return

        // Calculer la trajectoire avec courbe de Bézier
        const deltaX = endX - (startX + startWidth / 2)
        const deltaY = endY - (startY + startHeight / 2)

        // Animation CSS avec keyframes dynamiques
        const keyframes = [
          {
            transform: "translate(0, 0) scale(1) rotate(0deg)",
            opacity: 1,
            filter: "blur(0px)",
          },
          {
            transform: `translate(${deltaX * 0.3}px, ${deltaY * 0.2}px) scale(0.8) rotate(-5deg)`,
            opacity: 0.9,
            filter: "blur(0px)",
            offset: 0.2,
          },
          {
            transform: `translate(${deltaX * 0.5}px, ${deltaY * 0.4}px) scale(0.5) rotate(-15deg)`,
            opacity: 0.8,
            filter: "blur(1px)",
            offset: 0.4,
          },
          {
            transform: `translate(${deltaX * 0.7}px, ${deltaY * 0.6}px) scale(0.3) rotate(-30deg) scaleX(0.6)`,
            opacity: 0.6,
            filter: "blur(2px)",
            offset: 0.6,
          },
          {
            transform: `translate(${deltaX * 0.9}px, ${deltaY * 0.85}px) scale(0.15) rotate(-45deg) scaleX(0.3)`,
            opacity: 0.4,
            filter: "blur(3px)",
            offset: 0.8,
          },
          {
            transform: `translate(${deltaX}px, ${deltaY}px) scale(0.05) rotate(-60deg) scaleX(0.1)`,
            opacity: 0,
            filter: "blur(4px)",
          },
        ]

        const animation = cloneRef.current.animate(keyframes, {
          duration,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "forwards",
        })

        animation.onfinish = () => {
          setPhase("complete")
          
          // Déclencher l'effet de rebond sur la pastille
          if (onBadgeBounce) {
            onBadgeBounce()
          }

          // Petite pause avant de nettoyer pour l'effet visuel
          setTimeout(() => {
            if (onComplete) {
              onComplete()
            }
            clearGenieEffect()
          }, 50)
        }
      })
    }
  }, [isAnimating, config])

  // Cacher la ligne source pendant l'animation
  useEffect(() => {
    if (isAnimating && config?.sourceElement) {
      const originalOpacity = config.sourceElement.style.opacity
      config.sourceElement.style.opacity = "0"
      config.sourceElement.style.transition = "opacity 0.1s"

      return () => {
        if (config.sourceElement) {
          config.sourceElement.style.opacity = originalOpacity
          config.sourceElement.style.transition = ""
        }
      }
    }
  }, [isAnimating, config])

  if (!isAnimating || !config) {
    return null
  }

  return createPortal(
    <div
      ref={cloneRef}
      className="genie-effect-clone"
      style={{
        position: "fixed",
        zIndex: 9999,
        pointerEvents: "none",
      }}
    />,
    document.body
  )
}

/**
 * Hook pour gérer le rebond de la pastille
 */
export function useBadgeBounce(viewId: string) {
  const [isBouncing, setIsBouncing] = useState(false)
  const bounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const triggerBounce = useCallback(() => {
    // Nettoyer le timeout précédent
    if (bounceTimeoutRef.current) {
      clearTimeout(bounceTimeoutRef.current)
    }

    setIsBouncing(true)

    // Arrêter le rebond après l'animation (500ms)
    bounceTimeoutRef.current = setTimeout(() => {
      setIsBouncing(false)
    }, 500)
  }, [])

  // Écouter les événements de rebond globaux
  useEffect(() => {
    const handleBounce = (event: CustomEvent<{ viewId: string }>) => {
      if (event.detail.viewId === viewId) {
        triggerBounce()
      }
    }

    window.addEventListener("genie-badge-bounce" as any, handleBounce)
    return () => {
      window.removeEventListener("genie-badge-bounce" as any, handleBounce)
      if (bounceTimeoutRef.current) {
        clearTimeout(bounceTimeoutRef.current)
      }
    }
  }, [viewId, triggerBounce])

  return { isBouncing, triggerBounce }
}

/**
 * Déclenche un événement de rebond sur une pastille
 */
export function triggerBadgeBounce(viewId: string) {
  window.dispatchEvent(
    new CustomEvent("genie-badge-bounce", {
      detail: { viewId },
    })
  )
}

/**
 * Styles CSS pour l'animation de rebond
 */
export const badgeBounceStyles = `
  @keyframes badge-bounce {
    0% {
      transform: scale(1);
    }
    20% {
      transform: scale(1.3);
    }
    40% {
      transform: scale(0.9);
    }
    60% {
      transform: scale(1.15);
    }
    80% {
      transform: scale(0.95);
    }
    100% {
      transform: scale(1);
    }
  }

  .badge-bouncing {
    animation: badge-bounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }

  @keyframes badge-glow {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    }
    50% {
      box-shadow: 0 0 15px 5px rgba(59, 130, 246, 0.4);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
  }

  .badge-bouncing {
    animation: badge-bounce 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55),
               badge-glow 0.5s ease-out;
  }
`
