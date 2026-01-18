import { createServerSupabaseAdmin } from "@/lib/supabase/server"

/**
 * Valide un token de portail artisan et retourne l'artisan_id
 * Utilise des requêtes directes au lieu de RPC pour éviter les problèmes de schema cache
 */
export async function validatePortalToken(token: string): Promise<string | null> {
  const supabase = createServerSupabaseAdmin()
  if (!supabase) return null
  
  const { data: tokenData, error } = await supabase
    .from("artisan_portal_tokens")
    .select("artisan_id, expires_at")
    .eq("token", token)
    .eq("is_active", true)
    .single()

  if (error || !tokenData) return null
  
  // Vérifier l'expiration
  if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
    return null
  }

  // Mettre à jour last_accessed_at (fire and forget)
  supabase
    .from("artisan_portal_tokens")
    .update({ last_accessed_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {})

  return tokenData.artisan_id
}

/**
 * Vérifie si un artisan a accès à une intervention donnée
 */
export async function checkArtisanAccessToIntervention(
  artisanId: string, 
  interventionId: string
): Promise<boolean> {
  const supabase = createServerSupabaseAdmin()
  if (!supabase) return false
  
  const { data, error } = await supabase
    .from("intervention_artisans")
    .select("id")
    .eq("artisan_id", artisanId)
    .eq("intervention_id", interventionId)
    .single()

  return !error && !!data
}
