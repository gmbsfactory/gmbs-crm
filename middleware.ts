import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const accessToken = req.cookies.get('sb-access-token')?.value || ''

  // Root redirect
  if (pathname === '/') {
    const url = req.nextUrl.clone()
    url.pathname = accessToken ? '/dashboard' : '/login'
    return NextResponse.redirect(url)
  }

  // Pages publiques - pas de vérification nécessaire
  const publicPaths = ['/login', '/landingpage', '/set-password', '/auth/callback']
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Si pas de token, rediriger vers login
  // IMPORTANT: Ne pas rediriger si on est déjà sur /login pour éviter les boucles
  if (!accessToken && pathname !== '/login') {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Le middleware vérifie uniquement la présence du token
  // La vérification de l'existence de l'utilisateur et des gestionnaires
  // est gérée par AuthGuard côté client pour éviter les problèmes de timing
  // et permettre une meilleure gestion des erreurs
  return NextResponse.next()
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
    // - api/auth (auth endpoints)
    // - public files/extensions
    '/((?!_next/static|_next/image|favicon.ico|login|landingpage|api/auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
