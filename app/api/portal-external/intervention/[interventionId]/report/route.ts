import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal-external/intervention/[interventionId]/report?artisanId={artisanId}
 *
 * Fetches the report from portal_gmbs for display in CRM.
 * Called by CRM frontend when viewing intervention report tab.
 *
 * Auth: None required (internal CRM call) - but could add session check
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ interventionId: string }> }
) {
  const { interventionId } = await params
  const artisanId = request.nextUrl.searchParams.get('artisanId')

  if (!artisanId) {
    return NextResponse.json({ error: 'artisanId required' }, { status: 400 })
  }

  const portalBaseUrl = process.env.PORTAL_GMBS_BASE_URL
  const apiKeyId = process.env.PORTAL_API_KEY_ID
  const apiSecret = process.env.PORTAL_API_SECRET

  if (!portalBaseUrl || !apiKeyId || !apiSecret) {
    console.error('[get-report] Missing portal configuration')
    return NextResponse.json({ error: 'Portal configuration error' }, { status: 500 })
  }

  try {
    // Appeler l'API du portal pour récupérer le rapport
    const portalResponse = await fetch(
      `${portalBaseUrl}/api/v1/interventions/${interventionId}/report?artisanId=${artisanId}`,
      {
        method: 'GET',
        headers: {
          'X-GMBS-Key-Id': apiKeyId,
          'X-GMBS-Secret': apiSecret
        }
      }
    )

    if (!portalResponse.ok) {
      if (portalResponse.status === 404) {
        // Aucun rapport trouvé - retourner null
        return NextResponse.json({ report: null, photos: [] }, { status: 200 })
      }
      const errorText = await portalResponse.text()
      console.error('[get-report] Portal API error:', errorText)
      throw new Error('Portal API error')
    }

    const data = await portalResponse.json()

    return NextResponse.json({
      report: data.report || null,
      photos: data.photos || []
    })

  } catch (error) {
    console.error('[get-report] Failed to fetch report from portal:', error)
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 })
  }
}
