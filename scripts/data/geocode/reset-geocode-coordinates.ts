#!/usr/bin/env tsx

/**
 * Réinitialise les colonnes latitude et longitude des interventions
 * Usage: npx tsx scripts/reset-geocode-coordinates.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

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

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "http://localhost:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error(
    "❌ SUPABASE_SERVICE_ROLE_KEY manquante. Veuillez la définir dans votre environnement.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function resetCoordinates() {
  console.log("🔄 Réinitialisation des coordonnées latitude et longitude...");
  console.log(`   URL Supabase: ${SUPABASE_URL}`);
  console.log("");

  // Compter toutes les interventions
  const { count: totalCount } = await supabase
    .from("interventions")
    .select("*", { count: "exact", head: true });

  console.log(`   Total d'interventions: ${totalCount ?? 0}`);

  // Utiliser une requête SQL directe pour réinitialiser toutes les coordonnées
  // Cela fonctionne même pour les valeurs 0,0
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'UPDATE interventions SET latitude = NULL, longitude = NULL WHERE latitude IS NOT NULL OR longitude IS NOT NULL'
  });

  if (error) {
    // Si RPC n'existe pas, utiliser une approche par lots
    console.log("   Utilisation d'une approche par lots...");
    
    let updated = 0;
    let offset = 0;
    const batchSize = 1000;
    
    while (true) {
      // Récupérer un lot d'interventions avec coordonnées
      const { data: batch, error: fetchError } = await supabase
        .from("interventions")
        .select("id")
        .or("latitude.not.is.null,longitude.not.is.null")
        .range(offset, offset + batchSize - 1);
      
      if (fetchError || !batch || batch.length === 0) {
        break;
      }
      
      // Mettre à NULL pour ce lot
      const ids = batch.map(i => i.id);
      const { error: updateError } = await supabase
        .from("interventions")
        .update({ latitude: null, longitude: null })
        .in("id", ids);
      
      if (updateError) {
        console.error(`❌ Erreur lors de la mise à jour: ${updateError.message}`);
        break;
      }
      
      updated += batch.length;
      offset += batchSize;
      
      if (batch.length < batchSize) {
        break;
      }
    }
    
    console.log(`✅ ${updated} interventions mises à jour (coordonnées réinitialisées)`);
  } else {
    console.log(`✅ Coordonnées réinitialisées avec succès`);
  }
  
  // Vérification finale
  const { count: countAfter } = await supabase
    .from("interventions")
    .select("*", { count: "exact", head: true })
    .or("latitude.not.is.null,longitude.not.is.null");
  
  console.log(`   Interventions avec coordonnées après: ${countAfter ?? 0}`);
  console.log("");
  console.log("✨ Terminé ! Vous pouvez maintenant relancer le géocodage.");
}

resetCoordinates().catch((error) => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});

