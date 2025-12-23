"use client"

import { type ReactNode, useMemo, useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion, type Variants } from "framer-motion"
import FocusTrap from "focus-trap-react"
import type { ModalDisplayMode } from "@/types/modal-display"
import { cn } from "@/lib/utils"

// ID du conteneur portal statique
const PORTAL_CONTAINER_ID = "modal-portal-root"

// Fonction pour obtenir ou créer le conteneur portal statique
function getPortalContainer(): HTMLElement | null {
  if (typeof window === "undefined") return null
  
  let container = document.getElementById(PORTAL_CONTAINER_ID)
  if (!container) {
    container = document.createElement("div")
    container.id = PORTAL_CONTAINER_ID
    container.setAttribute("data-modal-portal", "true")
    document.body.appendChild(container)
  }
  return container
}

type Props = {
  isOpen: boolean
  onClose: () => void
  mode: ModalDisplayMode
  layoutId?: string | null
  children: ReactNode
  containerClassName?: string
  wrapperClassName?: string
  contentClassName?: string
  onExitComplete?: () => void
  // Props pour la gestion des modifications non sauvegardées
  hasUnsavedChanges?: boolean
  isSubmitting?: boolean
  onShowUnsavedDialog?: () => void
  pauseFocusTrap?: boolean
}

const backdropVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const containerVariants: Record<ModalDisplayMode, Variants> = {
  halfpage: {
    initial: { x: "100%" },
    animate: { x: "0%" },
    exit: { x: "100%" },
  },
  centerpage: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 },
  },
  fullpage: {
    initial: { y: "100%" },
    animate: { y: "0%" },
    exit: { y: "100%" },
  },
}

const getModalStyle = (mode: ModalDisplayMode) => {
  switch (mode) {
    case "halfpage":
      return {
        container: "fixed top-0 right-0 z-[70] h-full w-1/2 p-4",
        wrapper: "pointer-events-none h-full w-full",
        content: "pointer-events-auto flex h-full w-full flex-col overflow-hidden shadcn-sheet-content",
      }
    case "centerpage":
      return {
        container: "fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none",
        wrapper: "flex h-full w-full items-center justify-center",
        content:
          "pointer-events-auto modal-surface flex h-[85vh] w-full max-w-[80vw] flex-col overflow-hidden p-0",
      }
    case "fullpage":
      return {
        container: "fixed inset-0 z-[9999] flex bg-background",
        wrapper: "h-full w-full",
        content: "pointer-events-auto modal-surface-full flex h-full w-full flex-col overflow-y-auto",
      }
  }
}

export function GenericModal({
  isOpen,
  onClose,
  mode,
  layoutId,
  children,
  containerClassName,
  wrapperClassName,
  contentClassName,
  onExitComplete,
  hasUnsavedChanges,
  isSubmitting,
  onShowUnsavedDialog,
  pauseFocusTrap,
}: Props) {
  // État pour indiquer si on est côté client (pour le portal)
  const [isMounted, setIsMounted] = useState(false)
  const portalContainerRef = useRef<HTMLElement | null>(null)

  // S'assurer qu'on est côté client avant d'utiliser le portal
  useEffect(() => {
    setIsMounted(true)
    portalContainerRef.current = getPortalContainer()
  }, [])

  const showBackdrop = mode === "centerpage"

  const transition = useMemo(
    () => ({
      type: "spring" as const,
      damping: 25,
      stiffness: 300,
    }),
    [],
  )

  const modalStyle = getModalStyle(mode)

  // Gestion du clic sur le backdrop avec vérification des modifications non sauvegardées
  const handleBackdropClick = () => {
    // Si des modifications non sauvegardées existent et qu'on n'est pas en train de soumettre
    if (hasUnsavedChanges && !isSubmitting && onShowUnsavedDialog) {
      onShowUnsavedDialog()
      return
    }

    // Pas de modifications ou soumission en cours : fermer directement
    onClose()
  }

  const modalContent = (
    <AnimatePresence mode="wait" onExitComplete={onExitComplete}>
      {isOpen ? (
        <FocusTrap
          paused={pauseFocusTrap}
          focusTrapOptions={{
            initialFocus: false,
            escapeDeactivates: true,
            clickOutsideDeactivates: false,
            returnFocusOnDeactivate: true,
            allowOutsideClick: true,
          }}
        >
          <div>
            {showBackdrop && (
              <motion.div
                role="presentation"
                aria-hidden
                className="modal-overlay z-[60]"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={backdropVariants}
                transition={{ duration: 0.2 }}
                onClick={handleBackdropClick}
              />
            )}
            <motion.div
              key="modal-container"
              className={cn(modalStyle.container, containerClassName)}
              initial="initial"
              animate="animate"
              exit="exit"
              variants={containerVariants[mode]}
              transition={transition}
              layout
              layoutId={layoutId ?? undefined}
              role="dialog"
              aria-modal="true"
            >
              <div className={cn(modalStyle.wrapper, wrapperClassName)}>
                <div className={cn(modalStyle.content, contentClassName)}>
                  {children}
                </div>
              </div>
            </motion.div>
          </div>
        </FocusTrap>
      ) : null}
    </AnimatePresence>
  )

  // Rendre tous les modals via un portal statique pour éviter tout déplacement de conteneur
  // Côté serveur ou avant le montage, ne rien rendre
  if (!isMounted || !portalContainerRef.current) {
    return null
  }

  return createPortal(modalContent, portalContainerRef.current)
}

export default GenericModal
