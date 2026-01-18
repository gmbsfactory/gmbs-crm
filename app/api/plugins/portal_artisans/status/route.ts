import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'

/**
 * GET /api/plugins/portal_artisans/status
 * Get the subscription status for Portal Artisans plugin
 */
export async function GET(request: NextRequest) {
  const token = bearerFrom(request)
  const supabase = createServerSupabase(token || undefined)
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ active: false, reason: 'unauthenticated' })
  }

  // Get plugin subscription
  const { data: subscription } = await supabase
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
