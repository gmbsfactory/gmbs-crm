/**
 * Bilan S1 — accès serveur à la configuration de visibilité (service role).
 * À n'importer QUE depuis des routes API / code serveur.
 */

import { supabaseAdmin } from "@/lib/supabase-admin"
import {
  BILAN_S1_PAGE_KEY,
  EMPTY_VISIBILITY,
  type PageVisibilityConfig,
} from "@/lib/bilan-s1/visibility-core"

type LoadResult = {
  config: PageVisibilityConfig
  /** true si la table n'existe pas encore (migration 99062 non appliquée). */
  tableMissing: boolean
}

/**
 * Charge la configuration de visibilité de la page bilan-s1.
 * En cas de table absente ou d'erreur, retombe sur EMPTY_VISIBILITY
 * (= dev-only) : on ne doit jamais élargir l'accès par accident.
 */
export async function loadBilanVisibility(): Promise<LoadResult> {
  if (!supabaseAdmin) return { config: EMPTY_VISIBILITY, tableMissing: false }

  const { data, error } = await supabaseAdmin
    .from("page_visibility")
    .select("allowed_roles,allowed_user_ids,expires_at,updated_at")
    .eq("page_key", BILAN_S1_PAGE_KEY)
    .maybeSingle()

  if (error) {
    // 42P01 = relation inexistante → migration pas encore appliquée.
    const tableMissing = error.code === "42P01"
    if (!tableMissing) console.error("[bilan-s1] lecture page_visibility:", error.message)
    return { config: EMPTY_VISIBILITY, tableMissing }
  }
  if (!data) return { config: EMPTY_VISIBILITY, tableMissing: false }

  return {
    config: {
      allowedRoles: data.allowed_roles ?? [],
      allowedUserIds: data.allowed_user_ids ?? [],
      expiresAt: data.expires_at ?? null,
      updatedAt: data.updated_at ?? null,
    },
    tableMissing: false,
  }
}
