import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Crée un client Supabase admin (service role) pour contourner les RLS
 * À utiliser UNIQUEMENT dans les routes API où l'authentification est déjà vérifiée manuellement
 */
export function createServerSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  // Correctif de revue du socle v2 (constat 22) : ECHEC EXPLICITE, plus de repli silencieux.
  //
  // Ce repli sur la cle anon « fonctionnait » tant qu'anon lisait tout. Depuis 99078 et 99082
  // (RLS + REVOKE ALL … FROM anon sur intervention_artisans, intervention_costs,
  // intervention_attachments, artisan_portal_actions), il ne degrade plus : il produit un
  // « permission denied » a chaque requete. Une variable oubliee cassait donc le flux SSE et
  // POST /portal-report EN PRODUCTION, avec un simple console.warn pour seule trace — alors
  // que la memoire du projet signale precisement des environnements portail incoherents.
  // On leve a l'appel, ce qui se voit au deploiement (et en demo locale) et non en incident.
  if (!serviceRoleKey) {
    throw new Error(
      '[createServerSupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY absente. ' +
        'Les routes serveur du portail ecrivent avec le role service_role : depuis 99078/99082, ' +
        'la cle anon n\'a plus aucun droit sur intervention_artisans, intervention_costs, ' +
        'intervention_attachments ni artisan_portal_actions. Renseignez la variable ' +
        "(.env.demo.local en demo locale, variables d'environnement Vercel en production)."
    )
  }

  const client = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  })
  return client as SupabaseClient
}
