/**
 * CORS headers partagés pour toutes les Edge Functions.
 * Utilisé par : comments, artisans-v2, interventions-v2, ai-contextual-action, etc.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '*'

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}
