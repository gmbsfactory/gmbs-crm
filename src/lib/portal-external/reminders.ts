import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Reminders posés par le portail pour le gestionnaire.
 *
 * Le dépôt d'un rapport en crée un depuis `report.ts` ; un refus de prix en crée
 * un autre (§7.2 : « bandeau rouge et reminder — proposer à un autre artisan »).
 * Chaque famille porte son propre **marqueur** dans la note : c'est lui qui
 * permet de clore le bon reminder sans toucher aux autres.
 *
 * `resolveReminderTarget` n'est pas redéfini ici : il vit dans `report.ts` et
 * reste la seule résolution « gestionnaire assigné → repli env → premier admin ».
 */

export { resolveReminderTarget } from './report'

export interface ReminderTarget {
  id: string
  username: string | null
}

/**
 * Crée ou met à jour le reminder d'une famille donnée pour un gestionnaire.
 * La mention `@username` déclenche la notification temps réel du CRM.
 */
export async function upsertPortalReminder(
  supabase: SupabaseClient,
  params: { interventionId: string; target: ReminderTarget; marker: string; note: string },
): Promise<void> {
  const { interventionId, target, marker, note } = params

  const { data: existing } = await supabase
    .from('intervention_reminders')
    .select('id')
    .eq('intervention_id', interventionId)
    .eq('user_id', target.id)
    .eq('is_active', true)
    .ilike('note', `%${marker}%`)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase
      .from('intervention_reminders')
      .update({
        note,
        is_completed: false,
        updated_at: new Date().toISOString(),
        mentioned_user_ids: [target.id],
      })
      .eq('id', (existing as { id: string }).id)
    if (error) console.error('[portal-external] Mise à jour du reminder échouée :', error.message)
    return
  }

  const { error } = await supabase.from('intervention_reminders').insert({
    intervention_id: interventionId,
    user_id: target.id,
    note,
    is_active: true,
    is_completed: false,
    mentioned_user_ids: [target.id],
  })
  if (error) console.error('[portal-external] Création du reminder échouée :', error.message)
}
