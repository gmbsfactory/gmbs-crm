/**
 * Validation du SIRET avec l'algorithme de clé Luhn
 */

/**
 * Valide un SIRET avec l'algorithme de clé Luhn
 * @param siret Le SIRET à valider (14 chiffres, sans espaces)
 * @returns true si le SIRET est valide selon Luhn
 */
export function validateSiretLuhn(siret: string): boolean {
  // Nettoyer le SIRET (supprimer espaces)
  const cleanSiret = siret.replace(/\s/g, "")

  // Vérifier que c'est uniquement des chiffres
  if (!/^\d+$/.test(cleanSiret)) {
    return false
  }

  // Vérifier la longueur (14 chiffres)
  if (cleanSiret.length !== 14) {
    return false
  }

  // Algorithme de Luhn
  // Multiplier par 2 les chiffres aux positions impaires (index pairs en 0-based : 0, 2, 4, 6, 8, 10, 12)
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleanSiret[i], 10)

    // Positions impaires (index pairs) : multiplier par 2
    if (i % 2 === 0) {
      digit *= 2
      // Si résultat ≥ 10, additionner les chiffres (ex: 14 → 1+4 = 5)
      if (digit >= 10) {
        digit = Math.floor(digit / 10) + (digit % 10)
      }
    }

    sum += digit
  }

  // Le SIRET est valide si la somme est un multiple de 10
  return sum % 10 === 0
}

/**
 * Valide le format et la clé Luhn d'un SIRET
 * @param siret Le SIRET à valider (peut contenir des espaces)
 * @returns { isValid: boolean, errorMessage?: string }
 * - isValid: true si vide OU valide (14 chiffres + Luhn OK)
 * - errorMessage: message d'erreur si invalide
 */
export function validateSiret(siret: string): { isValid: boolean; errorMessage?: string } {
  // SIRET vide → valide
  const trimmed = siret.trim()
  if (trimmed.length === 0) {
    return { isValid: true }
  }

  // Nettoyer le SIRET (supprimer espaces)
  const cleanSiret = trimmed.replace(/\s/g, "")

  // Vérifier que c'est uniquement des chiffres
  if (!/^\d+$/.test(cleanSiret)) {
    return {
      isValid: false,
      errorMessage: "Le SIRET doit contenir uniquement des chiffres",
    }
  }

  // Vérifier la longueur (14 chiffres)
  if (cleanSiret.length !== 14) {
    return {
      isValid: false,
      errorMessage: "Le SIRET doit contenir exactement 14 chiffres",
    }
  }

  // Vérifier la clé Luhn
  if (!validateSiretLuhn(cleanSiret)) {
    return {
      isValid: false,
      errorMessage: "Le SIRET n'est pas valide (erreur de clé de contrôle)",
    }
  }

  return { isValid: true }
}

/**
 * Règle de validation pour react-hook-form Controller.
 */
export function siretFormRule(value: string | undefined): true | string {
  const siret = value?.trim() || ""
  if (siret.length === 0) return true
  if (siret.length === 14 && /^\d+$/.test(siret)) return true
  return "14 chiffres requis"
}

