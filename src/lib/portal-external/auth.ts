import { NextRequest } from 'next/server'

/**
 * Validates API requests from portal_gmbs.
 * 
 * Portal sends:
 * - X-GMBS-Key-Id: The API key ID
 * - X-GMBS-Secret: The API secret
 * 
 * We validate against environment variables.
 */

type ValidationResult = 
  | { success: true }
  | { success: false; error: string }

export async function validatePortalApiRequest(
  request: NextRequest
): Promise<ValidationResult> {
  const keyId = request.headers.get('X-GMBS-Key-Id')
  const secret = request.headers.get('X-GMBS-Secret')

  if (!keyId || !secret) {
    return { success: false, error: 'Missing authentication headers' }
  }

  // Validate against configured credentials
  const expectedKeyId = process.env.GMBS_PORTAL_KEY_ID?.trim()
  const expectedSecret = process.env.GMBS_PORTAL_SECRET?.trim()

  if (!expectedKeyId || !expectedSecret) {
    console.error('[portal-external] Portal credentials not configured')
    return { success: false, error: 'Portal not configured' }
  }

  if (keyId !== expectedKeyId || secret !== expectedSecret) {
    return { success: false, error: 'Invalid credentials' }
  }

  return { success: true }
}

/**
 * Validates a portal token to identify the artisan.
 * 
 * This is used when portal_gmbs forwards the artisan's token
 * so we know which artisan is making the request.
 */
export async function validateArtisanToken(
  token: string
): Promise<{ success: true; artisanId: string } | { success: false; error: string }> {
  // For now, the token validation is done on portal_gmbs side
  // and portal forwards the artisan_id in the request
  // This function is a placeholder for potential future use
  return { success: false, error: 'Not implemented' }
}
