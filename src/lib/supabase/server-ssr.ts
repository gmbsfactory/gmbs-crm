import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Crée un client Supabase côté serveur (Route Handlers, Server Components).
 * Lit et écrit les cookies de session automatiquement via @supabase/ssr.
 * Le token est rafraîchi automatiquement si expiré.
 */
export async function createSSRServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // En Server Components, les cookies sont read-only.
            // C'est attendu et ne pose pas de problème.
          }
        },
      },
    }
  )
}
