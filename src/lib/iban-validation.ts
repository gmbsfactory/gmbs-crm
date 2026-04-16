/**
 * Validation IBAN (format français par défaut : 27 caractères)
 */

export const IBAN_LENGTH = 27
export const IBAN_GROUPS = [4, 4, 4, 4, 4, 4, 3]

/**
 * Normalise un IBAN : supprime les espaces, met en majuscules.
 * Retourne undefined si le format est invalide.
 */
export function normalizeIban(value: string): string | undefined {
  const iban = value?.replace(/\s/g, "").toUpperCase() || ""
  if (iban.length === 0) return undefined
  if (iban.length !== IBAN_LENGTH) return undefined
  if (!/^[A-Z0-9]+$/.test(iban)) return undefined
  return iban
}

/**
 * Valide un IBAN (format + caractères).
 * Retourne { isValid: true } si vide ou valide.
 */
export function validateIban(value: string): { isValid: boolean; errorMessage?: string } {
  const trimmed = value?.trim() || ""
  if (trimmed.length === 0) {
    return { isValid: true }
  }

  const iban = trimmed.replace(/\s/g, "").toUpperCase()

  if (!/^[A-Z0-9]+$/.test(iban)) {
    return { isValid: false, errorMessage: "Caractères invalides" }
  }

  if (iban.length !== IBAN_LENGTH) {
    return { isValid: false, errorMessage: `${IBAN_LENGTH} caractères requis` }
  }

  return { isValid: true }
}

/**
 * Règle de validation pour react-hook-form Controller.
 */
export function ibanFormRule(value: string | undefined): true | string {
  const raw = value?.trim() || ""
  if (raw.length === 0) return true
  const result = validateIban(raw)
  return result.isValid ? true : (result.errorMessage ?? "IBAN invalide")
}
