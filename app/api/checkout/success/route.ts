import { NextResponse } from "next/server"
import { cookies } from "next/headers"
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

async function readWalletId(): Promise<string | null> {
  const c = await cookies()
  const raw = c.get(WALLET_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { id: string; sig: string }
    if (parsed.sig === sign(parsed.id)) return parsed.id
  } catch { /* Silenced: corrupted cookie, fall through to null */ }
  return null
}

async function getBalance(): Promise<number> {
  const c = await cookies()
  const raw = c.get(CREDITS_COOKIE)?.value
  if (!raw) return 0
  try {
    const payload = JSON.parse(raw) as { balanceCents: number; sig: string }
    const sig = crypto.createHmac("sha256", getSecret()).update(String(payload.balanceCents)).digest("hex")
    if (payload.sig === sig) return Math.max(0, payload.balanceCents)
  } catch { /* Silenced: corrupted cookie, fall through to 0 */ }
  return 0
}

async function setBalance(nextBalance: number) {
  const c = await cookies()
  const sig = crypto.createHmac("sha256", getSecret()).update(String(nextBalance)).digest("hex")
  c.set(
    CREDITS_COOKIE,
    JSON.stringify({ balanceCents: nextBalance, sig }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    }
  )
}

export async function GET(request: Request) {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
  if (!STRIPE_SECRET_KEY) {
    // Calm mode: Stripe not configured, redirect with placeholder state
    const url = new URL(request.url)
    return NextResponse.redirect(new URL("/dashboard?topup=disabled", url.origin))
  }
  const url = new URL(request.url)
  const sessionId = url.searchParams.get("session_id")
  if (!sessionId) return new NextResponse("session_id manquant", { status: 400 })

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    return new NextResponse(text || "Erreur Stripe", { status: 500 })
  }
  const data = await res.json()
  if (data.payment_status !== "paid") {
    return NextResponse.redirect(new URL("/dashboard?topup=pending", url.origin))
  }

  const amount = Number(data.amount_total || 0)
  const metadataWalletId = data?.metadata?.walletId || null
  const cookieWalletId = await readWalletId()

  // Basic binding check: if cookie wallet differs, bind to metadata if cookie missing
  if (!cookieWalletId && metadataWalletId) {
    const c = await cookies()
    const value = JSON.stringify({ id: metadataWalletId, sig: sign(metadataWalletId) })
    c.set(WALLET_COOKIE, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  } else if (cookieWalletId && metadataWalletId && cookieWalletId !== metadataWalletId) {
    // Possible mismatch; reject crediting silently and go back with error
    return NextResponse.redirect(new URL("/dashboard?topup=wallet_mismatch", url.origin))
  }

  const current = await getBalance()
  await setBalance(current + amount)
  return NextResponse.redirect(new URL(`/dashboard?topup=success&amount=${amount}`, url.origin))
}
