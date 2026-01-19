import { NextResponse } from 'next/server'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * GET /api/plugins/portal_artisans/debug
 * Debug endpoint to check configuration
 */
export async function GET() {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? '✓ Set' : '✗ Missing',
      STRIPE_PRICE_PORTAL_ARTISANS: process.env.STRIPE_PRICE_PORTAL_ARTISANS || '✗ Missing',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing',
    }
  }

  // Check cookies
  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    debug.cookies = allCookies.map(c => c.name)
    
    // Find auth cookie
    const authCookie = allCookies.find(c => c.name.includes('-auth-token'))
    debug.authCookieFound = !!authCookie
    
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value)
        debug.hasAccessToken = !!parsed.access_token
      } catch {
        debug.authCookieParseError = 'Could not parse'
      }
    }
  } catch (e) {
    debug.cookieError = e instanceof Error ? e.message : 'Unknown'
  }

  // Check database table
  try {
    const adminSupabase = createServerSupabaseAdmin()
    
    // Try to query the table
    const { data, error } = await adminSupabase
      .from('plugin_subscriptions')
      .select('id')
      .limit(1)
    
    if (error) {
      debug.database = {
        status: 'error',
        message: error.message,
        code: error.code,
        hint: error.hint
      }
    } else {
      debug.database = {
        status: 'ok',
        tableExists: true,
        rowCount: data?.length || 0
      }
    }
  } catch (e) {
    debug.database = {
      status: 'exception',
      message: e instanceof Error ? e.message : 'Unknown'
    }
  }

  // Check Stripe
  try {
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')
    
    const priceId = process.env.STRIPE_PRICE_PORTAL_ARTISANS
    if (priceId) {
      const price = await stripe.prices.retrieve(priceId)
      debug.stripe = {
        status: 'ok',
        priceId: price.id,
        unitAmount: price.unit_amount,
        currency: price.currency
      }
    } else {
      debug.stripe = { status: 'no_price_id' }
    }
  } catch (e) {
    debug.stripe = {
      status: 'error',
      message: e instanceof Error ? e.message : 'Unknown'
    }
  }

  return NextResponse.json(debug, { 
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
