import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Identité lisible d'un gestionnaire, recopiée dans `payload.actor` du journal.
 *
 * `artisan_portal_actions.actor_user_id` est une clé étrangère
 * `ON DELETE SET NULL` : sans cette copie immuable, la suppression d'un compte
 * effacerait l'attribution de toutes ses saisies — la dérive exacte
 * d'`artisan_audit_log`, 92 % de lignes sans acteur. La contrainte
 * `artisan_portal_actions_acteur_check` l'exige d'ailleurs dès que
 * `source = 'crm'`.
 */
export async function resolveActorLabel(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null
  const { data } = await supabase
    .from('users')
    .select('email, username, firstname, lastname')
    .eq('id', userId)
    .maybeSingle()
  const user = data as {
    email: string | null
    username: string | null
    firstname: string | null
    lastname: string | null
  } | null
  if (!user) return null
  const nom = [user.firstname, user.lastname].filter(Boolean).join(' ').trim()
  return user.email || user.username || nom || null
}
