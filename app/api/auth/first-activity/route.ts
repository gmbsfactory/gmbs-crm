import { NextResponse } from 'next/server'
import { createServerSupabase, createServerSupabaseAdmin, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { isLateLogin } from '@/lib/utils/business-days'
import { getLocalDateString } from '@/lib/date-utils'
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
export async function POST(req: Request) {
  try {
    // Get authentication token
    let token = bearerFrom(req)
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get('sb-access-token')?.value || null
    }

    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabase(token)

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
    const today = getLocalDateString(now) // YYYY-MM-DD in local timezone
    const currentYear = now.getFullYear()

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

      // Check if this first activity time is late
      const isLate = isLateLogin(now)

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

          // Send lateness notification email (async, non-blocking)
          sendLatenessEmail(
            profile.id,
            userData.firstname || '',
            userData.lastname || '',
            userData.email || '',
            now,
            newLatenessCount,
            userData.lateness_email_sent_at,
            today
          ).catch((err) => {
            console.error('[first-activity] ❌ Failed to send lateness email:', err)
          })
        } else {
        }
      } else {
      }
    } else {
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
  today: string
): Promise<void> {
  try {
    // Check if email was already sent today
    if (lastEmailSentAt) {
      const lastSentDate = getLocalDateString(new Date(lastEmailSentAt))
      if (lastSentDate === today) {
        return
      }
    }

    // Check if user has an email
    if (!userEmail) {
      return
    }

    // Get lateness email configuration using admin client
    const adminSupabase = createServerSupabaseAdmin()
    const { data: config, error: configError } = await adminSupabase
      .from('lateness_email_config')
      .select('email_smtp, email_password_encrypted, is_enabled, motivation_message')
      .limit(1)
      .maybeSingle()

    if (configError) {
      console.error('[first-activity] 📧 Error fetching email config:', configError)
      return
    }

    if (!config) {
      return
    }

    if (!config.is_enabled) {
      return
    }

    if (!config.email_smtp || !config.email_password_encrypted) {
      return
    }

    // Calculate lateness in minutes (time since 10:00 AM)
    const hours = loginTime.getHours()
    const minutes = loginTime.getMinutes()
    const latenessMinutes = (hours - 10) * 60 + minutes

    // Format login time
    const loginTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`

    // Decrypt password
    let smtpPassword: string
    try {
      smtpPassword = decryptPassword(config.email_password_encrypted)
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
      motivationMessage: config.motivation_message || "Ne t'inquiète pas, demain sera meilleur ! 💪"
    }

    const htmlContent = generateLatenessEmailTemplate(emailData)
    const subject = generateLatenessEmailSubject(latenessMinutes)

    // Send email
    const result = await sendEmailToArtisan({
      type: 'intervention', // Using 'intervention' type as it's a generic email
      artisanEmail: userEmail,
      subject,
      htmlContent,
      smtpEmail: config.email_smtp,
      smtpPassword
    })

    if (!result.success) {
      console.error('[first-activity] 📧 Failed to send email:', result.error)
      return
    }

    // Update user record to mark email as sent
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
