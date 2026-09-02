import { NextResponse } from 'next/server'
import { requirePermission, isPermissionError } from '@/lib/auth/permissions'
import { createServerSupabaseAdmin } from '@/lib/supabase/server'
import { PORTAL_REPORT_COLUMNS, pickPortalReport } from '@/lib/portal-external/interventions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

interface ArtisanRef {
  id: string
  nom: string | null
  prenom: string | null
}

/**
 * GET /api/interventions/{id}/portal-report  (permission read_interventions)
 * Rapport portail à afficher, ses photos (déposées depuis le portail) et
 * l'artisan concerné → `{ report | null, photos, artisan }`.
 * Intervention à plusieurs artisans : le rapport **en attente** (`submitted`)
 * passe avant le dernier rapport traité, quel que soit l'artisan
 * (cf. `pickPortalReport`).
 */
export async function GET(request: Request, { params }: Params) {
  const permCheck = await requirePermission(request, 'read_interventions')
  if (isPermissionError(permCheck)) return permCheck.error

  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Intervention ID is required' }, { status: 400 })

  try {
    const supabase = createServerSupabaseAdmin()

    const { data: intervention, error: interventionError } = await supabase
      .from('interventions')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (interventionError) {
      console.error('[portal-report] Lecture de l\'intervention échouée :', interventionError.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!intervention) return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 })

    const [reportRes, photosRes] = await Promise.all([
      supabase
        .from('artisan_reports')
        .select(`artisan_id, artisan:artisans!artisan_id ( id, nom, prenom ), ${PORTAL_REPORT_COLUMNS}`)
        .eq('intervention_id', id)
        .order('version', { ascending: false })
        .order('submitted_at', { ascending: false }),
      supabase
        .from('intervention_attachments')
        .select('id, url, filename, created_at, created_by_display, metadata')
        .eq('intervention_id', id)
        .eq('kind', 'photos')
        .eq('metadata->>source', 'portal')
        .order('created_at', { ascending: true }),
    ])

    if (reportRes.error) {
      console.error('[portal-report] Lecture du rapport échouée :', reportRes.error.message)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    let report: Record<string, unknown> | null = null
    let artisan: ArtisanRef | null = null

    type ReportRow = Record<string, unknown> & {
      status: string
      artisan_id: string
      artisan: ArtisanRef | ArtisanRef[] | null
    }
    const selected = pickPortalReport((reportRes.data ?? []) as unknown as ReportRow[])
    if (selected) {
      const { artisan_id: _artisanId, artisan: artisanRel, ...rest } = selected
      void _artisanId
      report = rest
      artisan = Array.isArray(artisanRel) ? artisanRel[0] ?? null : artisanRel
    } else {
      // Pas de rapport : on renvoie l'artisan principal pour l'affichage.
      const { data: primary } = await supabase
        .from('intervention_artisans')
        .select('artisan:artisans!artisan_id ( id, nom, prenom )')
        .eq('intervention_id', id)
        .eq('is_primary', true)
        .limit(1)
        .maybeSingle()
      const rel = (primary as { artisan: ArtisanRef | ArtisanRef[] | null } | null)?.artisan ?? null
      artisan = Array.isArray(rel) ? rel[0] ?? null : rel
    }

    return NextResponse.json({ report, photos: photosRes.data ?? [], artisan })
  } catch (error) {
    console.error('[portal-report] Erreur inattendue :', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
