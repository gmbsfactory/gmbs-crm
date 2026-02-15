import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Crée un client Supabase admin (service role) pour contourner les RLS
 * À utiliser UNIQUEMENT dans les routes API où l'authentification est déjà vérifiée manuellement
 */
export function createServerSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!serviceRoleKey) {
    console.warn('[createServerSupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY not set, falling back to anon key')
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    return createClient(url, anon) as SupabaseClient
  }

  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  })
  return client as SupabaseClient
}
