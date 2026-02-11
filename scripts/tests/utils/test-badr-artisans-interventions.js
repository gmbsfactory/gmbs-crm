/**
 * Script de test pour vérifier les interventions des artisans de Badr
 * 
 * Ce script :
 * 1. Trouve l'utilisateur Badr
 * 2. Récupère tous ses artisans
 * 3. Pour chaque artisan, vérifie s'il a des interventions
 * 4. Affiche un rapport détaillé
 * 
 * Usage depuis la racine du projet:
 *   node scripts/tests/test-badr-artisans-interventions.js
 * 
 * Usage depuis scripts/core-window../lib/supabase-client
 *   node ../tests/test-badr-artisans-interventions.js
 */

const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, './lib/supabase-client'));

// Configuration
const GESTIONNAIRE_NAME = 'Badr'; // Peut être 'Badr' ou le nom complet
const YEAR = 2025; // Année à vérifier

// Couleurs pour la console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80));
}

function formatDate(dateString) {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

async function findGestionnaire(name) {
  logSection(`Recherche du gestionnaire: ${name}`);
  
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, firstname, lastname, email, code_gestionnaire, email')
    .or(`firstname.ilike.%${name}%,lastname.ilike.%${name}%`);
  
  if (error) {
    log(`❌ Erreur lors de la recherche: ${error.message}`, 'red');
    throw error;
  }
  
  if (!data || data.length === 0) {
    log(`❌ Aucun gestionnaire trouvé avec le nom "${name}"`, 'red');
    return null;
  }
  
  if (data.length > 1) {
    log(`⚠️  Plusieurs gestionnaires trouvés:`, 'yellow');
    data.forEach((user, index) => {
      log(`  ${index + 1}. ${user.firstname} ${user.lastname} (${user.email}) - ID: ${user.id}`, 'cyan');
    });
    log(`\n⚠️  Utilisation du premier résultat`, 'yellow');
  }
  
  const gestionnaire = data[0];
  log(`✅ Gestionnaire trouvé:`, 'green');
  log(`   Nom: ${gestionnaire.firstname} ${gestionnaire.lastname}`, 'cyan');
  log(`   Email: ${gestionnaire.email}`, 'cyan');
  log(`   Code: ${gestionnaire.code_gestionnaire || 'N/A'}`, 'cyan');
  log(`   ID: ${gestionnaire.id}`, 'cyan');
  
  return gestionnaire;
}

async function getArtisansByGestionnaire(gestionnaireId) {
  logSection('Récupération des artisans');
  
  const { data, error } = await supabaseAdmin
    .from('artisans')
    .select(`
      id,
      prenom,
      nom,
      raison_sociale,
      is_active,
      created_at,
      date_ajout,
      status:artisan_statuses(id, code, label)
    `)
    .eq('gestionnaire_id', gestionnaireId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  
  if (error) {
    log(`❌ Erreur lors de la récupération des artisans: ${error.message}`, 'red');
    throw error;
  }
  
  log(`✅ ${data.length} artisan(s) actif(s) trouvé(s)`, 'green');
  
  return data || [];
}

async function getInterventionsByArtisan(artisanId, year) {
  const startDate = `${year}-01-01T00:00:00Z`;
  const endDate = `${year}-12-31T23:59:59Z`;
  
  const { data, error } = await supabaseAdmin
    .from('intervention_artisans')
    .select(`
      intervention_id,
      is_primary,
      role,
      assigned_at,
      interventions!inner (
        id,
        id_inter,
        date,
        due_date,
        date_prevue,
        is_active,
        status:intervention_statuses(id, code, label, color),
        metier:metiers(id, code, label),
        intervention_costs(cost_type, amount)
      )
    `)
    .eq('artisan_id', artisanId)
    .eq('interventions.is_active', true)
    .gte('interventions.date', startDate)
    .lte('interventions.date', endDate);
  
  if (error) {
    log(`❌ Erreur lors de la récupération des interventions: ${error.message}`, 'red');
    return [];
  }
  
  return (data || []).map(item => {
    const intervention = item.interventions;
    
    // Calculer la marge
    let marge = 0;
    if (intervention.intervention_costs && Array.isArray(intervention.intervention_costs)) {
      intervention.intervention_costs.forEach(cost => {
        if (cost.cost_type === 'marge' && cost.amount !== null && cost.amount !== undefined) {
          marge += Number(cost.amount);
        }
      });
    }
    
    return {
      id: intervention.id,
      id_inter: intervention.id_inter,
      date: intervention.date,
      due_date: intervention.due_date,
      date_prevue: intervention.date_prevue,
      status: intervention.status,
      metier: intervention.metier,
      marge,
      is_primary: item.is_primary,
      role: item.role,
      assigned_at: item.assigned_at,
    };
  });
}

async function analyzeArtisan(artisan, year) {
  const artisanName = artisan.raison_sociale || `${artisan.prenom || ''} ${artisan.nom || ''}`.trim() || 'Sans nom';
  const statusLabel = artisan.status?.label || 'Sans statut';
  
  log(`\n📋 Artisan: ${artisanName}`, 'cyan');
  log(`   Statut: ${statusLabel}`, 'cyan');
  log(`   ID: ${artisan.id}`, 'cyan');
  log(`   Créé le: ${formatDate(artisan.created_at)}`, 'cyan');
  
  const interventions = await getInterventionsByArtisan(artisan.id, year);
  
  if (interventions.length === 0) {
    log(`   ❌ Aucune intervention en ${year}`, 'red');
    return {
      artisan,
      interventions: [],
      total: 0,
      margeTotal: 0,
      hasInterventions: false,
    };
  }
  
  log(`   ✅ ${interventions.length} intervention(s) trouvée(s) en ${year}`, 'green');
  
  // Afficher les détails des interventions
  interventions.forEach((intervention, index) => {
    log(`\n   Intervention ${index + 1}:`, 'yellow');
    log(`      ID: ${intervention.id_inter || intervention.id}`, 'cyan');
    log(`      Date: ${formatDate(intervention.date)}`, 'cyan');
    log(`      Statut: ${intervention.status?.label || 'N/A'}`, 'cyan');
    log(`      Métier: ${intervention.metier?.label || 'N/A'}`, 'cyan');
    log(`      Marge: ${intervention.marge.toFixed(2)} €`, 'cyan');
    log(`      Due date: ${formatDate(intervention.due_date)}`, 'cyan');
    log(`      Rôle: ${intervention.is_primary ? 'Principal' : 'Secondaire'}`, 'cyan');
  });
  
  const margeTotal = interventions.reduce((sum, i) => sum + i.marge, 0);
  
  return {
    artisan,
    interventions,
    total: interventions.length,
    margeTotal,
    hasInterventions: true,
  };
}

async function main() {
  try {
    log('\n🔍 Vérification des interventions des artisans de Badr', 'bright');
    log(`   Année: ${YEAR}`, 'cyan');
    
    // 1. Trouver le gestionnaire
    const gestionnaire = await findGestionnaire(GESTIONNAIRE_NAME);
    if (!gestionnaire) {
      process.exit(1);
    }
    
    // 2. Récupérer les artisans
    const artisans = await getArtisansByGestionnaire(gestionnaire.id);
    
    if (artisans.length === 0) {
      logSection('Résultat');
      log('❌ Aucun artisan trouvé pour ce gestionnaire', 'red');
      process.exit(0);
    }
    
    // 3. Analyser chaque artisan
    logSection('Analyse des artisans');
    
    const results = [];
    for (const artisan of artisans) {
      const result = await analyzeArtisan(artisan, YEAR);
      results.push(result);
    }
    
    // 4. Résumé
    logSection('Résumé');
    
    const artisansAvecInterventions = results.filter(r => r.hasInterventions);
    const artisansSansInterventions = results.filter(r => !r.hasInterventions);
    
    log(`Total d'artisans: ${artisans.length}`, 'bright');
    log(`✅ Artisans avec interventions en ${YEAR}: ${artisansAvecInterventions.length}`, 'green');
    log(`❌ Artisans sans interventions en ${YEAR}: ${artisansSansInterventions.length}`, 'red');
    
    if (artisansAvecInterventions.length > 0) {
      const totalInterventions = artisansAvecInterventions.reduce((sum, r) => sum + r.total, 0);
      const totalMarge = artisansAvecInterventions.reduce((sum, r) => sum + r.margeTotal, 0);
      
      log(`\n📊 Statistiques des interventions:`, 'bright');
      log(`   Total d'interventions: ${totalInterventions}`, 'cyan');
      log(`   Marge totale: ${totalMarge.toFixed(2)} €`, 'cyan');
    }
    
    if (artisansSansInterventions.length > 0) {
      log(`\n⚠️  Artisans sans interventions:`, 'yellow');
      artisansSansInterventions.forEach(r => {
        const name = r.artisan.raison_sociale || `${r.artisan.prenom || ''} ${r.artisan.nom || ''}`.trim() || 'Sans nom';
        log(`   - ${name} (${r.artisan.status?.label || 'Sans statut'})`, 'yellow');
      });
    }
    
    // 5. Vérifier les interventions hors période
    logSection('Vérification des interventions hors période 2025');
    
    let totalInterventionsHorsPeriode = 0;
    for (const artisan of artisans) {
      const { data } = await supabaseAdmin
        .from('intervention_artisans')
        .select('intervention_id, interventions!inner(id, date, is_active)')
        .eq('artisan_id', artisan.id)
        .eq('interventions.is_active', true)
        .or('interventions.date.lt.2025-01-01,interventions.date.gt.2025-12-31');
      
      if (data && data.length > 0) {
        const name = artisan.raison_sociale || `${artisan.prenom || ''} ${artisan.nom || ''}`.trim() || 'Sans nom';
        log(`   ${name}: ${data.length} intervention(s) hors période 2025`, 'yellow');
        totalInterventionsHorsPeriode += data.length;
      }
    }
    
    if (totalInterventionsHorsPeriode > 0) {
      log(`\n⚠️  Total d'interventions hors période 2025: ${totalInterventionsHorsPeriode}`, 'yellow');
    } else {
      log(`✅ Aucune intervention trouvée hors période 2025`, 'green');
    }
    
    log('\n✅ Analyse terminée', 'green');
    
  } catch (error) {
    log(`\n❌ Erreur fatale: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Exécuter le script
main();
