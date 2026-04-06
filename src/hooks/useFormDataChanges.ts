import { useEffect, useState, useRef } from "react"

/**
 * Hook pour détecter les modifications dans un objet formData
 * Compare avec les valeurs initiales pour déterminer si des changements ont été faits
 * @param formData - Les données actuelles du formulaire
 * @param isSubmitting - Indique si le formulaire est en cours de soumission
 * @param isReady - Indique si le formulaire est complètement initialisé (par défaut true)
 * @returns hasUnsavedChanges - true si le formulaire a des modifications non sauvegardées
 */
export function useFormDataChanges<T extends Record<string, any>>(
  formData: T,
  isSubmitting: boolean = false,
  isReady: boolean = true,
  initialDirty: boolean = false
) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(initialDirty)
  const initialValuesRef = useRef<T | null>(null)

  // Capturer les valeurs initiales uniquement quand le formulaire est prêt
  useEffect(() => {
    if (isReady && !initialValuesRef.current) {
      initialValuesRef.current = { ...formData }
    }
  }, [isReady, formData])

  // Détecter les changements par rapport aux valeurs initiales
  useEffect(() => {
    if (isSubmitting || !initialValuesRef.current) {
      setHasUnsavedChanges(false)
      return
    }

    const initial = initialValuesRef.current
    const hasChanges = Object.keys(formData).some((key) => {
      const currentValue = formData[key]
      const initialValue = initial[key]

      // Ignorer les changements vides (champ vide vers champ vide)
      if (!currentValue && !initialValue) {
        return false
      }

      return currentValue !== initialValue
    })

    setHasUnsavedChanges(hasChanges)
  }, [formData, isSubmitting])

  return hasUnsavedChanges
}
