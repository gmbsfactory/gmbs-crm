"use client"

import React, { createContext, useContext, useState, useCallback, useRef } from "react"

interface PendingAnimation {
  interventionId: string
  sourceElement: HTMLElement | null
  targetViewId: string
  onAnimationComplete: () => void
}

interface GenieEffectContextValue {
  // État de l'animation en cours
  isAnimating: boolean
  animatingInterventionId: string | null
  
  // Référence vers les éléments des pastilles (viewId -> HTMLElement)
  badgeRefs: Map<string, HTMLElement>
  
  // Enregistrer une référence de pastille
  registerBadgeRef: (viewId: string, element: HTMLElement | null) => void
  
  // Déclencher l'animation
  triggerAnimation: (
    interventionId: string,
    sourceElement: HTMLElement,
    targetViewId: string,
    onComplete: () => void
  ) => void
  
  // Vue dont la pastille doit rebondir
  bouncingViewId: string | null
  
  // Vues dont les compteurs doivent être gelés pendant l'animation
  frozenCountViewIds: Set<string>
  
  // Mettre à jour les compteurs après animation
  unfreezeCountForView: (viewId: string) => void
}

const GenieEffectContext = createContext<GenieEffectContextValue | null>(null)

export function GenieEffectProvider({ children }: { children: React.ReactNode }) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [animatingInterventionId, setAnimatingInterventionId] = useState<string | null>(null)
  const [bouncingViewId, setBouncingViewId] = useState<string | null>(null)
  const [frozenCountViewIds, setFrozenCountViewIds] = useState<Set<string>>(new Set())
  
  const badgeRefs = useRef<Map<string, HTMLElement>>(new Map())
  const animationCloneRef = useRef<HTMLDivElement | null>(null)
  
  const registerBadgeRef = useCallback((viewId: string, element: HTMLElement | null) => {
    if (element) {
      badgeRefs.current.set(viewId, element)
    } else {
      badgeRefs.current.delete(viewId)
    }
  }, [])
  
  const triggerAnimation = useCallback((
    interventionId: string,
    sourceElement: HTMLElement,
    targetViewId: string,
    onComplete: () => void
  ) => {
    
    const targetElement = badgeRefs.current.get(targetViewId)

    if (!targetElement) {
      console.warn(`[GenieEffect] Pastille non trouvée pour la vue: ${targetViewId}`)
      onComplete()
      return
    }

    // Respecter prefers-reduced-motion : skip animation
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (prefersReducedMotion) {
      onComplete()
      return
    }
    
    
    setIsAnimating(true)
    setAnimatingInterventionId(interventionId)
    
    // Geler les compteurs des vues concernées
    setFrozenCountViewIds(new Set(["market", targetViewId]))
    
    // Récupérer les positions AVANT de créer le clone
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
    
    // Calculer les deltas
    const deltaX = endX - (startX + startWidth / 2)
    const deltaY = endY - (startY + startHeight / 2)
    
    // Créer un clone fidèle de la ligne de tableau
    // On crée un mini-tableau pour préserver les largeurs de colonnes
    const clone = document.createElement("div")
    clone.className = "genie-effect-clone"
    
    // Récupérer le style calculé de la source pour le fond
    const computedStyle = window.getComputedStyle(sourceElement)
    const bgColor = computedStyle.backgroundColor !== "rgba(0, 0, 0, 0)" 
      ? computedStyle.backgroundColor 
      : "var(--background)"
    
    // Créer un tableau wrapper pour préserver la structure
    const tableWrapper = document.createElement("table")
    tableWrapper.style.cssText = "border-collapse: collapse; width: 100%; height: 100%; table-layout: fixed;"
    
    // Cloner la ligne avec tout son contenu et styles
    const clonedRow = sourceElement.cloneNode(true) as HTMLTableRowElement
    clonedRow.style.opacity = "1"
    clonedRow.style.transform = "none"
    clonedRow.style.display = ""
    
    // Copier les largeurs exactes de chaque cellule
    const originalCells = sourceElement.querySelectorAll("td")
    const clonedCells = clonedRow.querySelectorAll("td")
    originalCells.forEach((cell, index) => {
      if (clonedCells[index]) {
        const cellRect = cell.getBoundingClientRect()
        const clonedCell = clonedCells[index] as HTMLElement
        clonedCell.style.width = `${cellRect.width}px`
        clonedCell.style.minWidth = `${cellRect.width}px`
        clonedCell.style.maxWidth = `${cellRect.width}px`
        // Copier le padding et autres styles importants
        const cellStyle = window.getComputedStyle(cell)
        clonedCell.style.padding = cellStyle.padding
        clonedCell.style.textAlign = cellStyle.textAlign
        clonedCell.style.verticalAlign = cellStyle.verticalAlign
      }
    })
    
    // Créer le tbody et y ajouter la ligne clonée
    const tbody = document.createElement("tbody")
    tbody.appendChild(clonedRow)
    tableWrapper.appendChild(tbody)
    clone.appendChild(tableWrapper)
    
    // Style initial du clone
    Object.assign(clone.style, {
      position: "fixed",
      left: `${startX}px`,
      top: `${startY}px`,
      width: `${startWidth}px`,
      height: `${startHeight}px`,
      zIndex: "9999",
      pointerEvents: "none",
      transformOrigin: "center center",
      willChange: "transform, opacity",
      boxShadow: "0 8px 32px rgba(59, 130, 246, 0.5), 0 0 0 2px rgba(59, 130, 246, 0.3)",
      borderRadius: "8px",
      overflow: "hidden",
      background: bgColor,
      backdropFilter: "blur(4px)",
    })
    
    document.body.appendChild(clone)
    animationCloneRef.current = clone
    
    
    // Cacher la ligne source immédiatement (elle est clonée)
    sourceElement.style.opacity = "0"
    
    // Pour les lignes de tableau, on utilise une approche qui retire la ligne du flow
    // pour permettre aux lignes suivantes de remonter avec animation
    const isTableRow = sourceElement.tagName === "TR"
    
    if (isTableRow) {
      // Récupérer la hauteur de la ligne pour l'animation
      const rowHeight = sourceElement.offsetHeight
      
      // Trouver les lignes suivantes dans le tbody
      const tbody = sourceElement.parentElement
      const allRows = tbody ? Array.from(tbody.querySelectorAll("tr")) : []
      const currentIndex = allRows.indexOf(sourceElement as HTMLTableRowElement)
      const followingRows = allRows.slice(currentIndex + 1)
      
      // Préparer les lignes suivantes pour l'animation de remontée
      followingRows.forEach((row) => {
        const htmlRow = row as HTMLElement
        // Appliquer un transform initial pour maintenir la position
        htmlRow.style.transform = `translateY(0px)`
        htmlRow.style.transition = "none"
      })
      
      // Forcer un reflow
      void sourceElement.offsetHeight
      
      // Après un court délai, déclencher l'animation de remontée
      setTimeout(() => {
        // Cacher la ligne source immédiatement (display: none)
        sourceElement.style.display = "none"
        
        // IMMÉDIATEMENT recalculer les stripes AVANT l'animation de remontée
        // Inverser les classes even/odd pour maintenir l'alternance
        followingRows.forEach((row) => {
          const htmlRow = row as HTMLElement
          const isCurrentlyEven = htmlRow.classList.contains("table-row-even")
          const isCurrentlyOdd = htmlRow.classList.contains("table-row-odd")
          
          if (isCurrentlyEven) {
            htmlRow.classList.remove("table-row-even")
            htmlRow.classList.add("table-row-odd")
          } else if (isCurrentlyOdd) {
            htmlRow.classList.remove("table-row-odd")
            htmlRow.classList.add("table-row-even")
          }
        })
        
        // Animer les lignes suivantes pour qu'elles remontent de la hauteur de la ligne supprimée
        // Elles commencent à translateY(rowHeight) et vont vers translateY(0)
        followingRows.forEach((row) => {
          const htmlRow = row as HTMLElement
          // Position initiale : décalées vers le bas de la hauteur de la ligne supprimée
          htmlRow.style.transform = `translateY(${rowHeight}px)`
          htmlRow.style.transition = "none"
          
          // Forcer le reflow
          void htmlRow.offsetHeight
          
          // Appliquer la transition et animer vers la position finale
          htmlRow.style.transition = "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
          htmlRow.style.transform = "translateY(0px)"
        })
        
        // Nettoyer les styles après l'animation
        setTimeout(() => {
          followingRows.forEach((row) => {
            const htmlRow = row as HTMLElement
            htmlRow.style.transform = ""
            htmlRow.style.transition = ""
          })
        }, 300)
      }, 10) // Délai réduit à 10ms
    } else {
      // Pour les autres éléments (non-tableau), on utilise height
      const originalHeight = sourceElement.offsetHeight
      sourceElement.style.height = `${originalHeight}px`
      sourceElement.style.overflow = "hidden"
      
      setTimeout(() => {
        sourceElement.style.transition = "height 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        void sourceElement.offsetHeight
        sourceElement.style.height = "0px"
        sourceElement.style.paddingTop = "0px"
        sourceElement.style.paddingBottom = "0px"
      }, 10) // Délai réduit à 10ms
    }
    
    // Animation avec keyframes - Effet "remontée puis aspiration"
    // Phase 1 (0-10%) : Réduction initiale scale 1 → 0.8 (100ms)
    // Phase 2 (10-85%) : Remontée vers la pastille, scale reste 0.8 (750ms)
    // Phase 3 (85-100%) : Aspiration finale scale 0.8 → 0.2 (150ms)
const duration = 1000; // 1 second
const keyframes = [
  {
    transform: "translate(0, 0) scale(1)",
    opacity: 1,
    boxShadow: "0 8px 32px rgba(59, 130, 246, 0.5)",
    offset: 0,
  },
  // Phase 1 (Reduction)
  {
    transform: "translate(0, 0) scale(0.9)",
    opacity: 1,
    boxShadow: "0 6px 28px rgba(59, 130, 246, 0.45)",
    offset: 0.10,
  },
  // Phase 2 (Movement)
  {
    transform: `translate(${deltaX + 220}px, ${deltaY * 0.15}px) scale(0.9)`,
    opacity: 1,
    boxShadow: "0 6px 26px rgba(59, 130, 246, 0.45)",
    offset: 0.25,
  },
  {
    transform: `translate(${deltaX + 220}px, ${deltaY * 0.35}px) scale(0.88)`,
    opacity: 1,
    boxShadow: "0 5px 24px rgba(59, 130, 246, 0.42)",
    offset: 0.35,
  },
  {
    transform: `translate(${deltaX + 220}px, ${deltaY * 0.55}px) scale(0.86)`,
    opacity: 1,
    boxShadow: "0 5px 22px rgba(59, 130, 246, 0.40)",
    offset: 0.45,
  },
  {
    transform: `translate(${deltaX + 220}px, ${deltaY * 0.75}px) scale(0.84)`,
    opacity: 1,
    boxShadow: "0 4px 20px rgba(59, 130, 246, 0.38)",
    offset: 0.55,
  },
  {
    transform: `translate(${deltaX + 220}px, ${deltaY * 0.85}px) scale(0.82)`,
    opacity: 1,
    boxShadow: "0 4px 18px rgba(59, 130, 246, 0.35)",
    offset: 0.70,
  },
  // Phase 3 (Aspiration)
  {
    transform: `translate(${deltaX + 200}px, ${deltaY * 0.85}px) scale(0.75)`,
    opacity: 0.8,
    boxShadow: "0 3px 16px rgba(59, 130, 246, 0.3)",
    offset: 0.80,
  },
  {
    transform: `translate(${deltaX + 170}px, ${deltaY * 0.92}px) scale(0.6)`,
    opacity: 0.7,
    boxShadow: "0 2px 14px rgba(59, 130, 246, 0.28)",
    offset: 0.85,
  },
  {
    transform: `translate(${deltaX + 140}px, ${deltaY * 0.97}px) scale(0.4)`,
    opacity: 0.6,
    boxShadow: "0 2px 10px rgba(59, 130, 246, 0.20)",
    offset: 0.90,
  },
  {
    transform: `translate(${deltaX + 80}px, ${deltaY * 0.99}px) scale(0.2)`,
    opacity: 0.5,
    boxShadow: "0 1px 6px rgba(59, 130, 246, 0.15)",
    offset: 0.97,
  },
  {
    transform: `translate(${deltaX}px, ${deltaY}px) scale(0.1)`,
    opacity: 0,
    boxShadow: "0 0 4px rgba(59, 130, 246, 0.1)",
    offset: 1,
  },
];
    
    const animation = clone.animate(keyframes, {
      duration,
      easing: "linear", // Linear pour respecter les timings exacts des offsets
      fill: "forwards",
    })
    
    animation.onfinish = () => {
      // Nettoyer le clone
      if (animationCloneRef.current) {
        animationCloneRef.current.remove()
        animationCloneRef.current = null
      }
      
      // Exécuter la mutation
      onComplete()
      
      // Déclencher l'effet de rebond sur la pastille cible
      setBouncingViewId(targetViewId)
      
      // Dégeler les compteurs après un délai plus long (pour savourer le rebond)
      setTimeout(() => {
        setFrozenCountViewIds(new Set())
        setBouncingViewId(null)
        setIsAnimating(false)
        setAnimatingInterventionId(null)
      }, 700)
    }
  }, [])
  
  const unfreezeCountForView = useCallback((viewId: string) => {
    setFrozenCountViewIds(prev => {
      const next = new Set(prev)
      next.delete(viewId)
      return next
    })
  }, [])
  
  return (
    <GenieEffectContext.Provider
      value={{
        isAnimating,
        animatingInterventionId,
        badgeRefs: badgeRefs.current,
        registerBadgeRef,
        triggerAnimation,
        bouncingViewId,
        frozenCountViewIds,
        unfreezeCountForView,
      }}
    >
      {children}
    </GenieEffectContext.Provider>
  )
}

export function useGenieEffectContext() {
  const context = useContext(GenieEffectContext)
  if (!context) {
    // Retourner un contexte vide si le provider n'est pas présent
    // Cela permet aux composants de fonctionner sans animation
    return {
      isAnimating: false,
      animatingInterventionId: null,
      badgeRefs: new Map(),
      registerBadgeRef: () => {},
      triggerAnimation: (_: string, __: HTMLElement, ___: string, onComplete: () => void) => {
        onComplete()
      },
      bouncingViewId: null,
      frozenCountViewIds: new Set<string>(),
      unfreezeCountForView: () => {},
    }
  }
  return context
}