import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createServerSupabase(token?: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const client = createClient(url, anon, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  })
  return client as SupabaseClient
}

/**
 * Crée un client Supabase admin (service role) pour contourner les RLS
 * À utiliser UNIQUEMENT dans les routes API où l'authentification est déjà vérifiée manuellement
 */
export function createServerSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!serviceRoleKey) {
    console.warn('[createServerSupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY not set, falling back to anon key')
    return createServerSupabase()
  }
  
  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  })
  return client as SupabaseClient
}

export function bearerFrom(req: Request): string | null {
  const h = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!h) return null
  const m = /^Bearer\s+(.+)$/i.exec(h.trim())
  return m ? m[1] : null
}

