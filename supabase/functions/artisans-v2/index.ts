// ===== API ARTISANS COMPLÈTE ET SCALABLE =====
// Service API Supabase - CRUD complet pour les artisans
// 
// FEATURES:
// - CRUD complet (Create, Read, Update, Delete)
// - Gestion des métiers et zones d'intervention
// - Assignation par gestionnaire
// - Gestion des documents/attachments
// - Gestion des absences
// - Pagination optimisée
// - Validation des données
// - Gestion d'erreurs robuste

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Types pour la validation
interface CreateArtisanRequest {
  prenom?: string;
  nom?: string;
  telephone?: string;
  telephone2?: string;
  email?: string;
  raison_sociale?: string;
  siret?: string;
  statut_juridique?: string;
  statut_id?: string;
  gestionnaire_id?: string;
  adresse_siege_social?: string;
  ville_siege_social?: string;
  code_postal_siege_social?: string;
  adresse_intervention?: string;
  ville_intervention?: string;
  code_postal_intervention?: string;
  intervention_latitude?: number;
  intervention_longitude?: number;
  numero_associe?: string;
  suivi_relances_docs?: string;
  metiers?: string[];
  zones?: string[];
}

interface UpdateArtisanRequest {
  prenom?: string;
  nom?: string;
  telephone?: string;
  telephone2?: string;
  email?: string;
  raison_sociale?: string;
  siret?: string;
  statut_juridique?: string;
  statut_id?: string;
  gestionnaire_id?: string;
  adresse_siege_social?: string;
  ville_siege_social?: string;
  code_postal_siege_social?: string;
  adresse_intervention?: string;
  ville_intervention?: string;
  code_postal_intervention?: string;
  intervention_latitude?: number;
  intervention_longitude?: number;
  numero_associe?: string;
  suivi_relances_docs?: string;
  is_active?: boolean;
  metiers?: string[];
  zones?: string[];
}

interface AssignMetierRequest {
  artisan_id: string;
  metier_id: string;
  is_primary?: boolean;
}

interface AssignZoneRequest {
  artisan_id: string;
  zone_id: string;
}

interface CreateAbsenceRequest {
  artisan_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  is_confirmed?: boolean;
}

interface CreateAttachmentRequest {
  artisan_id: string;
  kind: string;
  url: string;
  filename?: string;
  mime_type?: string;
  file_size?: number;
}

// ===== GEOCODING FUNCTIONS =====
// Similar logic to scripts/geocode-artisans.ts

interface GeocodeResult {
  lat: number;
  lng: number;
  provider: 'opencage' | 'nominatim';
}

/**
 * Build address candidates from artisan data
 * Prioritizes intervention address, falls back to headquarters address
 */
function buildAddressCandidates(artisan: {
  adresse_intervention?: string;
  code_postal_intervention?: string;
  ville_intervention?: string;
  adresse_siege_social?: string;
  code_postal_siege_social?: string;
  ville_siege_social?: string;
}): string[] {
  const candidates: string[] = [];

  const interventionParts = [
    artisan.adresse_intervention,
    artisan.code_postal_intervention,
    artisan.ville_intervention,
  ]
    .filter(Boolean)
    .map((value) => value?.trim());

  if (interventionParts.length >= 2) {
    candidates.push(interventionParts.join(', '));
  }

  const hqParts = [
    artisan.adresse_siege_social,
    artisan.code_postal_siege_social,
    artisan.ville_siege_social,
  ]
    .filter(Boolean)
    .map((value) => value?.trim());

  if (hqParts.length >= 2) {
    const formatted = hqParts.join(', ');
    if (!candidates.includes(formatted)) {
      candidates.push(formatted);
    }
  }

  return candidates;
}

/**
 * Geocode using OpenCage API (primary provider)
 */
async function geocodeWithOpenCage(address: string): Promise<GeocodeResult | null> {
  const apiKey = Deno.env.get('OPENCAGE_API_KEY');
  if (!apiKey) {
    return null;
  }

  try {
    const endpoint = new URL('https://api.opencagedata.com/geocode/v1/json');
    endpoint.searchParams.set('q', address);
    endpoint.searchParams.set('key', apiKey);
    endpoint.searchParams.set('limit', '1');
    endpoint.searchParams.set('language', 'fr');
    endpoint.searchParams.set('no_annotations', '1');

    const response = await fetch(endpoint.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[geocode] OpenCage failed (${response.status})`);
      return null;
    }

    const payload = await response.json();
    const match = payload.results?.[0]?.geometry;
    if (!match || match.lat == null || match.lng == null) {
      return null;
    }

    return { lat: match.lat, lng: match.lng, provider: 'opencage' };
  } catch (error) {
    console.warn(`[geocode] OpenCage error: ${error.message}`);
    return null;
  }
}

/**
 * Geocode using Nominatim API (fallback provider)
 */
async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
  try {
    const endpoint = new URL('https://nominatim.openstreetmap.org/search');
    endpoint.searchParams.set('q', address);
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('limit', '1');
    endpoint.searchParams.set('addressdetails', '0');

    const response = await fetch(endpoint.toString(), {
      headers: {
        'User-Agent': 'gmbs-crm-artisans-api/1.0 (contact@webcraft.fr)',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[geocode] Nominatim failed (${response.status})`);
      return null;
    }

    const payload = await response.json();
    const match = payload[0];
    if (!match?.lat || !match?.lon) {
      return null;
    }

    return {
      lat: parseFloat(match.lat),
      lng: parseFloat(match.lon),
      provider: 'nominatim',
    };
  } catch (error) {
    console.warn(`[geocode] Nominatim error: ${error.message}`);
    return null;
  }
}

/**
 * Geocode an address using OpenCage with Nominatim fallback
 */
async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) {
    return null;
  }

  // Try OpenCage first (if API key available)
  const withOpenCage = await geocodeWithOpenCage(trimmed);
  if (withOpenCage) {
    return withOpenCage;
  }

  // Fallback to Nominatim
  return geocodeWithNominatim(trimmed);
}

/**
 * Geocode an artisan based on their address data
 * Returns coordinates if successful, null otherwise
 */
async function geocodeArtisan(artisan: {
  adresse_intervention?: string;
  code_postal_intervention?: string;
  ville_intervention?: string;
  adresse_siege_social?: string;
  code_postal_siege_social?: string;
  ville_siege_social?: string;
}): Promise<GeocodeResult | null> {
  const candidates = buildAddressCandidates(artisan);

  if (candidates.length === 0) {
    console.log('[geocode] No address available for geocoding');
    return null;
  }

  for (const candidate of candidates) {
    const result = await geocodeAddress(candidate);
    if (result) {
      console.log(`[geocode] Success: ${result.lat.toFixed(6)}, ${result.lng.toFixed(6)} (${result.provider})`);
      return result;
    }
  }

  console.log('[geocode] No match found for any address candidate');
  return null;
}

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

  console.log(JSON.stringify({
    level: 'info',
    requestId,
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    message: 'Artisans API request started'
  }));

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(segment => segment);
    
    // Parsing plus robuste pour gérer les sous-ressources
    let resource = pathSegments[pathSegments.length - 1];
    let resourceId = null;
    let isUpsert = false;
    
    // Routes spéciales sans ID (ex: /artisans/check-deleted)
    const specialRoutes = ['check-deleted', 'upsert'];
    
    // Détecter si c'est une requête upsert
    if (pathSegments.includes('upsert')) {
      isUpsert = true;
      resource = 'artisans';
    }
    
    // Pour /artisans-v2/artisans/check-deleted (routes spéciales sans ID)
    if (pathSegments.length >= 3 && 
        pathSegments[pathSegments.length - 2] === 'artisans' && 
        specialRoutes.includes(pathSegments[pathSegments.length - 1])) {
      resource = pathSegments[pathSegments.length - 1];
      resourceId = null;
    }
    // Pour /artisans-v2/artisans/{id}/metiers, /artisans/{id}/restore, /artisans/{id}/permanent
    else if (pathSegments.length >= 4 && pathSegments[pathSegments.length - 3] === 'artisans') {
      resourceId = pathSegments[pathSegments.length - 2];
      resource = pathSegments[pathSegments.length - 1];
    }
    // Pour /artisans-v2/artisans/{id}
    else if (pathSegments.length >= 3 && pathSegments[pathSegments.length - 2] === 'artisans') {
      resourceId = pathSegments[pathSegments.length - 1];
      resource = 'artisans';
    }
    // Pour /artisans-v2/artisans
    else if (pathSegments.length >= 2 && pathSegments[pathSegments.length - 1] === 'artisans') {
      resource = 'artisans';
    }

    // ===== GET /artisans - Liste tous les artisans =====
    if (req.method === 'GET' && resource === 'artisans') {
      const metier = url.searchParams.get('metier');
      const zone = url.searchParams.get('zone');
      const statut = url.searchParams.get('statut');
      const gestionnaire = url.searchParams.get('gestionnaire');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const includeRelations = url.searchParams.get('include')?.split(',') || [];

      let query = supabase
        .from('artisans')
        .select(`
          id,
          prenom,
          nom,
          telephone,
          telephone2,
          email,
          raison_sociale,
          siret,
          statut_juridique,
          statut_id,
          gestionnaire_id,
          adresse_siege_social,
          ville_siege_social,
          code_postal_siege_social,
          adresse_intervention,
          ville_intervention,
          code_postal_intervention,
          intervention_latitude,
          intervention_longitude,
          numero_associe,
          suivi_relances_docs,
          is_active,
          date_ajout,
          created_at,
          updated_at
          ${includeRelations.includes('statuses') ? ',artisan_statuses(id,code,label,color)' : ''}
          ${includeRelations.includes('gestionnaires') ? ',users!gestionnaire_id(id,firstname,lastname,username)' : ''}
          ${includeRelations.includes('metiers') ? ',artisan_metiers(metier_id,is_primary,metiers(id,label,code))' : ''}
          ${includeRelations.includes('zones') ? ',artisan_zones(zone_id,zones(id,label,code))' : ''}
          ${includeRelations.includes('attachments') ? ',artisan_attachments(id,kind,url,filename,mime_type)' : ''}
          ${includeRelations.includes('absences') ? ',artisan_absences(id,start_date,end_date,reason,is_confirmed)' : ''}
        `)
        .order('nom', { ascending: true })
        .order('prenom', { ascending: true });

      // Appliquer les filtres
      if (statut) {
        query = query.eq('statut_id', statut);
      }
      if (gestionnaire) {
        query = query.eq('gestionnaire_id', gestionnaire);
      }

      // Filtrer les artisans actifs
      query = query.eq('is_active', true);

      // Compter le total
      const { count: totalCount } = await supabase
        .from('artisans')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Appliquer pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Si métier ou zone est spécifié, filtrer les artisans correspondants
      let filteredData = data || [];
      if (metier) {
        const { data: metierArtisans } = await supabase
          .from('artisan_metiers')
          .select('artisan_id')
          .eq('metier_id', metier);
        
        const artisanIds = metierArtisans?.map(am => am.artisan_id) || [];
        filteredData = filteredData.filter(artisan => artisanIds.includes(artisan.id));
      }

      if (zone) {
        const { data: zoneArtisans } = await supabase
          .from('artisan_zones')
          .select('artisan_id')
          .eq('zone_id', zone);
        
        const artisanIds = zoneArtisans?.map(az => az.artisan_id) || [];
        filteredData = filteredData.filter(artisan => artisanIds.includes(artisan.id));
      }

      const responseTime = Date.now() - startTime;
      
      console.log(JSON.stringify({
        level: 'info',
        requestId,
        responseTime,
        dataCount: filteredData.length,
        timestamp: new Date().toISOString(),
        message: 'Artisans list retrieved successfully'
      }));

      return new Response(
        JSON.stringify({
          data: filteredData,
          pagination: {
            limit,
            offset,
            total: totalCount || 0,
            hasMore: filteredData.length === limit
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== GET /artisans/{id} - Artisan par ID =====
    if (req.method === 'GET' && resourceId && resource === 'artisans') {
      const includeRelations = url.searchParams.get('include')?.split(',') || [];

      const { data, error } = await supabase
        .from('artisans')
        .select(`
          id,
          prenom,
          nom,
          telephone,
          telephone2,
          email,
          raison_sociale,
          siret,
          statut_juridique,
          statut_id,
          gestionnaire_id,
          adresse_siege_social,
          ville_siege_social,
          code_postal_siege_social,
          adresse_intervention,
          ville_intervention,
          code_postal_intervention,
          intervention_latitude,
          intervention_longitude,
          numero_associe,
          suivi_relances_docs,
          is_active,
          date_ajout,
          created_at,
          updated_at
          ${includeRelations.includes('statuses') ? ',artisan_statuses(id,code,label,color)' : ''}
          ${includeRelations.includes('gestionnaires') ? ',users!gestionnaire_id(id,firstname,lastname,username)' : ''}
          ${includeRelations.includes('metiers') ? ',artisan_metiers(metier_id,is_primary,metiers(id,label,code))' : ''}
          ${includeRelations.includes('zones') ? ',artisan_zones(zone_id,zones(id,label,code))' : ''}
          ${includeRelations.includes('attachments') ? ',artisan_attachments(id,kind,url,filename,mime_type,content_hash,derived_sizes,mime_preferred)' : ''}
          ${includeRelations.includes('absences') ? ',artisan_absences(id,start_date,end_date,reason,is_confirmed)' : ''}
          ${includeRelations.includes('interventions') ? ',intervention_artisans(intervention_id,role,is_primary,interventions(id,date,statut_id,contexte_intervention))' : ''}
        `)
        .eq('id', resourceId)
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Artisan not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /artisans/upsert - Upsert un artisan =====
    if (req.method === 'POST' && resource === 'artisans' && isUpsert) {
      const body: CreateArtisanRequest = await req.json();

      // Validation des données requises pour l'upsert
      if (!body.email && !body.siret) {
        return new Response(
          JSON.stringify({ error: 'Email or SIRET is required for upsert operation' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Vérifier si l'artisan existe déjà par email ou SIRET
      let existingArtisan = null;
      
      if (body.email) {
        const { data: emailArtisan } = await supabase
          .from('artisans')
          .select('id')
          .eq('email', body.email)
          .single();
        existingArtisan = emailArtisan;
      }
      
      if (!existingArtisan && body.siret) {
        const { data: siretArtisan } = await supabase
          .from('artisans')
          .select('id')
          .eq('siret', body.siret)
          .single();
        existingArtisan = siretArtisan;
      }

      if (existingArtisan) {
        // Mettre à jour l'artisan existant
        const { data: updatedArtisan, error: updateError } = await supabase
          .from('artisans')
          .update({
            prenom: body.prenom,
            nom: body.nom,
            telephone: body.telephone,
            telephone2: body.telephone2,
            raison_sociale: body.raison_sociale,
            siret: body.siret,
            statut_juridique: body.statut_juridique,
            statut_id: body.statut_id,
            gestionnaire_id: body.gestionnaire_id,
            adresse_siege_social: body.adresse_siege_social,
            ville_siege_social: body.ville_siege_social,
            code_postal_siege_social: body.code_postal_siege_social,
            adresse_intervention: body.adresse_intervention,
            ville_intervention: body.ville_intervention,
            code_postal_intervention: body.code_postal_intervention,
            intervention_latitude: body.intervention_latitude,
            intervention_longitude: body.intervention_longitude,
            numero_associe: body.numero_associe,
            suivi_relances_docs: body.suivi_relances_docs,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingArtisan.id)
          .select()
          .single();

        if (updateError) {
          throw new Error(`Failed to update artisan: ${updateError.message}`);
        }

        // Mettre à jour les métiers si spécifiés
        if (body.metiers && body.metiers.length > 0) {
          // Supprimer les anciens métiers
          await supabase
            .from('artisan_metiers')
            .delete()
            .eq('artisan_id', existingArtisan.id);

          // Ajouter les nouveaux métiers
          const metierInserts = body.metiers.map((metierId, index) => ({
            artisan_id: existingArtisan.id,
            metier_id: metierId,
            is_primary: index === 0
          }));

          const { error: metierError } = await supabase
            .from('artisan_metiers')
            .insert(metierInserts);

          if (metierError) {
            console.warn(`Failed to update metiers: ${metierError.message}`);
          }
        }

        // Mettre à jour les zones si spécifiées
        if (body.zones && body.zones.length > 0) {
          // Supprimer les anciennes zones
          await supabase
            .from('artisan_zones')
            .delete()
            .eq('artisan_id', existingArtisan.id);

          // Ajouter les nouvelles zones
          const zoneInserts = body.zones.map(zoneId => ({
            artisan_id: existingArtisan.id,
            zone_id: zoneId
          }));

          const { error: zoneError } = await supabase
            .from('artisan_zones')
            .insert(zoneInserts);

          if (zoneError) {
            console.warn(`Failed to update zones: ${zoneError.message}`);
          }
        }

        console.log(JSON.stringify({
          level: 'info',
          requestId,
          artisanId: existingArtisan.id,
          timestamp: new Date().toISOString(),
          message: 'Artisan updated successfully via upsert'
        }));

        return new Response(
          JSON.stringify(updatedArtisan),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Créer un nouvel artisan (logique identique à POST /artisans)
        const { data: artisan, error: artisanError } = await supabase
          .from('artisans')
          .insert([{
            prenom: body.prenom,
            nom: body.nom,
            telephone: body.telephone,
            telephone2: body.telephone2,
            email: body.email,
            raison_sociale: body.raison_sociale,
            siret: body.siret,
            statut_juridique: body.statut_juridique,
            statut_id: body.statut_id,
            gestionnaire_id: body.gestionnaire_id,
            adresse_siege_social: body.adresse_siege_social,
            ville_siege_social: body.ville_siege_social,
            code_postal_siege_social: body.code_postal_siege_social,
            adresse_intervention: body.adresse_intervention,
            ville_intervention: body.ville_intervention,
            code_postal_intervention: body.code_postal_intervention,
            intervention_latitude: body.intervention_latitude,
            intervention_longitude: body.intervention_longitude,
            numero_associe: body.numero_associe,
            suivi_relances_docs: body.suivi_relances_docs,
            is_active: true,
            date_ajout: new Date().toISOString()
          }])
          .select()
          .single();

        if (artisanError) {
          throw new Error(`Failed to create artisan: ${artisanError.message}`);
        }

        // Ajouter les métiers si spécifiés
        if (body.metiers && body.metiers.length > 0) {
          const metierInserts = body.metiers.map((metierId, index) => ({
            artisan_id: artisan.id,
            metier_id: metierId,
            is_primary: index === 0
          }));

          const { error: metierError } = await supabase
            .from('artisan_metiers')
            .insert(metierInserts);

          if (metierError) {
            console.warn(`Failed to assign metiers: ${metierError.message}`);
          }
        }

        // Ajouter les zones si spécifiées
        if (body.zones && body.zones.length > 0) {
          const zoneInserts = body.zones.map(zoneId => ({
            artisan_id: artisan.id,
            zone_id: zoneId
          }));

          const { error: zoneError } = await supabase
            .from('artisan_zones')
            .insert(zoneInserts);

          if (zoneError) {
            console.warn(`Failed to assign zones: ${zoneError.message}`);
          }
        }

        // ===== GEOCODING AUTOMATIQUE (UPSERT - CREATION) =====
        // Géocoder automatiquement si l'artisan a une adresse et pas de coordonnées fournies
        let finalArtisan = artisan;
        if (!body.intervention_latitude && !body.intervention_longitude) {
          const geocodeResult = await geocodeArtisan({
            adresse_intervention: body.adresse_intervention,
            code_postal_intervention: body.code_postal_intervention,
            ville_intervention: body.ville_intervention,
            adresse_siege_social: body.adresse_siege_social,
            code_postal_siege_social: body.code_postal_siege_social,
            ville_siege_social: body.ville_siege_social,
          });

          if (geocodeResult) {
            // Mettre à jour l'artisan avec les coordonnées
            const { data: updatedArtisan, error: updateError } = await supabase
              .from('artisans')
              .update({
                intervention_latitude: geocodeResult.lat,
                intervention_longitude: geocodeResult.lng,
              })
              .eq('id', artisan.id)
              .select()
              .single();

            if (updateError) {
              console.warn(`[geocode] Failed to update artisan coordinates: ${updateError.message}`);
            } else {
              finalArtisan = updatedArtisan;
              console.log(JSON.stringify({
                level: 'info',
                requestId,
                artisanId: artisan.id,
                latitude: geocodeResult.lat,
                longitude: geocodeResult.lng,
                provider: geocodeResult.provider,
                timestamp: new Date().toISOString(),
                message: 'Artisan geocoded successfully via upsert'
              }));
            }
          }
        }

        console.log(JSON.stringify({
          level: 'info',
          requestId,
          artisanId: artisan.id,
          timestamp: new Date().toISOString(),
          message: 'Artisan created successfully via upsert'
        }));

        return new Response(
          JSON.stringify(finalArtisan),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== POST /artisans - Créer un artisan =====
    if (req.method === 'POST' && resource === 'artisans' && !isUpsert) {
      const body: CreateArtisanRequest = await req.json();

      // ===== VÉRIFICATION DES DOUBLONS (email/siret) =====
      // Vérifier si un artisan existe déjà avec cet email ou SIRET (actif OU supprimé)
      if (body.email || body.siret) {
        // Vérifier par email
        if (body.email) {
          const { data: existingByEmail } = await supabase
            .from('artisans')
            .select('id, prenom, nom, email, siret, raison_sociale, is_active, updated_at')
            .eq('email', body.email)
            .maybeSingle();

          if (existingByEmail) {
            if (!existingByEmail.is_active) {
              // Artisan supprimé trouvé - retourner un code spécial pour le frontend
              return new Response(
                JSON.stringify({
                  error: 'DELETED_ARTISAN_EXISTS',
                  message: 'Un artisan supprimé existe déjà avec cet email',
                  artisan: {
                    id: existingByEmail.id,
                    prenom: existingByEmail.prenom,
                    nom: existingByEmail.nom,
                    email: existingByEmail.email,
                    siret: existingByEmail.siret,
                    raison_sociale: existingByEmail.raison_sociale,
                  },
                  deleted_at: existingByEmail.updated_at,
                }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              // Artisan actif trouvé
              return new Response(
                JSON.stringify({ error: `Un artisan actif existe déjà avec l'email ${body.email}` }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }

        // Vérifier par SIRET
        if (body.siret) {
          const { data: existingBySiret } = await supabase
            .from('artisans')
            .select('id, prenom, nom, email, siret, raison_sociale, is_active, updated_at')
            .eq('siret', body.siret)
            .maybeSingle();

          if (existingBySiret) {
            if (!existingBySiret.is_active) {
              // Artisan supprimé trouvé
              return new Response(
                JSON.stringify({
                  error: 'DELETED_ARTISAN_EXISTS',
                  message: 'Un artisan supprimé existe déjà avec ce SIRET',
                  artisan: {
                    id: existingBySiret.id,
                    prenom: existingBySiret.prenom,
                    nom: existingBySiret.nom,
                    email: existingBySiret.email,
                    siret: existingBySiret.siret,
                    raison_sociale: existingBySiret.raison_sociale,
                  },
                  deleted_at: existingBySiret.updated_at,
                }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else {
              // Artisan actif trouvé
              return new Response(
                JSON.stringify({ error: `Un artisan actif existe déjà avec le SIRET ${body.siret}` }),
                { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }
      }

      // Règle : À la création, l'artisan doit être soit CANDIDAT (par défaut) soit POTENTIEL
      // Si aucun statut n'est fourni ou si le statut fourni n'est pas autorisé, utiliser CANDIDAT
      let finalStatutId = body.statut_id;
      if (finalStatutId) {
        // Vérifier que le statut fourni est CANDIDAT ou POTENTIEL
        const { data: statusCheck } = await supabase
          .from('artisan_statuses')
          .select('code')
          .eq('id', finalStatutId)
          .single();
        
        const statusCode = statusCheck?.code?.toUpperCase();
        if (statusCode !== 'CANDIDAT' && statusCode !== 'POTENTIEL') {
          // Si le statut n'est pas autorisé, utiliser CANDIDAT par défaut
          const { data: candidatStatus } = await supabase
            .from('artisan_statuses')
            .select('id')
            .eq('code', 'CANDIDAT')
            .single();
          finalStatutId = candidatStatus?.id || null;
        }
      } else {
        // Si aucun statut fourni, utiliser CANDIDAT par défaut
        const { data: candidatStatus } = await supabase
          .from('artisan_statuses')
          .select('id')
          .eq('code', 'CANDIDAT')
          .single();
        finalStatutId = candidatStatus?.id || null;
      }

      // Validation des données requises
      if (!body.prenom && !body.nom) {
        return new Response(
          JSON.stringify({ error: 'At least prenom or nom is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: artisan, error: artisanError } = await supabase
        .from('artisans')
        .insert([{
          prenom: body.prenom,
          nom: body.nom,
          telephone: body.telephone,
          telephone2: body.telephone2,
          email: body.email,
          raison_sociale: body.raison_sociale,
          siret: body.siret,
          statut_juridique: body.statut_juridique,
          statut_id: finalStatutId, // Utiliser finalStatutId (CANDIDAT ou POTENTIEL uniquement)
          statut_dossier: 'INCOMPLET', // Initialiser le statut de dossier à INCOMPLET
          gestionnaire_id: body.gestionnaire_id,
          adresse_siege_social: body.adresse_siege_social,
          ville_siege_social: body.ville_siege_social,
          code_postal_siege_social: body.code_postal_siege_social,
          adresse_intervention: body.adresse_intervention,
          ville_intervention: body.ville_intervention,
          code_postal_intervention: body.code_postal_intervention,
          intervention_latitude: body.intervention_latitude,
          intervention_longitude: body.intervention_longitude,
          numero_associe: body.numero_associe,
          suivi_relances_docs: body.suivi_relances_docs,
          is_active: true,
          date_ajout: new Date().toISOString()
        }])
        .select()
        .single();

      if (artisanError) {
        throw new Error(`Failed to create artisan: ${artisanError.message}`);
      }

      // Ajouter les métiers si spécifiés
      if (body.metiers && body.metiers.length > 0) {
        const metierInserts = body.metiers.map((metierId, index) => ({
          artisan_id: artisan.id,
          metier_id: metierId,
          is_primary: index === 0 // Premier métier = primaire
        }));

        const { error: metierError } = await supabase
          .from('artisan_metiers')
          .insert(metierInserts);

        if (metierError) {
          console.warn(`Failed to assign metiers: ${metierError.message}`);
        }
      }

      // Ajouter les zones si spécifiées
      if (body.zones && body.zones.length > 0) {
        const zoneInserts = body.zones.map(zoneId => ({
          artisan_id: artisan.id,
          zone_id: zoneId
        }));

        const { error: zoneError } = await supabase
          .from('artisan_zones')
          .insert(zoneInserts);

        if (zoneError) {
          console.warn(`Failed to assign zones: ${zoneError.message}`);
        }
      }

      // ===== GEOCODING AUTOMATIQUE =====
      // Géocoder automatiquement si l'artisan a une adresse et pas de coordonnées fournies
      let finalArtisan = artisan;
      if (!body.intervention_latitude && !body.intervention_longitude) {
        const geocodeResult = await geocodeArtisan({
          adresse_intervention: body.adresse_intervention,
          code_postal_intervention: body.code_postal_intervention,
          ville_intervention: body.ville_intervention,
          adresse_siege_social: body.adresse_siege_social,
          code_postal_siege_social: body.code_postal_siege_social,
          ville_siege_social: body.ville_siege_social,
        });

        if (geocodeResult) {
          // Mettre à jour l'artisan avec les coordonnées
          const { data: updatedArtisan, error: updateError } = await supabase
            .from('artisans')
            .update({
              intervention_latitude: geocodeResult.lat,
              intervention_longitude: geocodeResult.lng,
            })
            .eq('id', artisan.id)
            .select()
            .single();

          if (updateError) {
            console.warn(`[geocode] Failed to update artisan coordinates: ${updateError.message}`);
          } else {
            finalArtisan = updatedArtisan;
            console.log(JSON.stringify({
              level: 'info',
              requestId,
              artisanId: artisan.id,
              latitude: geocodeResult.lat,
              longitude: geocodeResult.lng,
              provider: geocodeResult.provider,
              timestamp: new Date().toISOString(),
              message: 'Artisan geocoded successfully'
            }));
          }
        }
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: artisan.id,
        timestamp: new Date().toISOString(),
        message: 'Artisan created successfully'
      }));

      return new Response(
        JSON.stringify(finalArtisan),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== PUT /artisans/{id} - Modifier un artisan =====
    if (req.method === 'PUT' && resourceId && resource === 'artisans') {
      const body: UpdateArtisanRequest = await req.json();

      // Validation des transitions de statut selon les règles métier
      if (body.statut_id !== undefined) {
        // Récupérer le statut actuel de l'artisan
        const { data: currentArtisan } = await supabase
          .from('artisans')
          .select('statut_id')
          .eq('id', resourceId)
          .single();

        if (currentArtisan?.statut_id) {
          // Récupérer les codes des statuts
          const { data: currentStatus } = await supabase
            .from('artisan_statuses')
            .select('code')
            .eq('id', currentArtisan.statut_id)
            .single();

          const { data: newStatus } = await supabase
            .from('artisan_statuses')
            .select('code')
            .eq('id', body.statut_id)
            .single();

          const currentCode = currentStatus?.code?.toUpperCase();
          const newCode = newStatus?.code?.toUpperCase();

          // Vérifier si la transition est autorisée
          if (currentCode && newCode && currentCode !== newCode) {
            // ARCHIVE peut être atteint depuis n'importe quel statut (géré côté frontend avec raison)
            if (newCode === 'ARCHIVE') {
              // Autoriser l'archivage
            }
            // CANDIDAT → POTENTIEL ou ONE_SHOT : autorisé
            else if (currentCode === 'CANDIDAT' && (newCode === 'POTENTIEL' || newCode === 'ONE_SHOT')) {
              // Autoriser la transition
            }
            // Les autres transitions manuelles ne sont pas autorisées
            // Les transitions automatiques sont gérées par les triggers
            else {
              return new Response(
                JSON.stringify({ 
                  error: `Transition de statut non autorisée : ${currentCode} → ${newCode}. Seules les transitions CANDIDAT → POTENTIEL/ONE_SHOT et vers ARCHIVE sont autorisées manuellement.` 
                }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          }
        }
      }

      const { data, error } = await supabase
        .from('artisans')
        .update({
          prenom: body.prenom,
          nom: body.nom,
          telephone: body.telephone,
          telephone2: body.telephone2,
          email: body.email,
          raison_sociale: body.raison_sociale,
          siret: body.siret,
          statut_juridique: body.statut_juridique,
          statut_id: body.statut_id,
          gestionnaire_id: body.gestionnaire_id,
          adresse_siege_social: body.adresse_siege_social,
          ville_siege_social: body.ville_siege_social,
          code_postal_siege_social: body.code_postal_siege_social,
          adresse_intervention: body.adresse_intervention,
          ville_intervention: body.ville_intervention,
          code_postal_intervention: body.code_postal_intervention,
          intervention_latitude: body.intervention_latitude,
          intervention_longitude: body.intervention_longitude,
          numero_associe: body.numero_associe,
          suivi_relances_docs: body.suivi_relances_docs,
          is_active: body.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', resourceId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update artisan: ${error.message}`);
      }

      // Mettre à jour les métiers si spécifiés
      if (body.metiers !== undefined) {
        // Supprimer les métiers existants
        await supabase
          .from('artisan_metiers')
          .delete()
          .eq('artisan_id', resourceId);

        // Ajouter les nouveaux métiers
        if (body.metiers.length > 0) {
          const metierInserts = body.metiers.map((metierId, index) => ({
            artisan_id: resourceId,
            metier_id: metierId,
            is_primary: index === 0
          }));

          const { error: metierError } = await supabase
            .from('artisan_metiers')
            .insert(metierInserts);

          if (metierError) {
            console.warn(`Failed to update metiers: ${metierError.message}`);
          }
        }
      }

      // Mettre à jour les zones si spécifiées
      if (body.zones !== undefined) {
        // Supprimer les zones existantes
        await supabase
          .from('artisan_zones')
          .delete()
          .eq('artisan_id', resourceId);

        // Ajouter les nouvelles zones
        if (body.zones.length > 0) {
          const zoneInserts = body.zones.map(zoneId => ({
            artisan_id: resourceId,
            zone_id: zoneId
          }));

          const { error: zoneError } = await supabase
            .from('artisan_zones')
            .insert(zoneInserts);

          if (zoneError) {
            console.warn(`Failed to update zones: ${zoneError.message}`);
          }
        }
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Artisan updated successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== DELETE /artisans/{id} - Supprimer un artisan (soft delete) =====
    if (req.method === 'DELETE' && resourceId && resource === 'artisans') {
      const { data, error } = await supabase
        .from('artisans')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', resourceId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to delete artisan: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Artisan deleted successfully'
      }));

      return new Response(
        JSON.stringify({ message: 'Artisan deleted successfully', data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /artisans/{id}/metiers - Assigner un métier =====
    if (req.method === 'POST' && resourceId && resource === 'metiers') {
      const body: AssignMetierRequest = await req.json();

      if (!body.metier_id) {
        return new Response(
          JSON.stringify({ error: 'metier_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('artisan_metiers')
        .insert([{
          artisan_id: resourceId,
          metier_id: body.metier_id,
          is_primary: body.is_primary ?? false
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to assign metier: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: resourceId,
        metierId: body.metier_id,
        timestamp: new Date().toISOString(),
        message: 'Metier assigned successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /artisans/{id}/zones - Assigner une zone =====
    if (req.method === 'POST' && resourceId && resource === 'zones') {
      const body: AssignZoneRequest = await req.json();

      if (!body.zone_id) {
        return new Response(
          JSON.stringify({ error: 'zone_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('artisan_zones')
        .insert([{
          artisan_id: resourceId,
          zone_id: body.zone_id
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to assign zone: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: resourceId,
        zoneId: body.zone_id,
        timestamp: new Date().toISOString(),
        message: 'Zone assigned successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /artisans/{id}/absences - Créer une absence =====
    if (req.method === 'POST' && resourceId && resource === 'absences') {
      const body: CreateAbsenceRequest = await req.json();

      if (!body.start_date || !body.end_date) {
        return new Response(
          JSON.stringify({ error: 'start_date and end_date are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('artisan_absences')
        .insert([{
          artisan_id: resourceId,
          start_date: body.start_date,
          end_date: body.end_date,
          reason: body.reason,
          is_confirmed: body.is_confirmed ?? false
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create absence: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: resourceId,
        absenceId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Absence created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /artisans/{id}/documents - Ajouter un document Drive =====
    if (req.method === 'POST' && resourceId && resource === 'documents') {
      const body = await req.json();

      if (!body.kind || !body.url || !body.filename) {
        return new Response(
          JSON.stringify({ error: 'kind, url, and filename are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('artisan_attachments')
        .insert({
          artisan_id: resourceId,
          kind: body.kind,
          url: body.url,
          filename: body.filename,
          mime_type: body.mime_type || 'application/octet-stream'
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create document: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: resourceId,
        documentId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Document created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /artisans/{id}/metiers - Ajouter un métier =====
    if (req.method === 'POST' && resourceId && resource === 'metiers') {
      const body = await req.json();

      if (!body.metier_id) {
        return new Response(
          JSON.stringify({ error: 'metier_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Utiliser upsert pour éviter les problèmes de contrainte de clé unique
        const result = await supabase
          .from('artisan_metiers')
          .upsert({
            artisan_id: resourceId,
            metier_id: body.metier_id,
            is_primary: body.is_primary || false
          }, {
            onConflict: 'artisan_id,metier_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (result.error) {
          throw new Error(`Failed to assign metier: ${result.error.message}`);
        }

        console.log(JSON.stringify({
          level: 'info',
          requestId,
          artisanId: resourceId,
          metierId: result.data.metier_id,
          timestamp: new Date().toISOString(),
          message: 'Artisan metier assigned successfully'
        }));

        return new Response(
          JSON.stringify(result.data),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error(JSON.stringify({
          level: 'error',
          requestId,
          artisanId: resourceId,
          metierId: body.metier_id,
          timestamp: new Date().toISOString(),
          error: error.message
        }));

        return new Response(
          JSON.stringify({ error: `Failed to assign metier: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== POST /artisans/{id}/zones - Ajouter une zone =====
    if (req.method === 'POST' && resourceId && resource === 'zones') {
      const body = await req.json();

      if (!body.zone_id) {
        return new Response(
          JSON.stringify({ error: 'zone_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        // Utiliser upsert pour éviter les problèmes de contrainte de clé unique
        const result = await supabase
          .from('artisan_zones')
          .upsert({
            artisan_id: resourceId,
            zone_id: body.zone_id
          }, {
            onConflict: 'artisan_id,zone_id',
            ignoreDuplicates: false
          })
          .select()
          .single();

        if (result.error) {
          throw new Error(`Failed to assign zone: ${result.error.message}`);
        }

        console.log(JSON.stringify({
          level: 'info',
          requestId,
          artisanId: resourceId,
          zoneId: result.data.zone_id,
          timestamp: new Date().toISOString(),
          message: 'Artisan zone assigned successfully'
        }));

        return new Response(
          JSON.stringify(result.data),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error(JSON.stringify({
          level: 'error',
          requestId,
          artisanId: resourceId,
          zoneId: body.zone_id,
          timestamp: new Date().toISOString(),
          error: error.message
        }));

        return new Response(
          JSON.stringify({ error: `Failed to assign zone: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ===== POST /artisans/{id}/attachments - Ajouter un document =====
    if (req.method === 'POST' && resourceId && resource === 'attachments') {
      const body: CreateAttachmentRequest = await req.json();

      if (!body.kind || !body.url) {
        return new Response(
          JSON.stringify({ error: 'kind and url are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data, error } = await supabase
        .from('artisan_attachments')
        .insert([{
          artisan_id: resourceId,
          kind: body.kind,
          url: body.url,
          filename: body.filename,
          mime_type: body.mime_type,
          file_size: body.file_size
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create attachment: ${error.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: resourceId,
        attachmentId: data.id,
        timestamp: new Date().toISOString(),
        message: 'Attachment created successfully'
      }));

      return new Response(
        JSON.stringify(data),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /artisans/check-deleted - Vérifier si un artisan supprimé existe =====
    if (req.method === 'POST' && resource === 'check-deleted') {
      const body = await req.json();
      const { email, siret } = body;

      if (!email && !siret) {
        return new Response(
          JSON.stringify({ error: 'Email or SIRET is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Chercher un artisan supprimé avec cet email ou SIRET
      let deletedArtisan = null;

      if (email) {
        const { data: emailArtisan } = await supabase
          .from('artisans')
          .select(`
            id, prenom, nom, email, siret, raison_sociale,
            is_active, updated_at,
            status:artisan_statuses(id, code, label)
          `)
          .eq('email', email)
          .eq('is_active', false)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (emailArtisan) {
          deletedArtisan = emailArtisan;
        }
      }

      if (!deletedArtisan && siret) {
        const { data: siretArtisan } = await supabase
          .from('artisans')
          .select(`
            id, prenom, nom, email, siret, raison_sociale,
            is_active, updated_at,
            status:artisan_statuses(id, code, label)
          `)
          .eq('siret', siret)
          .eq('is_active', false)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (siretArtisan) {
          deletedArtisan = siretArtisan;
        }
      }

      if (deletedArtisan) {
        return new Response(
          JSON.stringify({
            found: true,
            artisan: deletedArtisan,
            deleted_at: deletedArtisan.updated_at,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ found: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== POST /artisans/{id}/restore - Restaurer un artisan supprimé =====
    if (req.method === 'POST' && resourceId && resource === 'restore') {
      const body = await req.json();
      const { newData } = body; // Données optionnelles pour mettre à jour l'artisan lors de la restauration

      // Vérifier que l'artisan existe et est supprimé
      const { data: existingArtisan, error: findError } = await supabase
        .from('artisans')
        .select('id, is_active')
        .eq('id', resourceId)
        .single();

      if (findError || !existingArtisan) {
        return new Response(
          JSON.stringify({ error: 'Artisan not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (existingArtisan.is_active) {
        return new Response(
          JSON.stringify({ error: 'Artisan is already active' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Restaurer l'artisan et mettre à jour les données si fournies
      const updatePayload: Record<string, any> = {
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      // Appliquer les nouvelles données si fournies
      if (newData) {
        if (newData.prenom !== undefined) updatePayload.prenom = newData.prenom;
        if (newData.nom !== undefined) updatePayload.nom = newData.nom;
        if (newData.telephone !== undefined) updatePayload.telephone = newData.telephone;
        if (newData.telephone2 !== undefined) updatePayload.telephone2 = newData.telephone2;
        if (newData.email !== undefined) updatePayload.email = newData.email;
        if (newData.raison_sociale !== undefined) updatePayload.raison_sociale = newData.raison_sociale;
        if (newData.siret !== undefined) updatePayload.siret = newData.siret;
        if (newData.statut_juridique !== undefined) updatePayload.statut_juridique = newData.statut_juridique;
        if (newData.statut_id !== undefined) updatePayload.statut_id = newData.statut_id;
        if (newData.gestionnaire_id !== undefined) updatePayload.gestionnaire_id = newData.gestionnaire_id;
        if (newData.adresse_siege_social !== undefined) updatePayload.adresse_siege_social = newData.adresse_siege_social;
        if (newData.ville_siege_social !== undefined) updatePayload.ville_siege_social = newData.ville_siege_social;
        if (newData.code_postal_siege_social !== undefined) updatePayload.code_postal_siege_social = newData.code_postal_siege_social;
        if (newData.adresse_intervention !== undefined) updatePayload.adresse_intervention = newData.adresse_intervention;
        if (newData.ville_intervention !== undefined) updatePayload.ville_intervention = newData.ville_intervention;
        if (newData.code_postal_intervention !== undefined) updatePayload.code_postal_intervention = newData.code_postal_intervention;
        if (newData.intervention_latitude !== undefined) updatePayload.intervention_latitude = newData.intervention_latitude;
        if (newData.intervention_longitude !== undefined) updatePayload.intervention_longitude = newData.intervention_longitude;
        if (newData.numero_associe !== undefined) updatePayload.numero_associe = newData.numero_associe;
        if (newData.suivi_relances_docs !== undefined) updatePayload.suivi_relances_docs = newData.suivi_relances_docs;
      }

      const { data: restoredArtisan, error: restoreError } = await supabase
        .from('artisans')
        .update(updatePayload)
        .eq('id', resourceId)
        .select()
        .single();

      if (restoreError) {
        throw new Error(`Failed to restore artisan: ${restoreError.message}`);
      }

      // Mettre à jour les métiers si spécifiés
      if (newData?.metiers && newData.metiers.length > 0) {
        // Supprimer les anciens métiers
        await supabase
          .from('artisan_metiers')
          .delete()
          .eq('artisan_id', resourceId);

        // Ajouter les nouveaux métiers
        const metierInserts = newData.metiers.map((metierId: string, index: number) => ({
          artisan_id: resourceId,
          metier_id: metierId,
          is_primary: index === 0
        }));

        await supabase
          .from('artisan_metiers')
          .insert(metierInserts);
      }

      // Mettre à jour les zones si spécifiées
      if (newData?.zones && newData.zones.length > 0) {
        // Supprimer les anciennes zones
        await supabase
          .from('artisan_zones')
          .delete()
          .eq('artisan_id', resourceId);

        // Ajouter les nouvelles zones
        const zoneInserts = newData.zones.map((zoneId: string) => ({
          artisan_id: resourceId,
          zone_id: zoneId
        }));

        await supabase
          .from('artisan_zones')
          .insert(zoneInserts);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Artisan restored successfully'
      }));

      return new Response(
        JSON.stringify({ message: 'Artisan restored successfully', data: restoredArtisan }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== DELETE /artisans/{id}/permanent - Suppression définitive (hard delete) =====
    if (req.method === 'DELETE' && resourceId && resource === 'permanent') {
      // Vérifier que l'artisan existe et est déjà soft-deleted
      const { data: existingArtisan, error: findError } = await supabase
        .from('artisans')
        .select('id, is_active')
        .eq('id', resourceId)
        .single();

      if (findError || !existingArtisan) {
        return new Response(
          JSON.stringify({ error: 'Artisan not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Supprimer les relations
      await supabase.from('artisan_metiers').delete().eq('artisan_id', resourceId);
      await supabase.from('artisan_zones').delete().eq('artisan_id', resourceId);
      await supabase.from('artisan_absences').delete().eq('artisan_id', resourceId);
      await supabase.from('artisan_attachments').delete().eq('artisan_id', resourceId);

      // Suppression définitive
      const { error: deleteError } = await supabase
        .from('artisans')
        .delete()
        .eq('id', resourceId);

      if (deleteError) {
        throw new Error(`Failed to permanently delete artisan: ${deleteError.message}`);
      }

      console.log(JSON.stringify({
        level: 'info',
        requestId,
        artisanId: resourceId,
        timestamp: new Date().toISOString(),
        message: 'Artisan permanently deleted'
      }));

      return new Response(
        JSON.stringify({ message: 'Artisan permanently deleted' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.log(JSON.stringify({
      level: 'error',
      requestId,
      responseTime,
      error: error.message,
      timestamp: new Date().toISOString(),
      message: 'Artisans API request failed'
    }));

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
