import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Rafraîchir la session (token JWT) à chaque requête via @supabase/ssr
  const { user, supabaseResponse } = await updateSession(req)

  // Ajouter le pathname aux headers pour le layout
  supabaseResponse.headers.set('x-pathname', pathname)

  // Root redirect
  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = user ? '/dashboard' : '/login'
    return NextResponse.redirect(url)
  }

  // Pages publiques - pas de vérification nécessaire
  const publicPaths = ['/login', '/landingpage', '/set-password', '/auth/callback', '/portail']
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return supabaseResponse
  }

  // Si pas d'utilisateur authentifié, rediriger vers login
  if (!user && pathname !== '/login') {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Vérification session quotidienne : forcer reconnexion chaque jour
  if (user) {
    const sessionDate = req.cookies.get('crm_session_date')?.value
    const today = new Date().toISOString().slice(0, 10) // UTC YYYY-MM-DD

    if (!sessionDate || sessionDate !== today) {
      const loginUrl = req.nextUrl.clone()
      loginUrl.pathname = '/login'
      loginUrl.searchParams.set('expired', 'daily')
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('crm_session_date')
      return response
    }
  }

  return supabaseResponse
}

// Exclude static assets, images, favicon, and public auth endpoints; allow /login and /landingpage
export const config = {
  matcher: [
    // All paths except the ones starting with:
    // - _next/static (static files)
    // - _next/image (image optimization files)
    // - favicon.ico
    // - login (public login page)
    // - landingpage (public landing page)
    // - portail (public artisan portal)
    // - api/auth (auth endpoints)
    // - api/portail (artisan portal API)
    // - api/portal-external (external portal API - called by portal_gmbs)
    // - public files/extensions
    '/((?!_next/static|_next/image|favicon.ico|login|landingpage|portail|api/auth/|api/portail/|api/portal-external/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}