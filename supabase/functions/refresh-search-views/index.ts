// ===== REFRESH SEARCH VIEWS - Event-Driven avec Debounce =====
//
// Cette Edge Function est appelée par un Database Webhook Supabase
// quand les tables sources sont modifiées. Elle rafraîchit les vues
// matérialisées avec un debounce intelligent.
//
// Architecture:
// 1. Database Webhook détecte INSERT/UPDATE/DELETE sur les tables
// 2. Cette fonction reçoit l'événement
// 3. Appelle la fonction RPC pour rafraîchir les vues
//
// Note: Le debounce côté Edge Function est limité car chaque invocation
// peut être sur une instance différente. Le vrai debounce est géré
// par la table search_views_refresh_flags côté PostgreSQL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Tables qui déclenchent le refresh des interventions
const INTERVENTION_TABLES = [
  'interventions',
  'intervention_artisans',
  'comments',
  'agencies',
  'tenants',
  'owner',
]

// Tables qui déclenchent le refresh des artisans
const ARTISAN_TABLES = [
  'artisans',
  'artisan_metiers',
  'artisan_zones',
]

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown>
  old_record?: Record<string, unknown>
}

Deno.serve(async (req) => {
  // Gérer CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  // Seules les requêtes POST sont acceptées
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Créer un client Supabase avec la service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const payload: WebhookPayload = await req.json()
    console.log(`[refresh-search-views] Received ${payload.type} on ${payload.schema}.${payload.table}`)

    // Déterminer quelles vues rafraîchir
    const refreshInterventions = INTERVENTION_TABLES.includes(payload.table) || payload.table === 'artisans'
    const refreshArtisans = ARTISAN_TABLES.includes(payload.table)

    if (!refreshInterventions && !refreshArtisans) {
      return new Response(
        JSON.stringify({ message: 'Table not monitored', table: payload.table }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const startTime = Date.now()
    const refreshedViews: string[] = []
    const errors: string[] = []

    // Appeler la fonction RPC qui gère le refresh avec debounce intégré
    const { data, error } = await supabase.rpc('refresh_search_views_debounced', {
      p_refresh_interventions: refreshInterventions,
      p_refresh_artisans: refreshArtisans
    })

    if (error) {
      console.error('[refresh-search-views] RPC error:', error)
      errors.push(error.message)
    } else {
      console.log('[refresh-search-views] RPC result:', data)
      if (data?.refreshed_views) {
        refreshedViews.push(...data.refreshed_views)
      }
    }

    const duration = Date.now() - startTime

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        trigger: { type: payload.type, table: payload.table },
        refreshedViews,
        errors,
        durationMs: duration
      }),
      { status: errors.length === 0 ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[refresh-search-views] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
