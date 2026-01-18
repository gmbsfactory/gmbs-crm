import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

// Use service role for webhook to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event: Stripe.Event

  // Verify webhook signature if secret is configured
  if (endpointSecret && signature) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } else {
    // In development without webhook secret, parse directly
    try {
      event = JSON.parse(body) as Stripe.Event
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }

  console.log(`Stripe webhook received: ${event.type}`)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error('Error handling webhook:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return

  const pluginId = session.metadata?.plugin_id

  if (!pluginId) {
    console.error('No plugin_id in checkout session metadata')
    return
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  const subData = JSON.parse(JSON.stringify(subscription))
  
  await upsertPluginSubscription(pluginId, {
    stripe_customer_id: session.customer as string,
    stripe_subscription_id: subData.id,
    stripe_price_id: subData.items?.data?.[0]?.price?.id,
    status: subData.status,
    current_period_start: subData.current_period_start ? new Date(subData.current_period_start * 1000).toISOString() : null,
    current_period_end: subData.current_period_end ? new Date(subData.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: subData.cancel_at_period_end,
    metadata: { 
      plan: subData.items?.data?.[0]?.price?.metadata?.plan || 'starter',
      user_id: session.metadata?.user_id 
    }
  })
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const subData = JSON.parse(JSON.stringify(subscription))
  const pluginId = subData.metadata?.plugin_id
  if (!pluginId) return

  await upsertPluginSubscription(pluginId, {
    stripe_subscription_id: subData.id,
    stripe_price_id: subData.items?.data?.[0]?.price?.id,
    status: subData.status,
    current_period_start: subData.current_period_start ? new Date(subData.current_period_start * 1000).toISOString() : null,
    current_period_end: subData.current_period_end ? new Date(subData.current_period_end * 1000).toISOString() : null,
    cancel_at_period_end: subData.cancel_at_period_end
  })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subData = JSON.parse(JSON.stringify(subscription))
  const pluginId = subData.metadata?.plugin_id
  if (!pluginId) return

  await supabase
    .from('plugin_subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subData.id)
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceData = JSON.parse(JSON.stringify(invoice))
  if (!invoiceData.subscription) return

  await supabase
    .from('plugin_subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', invoiceData.subscription)
}

async function upsertPluginSubscription(
  pluginId: string, 
  data: Record<string, unknown>
) {
  const { data: existing } = await supabase
    .from('plugin_subscriptions')
    .select('id')
    .eq('plugin_id', pluginId)
    .single()

  if (existing) {
    await supabase
      .from('plugin_subscriptions')
      .update(data)
      .eq('id', existing.id)
  } else {
    await supabase
      .from('plugin_subscriptions')
      .insert({ plugin_id: pluginId, ...data })
  }
}
