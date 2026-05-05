import { NextRequest, NextResponse } from 'next/server'
import { createSSRServerClient } from '@/lib/supabase/server-ssr'
import {
  convertToCSV,
  formatDate,
  type InterventionRow,
  type InterventionCost,
} from '@/utils/import-export/intervention-csv'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const supabase = await createSSRServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start') // YYYY-MM-DD, optionnel
  const end = searchParams.get('end') // YYYY-MM-DD, optionnel

  // ── Requête principale (RLS-filtered par le client utilisateur) ──
  let query = supabase
    .from('interventions')
    .select(
      `
      *,
      agencies!agence_id(label),
      tenants!tenant_id(firstname, lastname, telephone, email),
      owner!owner_id(owner_firstname, owner_lastname),
      users!assigned_user_id(username),
      intervention_statuses!statut_id(label),
      metiers!metier_id(label)
    `
    )
    .order('created_at', { ascending: false })

  if (start) {
    query = query.gte('created_at', start)
  }
  if (end) {
    // Inclure toute la journée de fin
    const nextDay = new Date(`${end}T00:00:00`)
    nextDay.setDate(nextDay.getDate() + 1)
    query = query.lt('created_at', nextDay.toISOString().split('T')[0])
  }

  const { data: interventions, error } = await query

  if (error) {
    console.error('[exports/interventions] query error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = interventions ?? []

  if (list.length === 0) {
    return buildCsvResponse(convertToCSV([]))
  }

  const ids = list.map((i: any) => i.id as string)

  // ── Batch : artisans (primaire en premier) ──
  const { data: artisansRows } = await supabase
    .from('intervention_artisans')
    .select('intervention_id, is_primary, artisans(plain_nom)')
    .in('intervention_id', ids)
    .order('is_primary', { ascending: false })

  const artisanMap = new Map<string, string>()
  for (const row of (artisansRows ?? []) as any[]) {
    if (!artisanMap.has(row.intervention_id)) {
      artisanMap.set(row.intervention_id, row.artisans?.plain_nom || '')
    }
  }

  // ── Batch : coûts ──
  const { data: costsRows } = await supabase
    .from('intervention_costs')
    .select('intervention_id, cost_type, amount')
    .in('intervention_id', ids)

  const costsMap = new Map<string, InterventionCost[]>()
  for (const row of (costsRows ?? []) as any[]) {
    const arr = costsMap.get(row.intervention_id) ?? []
    arr.push({ cost_type: row.cost_type, amount: row.amount })
    costsMap.set(row.intervention_id, arr)
  }

  // ── Batch : commentaires internes (tri desc global → ordre desc par intervention) ──
  const { data: commentsRows } = await supabase
    .from('comments')
    .select('entity_id, content, created_at')
    .eq('entity_type', 'intervention')
    .in('entity_id', ids)
    .eq('is_internal', true)
    .order('created_at', { ascending: false })

  const commentsMap = new Map<string, string>()
  for (const row of (commentsRows ?? []) as any[]) {
    const segment = `[${formatDate(row.created_at)}] ${row.content}`
    const existing = commentsMap.get(row.entity_id)
    commentsMap.set(row.entity_id, existing ? `${existing} || ${segment}` : segment)
  }

  // ── Assemblage des lignes ──
  const rows: InterventionRow[] = list.map((i: any) => ({
    created_at: i.created_at,
    id_inter: i.id_inter,
    adresse: i.adresse,
    contexte_intervention: i.contexte_intervention,
    numero_sst: i.numero_sst,
    pourcentage_sst: i.pourcentage_sst,
    date_prevue: i.date_prevue,
    commentaires: commentsMap.get(i.id) || '',
    technicien: artisanMap.get(i.id) || '',
    costs: costsMap.get(i.id) || [],
    agencies: i.agencies,
    tenants: i.tenants,
    owner: i.owner,
    users: i.users,
    intervention_statuses: i.intervention_statuses,
    metiers: i.metiers,
  }))

  return buildCsvResponse(convertToCSV(rows))
}

function buildCsvResponse(csv: string): NextResponse {
  const BOM = '﻿'
  return new NextResponse(BOM + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // Le nom du fichier est généré côté client pour utiliser la date locale
      'Content-Disposition': 'attachment',
    },
  })
}
