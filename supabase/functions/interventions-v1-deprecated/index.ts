import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
// Cache temporairement désactivé

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Cache warming temporairement désactivé
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // GET /interventions - Liste toutes les interventions
    if (req.method === 'GET' && path === 'interventions') {
      const statut = url.searchParams.get('statut');
      const agence = url.searchParams.get('agence');
      const artisan = url.searchParams.get('artisan');
      const user = url.searchParams.get('user');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const limit = parseInt(url.searchParams.get('limit') || '35');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const cursor = url.searchParams.get('cursor'); // Nouveau paramètre pour cursor-based pagination

      // Sélection optimisée : seulement les colonnes nécessaires pour la liste
      let query = supabase
        .from('interventions')
        .select(`
          id,
          date,
          agence,
          contexte_intervention,
          adresse,
          ville,
          type,
          statut,
          sous_statut_text,
          sous_statut_text_color,
          prenom_client,
          nom_client,
          telephone_client,
          cout_sst,
          attribue_a,
          numero_sst,
          date_intervention
        `)
        .order('date', { ascending: false }); // Plus récent → plus ancien

      // Appliquer les filtres
      if (statut) {
        query = query.eq('statut', statut);
      }
      if (agence) {
        query = query.eq('agence', agence);
      }
      if (user) {
        query = query.eq('attribue_a', user);
      }
      if (startDate && endDate) {
        query = query.gte('date', startDate).lte('date', endDate);
      }

      // Compter le total d'interventions (pour la pagination) - sans cache temporairement
      const { count: totalCount } = await supabase
        .from('interventions')
        .select('*', { count: 'exact', head: true });

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
      const transformedData = data.map(intervention => ({
        id: intervention.id,
        idFacture: intervention.id_facture,
        date: intervention.date,
        dateTermine: intervention.date_termine,
        agence: intervention.agence,
        contexteIntervention: intervention.contexte_intervention,
        pieceJointeIntervention: intervention.piece_jointe_intervention || [],
        pieceJointeCout: intervention.piece_jointe_cout || [],
        pieceJointeDevis: intervention.piece_jointe_devis || [],
        pieceJointePhotos: intervention.piece_jointe_photos || [],
        pieceJointeFactureGMBS: intervention.piece_jointe_facture_gmbs || [],
        pieceJointeFactureArtisan: intervention.piece_jointe_facture_artisan || [],
        pieceJointeFactureMateriel: intervention.piece_jointe_facture_materiel || [],
        consigneIntervention: intervention.consigne_intervention,
        consigneDeuxiemeArtisanIntervention: intervention.consigne_deuxieme_artisan_intervention,
        commentaireAgent: intervention.commentaire_agent,
        adresse: intervention.adresse,
        codePostal: intervention.code_postal,
        ville: intervention.ville,
        latitudeAdresse: intervention.latitude_adresse,
        longitudeAdresse: intervention.longitude_adresse,
        type: intervention.type,
        typeDeuxiemeArtisan: intervention.type_deuxieme_artisan,
        datePrevue: intervention.date_prevue,
        datePrevueDeuxiemeArtisan: intervention.date_prevue_deuxieme_artisan,
        statut: intervention.statut,
        sousStatutText: intervention.sous_statut_text,
        sousStatutTextColor: intervention.sous_statut_text_color,
        prenomProprietaire: intervention.prenom_proprietaire,
        nomProprietaire: intervention.nom_proprietaire,
        telephoneProprietaire: intervention.telephone_proprietaire,
        emailProprietaire: intervention.email_proprietaire,
        prenomClient: intervention.prenom_client,
        nomClient: intervention.nom_client,
        telephoneClient: intervention.telephone_client,
        telephone2Client: intervention.telephone2_client,
        emailClient: intervention.email_client,
        coutSST: intervention.cout_sst,
        marge: intervention.marge,
        coutMateriel: intervention.cout_materiel,
        coutIntervention: intervention.cout_intervention,
        coutSSTDeuxiemeArtisan: intervention.cout_sst_deuxieme_artisan,
        margeDeuxiemeArtisan: intervention.marge_deuxieme_artisan,
        coutMaterielDeuxiemeArtisan: intervention.cout_materiel_deuxieme_artisan,
        acompteSST: intervention.acompte_sst,
        acompteClient: intervention.acompte_client,
        acompteSSTRecu: intervention.acompte_sst_recu,
        acompteClientRecu: intervention.acompte_client_recu,
        dateAcompteSST: intervention.date_acompte_sst,
        dateAcompteClient: intervention.date_acompte_client,
        deleteInterventionComptabilite: intervention.delete_intervention_comptabilite,
        attribueA: intervention.attribue_a,
        artisan: null, // TODO: Récupérer depuis intervention_artisans
        deuxiemeArtisan: null,
        metier: intervention.type, // Utiliser le type comme métier
        numeroSST: intervention.numero_sst,
        pourcentageSST: intervention.pourcentage_sst,
        dateIntervention: intervention.date_intervention,
        telLoc: intervention.telephone_client, // Utiliser le téléphone client
        locataire: intervention.nom_prenom_client,
        emailLocataire: intervention.email_client,
        commentaire: intervention.commentaire_agent,
        truspilot: intervention.truspilot,
        demandeIntervention: intervention.demande_intervention,
        demandeDevis: intervention.demande_devis,
        demandeTrustPilot: intervention.demande_trust_pilot
      }));

      // Délai simulé désactivé en production pour performance optimale
      // const simulatedLatency = parseInt(Deno.env.get('SIMULATED_LATENCY') || '0');
      // await new Promise(resolve => setTimeout(resolve, simulatedLatency));

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

    // GET /interventions/{id} - Intervention par ID
    if (req.method === 'GET' && path && path !== 'interventions') {
      const { data, error } = await supabase
        .from('interventions')
        .select(`
          id,
          id_facture,
          date,
          date_termine,
          agence,
          contexte_intervention,
          consigne_intervention,
          consigne_deuxieme_artisan_intervention,
          commentaire_agent,
          adresse,
          code_postal,
          ville,
          latitude_adresse,
          longitude_adresse,
          type,
          type_deuxieme_artisan,
          date_prevue,
          date_prevue_deuxieme_artisan,
          statut,
          sous_statut_text,
          sous_statut_text_color,
          prenom_proprietaire,
          nom_proprietaire,
          telephone_proprietaire,
          email_proprietaire,
          prenom_client,
          nom_client,
          telephone_client,
          telephone2_client,
          email_client,
          cout_sst,
          marge,
          cout_materiel,
          cout_intervention,
          cout_sst_deuxieme_artisan,
          marge_deuxieme_artisan,
          cout_materiel_deuxieme_artisan,
          acompte_sst,
          acompte_client,
          acompte_sst_recu,
          acompte_client_recu,
          date_acompte_sst,
          date_acompte_client,
          delete_intervention_comptabilite,
          attribue_a,
          created_at,
          updated_at,
          id_inter,
          proprietaire,
          nom_prenom_client,
          date_demande_intervention,
          date_demande_devis,
          numero_sst,
          pourcentage_sst,
          date_intervention,
          truspilot,
          demande_intervention,
          demande_devis,
          demande_trust_pilot,
          piece_jointe_intervention,
          piece_jointe_cout,
          piece_jointe_devis,
          piece_jointe_photos,
          piece_jointe_facture_gmbs,
          piece_jointe_facture_artisan,
          piece_jointe_facture_materiel
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
        idFacture: data.id_facture,
        date: data.date,
        dateTermine: data.date_termine,
        agence: data.agence,
        contexteIntervention: data.contexte_intervention,
        pieceJointeIntervention: data.piece_jointe_intervention || [],
        pieceJointeCout: data.piece_jointe_cout || [],
        pieceJointeDevis: data.piece_jointe_devis || [],
        pieceJointePhotos: data.piece_jointe_photos || [],
        pieceJointeFactureGMBS: data.piece_jointe_facture_gmbs || [],
        pieceJointeFactureArtisan: data.piece_jointe_facture_artisan || [],
        pieceJointeFactureMateriel: data.piece_jointe_facture_materiel || [],
        consigneIntervention: data.consigne_intervention,
        consigneDeuxiemeArtisanIntervention: data.consigne_deuxieme_artisan_intervention,
        commentaireAgent: data.commentaire_agent,
        adresse: data.adresse,
        codePostal: data.code_postal,
        ville: data.ville,
        latitudeAdresse: data.latitude_adresse,
        longitudeAdresse: data.longitude_adresse,
        type: data.type,
        typeDeuxiemeArtisan: data.type_deuxieme_artisan,
        datePrevue: data.date_prevue,
        datePrevueDeuxiemeArtisan: data.date_prevue_deuxieme_artisan,
        statut: data.statut,
        sousStatutText: data.sous_statut_text,
        sousStatutTextColor: data.sous_statut_text_color,
        prenomProprietaire: data.prenom_proprietaire,
        nomProprietaire: data.nom_proprietaire,
        telephoneProprietaire: data.telephone_proprietaire,
        emailProprietaire: data.email_proprietaire,
        prenomClient: data.prenom_client,
        nomClient: data.nom_client,
        telephoneClient: data.telephone_client,
        telephone2Client: data.telephone2_client,
        emailClient: data.email_client,
        coutSST: data.cout_sst,
        marge: data.marge,
        coutMateriel: data.cout_materiel,
        coutIntervention: data.cout_intervention,
        coutSSTDeuxiemeArtisan: data.cout_sst_deuxieme_artisan,
        margeDeuxiemeArtisan: data.marge_deuxieme_artisan,
        coutMaterielDeuxiemeArtisan: data.cout_materiel_deuxieme_artisan,
        acompteSST: data.acompte_sst,
        acompteClient: data.acompte_client,
        acompteSSTRecu: data.acompte_sst_recu,
        acompteClientRecu: data.acompte_client_recu,
        dateAcompteSST: data.date_acompte_sst,
        dateAcompteClient: data.date_acompte_client,
        deleteInterventionComptabilite: data.delete_intervention_comptabilite,
        attribueA: data.attribue_a,
        artisan: null,
        deuxiemeArtisan: null,
        metier: data.type, // Utiliser le type comme métier
        numeroSST: data.numero_sst,
        pourcentageSST: data.pourcentage_sst,
        dateIntervention: data.date_intervention,
        telLoc: data.telephone_client, // Utiliser le téléphone client
        locataire: data.nom_prenom_client,
        emailLocataire: data.email_client,
        commentaire: data.commentaire_agent,
        truspilot: data.truspilot,
        demandeIntervention: data.demande_intervention,
        demandeDevis: data.demande_devis,
        demandeTrustPilot: data.demande_trust_pilot
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
