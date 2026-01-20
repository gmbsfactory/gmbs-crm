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

  console.log('[get-report] Request received:', { interventionId, artisanId })

  if (!artisanId) {
    return NextResponse.json({ error: 'artisanId required' }, { status: 400 })
  }

  const portalBaseUrl = process.env.PORTAL_GMBS_BASE_URL
  const apiKeyId = process.env.PORTAL_API_KEY_ID
  const apiSecret = process.env.PORTAL_API_SECRET

  console.log('[get-report] Portal config:', { 
    portalBaseUrl: portalBaseUrl ? '✓ set' : '✗ missing',
    apiKeyId: apiKeyId ? '✓ set' : '✗ missing',
    apiSecret: apiSecret ? '✓ set' : '✗ missing'
  })

  if (!portalBaseUrl || !apiKeyId || !apiSecret) {
    console.error('[get-report] Missing portal configuration:', {
      PORTAL_GMBS_BASE_URL: !!portalBaseUrl,
      PORTAL_API_KEY_ID: !!apiKeyId,
      PORTAL_API_SECRET: !!apiSecret
    })
    return NextResponse.json({ error: 'Portal configuration error' }, { status: 500 })
  }

  try {
    const url = `${portalBaseUrl}/api/v1/interventions/${interventionId}/report?artisanId=${artisanId}`
    console.log('[get-report] Calling portal API:', url)

    // Appeler l'API du portal pour récupérer le rapport
    const portalResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'X-GMBS-Key-Id': apiKeyId,
        'X-GMBS-Secret': apiSecret
      }
    })

    console.log('[get-report] Portal response status:', portalResponse.status)

    if (!portalResponse.ok) {
      if (portalResponse.status === 404) {
        // Aucun rapport trouvé - retourner null
        return NextResponse.json({ report: null, photos: [] }, { status: 200 })
      }
      const errorText = await portalResponse.text()
      console.error('[get-report] Portal API error:', portalResponse.status, errorText)
      return NextResponse.json({ 
        error: 'Portal API error', 
        details: errorText,
        status: portalResponse.status 
      }, { status: 500 })
    }

    const data = await portalResponse.json()
    console.log('[get-report] Portal response data:', { 
      hasReport: !!data.report, 
      photosCount: data.photos?.length || 0 
    })

    return NextResponse.json({
      report: data.report || null,
      photos: data.photos || []
    })

  } catch (error) {
    console.error('[get-report] Failed to fetch report from portal:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch report',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
