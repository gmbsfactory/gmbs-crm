import { useEffect, useState } from "react"
import { UseFormReturn } from "react-hook-form"

/**
 * Hook pour détecter les modifications non sauvegardées dans un formulaire
 * @param form - Instance du formulaire react-hook-form
 * @param isSubmitting - Indique si le formulaire est en cours de soumission
 * @returns hasUnsavedChanges - true si le formulaire a des modifications non sauvegardées
 */
export function useUnsavedChanges(
  form: UseFormReturn<any>,
  isSubmitting: boolean = false
) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    // Ne pas marquer comme modifié si le formulaire est en cours de soumission
    if (isSubmitting) {
      setHasUnsavedChanges(false)
      return
    }

    const subscription = form.watch((value, { name }) => {
      // Détecter si au moins un champ a été modifié
      if (name) {
        setHasUnsavedChanges(form.formState.isDirty)
      }
    })

    return () => subscription.unsubscribe()
  }, [form, isSubmitting])

  return hasUnsavedChanges
}
