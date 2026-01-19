import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServerSupabaseAdmin, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

/**
 * POST /api/plugins/portal_artisans/cancel
 * Cancel the Portal Artisans subscription
 */
export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use admin client for plugin_subscriptions
  const adminSupabase = createServerSupabaseAdmin()

  // Get subscription
  const { data: subscription, error } = await adminSupabase
    .from('plugin_subscriptions')
    .select('id, stripe_subscription_id, status')
    .eq('plugin_id', 'portal_artisans')
    .single()

  if (error || !subscription) {
    return NextResponse.json({ 
      error: 'No active subscription found' 
    }, { status: 404 })
  }

  // If there's a Stripe subscription, cancel it
  if (subscription.stripe_subscription_id) {
    try {
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        cancel_at_period_end: true
      })
    } catch (stripeError) {
      console.error('Stripe cancel error:', stripeError)
      // Continue anyway - we'll update the local status
    }
  }

  // Update local subscription status
  await adminSupabase
    .from('plugin_subscriptions')
    .update({
      status: 'canceled',
      cancel_at_period_end: true
    })
    .eq('id', subscription.id)

  return NextResponse.json({ success: true })
}
