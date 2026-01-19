import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServerSupabaseAdmin, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * GET /api/plugins/portal_artisans/status
 * Get the subscription status for Portal Artisans plugin
 */
export async function GET(request: NextRequest) {
  // Try bearer token first, then cookies
  let token = bearerFrom(request)
  if (!token) {
    const cookieStore = await cookies()
    token = cookieStore.get('sb-access-token')?.value || null
  }
  const supabase = createServerSupabase(token || undefined)
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ active: false, reason: 'unauthenticated' })
  }

  // Use admin client for plugin_subscriptions (RLS requires service_role for writes, but also use for reads for consistency)
  const adminSupabase = createServerSupabaseAdmin()

  // Get plugin subscription
  const { data: subscription } = await adminSupabase
    .from('plugin_subscriptions')
    .select('status, current_period_end, cancel_at_period_end, metadata')
    .eq('plugin_id', 'portal_artisans')
    .single()

  if (!subscription) {
    return NextResponse.json({ 
      active: false, 
      status: 'inactive' 
    })
  }

  const isActive = ['active', 'trialing'].includes(subscription.status)

  return NextResponse.json({
    active: isActive,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    plan: (subscription.metadata as Record<string, string>)?.plan || 'starter'
  })
}
