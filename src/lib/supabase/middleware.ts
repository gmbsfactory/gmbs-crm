import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Rafraîchit la session Supabase dans le middleware Next.js.
 * Appelle getUser() qui vérifie et rafraîchit automatiquement le token JWT.
 * Les cookies mis à jour sont écrits dans la réponse.
 */
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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() contacte le serveur Supabase et rafraîchit le token si expiré.
  // Ne pas utiliser getSession() ici car il ne valide pas le token.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { user, supabaseResponse }
}