import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { encryptPassword } from '@/lib/utils/encryption'
import { validateGmailEmail } from '@/lib/services/email-service'

export const runtime = 'nodejs'

export async function PATCH(req: Request) {
  const token = bearerFrom(req)
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createServerSupabase(token)
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const patch: Record<string, unknown> = {}

  const color = typeof body.color === 'string' ? body.color.trim() : typeof body.btn_color === 'string' ? body.btn_color.trim() : null
  if (color !== null) patch.color = color || null

  if (typeof body.firstname === 'string') patch.firstname = body.firstname.trim() || null
  else if (typeof body.prenom === 'string') patch.firstname = String(body.prenom).trim() || null

  if (typeof body.lastname === 'string') patch.lastname = body.lastname.trim() || null
  else if (typeof body.name === 'string') patch.lastname = String(body.name).trim() || null

  if (typeof body.surnom === 'string') patch.code_gestionnaire = body.surnom.trim() || null
  else if (typeof body.code_gestionnaire === 'string') patch.code_gestionnaire = String(body.code_gestionnaire).trim() || null

  // Handle email_smtp field
  if (typeof body.email_smtp === 'string') {
    const email = body.email_smtp.trim()
    if (email.length > 0) {
      // Validate Gmail format
      if (!validateGmailEmail(email)) {
        return NextResponse.json(
          { error: "L'email SMTP doit être une adresse Gmail valide (gmail.com ou googlemail.com)" },
          { status: 400 }
        )
      }
      patch.email_smtp = email
    } else {
      patch.email_smtp = null
    }
  }

  // Handle email_password field (encrypt before storage)
  if (typeof body.email_password === 'string') {
    const password = body.email_password.trim()
    if (password.length > 0) {
      // Validate password length (reasonable minimum)
      if (password.length < 8) {
        return NextResponse.json(
          { error: 'Le mot de passe doit contenir au moins 8 caractères' },
          { status: 400 }
        )
      }
      try {
        // Encrypt password before storage
        patch.email_password_encrypted = encryptPassword(password)
      } catch (error) {
        console.error('[profile] Password encryption failed:', error)
        return NextResponse.json(
          { error: 'Erreur lors du chiffrement du mot de passe' },
          { status: 500 }
        )
      }
    } else {
      // Empty password means remove it
      patch.email_password_encrypted = null
    }
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })
  const { data: me, error: selErr } = await supabase.from('users').select('id').maybeSingle()
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 })
  if (!me) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { error } = await supabase.from('users').update(patch).eq('id', me.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
