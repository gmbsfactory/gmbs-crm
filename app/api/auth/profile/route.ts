import { NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { encryptPassword } from '@/lib/utils/encryption'
import { validateGmailEmail } from '@/lib/services/email-service'

export const runtime = 'nodejs'

export async function PATCH(req: Request) {
  console.log('[profile] PATCH request received')

  // @supabase/ssr lit automatiquement les cookies de session
  const supabaseAuth = await createSSRServerClient()

  // Client admin pour les opérations de mise à jour (contourne les RLS)
  const supabase = createServerSupabaseAdmin()

  // Vérifier l'utilisateur authentifié
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser()
  console.log('[profile] Auth user:', authData?.user?.id, 'error:', authError?.message)
  
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  console.log('[profile] Body keys:', Object.keys(body))
  
  const patch: Record<string, unknown> = {}

  const color = typeof body.color === 'string' ? body.color.trim() : typeof body.btn_color === 'string' ? body.btn_color.trim() : null
  if (color !== null) patch.color = color || null

  if (typeof body.firstname === 'string') patch.firstname = body.firstname.trim() || null
  else if (typeof body.prenom === 'string') patch.firstname = String(body.prenom).trim() || null

  if (typeof body.lastname === 'string') patch.lastname = body.lastname.trim() || null
  else if (typeof body.name === 'string') patch.lastname = String(body.name).trim() || null

  if (typeof body.surnom === 'string') patch.code_gestionnaire = body.surnom.trim() || null
  else if (typeof body.code_gestionnaire === 'string') patch.code_gestionnaire = String(body.code_gestionnaire).trim() || null

  // Handle avatar_url field
  if (typeof body.avatar_url === 'string') {
    patch.avatar_url = body.avatar_url.trim() || null
  } else if (body.avatar_url === null) {
    patch.avatar_url = null
  }

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

  if (Object.keys(patch).length === 0) {
    console.log('[profile] No changes to save')
    return NextResponse.json({ ok: true })
  }
  
  console.log('[profile] Patch to apply:', Object.keys(patch))
  
  // Utiliser auth.uid() pour trouver l'utilisateur via la table de mapping
  const authUserId = authData?.user?.id
  const authEmail = authData?.user?.email
  if (!authUserId) {
    console.log('[profile] No auth user id found')
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })
  }
  
  // D'abord, chercher via la table de mapping
  const { data: mapping, error: mappingErr } = await supabase
    .from('auth_user_mapping')
    .select('public_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  
  console.log('[profile] Mapping result:', mapping?.public_user_id, 'error:', mappingErr?.message)
  
  let me: { id: string } | null = null
  let selErr: any = null
  
  if (mapping?.public_user_id) {
    // Utiliser l'ID du mapping
    const result = await supabase
      .from('users')
      .select('id')
      .eq('id', mapping.public_user_id)
      .maybeSingle()
    me = result.data
    selErr = result.error
  } else if (authEmail) {
    // Fallback: chercher par email si pas de mapping
    console.log('[profile] No mapping found, trying email fallback:', authEmail)
    const result = await supabase
      .from('users')
      .select('id')
      .eq('email', authEmail)
      .maybeSingle()
    me = result.data
    selErr = result.error
    
    // Si trouvé par email, créer automatiquement le mapping pour la prochaine fois
    if (me && !selErr) {
      console.log('[profile] Creating mapping for future use')
      await supabase
        .from('auth_user_mapping')
        .insert({ auth_user_id: authUserId, public_user_id: me.id })
        .single()
    }
  }
  
  console.log('[profile] SELECT result:', me?.id, 'error:', selErr?.message, 'code:', selErr?.code)
  
  if (selErr) {
    console.error('[profile] SELECT error:', selErr)
    return NextResponse.json({ error: selErr.message }, { status: 500 })
  }
  if (!me) {
    console.log('[profile] User not found for id:', authUserId)
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  
  console.log('[profile] Updating user:', me.id)
  const { error } = await supabase.from('users').update(patch).eq('id', me.id)
  
  if (error) {
    console.error('[profile] UPDATE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  
  console.log('[profile] Update successful')
  return NextResponse.json({ ok: true })
}
