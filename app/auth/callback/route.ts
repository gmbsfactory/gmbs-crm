import { createServerSupabase } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Auth callback route for Supabase
 * Handles code exchange for PKCE flow
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/set-password'
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  // Handle error from Supabase
  if (error) {
    console.error('[auth/callback] Error from Supabase:', error, errorDescription)
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('error', errorDescription || error)
    return NextResponse.redirect(redirectUrl)
  }

  // If we have a code, exchange it for a session
  if (code) {
    try {
      const supabase = createServerSupabase()
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

      if (exchangeError) {
        console.error('[auth/callback] Code exchange failed:', exchangeError.message)
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('error', exchangeError.message)
        return NextResponse.redirect(redirectUrl)
      }
    } catch (e: any) {
      console.error('[auth/callback] Unexpected error:', e?.message)
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('error', 'Authentication failed')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // Redirect to the next URL (set-password page or dashboard)
  const redirectUrl = new URL(next, request.url)
  return NextResponse.redirect(redirectUrl)
}
