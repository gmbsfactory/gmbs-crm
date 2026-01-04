/**
 * Utilitaires de normalisation des requêtes de géocodage
 * 
 * Améliore le matching fuzzy en générant des variantes de la requête
 * avec différentes prépositions et formes.
 */

/**
 * Patterns de types de voies et leurs prépositions possibles
 */
const STREET_PATTERNS = [
    {
        prefix: /^(rue|avenue|boulevard|place|allée|impasse|chemin|passage|square|cours)\s+/i,
        prepositions: ["de ", "du ", "de la ", "des ", "d'", ""],
    },
    {
        prefix: /^(quai|port)\s+/i,
        prepositions: ["de ", "du ", "des ", ""],
    },
] as const

/**
 * Génère des variantes de la requête pour améliorer le matching fuzzy
 * 
 * @example
 * normalizeQueryForSearch("rue rivoli")
 * // → ["rue rivoli", "rue de rivoli", "rue du rivoli"]
 * 
 * @example
 * normalizeQueryForSearch("rue de rivoli")
 * // → ["rue de rivoli", "rue rivoli"]
 */
export function normalizeQueryForSearch(query: string): string[] {
    const trimmed = query.trim()
    if (!trimmed) return []

    const queries = [trimmed]
    const lower = trimmed.toLowerCase()

    for (const pattern of STREET_PATTERNS) {
        const match = lower.match(pattern.prefix)
        if (match) {
            const streetType = match[1]
            const rest = trimmed.slice(match[0].length)

            // Vérifier si une préposition est déjà présente
            const hasPreposition = /^(de |du |de la |des |d'|l')/i.test(rest)

            if (!hasPreposition) {
                // Ajouter des variantes avec prépositions
                for (const prep of pattern.prepositions) {
                    if (prep) {
                        const variant = `${streetType} ${prep}${rest}`
                        if (!queries.includes(variant)) {
                            queries.push(variant)
                        }
                    }
                }
            } else {
                // Ajouter une variante sans préposition
                const withoutPrep = rest.replace(/^(de |du |de la |des |d'|l')/i, "")
                const variant = `${streetType} ${withoutPrep}`
                if (!queries.includes(variant)) {
                    queries.push(variant)
                }
            }
        }
    }

    // Limiter à 3 variantes pour éviter trop d'appels
    return queries.slice(0, 3)
}

/**
 * Nettoie une requête de géocodage
 * - Supprime les espaces multiples
 * - Normalise la casse
 */
export function cleanQuery(query: string): string {
    return query
        .trim()
        .replace(/\s+/g, " ")
}

/**
 * Génère une clé de cache normalisée pour une requête
 */
export function generateCacheKey(query: string, options?: { countryCode?: string }): string {
    const normalized = cleanQuery(query).toLowerCase()
    const countryPart = options?.countryCode ? `|${options.countryCode}` : ""
    return `${normalized}${countryPart}`
}


