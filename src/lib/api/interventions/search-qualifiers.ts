// ===== INTERVENTIONS - ANALYSE DE LA SAISIE DE RECHERCHE =====
// Le champ de recherche de la liste des interventions est plein-texte : il ne
// porte que sur des colonnes textuelles (id_inter, adresse, artisan, ...).
// Les montants vivent dans `intervention_payments` (acomptes) et
// `intervention_costs` (SST, inter, matériel) et n'étaient donc pas
// atteignables — saisir « 387,78 » ne remontait rien.
//
// Deux chemins, selon la façon dont l'utilisateur saisit :
//
//  1. Montant sec (« 387,78 ») — l'usage réel observé. Une saisie à deux
//     décimales est un montant sans ambiguïté : on lance EN PLUS du plein-texte
//     un filtre exact sur TOUS les montants de l'intervention, et on fusionne
//     les deux jeux de résultats. Rien n'est perdu, le plein-texte répond
//     toujours.
//
//  2. Qualificateur explicite (« sst:387 ») — il remplit deux rôles :
//     atteindre les montants ENTIERS, qu'on ne peut pas auto-détecter
//     (« 120 » ressemble tout autant à un id_inter ou à un numéro de rue), et
//     restreindre la recherche à une colonne de montant précise.
//
// Voir docs/api-reference/interventions.md#recherche-par-montant

/** Portée d'un filtre par montant : quelles colonnes de montant interroger. */
export interface AmountScope {
  /** Valeurs de `intervention_payments.payment_type` à interroger. */
  paymentTypes: string[]
  /** Valeurs de `intervention_costs.cost_type` à interroger. */
  costTypes: string[]
}

/** Filtre par montant exact résolu depuis la saisie. */
export interface AmountFilter extends AmountScope {
  value: number
}

/** Résultat de l'analyse de la saisie du champ de recherche. */
export interface ParsedSearch {
  /** Terme plein-texte à envoyer, ou `null` si la saisie est qualifiée. */
  text: string | null
  /** Filtre par montant exact, ou `null`. */
  amount: AmountFilter | null
}

const PAYMENT_ACOMPTE_SST = "acompte_sst"
const PAYMENT_ACOMPTE_CLIENT = "acompte_client"
const COST_SST = "sst"
const COST_INTERVENTION = "intervention"
const COST_MATERIEL = "materiel"

/** Portée par défaut : toutes les colonnes de montant d'une intervention. */
export const ANY_AMOUNT_SCOPE: AmountScope = {
  paymentTypes: [PAYMENT_ACOMPTE_SST, PAYMENT_ACOMPTE_CLIENT],
  costTypes: [COST_SST, COST_INTERVENTION, COST_MATERIEL],
}

// Les libellés reprennent ceux des colonnes de la page Comptabilité
// (« Ac. Client », « Ac. Artisan », « SST », « Inter », « Matériel ») pour que
// l'utilisateur tape le mot qu'il a sous les yeux.
//
// Ordre significatif : les qualificateurs les plus spécifiques d'abord, sinon
// « acompte » capturerait « acompte client ».
const QUALIFIERS: ReadonlyArray<{ pattern: RegExp; scope: AmountScope }> = [
  {
    // `acc?ompte` : « acompte » et la faute d'orthographe courante « accompte ».
    pattern: /^\s*acc?ompte[\s_]*(?:client|cli)\s*:\s*(.+)$/i,
    scope: { paymentTypes: [PAYMENT_ACOMPTE_CLIENT], costTypes: [] },
  },
  {
    pattern: /^\s*acc?ompte[\s_]*(?:sst|artisan|art)\s*:\s*(.+)$/i,
    scope: { paymentTypes: [PAYMENT_ACOMPTE_SST], costTypes: [] },
  },
  {
    pattern: /^\s*acc?ompte\s*:\s*(.+)$/i,
    scope: { paymentTypes: [PAYMENT_ACOMPTE_SST, PAYMENT_ACOMPTE_CLIENT], costTypes: [] },
  },
  {
    pattern: /^\s*sst\s*:\s*(.+)$/i,
    scope: { paymentTypes: [], costTypes: [COST_SST] },
  },
  {
    // « inter » et « client » désignent tous deux le montant facturé au client
    // (`cost_type = 'intervention'`, colonne « Inter » en comptabilité).
    pattern: /^\s*(?:inter|intervention|client)\s*:\s*(.+)$/i,
    scope: { paymentTypes: [], costTypes: [COST_INTERVENTION] },
  },
  {
    pattern: /^\s*mat[ée]riel\s*:\s*(.+)$/i,
    scope: { paymentTypes: [], costTypes: [COST_MATERIEL] },
  },
]

// Un montant sec auto-détectable : deux décimales obligatoires. Cette
// contrainte est ce qui rend la détection sûre — un entier nu reste interprété
// comme du plein-texte (id_inter, numéro de rue, code postal...).
// Le suffixe monétaire optionnel couvre le copier-coller depuis un relevé
// bancaire (« 387,78 € »).
const BARE_AMOUNT = /^\d[\d\s  .,]*[.,]\d{2}\s*(?:€|EUR)?$/i

/**
 * Normalise un montant saisi à la française vers un nombre.
 *
 * Accepte les espaces (y compris insécables) comme séparateurs de milliers,
 * la virgule comme séparateur décimal, et un suffixe monétaire optionnel.
 * Retourne `null` si la saisie n'est pas un montant exploitable.
 */
export function parseAmountInput(raw: string): number | null {
  let value = raw
    .replace(/[\s  ]/g, "")
    .replace(/€|EUR/gi, "")
    .trim()

  if (!value) return null

  const lastComma = value.lastIndexOf(",")
  const lastDot = value.lastIndexOf(".")

  if (lastComma !== -1 && lastDot !== -1) {
    // Les deux séparateurs sont présents : le dernier est le séparateur
    // décimal, l'autre sépare les milliers (« 1.500,50 » ou « 1,500.50 »).
    const decimalSeparator = lastComma > lastDot ? "," : "."
    const thousandsSeparator = decimalSeparator === "," ? "." : ","
    value = value.split(thousandsSeparator).join("")
    value = value.replace(decimalSeparator, ".")
  } else if (lastComma !== -1) {
    value = value.replace(",", ".")
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Analyse la saisie du champ de recherche et décide des filtres à envoyer.
 *
 * Une saisie invalide derrière un qualificateur (`sst:abc`) retombe
 * silencieusement sur la recherche plein-texte : une faute de frappe ne doit
 * pas produire d'écran d'erreur.
 */
export function parseSearch(search: string): ParsedSearch {
  for (const { pattern, scope } of QUALIFIERS) {
    const match = pattern.exec(search)
    if (!match) continue

    const value = parseAmountInput(match[1])
    // Qualificateur explicite : l'utilisateur a levé l'ambiguïté lui-même, on
    // n'encombre pas ses résultats avec du plein-texte.
    if (value !== null) return { text: null, amount: { value, ...scope } }
    return { text: search, amount: null }
  }

  const trimmed = search.trim()
  if (BARE_AMOUNT.test(trimmed)) {
    const value = parseAmountInput(trimmed)
    // Montant sec : on ajoute le filtre montant SANS retirer le plein-texte —
    // « 387,78 » peut aussi apparaître dans un commentaire ou une référence.
    if (value !== null) return { text: search, amount: { value, ...ANY_AMOUNT_SCOPE } }
  }

  return { text: search, amount: null }
}
