import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Rafraîchit la session Supabase dans le middleware Next.js.
 *
 * Stratégie hybride pour minimiser la pression Auth/DB :
 * - `getSession()` lit/valide le JWT depuis le cookie (pas d'appel réseau).
 * - `getUser()` est appelé seulement si le token expire dans < 60s, ce qui
 *   force un refresh + réécriture des cookies.
 *
 * Sur des tokens d'1h, cela passe d'1 appel Auth+DB par navigation à
 * ~1 appel par heure et par session.
 */
const REFRESH_THRESHOLD_SECONDS = 60

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const nowSeconds = Math.floor(Date.now() / 1000)
  const expiresAt = session?.expires_at ?? 0
  const needsRefresh = !!session && expiresAt - nowSeconds < REFRESH_THRESHOLD_SECONDS

  let user = session?.user ?? null

  if (needsRefresh) {
    const {
      data: { user: refreshedUser },
    } = await supabase.auth.getUser()
    user = refreshedUser
  }

  return { user, supabaseResponse }
}
