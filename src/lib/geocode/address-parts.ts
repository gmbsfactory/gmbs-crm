/**
 * Extraction des composants d'une adresse (rue, code postal, ville).
 *
 * Source de vérité unique partagée par les formulaires (artisans, interventions).
 *
 * Deux entrées :
 * - `parseAddressLabel` : parse une chaîne d'adresse libre. Gère le format virgulé
 *   (Google / Nominatim / saisie manuelle) ET le format sans virgule renvoyé par
 *   l'API Adresse France (BAN), de la forme « rue CP ville ».
 * - `resolveSuggestionParts` : à privilégier quand on dispose d'une suggestion de
 *   géocodage. Utilise les champs `postcode` / `city` structurés (fiables) et ne
 *   retombe sur le parsing du label qu'en dernier recours.
 */

export type AddressParts = {
  street: string
  postalCode: string
  city: string
}

const POSTAL_CODE_REGEX = /\b(\d{5})\b/

/**
 * Parse une chaîne d'adresse en rue / code postal / ville.
 *
 * @example
 * parseAddressLabel("7 Rue Jean Giraudoux 03300 Cusset")
 * // → { street: "7 Rue Jean Giraudoux", postalCode: "03300", city: "Cusset" }
 */
export function parseAddressLabel(fullAddress: string | null | undefined): AddressParts {
  const raw = (fullAddress ?? "").trim()
  if (!raw) {
    return { street: "", postalCode: "", city: "" }
  }

  // --- Cas A : format virgulé (Google, Nominatim, OpenCage, saisie manuelle) ---
  if (raw.includes(",")) {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)

    let postalCode = ""
    let city = ""

    for (let i = 0; i < parts.length; i++) {
      const match = parts[i].match(POSTAL_CODE_REGEX)
      if (!match) continue

      postalCode = match[1]
      const cityInSamePart = parts[i].replace(match[0], "").trim()
      if (cityInSamePart) {
        city = cityInSamePart
      } else if (i > 0) {
        city = parts[i - 1]
      }
      break
    }

    // Pas de ville extraite via le code postal : on prend le 1er segment
    // « non-rue » qui n'est pas le pays.
    if (!city) {
      const candidate = parts.slice(1).find((p) => !/^france$/i.test(p))
      if (candidate) {
        city = candidate.replace(POSTAL_CODE_REGEX, "").trim()
      }
    }

    return { street: parts[0] || raw, postalCode, city }
  }

  // --- Cas B : sans virgule, format BAN « rue CP ville » ---
  const match = raw.match(POSTAL_CODE_REGEX)
  if (match) {
    const postalCode = match[1]
    const idx = raw.indexOf(postalCode)
    return {
      street: raw.slice(0, idx).trim(),
      postalCode,
      city: raw.slice(idx + postalCode.length).trim(),
    }
  }

  // --- Cas C : ni virgule ni code postal → tout dans la rue ---
  return { street: raw, postalCode: "", city: "" }
}

/**
 * Suggestion minimale acceptée par `resolveSuggestionParts`.
 * `postcode` / `city` proviennent idéalement de la BAN (champs structurés).
 */
export type SuggestionLike = {
  label: string
  postcode?: string | null
  city?: string | null
}

/**
 * Détermine rue / code postal / ville à partir d'une suggestion de géocodage.
 *
 * Priorité aux champs structurés (`postcode`, `city`) fournis par le provider :
 * ils évitent tout re-parsing fragile du label. Le parsing du label sert
 * uniquement de filet de secours (providers ne renvoyant pas ces champs).
 */
export function resolveSuggestionParts(suggestion: SuggestionLike): AddressParts {
  const parsed = parseAddressLabel(suggestion.label)

  const postalCode = (suggestion.postcode ?? "").trim() || parsed.postalCode
  const city = (suggestion.city ?? "").trim() || parsed.city

  // Quand on connaît le code postal, la rue = tout ce qui précède dans le label.
  // Plus fiable que `parsed.street` lorsque le label est virgulé mais que les
  // champs structurés priment.
  let street = parsed.street
  if (postalCode && suggestion.label.includes(postalCode)) {
    const idx = suggestion.label.indexOf(postalCode)
    const candidate = suggestion.label.slice(0, idx).replace(/[\s,]+$/, "").trim()
    if (candidate) {
      street = candidate
    }
  }

  return { street, postalCode, city }
}
