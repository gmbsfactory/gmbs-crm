import { NextRequest, NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import {
  convertToCSV,
  formatDate,
  type InterventionRow,
  type InterventionCost,
} from '@/utils/import-export/intervention-csv'

type CostRow = InterventionCost & { intervention_id: string }

export const runtime = 'nodejs'

type UserContext = { appUserId: string | null; isAdmin: boolean }

async function resolveUserContext(supabase: any, authUserId: string, authEmail: string | null): Promise<UserContext> {
  // Tenter via auth_user_mapping
  const mapping = await supabase
    .from('auth_user_mapping')
    .select('public_user_id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  let appUserId: string | null = mapping?.data?.public_user_id ?? null

  // Fallback: lookup par email
  if (!appUserId && authEmail) {
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('email', authEmail)
      .maybeSingle()
    appUserId = userRow?.id ?? null
  }

  if (!appUserId) return { appUserId: null, isAdmin: false }

  const { data: rolesRows } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', appUserId)

  const isAdmin = (rolesRows ?? []).some(
    (r: any) => typeof r?.roles?.name === 'string' && r.roles.name.toLowerCase().includes('admin')
  )

  return { appUserId, isAdmin }
}

export async function GET(req: NextRequest) {
  // Permission gate (cf. spec §8.3 + migration 00099)
  const permCheck = await requirePermission(req, 'export_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const supabase = await createSSRServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { appUserId, isAdmin } = await resolveUserContext(supabase, user.id, user.email ?? null)

  if (!appUserId) {
    return NextResponse.json({ error: 'Utilisateur applicatif introuvable' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  const userIdsParam = searchParams.get('userIds')
  const extended = searchParams.get('extended') === '1' || searchParams.get('extended') === 'true'

  // Périmètre utilisateurs
  const requested = (userIdsParam ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  let scopeUserIds: string[]
  if (isAdmin) {
    scopeUserIds = requested.length > 0 ? requested : [appUserId]
  } else {
    // Non-admin: toujours restreindre à soi, peu importe le param
    scopeUserIds = [appUserId]
  }

  let query = supabase
    .from('interventions')
    .select(
      `
      *,
      agencies!agence_id(label),
      tenants!tenant_id(firstname, lastname, plain_nom_client, telephone, email),
      owner!owner_id(plain_nom_facturation, telephone, email),
      users!assigned_user_id(username),
      intervention_statuses!statut_id(label),
      metiers!metier_id(label)
    `
    )
    .in('assigned_user_id', scopeUserIds)
    .order('created_at', { ascending: true })

  if (start) {
    query = query.gte('created_at', start)
  }
  let endBound: string | null = null
  if (end) {
    // FIX: build the upper bound as a pure date string (UTC-safe) to avoid
    // the timezone shift that previously rolled "end = today" back to today
    // and excluded interventions created the same day.
    const [y, m, d] = end.split('-').map(Number)
    const next = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1))
    next.setUTCDate(next.getUTCDate() + 1)
    endBound = next.toISOString().split('T')[0]
    query = query.lt('created_at', endBound)
  }

  const { data: interventions, error } = await query

  // --- Diagnostics: isolate whether 0 rows is RLS, scope, or date ---
  const probeAll = await supabase
    .from('interventions')
    .select('id, id_inter, assigned_user_id, created_at', { count: 'exact', head: false })
    .order('created_at', { ascending: false })
    .limit(5)

  const probeScope = await supabase
    .from('interventions')
    .select('id, id_inter, assigned_user_id, created_at', { count: 'exact', head: false })
    .in('assigned_user_id', scopeUserIds)
    .order('created_at', { ascending: false })
    .limit(5)

  console.log('[exports/interventions] probeAll', {
    visibleCount: probeAll.count,
    error: probeAll.error?.message ?? null,
    sample: (probeAll.data ?? []).map((i: any) => ({
      id_inter: i.id_inter,
      assigned_user_id: i.assigned_user_id,
      created_at: i.created_at,
    })),
  })
  console.log('[exports/interventions] probeScope (no date filter)', {
    matchCount: probeScope.count,
    error: probeScope.error?.message ?? null,
    sample: (probeScope.data ?? []).map((i: any) => ({
      id_inter: i.id_inter,
      assigned_user_id: i.assigned_user_id,
      created_at: i.created_at,
    })),
  })

  console.log('[exports/interventions] params', {
    appUserId,
    isAdmin,
    scopeUserIds,
    start,
    end,
    endBound,
    extended,
    rowCount: interventions?.length ?? 0,
    sample: (interventions ?? []).slice(0, 3).map((i: any) => ({
      id: i.id,
      id_inter: i.id_inter,
      assigned_user_id: i.assigned_user_id,
      created_at: i.created_at,
    })),
    error: error?.message ?? null,
  })

  if (error) {
    console.error('[exports/interventions] query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = interventions ?? []

  if (list.length === 0) {
    return buildCsvResponse(convertToCSV([], { extended }))
  }

  const ids = list.map((i: any) => i.id as string)

  // Artisans : on récupère primaire ET secondaire (max 2 par intervention).
  const { data: artisansRows } = await supabase
    .from('intervention_artisans')
    .select('intervention_id, is_primary, role, artisans(plain_nom, telephone)')
    .in('intervention_id', ids)
    .order('is_primary', { ascending: false })

  const artisanMap = new Map<string, { primary: string; secondary: string; primaryPhone: string }>()
  for (const row of (artisansRows ?? []) as any[]) {
    const entry = artisanMap.get(row.intervention_id) ?? { primary: '', secondary: '', primaryPhone: '' }
    const name = row.artisans?.plain_nom || ''
    const phone = row.artisans?.telephone || ''
    if (row.is_primary && !entry.primary) {
      entry.primary = name
      entry.primaryPhone = phone
    } else if (!entry.secondary) {
      entry.secondary = name
    }
    artisanMap.set(row.intervention_id, entry)
  }

  // Coûts : on garde artisan_order pour permettre la ventilation
  // SST/COÛT MATERIEL (primaire) vs SST 2/COÛT MATERIEL 2 (secondaire).
  const { data: costsRows } = await supabase
    .from('intervention_costs')
    .select('intervention_id, cost_type, amount, artisan_order')
    .in('intervention_id', ids)

  const costsMap = new Map<string, InterventionCost[]>()
  for (const row of (costsRows ?? []) as CostRow[]) {
    const arr = costsMap.get(row.intervention_id) ?? []
    arr.push({
      cost_type: row.cost_type,
      amount: row.amount,
      artisan_order: row.artisan_order ?? null,
    })
    costsMap.set(row.intervention_id, arr)
  }

  // Commentaires internes : inclus dans le format de base (colonne COMMENTAIRE).
  const commentsMap = new Map<string, string>()
  {
    const { data: commentsRows } = await supabase
      .from('comments')
      .select('entity_id, content, created_at')
      .eq('entity_type', 'intervention')
      .in('entity_id', ids)
      .eq('is_internal', true)
      .order('created_at', { ascending: false })

    for (const row of (commentsRows ?? []) as any[]) {
      const segment = `[${formatDate(row.created_at)}] ${row.content}`
      const existing = commentsMap.get(row.entity_id)
      commentsMap.set(row.entity_id, existing ? `${existing} || ${segment}` : segment)
    }
  }

  const rows: InterventionRow[] = list.map((i: any) => {
    const artisans = artisanMap.get(i.id) ?? { primary: '', secondary: '', primaryPhone: '' }
    return {
      created_at: i.created_at,
      id_inter: i.id_inter,
      adresse: i.adresse,
      contexte_intervention: i.contexte_intervention,
      numero_sst: artisans.primaryPhone,
      pourcentage_sst: i.pourcentage_sst,
      date_prevue: i.date_prevue,
      artisan_primary: artisans.primary,
      artisan_secondary: artisans.secondary,
      costs: costsMap.get(i.id) || [],
      agencies: i.agencies,
      tenants: i.tenants,
      owner: i.owner,
      metiers: i.metiers,
      // Champs étendus (ignorés en mode standard) :
      intervention_statuses: i.intervention_statuses,
      users: i.users,
      commentaires: commentsMap.get(i.id) || '',
    }
  })

  return buildCsvResponse(convertToCSV(rows, { extended }))
}

function buildCsvResponse(csv: string): NextResponse {
  const BOM = '﻿'
  return new NextResponse(BOM + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment',
    },
  })
}
