import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom} from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { isLateLogin } from '@/lib/utils/business-days'
import { isSameDay } from '@/lib/date-utils'

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

    console.log('[first-activity] 🔍 Checking first activity for user:', profile.id)

    // Fetch user data including lateness tracking and roles
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('last_activity_date, lateness_count, lateness_count_year, last_lateness_date, user_roles(roles(name))')
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
    const today = now.toISOString().split('T')[0] // YYYY-MM-DD
    const currentYear = now.getFullYear()

    const lastActivityDate = userData.last_activity_date

    console.log('[first-activity] 📅 Last activity date:', lastActivityDate)
    console.log('[first-activity] 📅 Today:', today)

    // Check if this is the first activity of the day
    const isFirstActivityOfDay = !lastActivityDate || lastActivityDate !== today

    if (!isFirstActivityOfDay) {
      // Already had activity today, nothing to do
      console.log('[first-activity] ✅ Already had activity today, skipping')
      return NextResponse.json({
        ok: true,
        wasFirstActivity: false,
        latenessCount: userData.lateness_count || 0
      })
    }

    // This IS the first activity of the day!
    console.log('[first-activity] 🎯 First activity of the day detected!')

    const patch: any = {
      last_activity_date: today,
      last_seen_at: now.toISOString()
    }

    // Exclude admin/manager from lateness tracking
    const roles = userData.user_roles?.map((r: any) => r.role?.toLowerCase()) || []
    const isAdminOrManager = roles.includes('admin') || roles.includes('manager')

    console.log('[first-activity] 👤 Roles:', roles)
    console.log('[first-activity] 🚫 Is admin/manager:', isAdminOrManager)

    if (!isAdminOrManager) {
      // Reset counter if year has changed
      if (userData.lateness_count_year !== currentYear) {
        console.log('[first-activity] 📆 Year changed, resetting counter')
        patch.lateness_count = 0
        patch.lateness_count_year = currentYear
        patch.last_lateness_date = null
      }

      // Check if this first activity time is late
      const isLate = isLateLogin(now)
      console.log('[first-activity] ⏰ Is late login:', isLate)

      if (isLate) {
        const lastLatenessDate = userData.last_lateness_date

        console.log('[first-activity] 📅 Last lateness date:', lastLatenessDate)

        // Only count if not already marked late today (extra safety check)
        if (!lastLatenessDate || lastLatenessDate !== today) {
          const currentCount = patch.lateness_count_year === currentYear || userData.lateness_count_year === currentYear
            ? (userData.lateness_count || 0)
            : 0

          const newLatenessCount = currentCount + 1
          patch.lateness_count = newLatenessCount
          patch.lateness_count_year = currentYear
          patch.last_lateness_date = today

          console.log('[first-activity] ✅ INCREMENTING lateness count to:', newLatenessCount)
          console.log('[first-activity] 📦 Patch object:', patch)
        } else {
          console.log('[first-activity] ⚠️ Already marked late today (should not happen)')
        }
      } else {
        console.log('[first-activity] ✅ Not a late login')
      }
    } else {
      console.log('[first-activity] 🚫 Admin/Manager, skipping lateness tracking')
    }

    // Update user record
    const { error: updateError } = await supabase
      .from('users')
      .update(patch)
      .eq('id', profile.id)

    if (updateError) {
      console.error('[first-activity] ❌ Error updating user:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    console.log('[first-activity] ✅ Successfully updated user')

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
