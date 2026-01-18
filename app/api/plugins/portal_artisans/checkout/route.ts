import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const PRICE_ID = process.env.STRIPE_PRICE_PORTAL_ARTISANS!

/**
 * POST /api/plugins/portal_artisans/checkout
 * Create a Stripe Checkout session for Portal Artisans subscription
 */
export async function POST(request: NextRequest) {
  const token = bearerFrom(request)
  const supabase = createServerSupabase(token || undefined)
  
  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if already subscribed
  const { data: existingSubscription } = await supabase
    .from('plugin_subscriptions')
    .select('id, status, stripe_subscription_id')
    .eq('plugin_id', 'portal_artisans')
    .single()

  if (existingSubscription?.status === 'active') {
    return NextResponse.json({ 
      error: 'Plugin already active' 
    }, { status: 400 })
  }

  // Get price to check if it's free
  const price = await stripe.prices.retrieve(PRICE_ID)
  
  // If price is 0, activate directly without Stripe checkout
  if (price.unit_amount === 0) {
    // Create or update subscription record directly
    const subscriptionData = {
      plugin_id: 'portal_artisans',
      status: 'active',
      stripe_price_id: PRICE_ID,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      metadata: { plan: 'starter', activated_by: user.id }
    }

    if (existingSubscription) {
      await supabase
        .from('plugin_subscriptions')
        .update(subscriptionData)
        .eq('id', existingSubscription.id)
    } else {
      await supabase
        .from('plugin_subscriptions')
        .insert(subscriptionData)
    }

    return NextResponse.json({ activated: true })
  }

  // Create Stripe checkout session for paid plans
  try {
    // Get or create Stripe customer
    let customerId: string
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
    } else {
      // Create new customer
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id }
      })
      customerId = customer.id

      // Save customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1
        }
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/plugins/portal-artisans?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/plugins/portal-artisans?canceled=true`,
      subscription_data: {
        metadata: {
          plugin_id: 'portal_artisans',
          user_id: user.id
        }
      }
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json({ 
      error: 'Failed to create checkout session' 
    }, { status: 500 })
  }
}
