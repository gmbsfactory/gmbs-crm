import { toast } from "sonner"

/**
 * Message dédié au conflit d'ID intervention (contrainte id_inter UNIQUE) :
 * un devis supp / une saisie qui réutilise un ID existant doit l'expliquer
 * clairement (signalement WhatsApp n°21 du 02/07/2026, devis supp 20843).
 */
export const ID_INTER_DUPLICATE_MESSAGE =
  "Cet ID intervention existe déjà — choisissez un identifiant unique"

/**
 * Traductions des erreurs PostgreSQL/Supabase courantes vers du français naturel.
 * Clé = code PostgreSQL, Valeur = fonction qui génère le message français.
 */
const PG_ERROR_TRANSLATIONS: Record<string, (details?: string) => string> = {
  // Contrainte d'unicité violée
  "23505": (details) => {
    if (!details) return "Cette valeur existe déjà. Veuillez en choisir une autre."
    // Extraire le nom du champ depuis "Key (id_inter)=(xxx) already exists."
    const fieldMatch = details.match(/Key \((\w+)\)=\((.+?)\)/)
    if (fieldMatch) {
      if (fieldMatch[1] === "id_inter") {
        return `${ID_INTER_DUPLICATE_MESSAGE} (« ${fieldMatch[2]} » est déjà pris).`
      }
      const fieldName = translateFieldName(fieldMatch[1])
      const value = fieldMatch[2]
      return `Le ${fieldName} « ${value} » est déjà utilisé. Veuillez en choisir un autre.`
    }
    return "Cette valeur existe déjà. Veuillez en choisir une autre."
  },
  // Contrainte NOT NULL violée
  "23502": (details) => {
    if (!details) return "Un champ obligatoire n'a pas été rempli."
    const fieldMatch = details.match(/column "(\w+)"/)
    if (fieldMatch) {
      const fieldName = translateFieldName(fieldMatch[1])
      return `Le champ « ${fieldName} » est obligatoire.`
    }
    return "Un champ obligatoire n'a pas été rempli."
  },
  // Contrainte de clé étrangère violée
  "23503": () => "La référence sélectionnée n'existe plus. Veuillez actualiser la page.",
  // Contrainte CHECK violée
  "23514": () => "La valeur saisie ne respecte pas les règles de validation.",
  // Timeout / délai dépassé
  "57014": () => "L'opération a pris trop de temps. Veuillez réessayer.",
  // Permission refusée
  "42501": () => "Vous n'avez pas les droits nécessaires pour cette action.",
  // Relation/table introuvable
  "42P01": () => "Une erreur de configuration a été détectée. Contactez le support.",
}

/**
 * Traduit les noms de colonnes de la base de données en français lisible.
 */
function translateFieldName(columnName: string): string {
  const translations: Record<string, string> = {
    id_inter: "numéro d'intervention",
    reference_agence: "référence agence",
    agence_id: "agence",
    statut_id: "statut",
    metier_id: "métier",
    assigned_user_id: "gestionnaire assigné",
    adresse: "adresse",
    code_postal: "code postal",
    ville: "ville",
    date_prevue: "date prévue",
    owner_id: "propriétaire",
    tenant_id: "locataire",
    email: "email",
    username: "nom d'utilisateur",
  }
  return translations[columnName] || columnName.replace(/_/g, " ")
}

/**
 * Détecte une violation d'unicité APLATIE en texte (le code Postgres a été
 * perdu en route, ex. côté serveur : « Échec de la mise à jour de
 * l'intervention: duplicate key value violates unique constraint
 * "interventions_id_inter_key" »). Retourne le message clair, ou null.
 */
function translateFlattenedDuplicateKey(message: string): string | null {
  if (!/duplicate key value|23505/i.test(message)) return null
  if (/id_inter/i.test(message)) {
    const valueMatch = message.match(/Key \(id_inter\)=\((.+?)\)/)
    return valueMatch
      ? `${ID_INTER_DUPLICATE_MESSAGE} (« ${valueMatch[1]} » est déjà pris).`
      : ID_INTER_DUPLICATE_MESSAGE
  }
  return "Cette valeur existe déjà. Veuillez en choisir une autre."
}

/**
 * Extrait un message d'erreur lisible en français depuis n'importe quel type d'erreur.
 * Traduit les erreurs PostgreSQL/Supabase en langage naturel.
 */
export function extractErrorMessage(error: unknown): string {
  // Error standard JS
  if (error instanceof Error) {
    return translateFlattenedDuplicateKey(error.message) ?? error.message
  }

  // String directe
  if (typeof error === "string") {
    return translateFlattenedDuplicateKey(error) ?? error
  }

  // Objet avec propriétés (PostgrestError Supabase, etc.)
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>

    // PostgrestError : { message, details, code, hint }
    // Essayer de traduire via le code PostgreSQL d'abord
    if (typeof obj.code === "string" && obj.code in PG_ERROR_TRANSLATIONS) {
      const details = typeof obj.details === "string" ? obj.details : undefined
      return PG_ERROR_TRANSLATIONS[obj.code](details)
    }

    // Message disponible mais pas de code connu — traduire les violations
    // d'unicité aplaties, sinon renvoyer le message tel quel
    if (typeof obj.message === "string" && obj.message.length > 0) {
      return translateFlattenedDuplicateKey(obj.message) ?? obj.message
    }

    // Erreur avec .error imbriqué
    if (typeof obj.error === "string" && obj.error.length > 0) {
      return obj.error
    }
  }

  return "Une erreur inattendue s'est produite. Veuillez réessayer."
}

/**
 * Affiche un toast de chargement puis le met à jour en succès ou erreur.
 * En cas d'erreur, le toast devient permanent (ne disparaît pas).
 */
export async function toastSaveOperation<T>(options: {
  loadingMessage: string
  successMessage: string
  errorMessage: string
  operation: () => Promise<T>
}): Promise<{ success: true; data: T } | { success: false; error: unknown }> {
  const toastId = toast.loading(options.loadingMessage)

  try {
    const data = await options.operation()
    toast.success(options.successMessage, {
      id: toastId,
      duration: 5000,
    })
    return { success: true, data }
  } catch (error) {
    const description = extractErrorMessage(error)
    toast.error(options.errorMessage, {
      id: toastId,
      duration: Infinity,
      description,
    })
    return { success: false, error }
  }
}
