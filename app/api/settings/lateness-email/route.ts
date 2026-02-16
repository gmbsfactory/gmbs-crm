import { NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { encryptPassword, decryptPassword } from '@/lib/utils/encryption'
import { validateGmailEmail } from '@/lib/services/email-service'

export const runtime = 'nodejs'

/**
 * Check if the user is an admin
 * Uses admin client to bypass RLS restrictions on user_roles
 */
async function isAdmin(userId: string): Promise<boolean> {
  const adminSupabase = createServerSupabaseAdmin()
  const { data: roles, error } = await adminSupabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId)
  
  
  if (error) {
    console.error('[lateness-email] Error checking admin role:', error)
    return false
  }
  
  const roleNames = (roles || [])
    .map((r: any) => r.roles?.name?.toLowerCase())
    .filter((name: any): name is string => typeof name === 'string')
  
  return roleNames.includes('admin')
}

/**
 * GET /api/settings/lateness-email
 * 
 * Retrieves the lateness email configuration.
 * Admin only.
 */
export async function GET() {
  console.log('[lateness-email] GET request received')
  try {
    // @supabase/ssr lit automatiquement les cookies de session
    const supabase = await createSSRServerClient()

    // Get authenticated user
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Resolve user profile (try mapping first, then fallback to email)
    let userId: string | null = null
    const authUserId = authUser.user.id
    const authEmail = authUser.user.email

    // Try mapping first
    const { data: mapping } = await supabase
      .from('auth_user_mapping')
      .select('public_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (mapping?.public_user_id) {
      userId = mapping.public_user_id
    } else if (authEmail) {
      // Fallback: find user by email
      const adminSupabase = createServerSupabaseAdmin()
      const { data: userByEmail } = await adminSupabase
        .from('users')
        .select('id')
        .eq('email', authEmail)
        .maybeSingle()
      
      if (userByEmail?.id) {
        userId = userByEmail.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    // Check admin role
    const userIsAdmin = await isAdmin(userId)
    
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'forbidden - admin only' }, { status: 403 })
    }

    // Use admin client to fetch config (RLS)
    const adminSupabase = createServerSupabaseAdmin()
    
    // Get the configuration (there should be only one row)
    const { data: config, error } = await adminSupabase
      .from('lateness_email_config')
      .select('id, email_smtp, is_enabled, motivation_message, updated_at')
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('[lateness-email] Error fetching config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return empty config if none exists
    if (!config) {
      return NextResponse.json({
        configured: false,
        email_smtp: null,
        is_enabled: true,
        motivation_message: "Ne t'inquiète pas, demain sera meilleur ! 💪"
      })
    }

    return NextResponse.json({
      configured: true,
      email_smtp: config.email_smtp,
      is_enabled: config.is_enabled,
      motivation_message: config.motivation_message,
      updated_at: config.updated_at
    })
  } catch (error) {
    console.error('[lateness-email] GET error:', error)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/lateness-email
 * 
 * Updates or creates the lateness email configuration.
 * Admin only.
 * 
 * Body:
 * - email_smtp: string (Gmail address)
 * - email_password: string (App password - will be encrypted)
 * - is_enabled: boolean
 * - motivation_message: string
 */
export async function PATCH(req: Request) {
  try {
    // @supabase/ssr lit automatiquement les cookies de session
    const supabase = await createSSRServerClient()

    // Get authenticated user
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Resolve user profile (try mapping first, then fallback to email)
    let userId: string | null = null
    const authUserId = authUser.user.id
    const authEmail = authUser.user.email

    // Try mapping first
    const { data: mapping } = await supabase
      .from('auth_user_mapping')
      .select('public_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (mapping?.public_user_id) {
      userId = mapping.public_user_id
    } else if (authEmail) {
      // Fallback: find user by email
      const adminSupabase = createServerSupabaseAdmin()
      const { data: userByEmail } = await adminSupabase
        .from('users')
        .select('id')
        .eq('email', authEmail)
        .maybeSingle()
      
      if (userByEmail?.id) {
        userId = userByEmail.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    // Check admin role
    const userIsAdmin = await isAdmin(userId)
    
    if (!userIsAdmin) {
      return NextResponse.json({ error: 'forbidden - admin only' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))

    const patch: Record<string, unknown> = {}

    // Handle email_smtp
    if (typeof body.email_smtp === 'string') {
      const email = body.email_smtp.trim()
      if (email.length > 0) {
        if (!validateGmailEmail(email)) {
          return NextResponse.json(
            { error: "L'email doit être une adresse Gmail valide" },
            { status: 400 }
          )
        }
        patch.email_smtp = email
      }
    }

    // Handle email_password (encrypt before storage)
    if (typeof body.email_password === 'string') {
      const password = body.email_password.trim()
      if (password.length > 0) {
        if (password.length < 8) {
          return NextResponse.json(
            { error: 'Le mot de passe doit contenir au moins 8 caractères' },
            { status: 400 }
          )
        }
        try {
          patch.email_password_encrypted = encryptPassword(password)
        } catch (error) {
          console.error('[lateness-email] Password encryption failed:', error)
          return NextResponse.json(
            { error: 'Erreur lors du chiffrement du mot de passe' },
            { status: 500 }
          )
        }
      }
    }

    // Handle is_enabled
    if (typeof body.is_enabled === 'boolean') {
      patch.is_enabled = body.is_enabled
    }

    // Handle motivation_message
    if (typeof body.motivation_message === 'string') {
      patch.motivation_message = body.motivation_message.trim() || "Ne t'inquiète pas, demain sera meilleur ! 💪"
    }

    // Track who updated
    patch.updated_by = userId

    const adminSupabase = createServerSupabaseAdmin()

    // Check if config exists
    const { data: existingConfig } = await adminSupabase
      .from('lateness_email_config')
      .select('id')
      .limit(1)
      .maybeSingle()

    if (existingConfig) {
      // Update existing config
      const { error: updateError } = await adminSupabase
        .from('lateness_email_config')
        .update(patch)
        .eq('id', existingConfig.id)

      if (updateError) {
        console.error('[lateness-email] Update error:', updateError)
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }
    } else {
      // Create new config - email_smtp and email_password are required for insert
      if (!patch.email_smtp || !patch.email_password_encrypted) {
        return NextResponse.json(
          { error: "L'email et le mot de passe sont requis pour la première configuration" },
          { status: 400 }
        )
      }

      const { error: insertError } = await adminSupabase
        .from('lateness_email_config')
        .insert({
          email_smtp: patch.email_smtp,
          email_password_encrypted: patch.email_password_encrypted,
          is_enabled: patch.is_enabled ?? true,
          motivation_message: patch.motivation_message || "Ne t'inquiète pas, demain sera meilleur ! 💪",
          updated_by: userId
        })

      if (insertError) {
        console.error('[lateness-email] Insert error:', insertError)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[lateness-email] PATCH error:', error)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/settings/lateness-email/test
 * 
 * Sends a test email to verify the configuration works.
 * Admin only.
 */
export async function POST() {
  try {
    // @supabase/ssr lit automatiquement les cookies de session
    const supabase = await createSSRServerClient()

    // Get authenticated user
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Resolve user profile (try mapping first, then fallback to email)
    let userId: string | null = null
    const authUserId = authUser.user.id
    const authEmail = authUser.user.email

    // Try mapping first
    const { data: mapping } = await supabase
      .from('auth_user_mapping')
      .select('public_user_id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (mapping?.public_user_id) {
      userId = mapping.public_user_id
    } else if (authEmail) {
      // Fallback: find user by email
      const tempAdminSupabase = createServerSupabaseAdmin()
      const { data: userByEmail } = await tempAdminSupabase
        .from('users')
        .select('id')
        .eq('email', authEmail)
        .maybeSingle()
      
      if (userByEmail?.id) {
        userId = userByEmail.id
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    // Check admin role
    if (!await isAdmin(userId)) {
      return NextResponse.json({ error: 'forbidden - admin only' }, { status: 403 })
    }

    const adminSupabase = createServerSupabaseAdmin()

    // Get current config
    const { data: config, error: configError } = await adminSupabase
      .from('lateness_email_config')
      .select('email_smtp, email_password_encrypted, motivation_message')
      .limit(1)
      .maybeSingle()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'Configuration email non trouvée. Veuillez d\'abord configurer l\'email.' },
        { status: 400 }
      )
    }

    // Get user info for test email
    const { data: userData } = await adminSupabase
      .from('users')
      .select('firstname, lastname, email')
      .eq('id', userId)
      .single()

    if (!userData?.email) {
      return NextResponse.json({ error: 'Email utilisateur non trouvé' }, { status: 400 })
    }

    // Import email service dynamically to avoid build issues
    const { sendEmailToArtisan } = await import('@/lib/services/email-service')
    const { generateLatenessEmailTemplate, generateLatenessEmailSubject } = await import('@/lib/email-templates/lateness-email')

    // Generate test email content
    const testData = {
      firstname: userData.firstname || 'Test',
      lastname: userData.lastname || 'User',
      latenessMinutes: 45,
      loginTime: '10:45',
      latenessCount: 3,
      motivationMessage: config.motivation_message || "Ne t'inquiète pas, demain sera meilleur ! 💪"
    }

    const htmlContent = generateLatenessEmailTemplate(testData)
    const subject = `[TEST] ${generateLatenessEmailSubject(45)}`

    // Decrypt password
    let smtpPassword: string
    try {
      smtpPassword = decryptPassword(config.email_password_encrypted)
    } catch (error) {
      console.error('[lateness-email] Password decryption failed:', error)
      return NextResponse.json(
        { error: 'Erreur lors du déchiffrement du mot de passe' },
        { status: 500 }
      )
    }

    // Send test email
    const result = await sendEmailToArtisan({
      type: 'intervention', // Using 'intervention' type as it's a generic email
      artisanEmail: userData.email,
      subject,
      htmlContent,
      smtpEmail: config.email_smtp,
      smtpPassword
    })

    if (!result.success) {
      return NextResponse.json(
        { error: `Échec de l'envoi: ${result.error}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: `Email de test envoyé à ${userData.email}`
    })
  } catch (error) {
    console.error('[lateness-email] POST (test) error:', error)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
