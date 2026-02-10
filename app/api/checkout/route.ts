import { NextResponse } from "next/server"
import { cookies, headers } from "next/headers"
import crypto from "node:crypto"

export const runtime = "nodejs"

const WALLET_COOKIE = "wallet_id"
const CREDITS_COOKIE = "chat_credits"

function getSecret() {
  return process.env.CREDITS_SECRET || "dev-secret"
}

function sign(value: string) {
  const h = crypto.createHmac("sha256", getSecret())
  h.update(value)
  return h.digest("hex")
}

async function getOrSetWalletId(): Promise<string> {
  const c: any = cookies() as any
  const raw = c.get(WALLET_COOKIE)?.value
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { id: string; sig: string }
      if (parsed.sig === sign(parsed.id)) return parsed.id
    } catch { /* Silenced: corrupted cookie, fall through to new ID */ }
  }
  const id = crypto.randomUUID()
  const value = JSON.stringify({ id, sig: sign(id) })
  c.set(WALLET_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
  return id
}

function getOrigin() {
  const hdrs: any = headers() as any
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host")
  const proto = hdrs.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http")
  return `${proto}://${host}`
}

export async function POST(request: Request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  if (!STRIPE_SECRET_KEY) {
    // Calm mode: Stripe not configured, no-op to avoid noisy 500s during staging/prod tests
    return new NextResponse("stripe_not_configured", { status: 202 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return new NextResponse("Bad JSON", { status: 400 })
  }
  const amountCents = Math.max(100, Math.floor(Number(body?.amountCents) || 0))
  const walletId = await getOrSetWalletId()
  const origin = process.env.NEXT_PUBLIC_APP_URL || getOrigin()

  const params = new URLSearchParams()
  params.set("mode", "payment")
  params.set("success_url", `${origin}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}`)
  params.set("cancel_url", `${origin}/dashboard?topup=cancel`)
  // line_items[0]
  params.set("line_items[0][quantity]", "1")
  params.set("line_items[0][price_data][currency]", "usd")
  params.set("line_items[0][price_data][unit_amount]", String(amountCents))
  params.set("line_items[0][price_data][product_data][name]", "Recharge crédit IA")
  // metadata
  params.set("metadata[walletId]", walletId)

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  })

  if (!res.ok) {
    const text = await res.text()
    return new NextResponse(text || "Erreur Stripe", { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ checkoutUrl: data.url })
}
