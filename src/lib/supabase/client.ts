import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Crée un client Supabase côté navigateur via @supabase/ssr.
 * La session est stockée dans les cookies (plus de localStorage).
 * Singleton : une seule instance est créée par onglet.
 */
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return browserClient
}
