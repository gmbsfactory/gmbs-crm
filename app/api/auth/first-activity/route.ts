import { NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import {
  isLateLogin,
  getLatenessMinutes,
  normalizeArrivalTime,
  type ArrivalTime,
} from '@/lib/utils/business-days'
import { getBusinessDateString, getBusinessParts } from '@/lib/utils/business-timezone'
import { decryptPassword } from '@/lib/utils/encryption'
import { sendEmailToArtisan } from '@/lib/services/email-service'
import { generateLatenessEmailTemplate, generateLatenessEmailSubject } from '@/lib/email-templates/lateness-email'

export const runtime = 'nodejs'

/**
 * POST /api/auth/first-activity
 *
 * Detects if this is the user's first activity of the day and checks for lateness.
 * This endpoint should be called once when the app loads (managed by AuthStateListenerProvider).
 *
 * Logic:
 * 1. Check if last_activity_date is different from today
 * 2. If yes, this is the FIRST activity of the day → capture current time
 * 3. Check if this first activity time is late (after 10 AM on business day)
 * 4. If late and not already marked today, increment lateness_count
 * 5. Update last_activity_date to today
 *
 * This ensures lateness is only counted ONCE per day, based on the FIRST activity time.
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

    const userId = authUser.user.id
    const userEmail = authUser.user.email

    // Resolve user profile (try mapping first, then fallback to email)
    let profile: { id: string } | null = null

    const { data: mapping } = await supabase
      .from('auth_user_mapping')
      .select('public_user_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    if (mapping?.public_user_id) {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('id', mapping.public_user_id)
        .maybeSingle()
      profile = data
    } else if (userEmail) {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('email', userEmail)
        .maybeSingle()
      profile = data
    }

    if (!profile) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    // Fetch user data including lateness tracking, roles, and user info for email
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('firstname, lastname, email, last_activity_date, lateness_count, lateness_count_year, last_lateness_date, lateness_email_sent_at, user_roles(roles(name))')
      .eq('id', profile.id)
      .single()

    if (userDataError) {
      console.error('[first-activity] ❌ Error fetching user data:', userDataError)
      return NextResponse.json({ error: userDataError.message }, { status: 500 })
    }

    if (!userData) {
      return NextResponse.json({ error: 'user data not found' }, { status: 404 })
    }

    const now = new Date()
    // Journee metier = journee a Paris, jamais le fuseau du process (UTC en prod)
    const today = getBusinessDateString(now) // YYYY-MM-DD in Europe/Paris
    const currentYear = Number(today.slice(0, 4))

    const lastActivityDate = userData.last_activity_date

    // Check if this is the first activity of the day
    const isFirstActivityOfDay = !lastActivityDate || lastActivityDate !== today

    if (!isFirstActivityOfDay) {
      // Already had activity today, nothing to do
      return NextResponse.json({
        ok: true,
        wasFirstActivity: false,
        latenessCount: userData.lateness_count || 0
      })
    }

    // This IS the first activity of the day!

    // Notification de retard a envoyer UNE FOIS l'ecriture confirmee.
    // L'update ci-dessous est atomique (conditionne sur last_activity_date) :
    // un seul appel concurrent le gagne, et c'est lui — et lui seul — qui envoie
    // le mail. Envoyer avant l'update exposerait a des doublons entre onglets.
    let pendingLatenessEmail: (() => Promise<void>) | null = null

    // Build the patch object
    const patch: any = {
      last_activity_date: today,
      last_seen_at: now.toISOString()
    }

    // Exclude admin/manager from lateness tracking
    const roles = (userData.user_roles || [])
      .map((r: any) => r.roles?.name?.toLowerCase())
      .filter((name): name is string => typeof name === 'string')
    const isAdminOrManager = roles.includes('admin') || roles.includes('manager')

    if (!isAdminOrManager) {
      // Reset counter if year has changed
      if (userData.lateness_count_year !== currentYear) {
        patch.lateness_count = 0
        patch.lateness_count_year = currentYear
        patch.last_lateness_date = null
      }

      // La config porte l'heure limite d'arrivee : elle doit etre lue AVANT de
      // decider du retard, pas seulement au moment de rediger l'email.
      const latenessConfig = await fetchLatenessConfig()
      const arrivalTime = latenessConfig.arrivalTime

      // Check if this first activity time is late
      const isLate = isLateLogin(now, arrivalTime)

      if (isLate) {
        const lastLatenessDate = userData.last_lateness_date

        // Only count if not already marked late today (extra safety check)
        if (!lastLatenessDate || lastLatenessDate !== today) {
          // Use patch.lateness_count if already set by year reset, otherwise use userData.lateness_count
          const currentCount = patch.lateness_count !== undefined
            ? patch.lateness_count
            : (userData.lateness_count_year === currentYear ? (userData.lateness_count || 0) : 0)

          const newLatenessCount = currentCount + 1
          patch.lateness_count = newLatenessCount
          patch.lateness_count_year = currentYear
          patch.last_lateness_date = today

          // Differe : envoye seulement si l'update atomique reussit (voir plus bas)
          pendingLatenessEmail = () =>
            sendLatenessEmail(
              profile!.id,
              userData.firstname || '',
              userData.lastname || '',
              userData.email || '',
              now,
              newLatenessCount,
              userData.lateness_email_sent_at,
              today,
              latenessConfig
            )
        }
      }
    }

    // Update user record with atomic conditional update to prevent race conditions
    // Only update if last_activity_date is NULL or different from today (atomic check)
    // This ensures that even if multiple requests arrive simultaneously, only one will succeed
    // Use admin client to bypass RLS since users don't have permission to update lateness fields
    const adminSupabase = createServerSupabaseAdmin()
    let updateQuery = adminSupabase
      .from('users')
      .update(patch)
      .eq('id', profile.id)

    // Add condition: only update if last_activity_date is NULL or different from today
    if (lastActivityDate === null) {
      updateQuery = updateQuery.is('last_activity_date', null)
    } else {
      updateQuery = updateQuery.neq('last_activity_date', today)
    }

    const { data: updatedData, error: updateError } = await updateQuery
      .select('lateness_count, last_activity_date')
      .single()

    // Handle race condition: if update affected 0 rows, another request already processed it
    if (updateError) {
      // PGRST116 means "0 rows" - this is a race condition, not a real error
      if (updateError.code === 'PGRST116' || updateError.message?.includes('0 rows')) {
        // Fetch the current state to return accurate data
        const { data: currentData } = await adminSupabase
          .from('users')
          .select('lateness_count')
          .eq('id', profile.id)
          .single()

        return NextResponse.json({
          ok: true,
          wasFirstActivity: false, // Another request already handled it
          latenessCount: currentData?.lateness_count || userData.lateness_count || 0
        })
      }

      // Real error, log and return
      console.error('[first-activity] ❌ Error updating user:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Check if the update actually happened (race condition protection)
    // If updatedData is null or last_activity_date wasn't updated, another request already processed it
    if (!updatedData || updatedData.last_activity_date !== today) {
      // Fetch the current state to return accurate data
      const { data: currentData } = await adminSupabase
        .from('users')
        .select('lateness_count')
        .eq('id', profile.id)
        .single()

      return NextResponse.json({
        ok: true,
        wasFirstActivity: false, // Another request already handled it
        latenessCount: currentData?.lateness_count || userData.lateness_count || 0
      })
    }

    // L'ecriture est confirmee et cet appel a gagne la course : c'est le seul
    // autorise a notifier. On attend l'envoi plutot que de le laisser flotter —
    // en serverless, une promesse non attendue est tuee avec la reponse.
    if (pendingLatenessEmail) {
      await (pendingLatenessEmail as () => Promise<void>)().catch((err) => {
        console.error('[first-activity] ❌ Failed to send lateness email:', err)
      })
    }

    return NextResponse.json({
      ok: true,
      wasFirstActivity: true,
      latenessCount: patch.lateness_count ?? userData.lateness_count ?? 0
    })
  } catch (error) {
    console.error('[first-activity] 💥 Unexpected error:', error)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 }
    )
  }
}

/** Configuration unique du suivi des retards, normalisee et prete a l'emploi. */
interface LatenessConfig {
  /** Heure limite d'arrivee, en heure de Paris */
  arrivalTime: ArrivalTime
  isEnabled: boolean
  smtpEmail: string | null
  smtpPasswordEncrypted: string | null
  motivationMessage: string
}

const DEFAULT_MOTIVATION_MESSAGE = "Ne t'inquiète pas, demain sera meilleur ! 💪"

/**
 * Lit la configuration unique des retards.
 *
 * Toujours resolue, meme en l'absence de ligne ou en cas d'erreur : l'heure
 * limite retombe alors sur 10h00, ce qui preserve le comportement historique
 * plutot que de desactiver silencieusement le suivi.
 */
async function fetchLatenessConfig(): Promise<LatenessConfig> {
  const fallback: LatenessConfig = {
    arrivalTime: normalizeArrivalTime(null),
    isEnabled: false,
    smtpEmail: null,
    smtpPasswordEncrypted: null,
    motivationMessage: DEFAULT_MOTIVATION_MESSAGE,
  }

  const adminSupabase = createServerSupabaseAdmin()
  const { data, error } = await adminSupabase
    .from('lateness_email_config')
    .select('email_smtp, email_password_encrypted, is_enabled, motivation_message, arrival_hour, arrival_minute')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[first-activity] 📧 Error fetching email config:', error)
    return fallback
  }

  if (!data) {
    return fallback
  }

  return {
    arrivalTime: normalizeArrivalTime({ hour: data.arrival_hour, minute: data.arrival_minute }),
    isEnabled: Boolean(data.is_enabled),
    smtpEmail: data.email_smtp ?? null,
    smtpPasswordEncrypted: data.email_password_encrypted ?? null,
    motivationMessage: data.motivation_message || DEFAULT_MOTIVATION_MESSAGE,
  }
}

/**
 * Sends a lateness notification email to the user.
 * This function runs asynchronously and doesn't block the main response.
 */
async function sendLatenessEmail(
  userId: string,
  firstname: string,
  lastname: string,
  userEmail: string,
  loginTime: Date,
  latenessCount: number,
  lastEmailSentAt: string | null,
  today: string,
  config: LatenessConfig
): Promise<void> {
  try {
    // Check if email was already sent today
    if (lastEmailSentAt) {
      const lastSentDate = getBusinessDateString(new Date(lastEmailSentAt))
      if (lastSentDate === today) {
        return
      }
    }

    // Check if user has an email
    if (!userEmail) {
      return
    }

    // Config deja lue en amont (elle porte l'heure limite d'arrivee)
    if (!config.isEnabled) {
      return
    }

    if (!config.smtpEmail || !config.smtpPasswordEncrypted) {
      return
    }

    // Retard en minutes par rapport a l'heure d'arrivee configuree (Paris).
    // Meme fonction que celle qui a decide du retard : aucune divergence possible.
    const latenessMinutes = getLatenessMinutes(loginTime, config.arrivalTime)

    const { hours, minutes } = getBusinessParts(loginTime)

    // Format login time
    const loginTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

    // Decrypt password
    let smtpPassword: string
    try {
      smtpPassword = decryptPassword(config.smtpPasswordEncrypted)
    } catch (error) {
      console.error('[first-activity] 📧 Failed to decrypt email password:', error)
      return
    }

    // Generate email content
    const emailData = {
      firstname: firstname || 'Utilisateur',
      lastname: lastname || '',
      latenessMinutes,
      loginTime: loginTimeStr,
      latenessCount,
      motivationMessage: config.motivationMessage
    }

    const htmlContent = generateLatenessEmailTemplate(emailData)
    const subject = generateLatenessEmailSubject(latenessMinutes)

    // Send email
    const result = await sendEmailToArtisan({
      type: 'intervention', // Using 'intervention' type as it's a generic email
      artisanEmail: userEmail,
      subject,
      htmlContent,
      smtpEmail: config.smtpEmail,
      smtpPassword
    })

    if (!result.success) {
      console.error('[first-activity] 📧 Failed to send email:', result.error)
      return
    }

    // Update user record to mark email as sent
    const adminSupabase = createServerSupabaseAdmin()
    const { error: updateError } = await adminSupabase
      .from('users')
      .update({ lateness_email_sent_at: new Date().toISOString() })
      .eq('id', userId)

    if (updateError) {
      console.error('[first-activity] 📧 Failed to update lateness_email_sent_at:', updateError)
    }
  } catch (error) {
    console.error('[first-activity] 📧 Unexpected error sending lateness email:', error)
  }
}
