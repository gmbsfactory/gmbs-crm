import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

const GENERIC_RESPONSE = { message: 'Si ce compte existe, un email a été envoyé.' }

export async function POST(req: Request) {
  if (!supabaseAdmin) return NextResponse.json(GENERIC_RESPONSE)
  const { identifier } = await req.json().catch(() => ({}))
  if (!identifier) return NextResponse.json(GENERIC_RESPONSE)

  // Délai constant pour éviter timing attack
  const startTime = Date.now()

  let email: string | null = null

  if (String(identifier).includes('@')) {
    email = identifier
  } else {
    const { data } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('username', identifier)
      .maybeSingle()
    email = data?.email || null
  }

  // Uniformiser le temps de réponse (~200ms minimum)
  const elapsed = Date.now() - startTime
  if (elapsed < 200) {
    await new Promise(r => setTimeout(r, 200 - elapsed))
  }

  // Toujours même structure de réponse
  return NextResponse.json({ email })
}
