// ===== API UPDATES V2 =====
// Gestion des mises à jour de l'application (app_updates)

import { supabase } from "@/lib/supabase-client"
import type { AppUpdate, AppUpdateView, AppUpdateWithViewStatus, AppUpdateWithAcknowledgments } from "@/types/app-updates"

/**
 * Vérifie si une update est visible pour un utilisateur donné
 */
function isUpdateVisibleToUser(
  update: AppUpdate,
  userId: string,
  userRoles: string[]
): boolean {
  // Si target_user_ids non-vide → seuls ces users voient l'update
  if (update.target_user_ids && update.target_user_ids.length > 0) {
    return update.target_user_ids.includes(userId)
  }
  // Si audience contient 'all' → visible pour tous
  if (update.audience.includes('all')) {
    return true
  }
  // Sinon → vérifier si un rôle de l'audience correspond à un rôle du user
  return update.audience.some(role => userRoles.includes(role))
}

/**
 * Récupère les updates publiées non acquittées par l'utilisateur
 */
async function getUnseen(
  userId: string,
  userRoles: string[]
): Promise<AppUpdateWithViewStatus[]> {
  // Récupérer toutes les updates publiées
  const { data: updates, error: updatesError } = await supabase
    .from('app_updates')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: true })

  if (updatesError) throw new Error(`Erreur lors de la récupération des updates: ${updatesError.message}`)
  if (!updates || updates.length === 0) return []

  // Récupérer les vues de l'utilisateur
  const { data: views, error: viewsError } = await supabase
    .from('app_update_views')
    .select('*')
    .eq('user_id', userId)

  if (viewsError) throw new Error(`Erreur lors de la récupération des vues: ${viewsError.message}`)

  const viewMap = new Map(
    ((views || []) as AppUpdateView[]).map(v => [v.update_id, v])
  )

  // Filtrer : visible pour l'utilisateur ET non acquittée
  return (updates as AppUpdate[])
    .filter(update => {
      if (!isUpdateVisibleToUser(update, userId, userRoles)) return false
      const view = viewMap.get(update.id)
      return !view?.acknowledged_at
    })
    .map(update => ({
      ...update,
      is_acknowledged: false,
      acknowledged_at: null,
    }))
}

/**
 * Récupère toutes les updates publiées avec leur statut de vue
 */
async function getJournal(
  userId: string,
  userRoles: string[]
): Promise<AppUpdateWithViewStatus[]> {
  const { data: updates, error: updatesError } = await supabase
    .from('app_updates')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  if (updatesError) throw new Error(`Erreur lors de la récupération des updates: ${updatesError.message}`)
  if (!updates || updates.length === 0) return []

  const { data: views, error: viewsError } = await supabase
    .from('app_update_views')
    .select('*')
    .eq('user_id', userId)

  if (viewsError) throw new Error(`Erreur lors de la récupération des vues: ${viewsError.message}`)

  const viewMap = new Map(
    ((views || []) as AppUpdateView[]).map(v => [v.update_id, v])
  )

  return (updates as AppUpdate[])
    .filter(update => isUpdateVisibleToUser(update, userId, userRoles))
    .map(update => {
      const view = viewMap.get(update.id)
      return {
        ...update,
        is_acknowledged: Boolean(view?.acknowledged_at),
        acknowledged_at: view?.acknowledged_at ?? null,
      }
    })
}

/**
 * Acquitte un lot d'updates pour un utilisateur (upsert batch)
 */
async function acknowledgeUpdates(
  userId: string,
  updateIds: string[]
): Promise<void> {
  if (updateIds.length === 0) return

  const now = new Date().toISOString()
  const rows = updateIds.map(updateId => ({
    update_id: updateId,
    user_id: userId,
    viewed_at: now,
    acknowledged_at: now,
  }))

  const { error } = await supabase
    .from('app_update_views')
    .upsert(rows, { onConflict: 'update_id,user_id' })

  if (error) throw new Error(`Erreur lors de l'acquittement des updates: ${error.message}`)
}

// ===== ADMIN CRUD =====

async function getAll(): Promise<AppUpdate[]> {
  const { data, error } = await supabase
    .from('app_updates')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Erreur lors de la recuperation des updates: ${error.message}`)
  return (data || []) as AppUpdate[]
}

async function getAllWithViews(): Promise<AppUpdateWithAcknowledgments[]> {
  const { data: updates, error: updatesError } = await supabase
    .from('app_updates')
    .select('*')
    .order('created_at', { ascending: false })

  if (updatesError) throw new Error(`Erreur lors de la recuperation des updates: ${updatesError.message}`)
  if (!updates || updates.length === 0) return []

  const { data: views, error: viewsError } = await supabase
    .from('app_update_views')
    .select('*')

  if (viewsError) throw new Error(`Erreur lors de la recuperation des vues: ${viewsError.message}`)

  const viewsByUpdate = new Map<string, AppUpdateView[]>()
  for (const v of (views || []) as AppUpdateView[]) {
    const arr = viewsByUpdate.get(v.update_id) || []
    arr.push(v)
    viewsByUpdate.set(v.update_id, arr)
  }

  return (updates as AppUpdate[]).map(update => ({
    ...update,
    views: viewsByUpdate.get(update.id) || [],
    acknowledgment_count: (viewsByUpdate.get(update.id) || []).filter(v => v.acknowledged_at).length,
  }))
}

async function create(
  input: Omit<AppUpdate, 'id' | 'created_at'>
): Promise<AppUpdate> {
  const { data, error } = await supabase
    .from('app_updates')
    .insert(input)
    .select()
    .single()

  if (error) throw new Error(`Erreur lors de la creation: ${error.message}`)
  return data as AppUpdate
}

async function update(
  id: string,
  input: Partial<Omit<AppUpdate, 'id' | 'created_at'>>
): Promise<AppUpdate> {
  const { data, error } = await supabase
    .from('app_updates')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Erreur lors de la mise a jour: ${error.message}`)
  return data as AppUpdate
}

async function remove(id: string): Promise<void> {
  const { error } = await supabase
    .from('app_updates')
    .delete()
    .eq('id', id)

  if (error) throw new Error(`Erreur lors de la suppression: ${error.message}`)
}

async function publish(id: string): Promise<AppUpdate> {
  return update(id, {
    status: 'published',
    published_at: new Date().toISOString(),
  })
}

export const updatesApi = {
  getUnseen,
  getJournal,
  acknowledgeUpdates,
  getAll,
  getAllWithViews,
  create,
  update,
  remove,
  publish,
}
