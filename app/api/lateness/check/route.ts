import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { getLocalDateString } from '@/lib/date-utils'

export const runtime = 'nodejs'

/**
 * GET /api/lateness/check
 *
 * Checks if user was late today and returns lateness data.
 * Automatically marks notification as shown if it should be displayed.
 * Used by dashboard to show toast notification.
 */
export async function GET(req: Request) {
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

    // Fetch lateness data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('lateness_count, last_lateness_date, lateness_notification_shown_at, user_roles(roles(name))')
      .eq('id', profile.id)
      .single()

    if (userError) {
      console.error('[lateness/check] Error fetching user data:', userError)
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    if (!userData) {
      return NextResponse.json({
        showNotification: false,
        latenessCount: 0,
        lastLatenessDate: null
      })
    }

    const now = new Date()
    const today = getLocalDateString(now) // YYYY-MM-DD in local timezone
    const lastLatenessDate = userData.last_lateness_date || null
    const notificationShownAt = userData.lateness_notification_shown_at
      ? new Date(userData.lateness_notification_shown_at)
      : null

    // Check if user was late today (compare date strings for consistency)
    const wasLateToday = lastLatenessDate && lastLatenessDate === today

    // Check if notification has been shown today (compare date strings for consistency)
    const notificationShownToday = notificationShownAt && getLocalDateString(notificationShownAt) === today

    // Show notification if late today and not yet shown
    const showNotification = wasLateToday && !notificationShownToday

    // Check if user is admin
    const roles = (userData.user_roles || [])
      .map((r: any) => r.roles?.name?.toLowerCase())
      .filter((name): name is string => typeof name === 'string')
    const isAdmin = roles.includes('admin')

    // Automatically mark notification as shown if we're going to show it
    // This eliminates the need for a separate /acknowledge endpoint
    if (showNotification) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ lateness_notification_shown_at: now.toISOString() })
        .eq('id', profile.id)

      if (updateError) {
        console.error('[lateness/check] Error marking notification as shown:', updateError)
        // Continue anyway - we still return showNotification: true
      }
    }

    return NextResponse.json({
      showNotification,
      latenessCount: userData.lateness_count || 0,
      lastLatenessDate: userData.last_lateness_date,
      isAdmin
    })
  } catch (error) {
    console.error('[lateness/check] Unexpected error:', error)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 }
    )
  }
}
