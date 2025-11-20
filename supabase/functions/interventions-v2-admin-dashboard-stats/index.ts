// ===== DASHBOARD ADMINISTRATEUR - STATISTIQUES =====
// Edge Function pour récupérer toutes les statistiques du dashboard admin
// Utilise la table intervention_status_transitions pour un tracking précis

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DashboardStatsRequest {
  period_start: string;
  period_end: string;
}

interface MainStats {
  nbInterventionsDemandees: number;
  nbInterventionsTerminees: number;
  tauxTransformation: number;
  tauxMarge: number;
}

interface StatusStats {
  nbDemandesRecues: number;
  nbDevisEnvoye: number;
  nbEnCours: number;
  nbAttAcompte: number;
  nbAccepte: number;
  nbTermine: number;
  breakdown: Array<{
    statusCode: string;
    statusLabel: string;
    count: number;
  }>;
}

interface MetierStat {
  metierId: string;
  metierLabel: string;
  count: number;
  percentage: number;
}

interface AgencyStat {
  agencyId: string;
  agencyLabel: string;
  nbTotalInterventions: number;
  nbInterventionsTerminees: number;
  tauxMarge: number;
  ca: number;
  marge: number;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { period_start, period_end }: DashboardStatsRequest = await req.json();

    // Log: Début de la requête
    console.log('\n📊 ========================================');
    console.log('📊 DASHBOARD ADMIN - Edge Function');
    console.log('📊 ========================================');
    console.log(`📅 Période: ${period_start} → ${period_end}`);

    if (!period_start || !period_end) {
      console.error('\n❌ Paramètres manquants: period_start et period_end sont requis');
      return new Response(
        JSON.stringify({ error: 'period_start and period_end are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Convertir les dates en timestamps pour les requêtes
    const periodStartTimestamp = `${period_start}T00:00:00`;
    const periodEndTimestamp = `${period_end}T23:59:59`;

    // Log: Opérations en cours
    console.log('\n🔍 Opération: Exécution des requêtes en parallèle...');
    console.log('   - Statistiques principales');
    console.log('   - Statistiques par statut');
    console.log('   - Statistiques par métier');
    console.log('   - Statistiques par agence');

    // Toutes les requêtes en parallèle
    const [mainStats, statusStats, metierStats, agencyStats] = await Promise.all([
      getMainStats(supabaseClient, period_start, period_end, periodStartTimestamp, periodEndTimestamp),
      getStatusStats(supabaseClient, period_start, period_end, periodStartTimestamp, periodEndTimestamp),
      getMetierStats(supabaseClient, period_start, period_end, periodStartTimestamp, periodEndTimestamp),
      getAgencyStats(supabaseClient, period_start, period_end, periodStartTimestamp, periodEndTimestamp),
    ]);

    console.log('✅ Toutes les requêtes terminées avec succès');

    // Log: Résumé des résultats
    console.log('\n📈 ========================================');
    console.log('📈 RÉSUMÉ DES RÉSULTATS');
    console.log('📈 ========================================');
    console.log(`📥 Interventions demandées: ${mainStats.nbInterventionsDemandees}`);
    console.log(`✅ Interventions terminées: ${mainStats.nbInterventionsTerminees}`);
    console.log(`📊 Taux de transformation: ${mainStats.tauxTransformation.toFixed(2)}%`);
    console.log(`💰 Taux de marge: ${mainStats.tauxMarge.toFixed(2)}%`);
    console.log(`📋 Statuts différents: ${statusStats.breakdown.length}`);
    console.log(`🔧 Métiers différents: ${metierStats.length}`);
    console.log(`🏢 Agences différentes: ${agencyStats.length}`);
    console.log('✅ ========================================\n');

    return new Response(
      JSON.stringify({
        mainStats,
        statusStats,
        metierStats,
        agencyStats,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('❌ ERREUR DASHBOARD ADMIN - Edge Function');
    console.error('❌ ========================================');
    console.error('❌ Erreur:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('❌ Stack:', error.stack);
    }
    console.error('❌ ========================================\n');
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ========================================
// FONCTIONS HELPER POUR LES STATISTIQUES
// ========================================

async function getMainStats(
  supabase: any,
  periodStart: string,
  periodEnd: string,
  periodStartTimestamp: string,
  periodEndTimestamp: string
): Promise<MainStats> {
  // 1. Interventions demandées (statut DEMANDE) pendant la période
  const { count: nbDemandees } = await supabase
    .from('interventions')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .gte('date', periodStartTimestamp)
    .lt('date', `${periodEnd}T23:59:59`)
    .eq('intervention_statuses.code', 'DEMANDE')
    .inner('intervention_statuses', 'statut_id', 'id');

  // 2. Interventions terminées (passées en INTER_TERMINEE pendant la période)
  // Utiliser la table intervention_status_transitions pour avoir la date exacte
  const { count: nbTerminees } = await supabase
    .from('intervention_status_transitions')
    .select('*', { count: 'exact', head: true })
    .eq('to_status_code', 'INTER_TERMINEE')
    .gte('transition_date', periodStartTimestamp)
    .lte('transition_date', periodEndTimestamp);

  // 3. Taux de transformation
  // (Nombre de devis envoyé / par inter « terminé; accepté; encours » × 100)
  const { data: interValides } = await supabase
    .from('interventions')
    .select('id')
    .eq('is_active', true)
    .gte('date', periodStartTimestamp)
    .lt('date', `${periodEnd}T23:59:59`)
    .in('intervention_statuses.code', ['INTER_TERMINEE', 'ACCEPTE', 'INTER_EN_COURS'])
    .inner('intervention_statuses', 'statut_id', 'id');

  const { count: nbDevis } = await supabase
    .from('interventions')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .gte('date', periodStartTimestamp)
    .lt('date', `${periodEnd}T23:59:59`)
    .eq('intervention_statuses.code', 'DEVIS_ENVOYE')
    .inner('intervention_statuses', 'statut_id', 'id');

  const nbInterValides = interValides?.length || 0;
  const tauxTransformation = nbInterValides > 0
    ? Math.round(((nbDevis || 0) / nbInterValides) * 10000) / 100
    : 0;

  // 4. Taux de marge (sur interventions terminées de la période)
  // Récupérer les IDs des interventions terminées pendant la période
  const { data: interTerminees } = await supabase
    .from('intervention_status_transitions')
    .select('intervention_id')
    .eq('to_status_code', 'INTER_TERMINEE')
    .gte('transition_date', periodStartTimestamp)
    .lte('transition_date', periodEndTimestamp);

  const interIds = interTerminees?.map((i: any) => i.intervention_id) || [];

  let totalPaiements = 0;
  let totalCouts = 0;

  if (interIds.length > 0) {
    const { data: paiements } = await supabase
      .from('intervention_payments')
      .select('amount')
      .in('intervention_id', interIds)
      .eq('is_received', true);

    const { data: couts } = await supabase
      .from('intervention_costs')
      .select('amount')
      .in('intervention_id', interIds);

    totalPaiements = paiements?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
    totalCouts = couts?.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0) || 0;
  }

  const tauxMarge = totalPaiements > 0
    ? Math.round(((totalPaiements - totalCouts) / totalPaiements) * 10000) / 100
    : 0;

  return {
    nbInterventionsDemandees: nbDemandees || 0,
    nbInterventionsTerminees: nbTerminees || 0,
    tauxTransformation,
    tauxMarge,
  };
}

async function getStatusStats(
  supabase: any,
  periodStart: string,
  periodEnd: string,
  periodStartTimestamp: string,
  periodEndTimestamp: string
): Promise<StatusStats> {
  // Nombre de demandes reçues
  const { count: nbDemandesRecues } = await supabase
    .from('interventions')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .gte('date', periodStartTimestamp)
    .lt('date', `${periodEnd}T23:59:59`)
    .eq('intervention_statuses.code', 'DEMANDE')
    .inner('intervention_statuses', 'statut_id', 'id');

  // Breakdown par statut
  const { data: statusBreakdown } = await supabase
    .from('interventions')
    .select(`
      statut_id,
      intervention_statuses!inner(code, label)
    `)
    .eq('is_active', true)
    .gte('date', periodStartTimestamp)
    .lt('date', `${periodEnd}T23:59:59`);

  // Compter par statut
  const statusCounts: Record<string, { label: string; count: number }> = {};
  
  if (statusBreakdown) {
    statusBreakdown.forEach((item: any) => {
      const status = item.intervention_statuses;
      if (status && status.code) {
        if (!statusCounts[status.code]) {
          statusCounts[status.code] = { label: status.label || status.code, count: 0 };
        }
        statusCounts[status.code].count++;
      }
    });
  }

  const breakdown = Object.entries(statusCounts).map(([code, data]) => ({
    statusCode: code,
    statusLabel: data.label,
    count: data.count,
  }));

  return {
    nbDemandesRecues: nbDemandesRecues || 0,
    nbDevisEnvoye: statusCounts['DEVIS_ENVOYE']?.count || 0,
    nbEnCours: statusCounts['INTER_EN_COURS']?.count || 0,
    nbAttAcompte: statusCounts['ATT_ACOMPTE']?.count || 0,
    nbAccepte: statusCounts['ACCEPTE']?.count || 0,
    nbTermine: statusCounts['INTER_TERMINEE']?.count || 0,
    breakdown,
  };
}

async function getMetierStats(
  supabase: any,
  periodStart: string,
  periodEnd: string,
  periodStartTimestamp: string,
  periodEndTimestamp: string
): Promise<MetierStat[]> {
  // Récupérer toutes les interventions de la période avec leurs métiers
  const { data: interventions } = await supabase
    .from('interventions')
    .select(`
      metier_id,
      metiers!inner(id, label)
    `)
    .eq('is_active', true)
    .gte('date', periodStartTimestamp)
    .lt('date', `${periodEnd}T23:59:59`)
    .not('metier_id', 'is', null);

  // Compter par métier
  const metierCounts: Record<string, { label: string; count: number }> = {};
  let total = 0;

  if (interventions) {
    interventions.forEach((item: any) => {
      const metier = item.metiers;
      if (metier && metier.id) {
        if (!metierCounts[metier.id]) {
          metierCounts[metier.id] = { label: metier.label || 'Inconnu', count: 0 };
        }
        metierCounts[metier.id].count++;
        total++;
      }
    });
  }

  // Calculer les pourcentages
  return Object.entries(metierCounts).map(([metierId, data]) => ({
    metierId,
    metierLabel: data.label,
    count: data.count,
    percentage: total > 0 ? Math.round((data.count / total) * 10000) / 100 : 0,
  })).sort((a, b) => b.count - a.count);
}

async function getAgencyStats(
  supabase: any,
  periodStart: string,
  periodEnd: string,
  periodStartTimestamp: string,
  periodEndTimestamp: string
): Promise<AgencyStat[]> {
  // Récupérer toutes les interventions terminées de la période avec leurs agences
  const { data: interTerminees } = await supabase
    .from('intervention_status_transitions')
    .select('intervention_id')
    .eq('to_status_code', 'INTER_TERMINEE')
    .gte('transition_date', periodStartTimestamp)
    .lte('transition_date', periodEndTimestamp);

  const interTermineesIds = interTerminees?.map((i: any) => i.intervention_id) || [];

  // Récupérer toutes les interventions de la période avec leurs agences
  const { data: allInterventions } = await supabase
    .from('interventions')
    .select(`
      id,
      agence_id,
      agencies!inner(id, label)
    `)
    .eq('is_active', true)
    .gte('date', periodStartTimestamp)
    .lt('date', `${periodEnd}T23:59:59`)
    .not('agence_id', 'is', null);

  // Compter par agence
  const agencyData: Record<string, {
    label: string;
    totalInterventions: number;
    terminatedInterventions: Set<string>;
  }> = {};

  if (allInterventions) {
    allInterventions.forEach((item: any) => {
      const agency = item.agencies;
      if (agency && agency.id) {
        if (!agencyData[agency.id]) {
          agencyData[agency.id] = {
            label: agency.label || 'Inconnu',
            totalInterventions: 0,
            terminatedInterventions: new Set(),
          };
        }
        agencyData[agency.id].totalInterventions++;
        
        if (interTermineesIds.includes(item.id)) {
          agencyData[agency.id].terminatedInterventions.add(item.id);
        }
      }
    });
  }

  // Calculer CA, marge et taux de marge pour chaque agence
  const agencyStats: AgencyStat[] = [];

  for (const [agencyId, data] of Object.entries(agencyData)) {
    const terminatedIds = Array.from(data.terminatedInterventions);

    let totalPaiements = 0;
    let totalCouts = 0;

    if (terminatedIds.length > 0) {
      const { data: paiements } = await supabase
        .from('intervention_payments')
        .select('amount')
        .in('intervention_id', terminatedIds)
        .eq('is_received', true);

      const { data: couts } = await supabase
        .from('intervention_costs')
        .select('amount')
        .in('intervention_id', terminatedIds);

      totalPaiements = paiements?.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0) || 0;
      totalCouts = couts?.reduce((sum: number, c: any) => sum + (Number(c.amount) || 0), 0) || 0;
    }

    const marge = totalPaiements - totalCouts;
    const tauxMarge = totalPaiements > 0
      ? Math.round((marge / totalPaiements) * 10000) / 100
      : 0;

    agencyStats.push({
      agencyId,
      agencyLabel: data.label,
      nbTotalInterventions: data.totalInterventions,
      nbInterventionsTerminees: terminatedIds.length,
      tauxMarge,
      ca: totalPaiements,
      marge,
    });
  }

  return agencyStats.sort((a, b) => b.ca - a.ca);
}

