import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAnyPermission, isPermissionError } from '@/lib/api/permissions'

export const runtime = 'nodejs'

/**
 * GET /api/targets
 * Récupère tous les objectifs de gestionnaires
 * Nécessite les permissions manage_settings ou view_comptabilite
 */
export async function GET(req: Request) {
  try {
    // Vérifier les permissions (manage_settings ou view_comptabilite)
    const permCheck = await requireAnyPermission(req, ["manage_settings", "view_comptabilite"])
    if (isPermissionError(permCheck)) return permCheck.error

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
    }

    // Récupérer tous les objectifs
    const { data, error } = await supabaseAdmin
      .from('gestionnaire_targets')
      .select('*')
      .order('user_id', { ascending: true })
      .order('period_type', { ascending: true })

    if (error) {
      console.error('[targets] Erreur lors de la récupération:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (e: any) {
    console.error('[targets] Erreur inattendue:', e)
    return NextResponse.json({ error: e?.message || 'Erreur inattendue' }, { status: 500 })
  }
}

/**
 * POST /api/targets
 * Crée ou met à jour un objectif de gestionnaire
 * Nécessite les permissions manage_settings ou view_comptabilite
 */
export async function POST(req: Request) {
  try {
    // Vérifier les permissions (manage_settings ou view_comptabilite)
    const permCheck = await requireAnyPermission(req, ["manage_settings", "view_comptabilite"])
    if (isPermissionError(permCheck)) return permCheck.error

    const userId = permCheck.user.id

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
    }

    // Lire le body de la requête
    const body = await req.json().catch(() => ({}))
    const { user_id, period_type, margin_target, performance_target } = body

    // Validation
    if (!user_id) {
      return NextResponse.json({ error: 'user_id est requis' }, { status: 400 })
    }
    if (!period_type) {
      return NextResponse.json({ error: 'period_type est requis' }, { status: 400 })
    }
    if (margin_target === undefined || margin_target === null) {
      return NextResponse.json({ error: 'margin_target est requis' }, { status: 400 })
    }

    // Vérifier si l'objectif existe déjà
    const { data: existing } = await supabaseAdmin
      .from('gestionnaire_targets')
      .select('id')
      .eq('user_id', user_id)
      .eq('period_type', period_type)
      .maybeSingle()

    let result
    if (existing) {
      // Mise à jour
      const { data, error } = await supabaseAdmin
        .from('gestionnaire_targets')
        .update({
          margin_target,
          performance_target: performance_target ?? 40,
          created_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('[targets] Erreur lors de la mise à jour:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      result = data
    } else {
      // Insertion
      const { data, error } = await supabaseAdmin
        .from('gestionnaire_targets')
        .insert({
          user_id,
          period_type,
          margin_target,
          performance_target: performance_target ?? 40,
          created_by: userId,
        })
        .select()
        .single()

      if (error) {
        console.error('[targets] Erreur lors de la création:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      result = data
    }

    return NextResponse.json({ data: result })
  } catch (e: any) {
    console.error('[targets] Erreur inattendue:', e)
    return NextResponse.json({ error: e?.message || 'Erreur inattendue' }, { status: 500 })
  }
}

