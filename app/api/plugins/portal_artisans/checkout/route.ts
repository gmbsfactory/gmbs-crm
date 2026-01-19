import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import Stripe from 'stripe'

// Trim to éviter les retours ligne accidentels dans Vercel env
const STRIPE_SECRET = (process.env.STRIPE_SECRET_KEY || '').trim()
const PRICE_ID = (process.env.STRIPE_PRICE_PORTAL_ARTISANS || '').trim()

const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null

/**
 * POST /api/plugins/portal_artisans/checkout
 * Create a Stripe Checkout session for Portal Artisans subscription
 */
export async function POST(request: NextRequest) {
  console.log('[checkout] Starting checkout request')
  
  try {
    // Check env vars
    if (!STRIPE_SECRET || !stripe) {
      console.error('[checkout] Missing STRIPE_SECRET_KEY')
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
    }
    if (!PRICE_ID) {
      console.error('[checkout] Missing STRIPE_PRICE_PORTAL_ARTISANS')
      return NextResponse.json({ error: 'Price not configured' }, { status: 500 })
    }

    // Get auth from cookies - Supabase stores tokens in cookies
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    console.log('[checkout] Available cookies:', allCookies.map(c => c.name))
    
    // Find the Supabase auth cookie (format varies by project)
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
        console.log('[checkout] Found auth token from cookie:', authCookie.name)
      } catch {
        console.log('[checkout] Could not parse auth cookie')
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
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('[checkout] Auth error:', authError.message)
      } else {
        user = authData.user
      }
    }

    if (!user) {
      console.error('[checkout] No authenticated user found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[checkout] User authenticated:', user.id)

    // Use admin client for plugin_subscriptions (RLS requires service_role)
    const adminSupabase = createServerSupabaseAdmin()

    // Check if already subscribed
    const { data: existingSubscription, error: subError } = await adminSupabase
      .from('plugin_subscriptions')
      .select('id, status, stripe_subscription_id')
      .eq('plugin_id', 'portal_artisans')
      .single()

    if (subError && subError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      console.error('[checkout] Error checking subscription:', subError)
      return NextResponse.json({ 
        error: 'Database error: ' + subError.message 
      }, { status: 500 })
    }

    console.log('[checkout] Existing subscription:', existingSubscription)

    if (existingSubscription?.status === 'active') {
      return NextResponse.json({ 
        error: 'Plugin already active' 
      }, { status: 400 })
    }

    // Get price to check if it's free
    console.log('[checkout] Retrieving price:', PRICE_ID)
    const price = await stripe.prices.retrieve(PRICE_ID)
    console.log('[checkout] Price unit_amount:', price.unit_amount)
    
    // If price is 0, activate directly without Stripe checkout
    if (price.unit_amount === 0) {
      console.log('[checkout] Free plan - activating directly')
      
      // Create or update subscription record directly
      const subscriptionData = {
        plugin_id: 'portal_artisans',
        status: 'active',
        stripe_price_id: PRICE_ID,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        metadata: { plan: 'starter', activated_by: user.id }
      }

      let dbError = null
      if (existingSubscription) {
        const { error } = await adminSupabase
          .from('plugin_subscriptions')
          .update(subscriptionData)
          .eq('id', existingSubscription.id)
        dbError = error
      } else {
        const { error } = await adminSupabase
          .from('plugin_subscriptions')
          .insert(subscriptionData)
        dbError = error
      }

      if (dbError) {
        console.error('[checkout] Database error:', dbError)
        return NextResponse.json({ 
          error: 'Failed to activate: ' + dbError.message 
        }, { status: 500 })
      }

      console.log('[checkout] Plugin activated successfully')
      return NextResponse.json({ activated: true })
    }

    // Create Stripe checkout session for paid plans
    console.log('[checkout] Creating Stripe checkout session')
    
    // Get or create Stripe customer
    let customerId: string
    
    const { data: profile } = await adminSupabase
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
      await adminSupabase
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
    console.error('[checkout] Error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
