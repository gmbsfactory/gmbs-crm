import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * GET /api/plugins/portal_artisans/status
 * Get the subscription status for Portal Artisans plugin
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth from cookies - Supabase stores tokens in cookies
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    
    // Find the Supabase auth cookie
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
    const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
    
    // Try to get access token from various cookie formats
    let accessToken: string | null = null
    
    // Check for sb-<project>-auth-token cookie (new format)
    const authCookie = allCookies.find(c => c.name.includes('-auth-token'))
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        accessToken = parsed.access_token || null
      } catch {
        // ignore parse errors
      }
    }
    
    // Fallback: try sb-access-token
    if (!accessToken) {
      accessToken = cookieStore.get('sb-access-token')?.value || null
    }
    
    // Create Supabase client with token
    let user = null
    if (accessToken) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      })
      const { data: authData } = await supabase.auth.getUser()
      user = authData.user
    }

    if (!user) {
      return NextResponse.json({ active: false, reason: 'unauthenticated' })
    }

    // Use admin client for plugin_subscriptions
    const adminSupabase = createServerSupabaseAdmin()

    // Get plugin subscription
    const { data: subscription, error } = await adminSupabase
      .from('plugin_subscriptions')
      .select('status, current_period_end, cancel_at_period_end, metadata')
      .eq('plugin_id', 'portal_artisans')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[status] Database error:', error)
      return NextResponse.json({ active: false, reason: 'database_error' })
    }

    if (!subscription) {
      return NextResponse.json({ active: false, reason: 'no_subscription' })
    }

    const isActive = subscription.status === 'active' || subscription.status === 'trialing'

    return NextResponse.json({
      active: isActive,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      plan: (subscription.metadata as Record<string, unknown>)?.plan || 'starter'
    })
  } catch (error) {
    console.error('[status] Error:', error)
    return NextResponse.json({ active: false, reason: 'error' })
  }
}
