import { NextResponse } from 'next/server'
import { getPortalSDK } from '@/lib/gmbs-plugins/portal-sdk'

/**
 * GET /api/plugins/portal/status
 * Check portal subscription status
 * Used by ArtisanPortalLink component to determine if feature is available
 */
export async function GET() {
  const sdk = getPortalSDK()

  // Check if credentials are configured
  if (!sdk.isConfigured()) {
    return NextResponse.json({ 
      active: false, 
      reason: 'not_configured' 
    })
  }

  try {
    const status = await sdk.checkSubscription()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Portal status check failed:', error)
    return NextResponse.json({ 
      active: false, 
      reason: 'api_error' 
    })
  }
}
