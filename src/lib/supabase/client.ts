import { createBrowserClient } from '@supabase/ssr'

let browserClient: ReturnType<typeof createBrowserClient> | null = null

/**
 * Crée un client Supabase côté navigateur via @supabase/ssr.
 * La session est stockée dans les cookies (plus de localStorage).
 * Singleton : une seule instance est créée par onglet.
 */
export function createClient() {
  if (browserClient) return browserClient

  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return browserClient
}
