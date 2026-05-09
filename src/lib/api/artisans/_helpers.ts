import { supabase, getSupabaseClientForNode } from "@/lib/api/common/client";
import { chunkArray, MAX_BATCH_SIZE } from "@/lib/api/common/utils";

// Utiliser le client admin dans Node.js, le client standard dans le navigateur
export const supabaseClient = typeof window !== 'undefined' ? supabase : getSupabaseClientForNode();

/**
 * Filtre les artisans par métiers en divisant les requêtes en lots pour éviter les erreurs de longueur d'URL
 */
export async function filterArtisansByMetiers(
  artisanIds: string[],
  metierIds: string[]
): Promise<Set<string>> {
  if (artisanIds.length === 0 || metierIds.length === 0) {
    return new Set();
  }

  const filteredIds = new Set<string>();

  // Diviser les artisanIds en lots
  const artisanIdChunks = chunkArray(artisanIds, MAX_BATCH_SIZE);

  // Pour chaque lot d'artisanIds, faire une requête
  for (const artisanIdChunk of artisanIdChunks) {
    const { data: artisansWithMetiers, error: metierError } = await supabaseClient
      .from("artisan_metiers")
      .select("artisan_id")
      .in("metier_id", metierIds)
      .in("artisan_id", artisanIdChunk);

    if (metierError) {
      console.error("Erreur lors du filtrage par métiers:", metierError);
      throw metierError;
    }

    if (artisansWithMetiers) {
      artisansWithMetiers.forEach((am: any) => {
        if (am.artisan_id) {
          filteredIds.add(am.artisan_id);
        }
      });
    }
  }

  return filteredIds;
}

/**
 * Filtre les artisans par un seul métier en divisant les requêtes en lots
 */
export async function filterArtisansByMetier(
  artisanIds: string[],
  metierId: string
): Promise<Set<string>> {
  if (artisanIds.length === 0) {
    return new Set();
  }

  const filteredIds = new Set<string>();

  // Diviser les artisanIds en lots
  const artisanIdChunks = chunkArray(artisanIds, MAX_BATCH_SIZE);

  // Pour chaque lot d'artisanIds, faire une requête
  for (const artisanIdChunk of artisanIdChunks) {
    const { data: artisansWithMetier, error: metierError } = await supabaseClient
      .from("artisan_metiers")
      .select("artisan_id")
      .eq("metier_id", metierId)
      .in("artisan_id", artisanIdChunk);

    if (metierError) {
      console.error("Erreur lors du filtrage par métier:", metierError);
      throw metierError;
    }

    if (artisansWithMetier) {
      artisansWithMetier.forEach((am: any) => {
        if (am.artisan_id) {
          filteredIds.add(am.artisan_id);
        }
      });
    }
  }

  return filteredIds;
}
