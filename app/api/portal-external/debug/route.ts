import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/portal-external/debug
 * 
 * Debug endpoint to verify CRM configuration for portal integration.
 * Shows what credentials the CRM expects and what it receives.
 */
export async function GET(request: NextRequest) {
  const debug: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    service: 'gmbs-crm',
    endpoint: 'portal-external/debug'
  }

  // What we received in headers
  const receivedKeyId = request.headers.get('X-GMBS-Key-Id')
  const receivedSecret = request.headers.get('X-GMBS-Secret')

  debug.receivedHeaders = {
    'X-GMBS-Key-Id': receivedKeyId ? `✓ Present (${receivedKeyId.substring(0, 8)}...)` : '✗ Missing',
    'X-GMBS-Secret': receivedSecret ? `✓ Present (${receivedSecret.substring(0, 10)}...)` : '✗ Missing'
  }

  // What we expect (configured in CRM env)
  const expectedKeyId = process.env.GMBS_PORTAL_KEY_ID?.trim()
  const expectedSecret = process.env.GMBS_PORTAL_SECRET?.trim()

  debug.expectedConfig = {
    GMBS_PORTAL_KEY_ID: expectedKeyId ? `✓ Set (${expectedKeyId.substring(0, 8)}...)` : '✗ Missing',
    GMBS_PORTAL_SECRET: expectedSecret ? `✓ Set (${expectedSecret.substring(0, 10)}...)` : '✗ Missing'
  }

  // Validation result
  if (!expectedKeyId || !expectedSecret) {
    debug.validationResult = 'FAILED - CRM credentials not configured'
    debug.configurationMissing = true
  } else if (!receivedKeyId || !receivedSecret) {
    debug.validationResult = 'FAILED - No credentials in request headers'
    debug.headersMissing = true
  } else {
    const keyIdMatch = receivedKeyId === expectedKeyId
    const secretMatch = receivedSecret === expectedSecret

    debug.comparison = {
      keyIdMatch,
      secretMatch,
      keyIdLength: { received: receivedKeyId.length, expected: expectedKeyId.length },
      secretLength: { received: receivedSecret.length, expected: expectedSecret.length }
    }

    if (keyIdMatch && secretMatch) {
      debug.validationResult = 'SUCCESS - Credentials match'
    } else {
      debug.validationResult = 'FAILED - Credentials mismatch'
      if (!keyIdMatch) {
        debug.keyIdMismatch = {
          receivedPrefix: receivedKeyId.substring(0, 8),
          expectedPrefix: expectedKeyId.substring(0, 8)
        }
      }
      if (!secretMatch) {
        debug.secretMismatch = {
          receivedPrefix: receivedSecret.substring(0, 10),
          expectedPrefix: expectedSecret.substring(0, 10)
        }
      }
    }
  }

  // Environment info
  debug.environment = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV || 'not-vercel'
  }

  return NextResponse.json(debug)
}
