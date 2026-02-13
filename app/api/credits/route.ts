import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import crypto from "node:crypto"

export const runtime = "nodejs"

const COOKIE_NAME = "chat_credits"
const MAX_BALANCE_CENTS = 100_000_00 // $100k cap as a guard
const INITIAL_FREE_CENTS = Math.max(
  0,
  Math.min(10_000_00, parseInt(process.env.INITIAL_FREE_CENTS || "500", 10) || 500)
)

function getSecret() {
  return process.env.CREDITS_SECRET || "dev-secret"
}

type CookiePayload = { balanceCents: number; sig: string }

function signBalance(balanceCents: number): string {
  const h = crypto.createHmac("sha256", getSecret())
  h.update(String(balanceCents))
  return h.digest("hex")
}

async function parseCookie(): Promise<number> {
  const c = await cookies()
  const raw = c.get(COOKIE_NAME)?.value
  if (!raw) return 0
  try {
    const payload = JSON.parse(raw) as CookiePayload
    if (
      typeof payload.balanceCents === "number" &&
      payload.sig &&
      payload.sig === signBalance(payload.balanceCents)
    ) {
      return Math.max(0, Math.min(payload.balanceCents, MAX_BALANCE_CENTS))
    }
  } catch { /* Silenced: corrupted cookie, fall through to 0 */ }
  return 0
}

async function setCookie(balanceCents: number) {
  const value: CookiePayload = { balanceCents, sig: signBalance(balanceCents) }
  const c = await cookies()
  c.set(COOKIE_NAME, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const reset = url.searchParams.get("reset") === "1"
  const c = await cookies()
  const raw = c.get(COOKIE_NAME)?.value
  if (!raw || reset) {
    await setCookie(INITIAL_FREE_CENTS)
    return NextResponse.json({ balanceCents: INITIAL_FREE_CENTS, reset })
  }
  const balanceCents = await parseCookie()
  return NextResponse.json({ balanceCents, reset: false })
}

export async function POST(request: Request) {
  const balanceCents = await parseCookie()
  let body: any
  try {
    body = await request.json()
  } catch {
    return new NextResponse("Bad JSON", { status: 400 })
  }
  const amountCents = Math.max(0, Math.floor(Number(body?.amountCents) || 0))
  if (!amountCents) {
    return new NextResponse("amountCents requis", { status: 400 })
  }
  const next = Math.min(MAX_BALANCE_CENTS, balanceCents + amountCents)
  await setCookie(next)
  return NextResponse.json({ balanceCents: next })
}
