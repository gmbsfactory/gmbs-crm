#!/usr/bin/env tsx

/**
 * Géocode les interventions basées sur leur adresse (adresse, code_postal, ville).
 *
 * Usage:
 *   npx tsx scripts/geocode-interventions.ts
 *
 * Variables d'environnement:
 *   SUPABASE_URL                - URL de l'instance Supabase
 *   SUPABASE_SERVICE_ROLE_KEY   - Clé de service Supabase (requise)
 *   OPENCAGE_API_KEY            - Optionnel, améliore la précision du géocodage
 *   GEOCODE_BATCH_SIZE          - Optionnel, défaut 50 (interventions par lot)
 *   GEOCODE_CONCURRENCY         - Optionnel, défaut 3 (requêtes parallèles)
 *   GEOCODE_REQUEST_DELAY_MS    - Optionnel, défaut 1000 (délai minimum entre requêtes)
 *
 * Performance:
 *   - Avec 3 requêtes concurrentes: ~3 interventions/sec
 *   - 1000 interventions ≈ 5-6 minutes
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, appendFileSync, existsSync } from "fs";

// Charger les variables d'environnement selon NODE_ENV
const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.local';

if (process.env.NODE_ENV === 'production') {
  config({ path: envFile });
} else {
  config({ path: ".env.local" });
}
config(); // Fallback vers .env

type InterventionRow = {
  id: string;
  id_inter: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  latitude: number | null;
  longitude: number | null;
};

type GeocodeResult = {
  lat: number;
  lng: number;
  provider: "opencage" | "nominatim";
};

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://localhost:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;
const BATCH_SIZE = Number(process.env.GEOCODE_BATCH_SIZE ?? "50");
const REQUEST_DELAY_MS = Number(
  process.env.GEOCODE_REQUEST_DELAY_MS ?? "1000",
);
const CONCURRENCY = Number(process.env.GEOCODE_CONCURRENCY ?? "3");

if (!SERVICE_ROLE_KEY) {
  console.error(
    "❌ SUPABASE_SERVICE_ROLE_KEY manquante. Veuillez la définir dans votre environnement.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Rate limiter pour contrôler les requêtes concurrentes
class RateLimiter {
  private queue: Array<() => void> = [];
  private activeCount = 0;
  private lastRequestTime = 0;

  constructor(
    private maxConcurrent: number,
    private minDelayMs: number,
  ) {}

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      const tryAcquire = async () => {
        if (this.activeCount < this.maxConcurrent) {
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          const delayNeeded = Math.max(0, this.minDelayMs - timeSinceLastRequest);

          if (delayNeeded > 0) {
            await sleep(delayNeeded);
          }

          this.activeCount++;
          this.lastRequestTime = Date.now();
          resolve();
        } else {
          this.queue.push(tryAcquire);
        }
      };
      tryAcquire();
    });
  }

  release(): void {
    this.activeCount--;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}

const rateLimiter = new RateLimiter(CONCURRENCY, REQUEST_DELAY_MS);

const FAILED_LOG_FILE = "scripts/geocode-failed-interventions.txt";

// Constantes pour les limites géographiques de la France
const FRANCE_BOUNDS = {
  minLat: 41.0,
  maxLat: 51.5,
  minLng: -5.0,
  maxLng: 10.0,
};

// Initialiser le fichier de log
if (!existsSync(FAILED_LOG_FILE)) {
  writeFileSync(
    FAILED_LOG_FILE,
    `# Interventions qui n'ont pas pu être géocodées\n# Généré le ${new Date().toLocaleString("fr-FR")}\n\n`,
  );
}

// Fonction pour vérifier si des coordonnées sont en France
function isInFrance(lat: number, lng: number): boolean {
  return (
    lat >= FRANCE_BOUNDS.minLat &&
    lat <= FRANCE_BOUNDS.maxLat &&
    lng >= FRANCE_BOUNDS.minLng &&
    lng <= FRANCE_BOUNDS.maxLng
  );
}

// Fonction pour normaliser et nettoyer les chaînes
function normalizeString(str: string | null): string | null {
  if (!str) return null;
  return str.trim().replace(/\s+/g, " ") || null;
}

// Fonction pour vérifier si un code postal est français (5 chiffres)
function isValidFrenchPostalCode(code: string | null): boolean {
  if (!code) return false;
  const cleaned = code.trim().replace(/\s/g, "");
  return /^\d{5}$/.test(cleaned);
}

// Génère plusieurs variantes d'adresses par ordre de probabilité
function buildAddressCandidates(intervention: InterventionRow): string[] {
  const candidates: string[] = [];

  const adresse = normalizeString(intervention.adresse);
  const codePostal = normalizeString(intervention.code_postal);
  const ville = normalizeString(intervention.ville);

  if (!adresse && !codePostal && !ville) {
    return [];
  }

  // Si on a un code postal français valide, on peut être plus précis
  const hasValidPostalCode = isValidFrenchPostalCode(codePostal);

  // Variante 1 : Format complet avec "France" (le plus précis)
  if (adresse && codePostal && ville) {
    candidates.push(`${adresse}, ${codePostal} ${ville}, France`);
    candidates.push(`${adresse}, ${codePostal}, ${ville}, France`);
  }

  // Variante 2 : Code postal + ville + France (souvent suffisant)
  if (codePostal && ville) {
    candidates.push(`${codePostal} ${ville}, France`);
    candidates.push(`${codePostal}, ${ville}, France`);
    // Sans France aussi (au cas où)
    if (hasValidPostalCode) {
      candidates.push(`${codePostal} ${ville}`);
    }
  }

  // Variante 3 : Adresse + code postal + ville (sans France)
  if (adresse && codePostal && ville) {
    candidates.push(`${adresse}, ${codePostal} ${ville}`);
    candidates.push(`${adresse}, ${codePostal}, ${ville}`);
  }

  // Variante 4 : Ville seule avec France (dernier recours)
  if (ville) {
    candidates.push(`${ville}, France`);
    // Si la ville contient déjà des mots-clés français, on peut essayer sans
    const villeLower = ville.toLowerCase();
    if (!villeLower.includes("france") && !villeLower.includes("paris")) {
      candidates.push(ville);
    }
  }

  // Variante 5 : Code postal seul avec France (si valide)
  if (hasValidPostalCode) {
    candidates.push(`${codePostal}, France`);
  }

  // Retirer les doublons et les valeurs vides
  return [...new Set(candidates.filter(Boolean))];
}

// Variable globale pour suivre si OpenCage a atteint sa limite
let openCageQuotaExceeded = false;

async function geocodeWithOpenCage(
  address: string,
  retries = 2,
): Promise<GeocodeResult | null> {
  if (!OPENCAGE_API_KEY || openCageQuotaExceeded) {
    return null;
  }

  const endpoint = new URL("https://api.opencagedata.com/geocode/v1/json");
  endpoint.searchParams.set("q", address);
  endpoint.searchParams.set("key", OPENCAGE_API_KEY);
  endpoint.searchParams.set("limit", "3"); // Prendre plusieurs résultats pour filtrer
  endpoint.searchParams.set("language", "fr");
  endpoint.searchParams.set("no_annotations", "1");
  // Restreindre aux résultats français
  endpoint.searchParams.set("countrycode", "fr");

  for (let attempt = 0; attempt <= retries; attempt++) {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Créer un AbortController pour timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondes timeout

      const response = await fetch(endpoint, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text();
        // Si erreur 402 (Payment Required) ou 429 (Too Many Requests), désactiver OpenCage
        if (response.status === 402 || response.status === 429) {
          openCageQuotaExceeded = true;
          console.warn(
            `[geocode] OpenCage quota exceeded (${response.status}), switching to Nominatim only`,
          );
        } else if (attempt < retries && response.status >= 500) {
          // Retry sur erreurs serveur
          await sleep(1000 * (attempt + 1));
          continue;
        } else {
          console.warn(
            `[geocode] OpenCage failed (${response.status}): ${body.slice(0, 200)}`,
          );
        }
        return null;
      }

      const payload: {
        results?: Array<{
          geometry?: { lat?: number; lng?: number };
          confidence?: number;
        }>;
      } = await response.json();

      if (!payload.results || payload.results.length === 0) {
        return null;
      }

      // Chercher le premier résultat en France avec la meilleure confiance
      for (const result of payload.results) {
        if (
          !result.geometry ||
          result.geometry.lat == null ||
          result.geometry.lng == null
        ) {
          continue;
        }

        const lat = result.geometry.lat;
        const lng = result.geometry.lng;

        // Vérifier que c'est en France
        if (isInFrance(lat, lng)) {
          return { lat, lng, provider: "opencage" };
        }
      }

      return null;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const isNetworkError =
        error instanceof TypeError ||
        (error as Error).name === "AbortError" ||
        (error as Error).message.includes("fetch");

      if (isNetworkError && attempt < retries) {
        // Retry sur erreurs réseau avec backoff exponentiel
        const delay = 1000 * Math.pow(2, attempt);
        console.warn(
          `[geocode] OpenCage network error (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`,
        );
        await sleep(delay);
        continue;
      }

      if (isNetworkError) {
        console.warn(`[geocode] OpenCage network error after ${retries + 1} attempts: ${(error as Error).message}`);
      } else {
        console.warn(`[geocode] OpenCage error: ${(error as Error).message}`);
      }
      return null;
    }
  }

  return null;
}

async function geocodeWithNominatim(
  address: string,
  retries = 2,
): Promise<GeocodeResult | null> {
  const endpoint = new URL("https://nominatim.openstreetmap.org/search");
  endpoint.searchParams.set("q", address);
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("limit", "3"); // Prendre plusieurs résultats pour filtrer
  endpoint.searchParams.set("addressdetails", "0");
  // Restreindre aux résultats français
  endpoint.searchParams.set("countrycodes", "fr");

  for (let attempt = 0; attempt <= retries; attempt++) {
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      // Créer un AbortController pour timeout
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 15000); // 15 secondes timeout (Nominatim peut être plus lent)

      const response = await fetch(endpoint, {
        headers: {
          "User-Agent": "gmbs-crm-geocode-script/1.0 (contact@webcraft.fr)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text();
        // Si erreur 429 (Too Many Requests), attendre plus longtemps
        if (response.status === 429 && attempt < retries) {
          const retryAfter = response.headers.get("Retry-After");
          const delay = retryAfter
            ? Number.parseInt(retryAfter, 10) * 1000
            : 2000 * Math.pow(2, attempt);
          console.warn(
            `[geocode] Nominatim rate limited (${response.status}), waiting ${delay}ms...`,
          );
          await sleep(delay);
          continue;
        } else if (attempt < retries && response.status >= 500) {
          // Retry sur erreurs serveur
          await sleep(1000 * (attempt + 1));
          continue;
        } else {
          console.warn(
            `[geocode] Nominatim failed (${response.status}): ${body.slice(0, 200)}`,
          );
        }
        return null;
      }

      const payload: Array<{
        lat?: string;
        lon?: string;
        importance?: number;
      }> = await response.json();

      if (!payload || payload.length === 0) {
        return null;
      }

      // Trier par importance décroissante et chercher le premier en France
      const sortedResults = [...payload]
        .filter((r) => r.lat && r.lon)
        .sort((a, b) => (b.importance || 0) - (a.importance || 0));

      for (const match of sortedResults) {
        if (!match.lat || !match.lon) continue;

        const lat = Number.parseFloat(match.lat);
        const lng = Number.parseFloat(match.lon);

        // Vérifier que c'est en France
        if (isInFrance(lat, lng)) {
          return {
            lat,
            lng,
            provider: "nominatim",
          };
        }
      }

      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      const isNetworkError =
        error instanceof TypeError ||
        (error as Error).name === "AbortError" ||
        (error as Error).message.includes("fetch");

      if (isNetworkError && attempt < retries) {
        // Retry sur erreurs réseau avec backoff exponentiel
        // Nominatim recommande 1 requête par seconde, donc on attend au moins 1 seconde
        const delay = Math.max(1000, 1000 * Math.pow(2, attempt));
        console.warn(
          `[geocode] Nominatim network error (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms...`,
        );
        await sleep(delay);
        continue;
      }

      if (isNetworkError) {
        console.warn(`[geocode] Nominatim network error after ${retries + 1} attempts: ${(error as Error).message}`);
      } else {
        console.warn(`[geocode] Nominatim error: ${(error as Error).message}`);
      }
      return null;
    }
  }

  return null;
}

// Fonction améliorée qui teste plusieurs variantes d'adresses
async function geocodeAddress(
  intervention: InterventionRow,
): Promise<GeocodeResult | null> {
  const candidates = buildAddressCandidates(intervention);

  if (candidates.length === 0) {
    return null;
  }

  // Essayer d'abord avec OpenCage (plus précis)
  if (OPENCAGE_API_KEY) {
    for (const candidate of candidates) {
      const result = await geocodeWithOpenCage(candidate);
      if (result) {
        return result;
      }
    }
  }

  // Fallback sur Nominatim
  for (const candidate of candidates) {
    const result = await geocodeWithNominatim(candidate);
    if (result) {
      return result;
    }
  }

  return null;
}

async function fetchNextBatch(): Promise<InterventionRow[]> {
  const { data, error } = await supabase
    .from("interventions")
    .select(
      [
        "id",
        "id_inter",
        "adresse",
        "code_postal",
        "ville",
        "latitude",
        "longitude",
      ].join(", "),
    )
    .or("latitude.is.null,longitude.is.null")
    .not("adresse", "is", null)
    .not("code_postal", "is", null)
    .not("ville", "is", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE * 2); // Récupérer plus pour compenser le filtrage

  if (error) {
    throw new Error(`Erreur Supabase lors de la récupération: ${error.message}`);
  }

  // Filtrer côté client : uniquement celles sans coordonnées valides
  // (null, null) ou (0, 0) qui indique un échec précédent
  return (data ?? []).filter(
    (intervention) =>
      !intervention.latitude ||
      !intervention.longitude ||
      (intervention.latitude === 0 && intervention.longitude === 0)
  ).slice(0, BATCH_SIZE);
}

async function updateInterventionLocation(
  interventionId: string,
  result: GeocodeResult,
): Promise<void> {
  const { error } = await supabase
    .from("interventions")
    .update({
      latitude: result.lat,
      longitude: result.lng,
    })
    .eq("id", interventionId);

  if (error) {
    throw new Error(
      `Échec de la mise à jour de l'intervention ${interventionId}: ${error.message}`,
    );
  }
}

async function markInterventionAsFailed(
  interventionId: string,
  reason: string,
): Promise<void> {
  // Marquer avec des coordonnées spéciales (0, 0) pour indiquer "tenté mais échoué"
  const { error } = await supabase
    .from("interventions")
    .update({
      latitude: 0,
      longitude: 0,
    })
    .eq("id", interventionId);

  if (error) {
    console.error(`Échec du marquage de l'intervention ${interventionId} comme échouée: ${error.message}`);
  }
}

function logFailedIntervention(intervention: InterventionRow, reason: string): void {
  const label = intervention.id_inter || intervention.id;
  const addressInfo = [
    intervention.adresse,
    intervention.code_postal,
    intervention.ville,
  ]
    .filter(Boolean)
    .join(", ") || "Aucune adresse";

  const logEntry = `[${new Date().toISOString()}] Intervention ${label} (ID: ${intervention.id})\n  Raison: ${reason}\n  Adresse: ${addressInfo}\n\n`;
  appendFileSync(FAILED_LOG_FILE, logEntry);
}

async function processIntervention(intervention: InterventionRow): Promise<boolean> {
  const label = intervention.id_inter || intervention.id;
  
  // Vérification de sécurité : ignorer si déjà géocodée avec des coordonnées valides
  if (
    intervention.latitude &&
    intervention.longitude &&
    !(intervention.latitude === 0 && intervention.longitude === 0)
  ) {
    console.log(`⏭️  ${label}: déjà géocodée (${intervention.latitude}, ${intervention.longitude}), ignorée.`);
    return false;
  }

  const candidates = buildAddressCandidates(intervention);

  if (candidates.length === 0) {
    console.warn(`⚠️  ${label}: aucune adresse disponible, marquée comme échouée.`);
    logFailedIntervention(intervention, "Aucune adresse disponible");
    await markInterventionAsFailed(intervention.id, "no address");
    return false;
  }

  await rateLimiter.acquire();
  let geocoded: GeocodeResult | null = null;
  try {
    // Utiliser la nouvelle fonction qui teste plusieurs variantes
    geocoded = await geocodeAddress(intervention);
  } catch (error) {
    console.error(`❌ ${label}: erreur de géocodage: ${(error as Error).message}`);
  } finally {
    rateLimiter.release();
  }

  if (!geocoded) {
    const addressInfo = [
      intervention.adresse,
      intervention.code_postal,
      intervention.ville,
    ]
      .filter(Boolean)
      .join(", ") || "Aucune adresse";
    console.warn(`⚠️  ${label}: aucun résultat trouvé pour "${addressInfo}", marquée comme échouée.`);
    logFailedIntervention(intervention, "Aucun résultat de géocodage trouvé en France");
    await markInterventionAsFailed(intervention.id, "no match");
    return false;
  }

  await updateInterventionLocation(intervention.id, geocoded);
  console.log(
    `✅ ${label}: ${geocoded.lat.toFixed(6)}, ${geocoded.lng.toFixed(6)} (${geocoded.provider})`,
  );
  return true;
}

async function processBatch(batch: InterventionRow[]): Promise<number> {
  const results = await Promise.all(batch.map((intervention) => processIntervention(intervention)));
  return results.filter((success) => success).length;
}

async function run() {
  console.log("🚀 Démarrage du géocodage des interventions…");
  console.log(`   URL Supabase:        ${SUPABASE_URL}`);
  console.log(
    `   Utilisation OpenCage: ${OPENCAGE_API_KEY ? "oui" : "non (fallback Nominatim)"}`,
  );
  console.log(`   Taille des lots:     ${BATCH_SIZE}`);
  console.log(`   Concurrence:         ${CONCURRENCY} requêtes parallèles`);
  console.log(`   Délai entre appels:  ${REQUEST_DELAY_MS} ms`);
  console.log(`   Fichier de log:      ${FAILED_LOG_FILE}`);
  console.log("");

  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  while (true) {
    const batch = await fetchNextBatch();
    if (batch.length === 0) {
      break;
    }

    console.log(
      `🔄 Traitement d'un lot de ${batch.length} intervention${batch.length > 1 ? "s" : ""}…`,
    );
    const successCount = await processBatch(batch);
    totalProcessed += batch.length;
    totalSuccess += successCount;
    totalFailed = totalProcessed - totalSuccess;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (totalProcessed / (Date.now() - startTime) * 1000).toFixed(1);
    console.log(
      `📊 Progression: ${totalSuccess} réussies, ${totalFailed} échecs | ${rate} interventions/sec | ${elapsed}s\n`,
    );
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("");
  console.log(`✨ Terminé en ${totalTime}s !`);
  console.log(`   ✅ ${totalSuccess} interventions géocodées avec succès`);
  console.log(`   ❌ ${totalFailed} interventions en échec (voir ${FAILED_LOG_FILE})`);
}

run().catch((error) => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});

