"use client"

import { useEffect, useCallback, RefObject } from "react"
import { usePlatformKey } from "@/hooks/usePlatformKey"

interface UseSubmitShortcutOptions {
  /** Référence vers le formulaire à soumettre */
  formRef?: RefObject<HTMLFormElement | null>
  /** Fonction de soumission alternative (si pas de formRef) */
  onSubmit?: () => void
  /** État de soumission en cours (désactive le raccourci si true) */
  isSubmitting?: boolean
  /** Désactiver complètement le raccourci */
  disabled?: boolean
}

/**
 * Hook pour ajouter un raccourci clavier Cmd+Enter (Mac) / Ctrl+Enter (Windows)
 * pour soumettre un formulaire dans un modal.
 * 
 * @example
 * ```tsx
 * const formRef = useRef<HTMLFormElement>(null)
 * const { shortcutHint } = useSubmitShortcut({ formRef, isSubmitting })
 * // shortcutHint = "⌘↵" ou "Ctrl+↵"
 * ```
 */
export function useSubmitShortcut({
  formRef,
  onSubmit,
  isSubmitting = false,
  disabled = false,
}: UseSubmitShortcutOptions) {
  const { modifierSymbol, isModifierPressed } = usePlatformKey()

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignorer si désactivé ou en cours de soumission
      if (disabled || isSubmitting) return

      // Vérifier Cmd/Ctrl + Enter
      if (isModifierPressed(event) && event.key === "Enter") {
        event.preventDefault()
        event.stopPropagation()

        // Priorité à onSubmit si fourni
        if (onSubmit) {
          onSubmit()
          return
        }

        // Sinon, soumettre via formRef
        if (formRef?.current) {
          formRef.current.requestSubmit()
        }
      }
    },
    [disabled, isSubmitting, isModifierPressed, onSubmit, formRef]
  )

  useEffect(() => {
    // Attacher au window pour capturer le raccourci même si le focus n'est pas sur le form
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  return {
    /** Texte du raccourci à afficher (ex: "⌘↵" ou "Ctrl+↵") */
    shortcutHint: `${modifierSymbol}↵`,
    /** Symbole du modificateur seul (ex: "⌘" ou "Ctrl") */
    modifierSymbol,
  }
}

