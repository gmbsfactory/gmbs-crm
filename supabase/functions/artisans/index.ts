import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Cache temporairement désactivé

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests FIRST, before any other code
  // This MUST be the very first statement to ensure OPTIONS always returns 200
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Cache warming temporairement désactivé
  
  // Log de début de requête
  console.log(JSON.stringify({
    level: 'info',
    requestId,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    message: 'Edge Function request started'
  }));

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // GET /artisans - Liste tous les artisans
    if (req.method === 'GET' && path === 'artisans') {
      const metier = url.searchParams.get('metier');
      const zone = url.searchParams.get('zone');
      const statut = url.searchParams.get('statut');
      const limit = parseInt(url.searchParams.get('limit') || '35');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const cursor = url.searchParams.get('cursor'); // Nouveau paramètre pour cursor-based pagination

      // Sélection optimisée : seulement les colonnes nécessaires pour la liste
      let query = supabase
        .from('artisans')
        .select(`
          id,
          prenom,
          nom,
          telephone,
          email,
          raison_sociale,
          statut_dossier,
          statut_artisan,
          statut_inactif,
          commentaire,
          gestionnaire_id,
          departement
        `)
        .order('nom', { ascending: true })
        .order('prenom', { ascending: true }); // Ordre alphabétique

      // Appliquer les filtres
      if (statut) {
        query = query.eq('statut_artisan', statut);
      }
      if (zone) {
        query = query.eq('departement', zone);
      }
      if (metier) {
        // Recherche par métier via la table artisan_metiers
        query = query.eq('metier_id', metier);
      }

      // Filtrer les artisans actifs
      query = query.eq('statut_inactif', false);

      // Compter le total d'artisans (pour la pagination) - sans cache temporairement
      const { count: totalCount } = await supabase
        .from('artisans')
        .select('*', { count: 'exact', head: true })
        .eq('statut_inactif', false);

      // Appliquer pagination (cursor-based si disponible, sinon OFFSET)
      if (cursor) {
        // Cursor-based pagination : plus rapide pour les grandes tables
        query = query.gt('id', cursor).limit(limit);
      } else {
        // Fallback vers OFFSET pour compatibilité
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transformer les données pour correspondre à l'interface MockAPI
      const transformedData = data.map(artisan => ({
        id: artisan.id,
        date: artisan.date,
        prenom: artisan.prenom,
        nom: artisan.nom,
        telephone: artisan.telephone,
        telephone2: artisan.telephone2,
        email: artisan.email,
        raisonSociale: artisan.raison_sociale,
        siret: artisan.siret,
        statutJuridique: artisan.statut_juridique,
        metiers: [],
        zoneIntervention: artisan.departement,
        commentaire: artisan.commentaire,
        statutDossier: artisan.statut_dossier,
        statutArtisan: artisan.statut_artisan,
        statutInactif: artisan.statut_inactif,
        adresseSiegeSocial: artisan.adresse_siege_social,
        villeSiegeSocial: artisan.ville_siege_social,
        codePostalSiegeSocial: artisan.code_postal_siege_social,
        adresseIntervention: artisan.adresse_intervention,
        villeIntervention: artisan.ville_intervention,
        codePostalIntervention: artisan.code_postal_intervention,
        interventionLatitude: artisan.intervention_latitude,
        interventionLongitude: artisan.intervention_longitude,
        attribueA: artisan.gestionnaire_id
      }));

      // Délai simulé désactivé en production pour performance optimale
      // const simulatedLatency = parseInt(Deno.env.get('SIMULATED_LATENCY') || '0');
      // await new Promise(resolve => setTimeout(resolve, simulatedLatency));

      const responseTime = Date.now() - startTime;
      
      // Log de succès
      console.log(JSON.stringify({
        level: 'info',
        requestId,
        responseTime,
        dataCount: transformedData.length,
        timestamp: new Date().toISOString(),
        message: 'Edge Function request completed successfully'
      }));

      return new Response(
        JSON.stringify({
          data: transformedData,
          pagination: {
            limit,
            offset,
            total: totalCount || 0,
            hasMore: transformedData.length === limit,
            cursor: data.length > 0 ? data[data.length - 1].id : null // Cursor pour la page suivante
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /artisans/{id} - Artisan par ID
    if (req.method === 'GET' && path && path !== 'artisans') {
      const { data, error } = await supabase
        .from('artisans')
        .select(`
          id,
          date,
          prenom,
          nom,
          telephone,
          telephone2,
          email,
          raison_sociale,
          siret,
          statut_juridique,
          statut_dossier,
          statut_artisan,
          statut_inactif,
          adresse_siege_social,
          ville_siege_social,
          code_postal_siege_social,
          adresse_intervention,
          ville_intervention,
          code_postal_intervention,
          intervention_latitude,
          intervention_longitude,
          commentaire,
          gestionnaire_id,
          metier_id,
          departement
        `)
        .eq('id', path)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transformer les données
      const transformedData = {
        id: data.id,
        date: data.date,
        prenom: data.prenom,
        nom: data.nom,
        telephone: data.telephone,
        telephone2: data.telephone2,
        email: data.email,
        raisonSociale: data.raison_sociale,
        siret: data.siret,
        statutJuridique: data.statut_juridique,
        metiers: [],
        zoneIntervention: data.departement,
        commentaire: data.commentaire,
        statutDossier: data.statut_dossier,
        statutArtisan: data.statut_artisan,
        statutInactif: data.statut_inactif,
        adresseSiegeSocial: data.adresse_siege_social,
        villeSiegeSocial: data.ville_siege_social,
        codePostalSiegeSocial: data.code_postal_siege_social,
        adresseIntervention: data.adresse_intervention,
        villeIntervention: data.ville_intervention,
        codePostalIntervention: data.code_postal_intervention,
        interventionLatitude: data.intervention_latitude,
        interventionLongitude: data.intervention_longitude,
        attribueA: data.gestionnaire_id
      };

      // Simuler le délai du MockAPI
      await new Promise(resolve => setTimeout(resolve, 50));

      return new Response(
        JSON.stringify(transformedData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
