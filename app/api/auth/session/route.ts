import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const c = await cookies()
  const { access_token, refresh_token, expires_at } = await req.json().catch(() => ({ }))
  if (!access_token || !refresh_token) return NextResponse.json({ error: 'missing_tokens' }, { status: 400 })
  const accessMaxAge = 60 * 60 // 1 hour
  const refreshMaxAge = 60 * 60 * 24 * 7 // 7 days
  const secure = process.env.NODE_ENV === 'production'
  const expires = expires_at ? new Date(expires_at * 1000) : undefined
  c.set('sb-access-token', access_token, { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: accessMaxAge, expires })
  c.set('sb-refresh-token', refresh_token, { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: refreshMaxAge })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const c = await cookies()
  const secure = process.env.NODE_ENV === 'production'
  c.set('sb-access-token', '', { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: 0 })
  c.set('sb-refresh-token', '', { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: 0 })
  return NextResponse.json({ ok: true })
}

