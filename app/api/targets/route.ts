import { NextResponse } from 'next/server'
import { createServerSupabase, bearerFrom } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

/**
 * GET /api/targets
 * Récupère tous les objectifs de gestionnaires
 * Nécessite les permissions admin ou manager
 */
export async function GET(req: Request) {
  try {
    // Obtenir le token d'authentification
    let token = bearerFrom(req)
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get('sb-access-token')?.value || null
    }

    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Obtenir l'ID de l'utilisateur depuis Supabase Auth
    const supabase = createServerSupabase(token)
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser?.user?.id) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 401 })
    }

    const userId = authUser.user.id

    // Vérifier les permissions (admin ou manager)
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
    }

    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(
          id,
          name
        )
      `)
      .eq('user_id', userId)

    if (rolesError) {
      console.error('[targets] Erreur lors de la vérification des rôles:', rolesError)
      return NextResponse.json({ error: 'Erreur lors de la vérification des permissions' }, { status: 500 })
    }

    const hasPermission = userRoles?.some((ur: any) => {
      const roleName = ur.roles?.name?.toLowerCase()
      return roleName === 'admin' || roleName === 'manager'
    })

    if (!hasPermission) {
      return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
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
 * Nécessite les permissions admin ou manager
 */
export async function POST(req: Request) {
  try {
    // Obtenir le token d'authentification
    let token = bearerFrom(req)
    if (!token) {
      const cookieStore = await cookies()
      token = cookieStore.get('sb-access-token')?.value || null
    }

    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Obtenir l'ID de l'utilisateur depuis Supabase Auth
    const supabase = createServerSupabase(token)
    const { data: authUser, error: authError } = await supabase.auth.getUser()
    
    if (authError || !authUser?.user?.id) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 401 })
    }

    const userId = authUser.user.id

    // Vérifier les permissions (admin ou manager)
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Configuration Supabase manquante' }, { status: 500 })
    }

    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select(`
        role_id,
        roles!inner(
          id,
          name
        )
      `)
      .eq('user_id', userId)

    if (rolesError) {
      console.error('[targets] Erreur lors de la vérification des rôles:', rolesError)
      return NextResponse.json({ error: 'Erreur lors de la vérification des permissions' }, { status: 500 })
    }

    const hasPermission = userRoles?.some((ur: any) => {
      const roleName = ur.roles?.name?.toLowerCase()
      return roleName === 'admin' || roleName === 'manager'
    })

    if (!hasPermission) {
      return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
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

