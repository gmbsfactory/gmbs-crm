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
const PG_ERROR_TRANSLATIONS: Record<string, (details?: string, message?: string) => string> = {
  // Contrainte d'unicité violée
  "23505": (details, message) => {
    // Cas idéal : Postgres renvoie DETAIL "Key (id_inter)=(xxx) already exists."
    // (souvent masqué par PostgREST selon le rôle → d'où le repli sur la contrainte)
    const fieldMatch = details?.match(/Key \((.+?)\)=\((.+?)\)/)
    if (fieldMatch) {
      return duplicateMessage(fieldMatch[1], fieldMatch[2])
    }
    // Repli : nom de la contrainte présent dans le message
    // (« duplicate key value violates unique constraint "interventions_id_inter_key" »)
    const constraint = extractConstraintName(details, message)
    if (constraint) {
      if (CONSTRAINT_TO_MESSAGE[constraint]) return CONSTRAINT_TO_MESSAGE[constraint]
      const field = fieldFromConstraint(constraint)
      if (field) return duplicateMessage(field)
    }
    return GENERIC_DUPLICATE_MESSAGE
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

export const GENERIC_DUPLICATE_MESSAGE =
  "Cette valeur existe déjà. Veuillez en choisir une autre."

/**
 * Contraintes d'unicité de la base → colonne fautive.
 * Sert de repli quand PostgREST masque le DETAIL de l'erreur (cas le plus
 * fréquent : seul le nom de la contrainte survit dans le message).
 * Toute nouvelle contrainte UNIQUE doit être ajoutée ici.
 */
const CONSTRAINT_TO_FIELD: Record<string, string> = {
  interventions_id_inter_key: "id_inter",
  users_email_key: "email",
  users_username_key: "username",
  users_code_gestionnaire_key: "code_gestionnaire",
  artisans_email_key: "email",
  artisans_siret_key: "siret",
  unique_artisan_telephone: "telephone",
  owner_external_ref_key: "external_ref",
  tenants_external_ref_key: "external_ref",
}

/**
 * Contraintes composites : le nom d'un champ ne suffit pas à expliquer le
 * conflit, on fournit un message métier complet.
 */
const CONSTRAINT_TO_MESSAGE: Record<string, string> = {
  intervention_artisans_intervention_id_artisan_id_key:
    "Cet artisan est déjà rattaché à l'intervention.",
  idx_intervention_costs_unique_type_order:
    "Un coût de ce type existe déjà pour cet artisan. Modifiez le coût existant plutôt que d'en ajouter un second.",
  idx_intervention_costs_unique_type_global:
    "Un coût de ce type existe déjà sur l'intervention. Modifiez le coût existant plutôt que d'en ajouter un second.",
  intervention_compta_checks_intervention_id_key:
    "Une validation comptable existe déjà pour cette intervention.",
  intervention_compta_exclusions_intervention_id_key:
    "Une exclusion comptable existe déjà pour cette intervention.",
}

/** Extrait `xxx` de `... unique constraint "xxx"` (message ou details). */
function extractConstraintName(...sources: (string | undefined)[]): string | null {
  for (const source of sources) {
    const match = source?.match(/constraint "([^"]+)"/)
    if (match) return match[1]
  }
  return null
}

/** Colonne fautive déduite d'un nom de contrainte, ou null si inconnue. */
function fieldFromConstraint(constraint: string): string | null {
  if (CONSTRAINT_TO_FIELD[constraint]) return CONSTRAINT_TO_FIELD[constraint]
  // Heuristique Postgres : `<table>_<colonne>_key`
  const match = constraint.match(/^[a-z]+_(.+)_key$/)
  return match ? match[1] : null
}

/** Message de doublon pour une colonne, avec la valeur fautive si connue. */
function duplicateMessage(field: string, value?: string): string {
  if (field === "id_inter") {
    return value
      ? `${ID_INTER_DUPLICATE_MESSAGE} (« ${value} » est déjà pris).`
      : ID_INTER_DUPLICATE_MESSAGE
  }
  const fieldName = translateFieldName(field)
  return value
    ? `Le ${fieldName} « ${value} » est déjà utilisé. Veuillez en choisir un autre.`
    : `Le ${fieldName} saisi existe déjà. Veuillez en choisir un autre.`
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
    telephone: "numéro de téléphone",
    siret: "SIRET",
    code_gestionnaire: "code gestionnaire",
    external_ref: "référence externe",
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
  // Le texte aplati contient les mêmes informations qu'un PostgrestError :
  // on réutilise donc exactement la même logique (DETAIL puis contrainte).
  return PG_ERROR_TRANSLATIONS["23505"](message, message)
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
      const message = typeof obj.message === "string" ? obj.message : undefined
      return PG_ERROR_TRANSLATIONS[obj.code](details, message)
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
