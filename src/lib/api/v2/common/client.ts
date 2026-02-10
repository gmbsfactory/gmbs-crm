// ===== CONSOLIDATED SUPABASE CLIENT =====
// Point d'entrée unique pour les clients Supabase dans l'API v2
//
// Usage :
//   import { supabase, getSupabaseClientForNode } from "./common/client";
//
// - supabase : client browser (anon key, singleton Proxy)
// - getSupabaseClientForNode() : hybride browser/Node.js
//     Browser → retourne le singleton supabase
//     Node.js → crée un client service role (bypass RLS)

import { supabase } from "@/lib/supabase-client";

export { supabase };

/**
 * Client Supabase hybride browser/Node.js
 * - Browser : retourne le client singleton (anon key)
 * - Node.js : crée un client service role pour contourner les RLS
 */
export function getSupabaseClientForNode() {
  if (typeof window !== "undefined") {
    return supabase;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@supabase/supabase-js");
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "[getSupabaseClientForNode] SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquants, utilisation du client standard"
    );
    return supabase;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
