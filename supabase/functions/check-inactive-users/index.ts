import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Supabase Edge Function: check-inactive-users
 *
 * Ce worker s'exécute périodiquement (toutes les 60s via cron) et:
 * 1. Trouve tous les utilisateurs avec status='connected' ou 'busy' ou 'dnd'
 * 2. Vérifie si leur last_seen_at > 90 secondes
 * 3. Met leur status à 'offline' automatiquement
 *
 * Cela permet de détecter les déconnexions même si:
 * - L'onglet a crashé
 * - Le processus a été tué (kill -9)
 * - Le réseau a été coupé brutalement
 * - Les événements beforeunload/pagehide n'ont pas été déclenchés
 *
 * Système inspiré de Teams/Skype/Slack
 */

const INACTIVITY_THRESHOLD = 90 // 90 secondes (3x le heartbeat de 30s)

Deno.serve(async (req) => {
  try {
    // Vérifier que c'est un appel authentifié (cron job ou admin)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.includes(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Créer un client Supabase avec la service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculer le timestamp de seuil (now - 90 secondes)
    const thresholdDate = new Date(Date.now() - INACTIVITY_THRESHOLD * 1000)
    const thresholdISO = thresholdDate.toISOString()

    console.log(`[check-inactive-users] Checking for users inactive since ${thresholdISO}`)

    // Trouver tous les utilisateurs qui:
    // - Ont un status actif (connected, busy, dnd)
    // - N'ont pas envoyé de heartbeat depuis plus de 90 secondes
    const { data: inactiveUsers, error: selectError } = await supabase
      .from('users')
      .select('id, email, username, last_seen_at, status')
      .in('status', ['connected', 'busy', 'dnd'])
      .lt('last_seen_at', thresholdISO)

    if (selectError) {
      console.error('[check-inactive-users] Select error:', selectError)
      return new Response(
        JSON.stringify({ error: 'Failed to query users', details: selectError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log('[check-inactive-users] No inactive users found')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No inactive users found',
          checked_at: new Date().toISOString()
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[check-inactive-users] Found ${inactiveUsers.length} inactive user(s)`)

    // Mettre à jour tous les utilisateurs inactifs en une seule requête
    const userIds = inactiveUsers.map(u => u.id)
    const { error: updateError } = await supabase
      .from('users')
      .update({ status: 'offline' })
      .in('id', userIds)

    if (updateError) {
      console.error('[check-inactive-users] Update error:', updateError)
      return new Response(
        JSON.stringify({
          error: 'Failed to update users',
          details: updateError.message,
          affected_users: inactiveUsers.length
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Log détaillé pour debugging
    inactiveUsers.forEach(user => {
      const lastSeenDate = new Date(user.last_seen_at)
      const inactiveDuration = Math.floor((Date.now() - lastSeenDate.getTime()) / 1000)
      console.log(
        `[check-inactive-users] Set offline: ${user.email || user.username || user.id} ` +
        `(inactive for ${inactiveDuration}s, last seen: ${user.last_seen_at})`
      )
    })

    return new Response(
      JSON.stringify({
        success: true,
        users_set_offline: inactiveUsers.length,
        users: inactiveUsers.map(u => ({
          id: u.id,
          email: u.email,
          username: u.username,
          last_seen_at: u.last_seen_at,
          previous_status: u.status
        })),
        checked_at: new Date().toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[check-inactive-users] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
