/**
 * Derive a display name for a user from available name fields.
 * Handles both French (`prenom`/`nom`) and English (`firstname`/`lastname`) field names.
 *
 * @param user - Object with optional name fields
 * @param fallback - Fallback when no name is available (default: "Vous")
 */
export function getUserDisplayName(
  user: {
    firstname?: string | null
    lastname?: string | null
    prenom?: string | null
    nom?: string | null
    username?: string | null
    email?: string | null
  } | null | undefined,
  fallback = "Vous"
): string {
  if (!user) return fallback

  const first = user.firstname ?? user.prenom ?? ""
  const last = user.lastname ?? user.nom ?? ""
  const fullName = [first, last].filter(Boolean).join(" ").trim()

  return fullName || user.username || user.email || fallback
}
