#!/usr/bin/env node

/**
 * Script d'export SQL vers Excel/Google Sheets
 * 
 * Exporte les données du CRM (Artisans et Interventions) vers un fichier Excel
 * 
 * Usage:
 *   node scripts/exports/export-to-sheets.js
 *   node scripts/exports/export-to-sheets.js --output ./exports/export.xlsx
 *   node scripts/exports/export-to-sheets.js --years 2024,2023
 */

const path = require('path');
const fs = require('fs');
const { supabaseAdmin } = require('../lib/supabase-client');
const ExcelFormatter = require('./formatters/excel-formatter');

// Configuration
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'exports');
const DEFAULT_FILENAME = `Export_GMBS_CRM_${new Date().toISOString().split('T')[0]}.xlsx`;

// Parse des arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    output: null,
    years: null,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--years' || arg === '-y') {
      options.years = args[++i].split(',').map(y => parseInt(y.trim()));
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
📊 Export SQL vers Excel/Google Sheets

Usage:
  node scripts/exports/export-to-sheets.js [options]

Options:
  --output, -o <path>    Chemin du fichier de sortie (défaut: exports/Export_GMBS_CRM_YYYY-MM-DD.xlsx)
  --years, -y <years>    Années à exporter (séparées par virgule, ex: 2024,2023)
  --verbose, -v          Mode verbeux
  --help, -h             Affiche cette aide

Exemples:
  node scripts/exports/export-to-sheets.js
  node scripts/exports/export-to-sheets.js --output ./backup.xlsx
  node scripts/exports/export-to-sheets.js --years 2024,2023 --verbose
`);
}

async function ensureOutputDir(outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Dossier créé: ${dir}`);
  }
}

async function exportArtisans(formatter, verbose = false) {
  console.log('👷 Export des artisans...');
  
  // Récupérer les artisans avec leurs relations
  const { data: artisans, error } = await supabaseAdmin
    .from('artisans')
    .select(`
      *,
      users!gestionnaire_id(username, firstname, lastname),
      artisan_statuses!statut_id(code, label)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  if (!artisans || artisans.length === 0) {
    console.log('   ⚠️  Aucun artisan trouvé');
    return 0;
  }

  if (verbose) {
    console.log(`   ✅ ${artisans.length} artisans trouvés`);
  }

  // Enrichir avec les métiers et zones
  const enrichedArtisans = await Promise.all(
    artisans.map(async (artisan) => {
      // Récupérer les métiers
      const { data: metiersData } = await supabaseAdmin
        .from('artisan_metiers')
        .select('metiers(label)')
        .eq('artisan_id', artisan.id);

      const metiers = metiersData
        ?.map(am => am.metiers?.label)
        .filter(Boolean)
        .sort()
        .join(', ') || '';

      // Récupérer les zones
      const { data: zonesData } = await supabaseAdmin
        .from('artisan_zones')
        .select('zones(label)')
        .eq('artisan_id', artisan.id);

      const zones = zonesData
        ?.map(az => az.zones?.label)
        .filter(Boolean)
        .sort()
        .join(' | ') || '';

      return {
        ...artisan,
        gestionnaire_username: artisan.users?.username || '',
        gestionnaire_firstname: artisan.users?.firstname || '',
        gestionnaire_lastname: artisan.users?.lastname || '',
        statut_code: artisan.artisan_statuses?.code || '',
        statut_label: artisan.artisan_statuses?.label || '',
        metiers,
        zones,
      };
    })
  );

  formatter.addArtisansSheet(enrichedArtisans);
  console.log('   ✅ Feuille "Artisans" créée');
  
  return enrichedArtisans.length;
}

async function getInterventionsYears() {
  // Récupérer toutes les dates d'interventions
  const { data, error } = await supabaseAdmin
    .from('interventions')
    .select('date')
    .not('date', 'is', null);

  if (error) throw error;

  if (!data || data.length === 0) {
    return [];
  }

  const years = [...new Set(data.map(row => {
    const date = new Date(row.date);
    return date.getFullYear();
  }))].sort((a, b) => b - a);

  return years;
}

async function exportInterventions(formatter, years = null, verbose = false) {
  console.log('🔧 Export des interventions...');

  // Récupérer les années disponibles
  const availableYears = await getInterventionsYears();
  
  if (availableYears.length === 0) {
    console.log('   ⚠️  Aucune intervention trouvée');
    return 0;
  }

  // Filtrer par années demandées
  const yearsToExport = years 
    ? availableYears.filter(y => years.includes(y))
    : availableYears;

  if (verbose) {
    console.log(`   📅 Années disponibles: ${availableYears.join(', ')}`);
    console.log(`   📅 Années à exporter: ${yearsToExport.join(', ')}`);
  }

  let totalInterventions = 0;

  for (const year of yearsToExport) {
    console.log(`   📄 Export des interventions de ${year}...`);
    
    // Récupérer les interventions de l'année avec leurs relations
    const { data: interventions, error } = await supabaseAdmin
      .from('interventions')
      .select(`
        *,
        agencies!agence_id(code, label),
        tenants!tenant_id(external_ref, firstname, lastname),
        owner!owner_id(external_ref, owner_firstname, owner_lastname),
        users!assigned_user_id(username, firstname, lastname),
        intervention_statuses!statut_id(code, label),
        metiers!metier_id(code, label)
      `)
      .gte('date', `${year}-01-01T00:00:00Z`)
      .lt('date', `${year + 1}-01-01T00:00:00Z`)
      .order('date', { ascending: false });

    if (error) {
      console.error(`   ❌ Erreur pour ${year}:`, error.message);
      continue;
    }

    if (!interventions || interventions.length === 0) {
      if (verbose) {
        console.log(`      ⚠️  Aucune intervention pour ${year}`);
      }
      continue;
    }

    // Enrichir avec les relations manquantes (artisans, costs, payments)
    const enrichedData = await enrichInterventionsData(interventions);
    formatter.addInterventionsSheet(enrichedData, year);
    totalInterventions += enrichedData.length;
    
    if (verbose) {
      console.log(`      ✅ ${enrichedData.length} interventions exportées`);
    }
  }

  console.log(`   ✅ ${totalInterventions} interventions exportées au total`);
  return totalInterventions;
}

/**
 * Enrichit les données d'interventions avec les relations manuelles
 */
async function enrichInterventionsData(interventions) {
  const enriched = [];

  for (const intervention of interventions) {
    // Récupérer les artisans
    const { data: artisansData } = await supabaseAdmin
      .from('intervention_artisans')
      .select(`
        is_primary,
        artisans(plain_nom)
      `)
      .eq('intervention_id', intervention.id);

    const artisansList = artisansData
      ?.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      .map(ia => ia.artisans?.plain_nom)
      .filter(Boolean)
      .join(', ') || '';

    // Récupérer les coûts
    const { data: costsData } = await supabaseAdmin
      .from('intervention_costs')
      .select('intervention_id, label, amount, currency, metadata')
      .eq('intervention_id', intervention.id)
      .order('created_at', { ascending: true });

    const costsList = costsData ? JSON.stringify(costsData.map(c => ({
      intervention_id: c.intervention_id,
      label: c.label,
      amount: c.amount,
      currency: c.currency,
      metadata: c.metadata
    }))) : '[]';

    // Récupérer les paiements
    const { data: paymentsData } = await supabaseAdmin
      .from('intervention_payments')
      .select('payment_type, amount, currency, payment_date')
      .eq('intervention_id', intervention.id)
      .order('payment_date', { ascending: true });

    const paymentsList = paymentsData ? JSON.stringify(paymentsData.map(p => ({
      payment_type: p.payment_type,
      amount: p.amount,
      currency: p.currency,
      payment_date: p.payment_date
    }))) : '[]';

    enriched.push({
      ...intervention,
      agence_code: intervention.agencies?.code || '',
      agence_label: intervention.agencies?.label || '',
      tenant_external_ref: intervention.tenants?.external_ref || '',
      tenant_firstname: intervention.tenants?.firstname || '',
      tenant_lastname: intervention.tenants?.lastname || '',
      owner_external_ref: intervention.owner?.external_ref || '',
      owner_firstname: intervention.owner?.owner_firstname || '',
      owner_lastname: intervention.owner?.owner_lastname || '',
      assigned_user_username: intervention.users?.username || '',
      assigned_user_firstname: intervention.users?.firstname || '',
      assigned_user_lastname: intervention.users?.lastname || '',
      statut_code: intervention.intervention_statuses?.code || '',
      statut_label: intervention.intervention_statuses?.label || '',
      metier_code: intervention.metiers?.code || '',
      metier_label: intervention.metiers?.label || '',
      artisans_list: artisansList,
      costs_list: costsList,
      payments_list: paymentsList,
    });
  }

  return enriched;
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  console.log('🚀 Démarrage de l\'export SQL vers Excel...\n');

  try {
    // Déterminer le chemin de sortie
    const outputPath = options.output 
      ? path.resolve(options.output)
      : path.join(DEFAULT_OUTPUT_DIR, DEFAULT_FILENAME);

    await ensureOutputDir(outputPath);

    // Créer le formateur
    const formatter = new ExcelFormatter();

    // Exporter les artisans
    const artisansCount = await exportArtisans(formatter, options.verbose);
    console.log('');

    // Exporter les interventions
    const interventionsCount = await exportInterventions(
      formatter, 
      options.years, 
      options.verbose
    );
    console.log('');

    // Sauvegarder le fichier
    console.log(`💾 Sauvegarde du fichier: ${outputPath}`);
    await formatter.saveToFile(outputPath);

    console.log('\n✅ Export terminé avec succès!');
    console.log(`   📊 Artisans: ${artisansCount}`);
    console.log(`   📊 Interventions: ${interventionsCount}`);
    console.log(`   📁 Fichier: ${outputPath}`);

  } catch (error) {
    console.error('\n❌ Erreur lors de l\'export:', error.message);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { main };

