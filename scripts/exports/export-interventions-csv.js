#!/usr/bin/env node

/**
 * Script d'export des interventions au format CSV
 *
 * Exporte les interventions de la base de données vers un fichier CSV
 * en respectant le format client défini dans le mapping
 *
 * Usage:
 *   node scripts/exports/export-interventions-csv.js (exporte toutes les interventions)
 *   node scripts/exports/export-interventions-csv.js --start-date 2024-01-01 --end-date 2024-12-31
 *   node scripts/exports/export-interventions-csv.js --start-date 2024-01-01 --end-date 2024-12-31 --output ./exports/interventions.csv
 */

const path = require('path');
const fs = require('fs');
const { supabaseAdmin } = require('../lib/supabase-client');

// Configuration
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'exports');
const DEFAULT_FILENAME = `Export_Interventions_${new Date().toISOString().split('T')[0]}.csv`;

// Colonnes CSV dans l'ordre défini par le client
const CSV_COLUMNS = [
  'Date',
  'Agence',
  'Adresse d\'intervention',
  'ID',
  'Statut',
  'Contexte d\'intervention',
  'Métier',
  'Gest.',
  'Technicien',
  'COUT SST',
  'COÛT MATERIEL',
  'Numéro SST',
  'COUT INTER',
  '% SST',
  'PROPRIO',
  'Date d\'intervention',
  'TEL LOC',
  'Locataire',
  'Em@il Locataire',
  'COMMENTAIRE'
];

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    startDate: null,
    endDate: null,
    output: null,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--start-date' || arg === '-s') {
      options.startDate = args[++i];
    } else if (arg === '--end-date' || arg === '-e') {
      options.endDate = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

/**
 * Affiche l'aide
 */
function showHelp() {
  console.log(`
📊 Export des Interventions au format CSV

Usage:
  node scripts/exports/export-interventions-csv.js [options]

Options:
  --start-date, -s <date>  Date de début (format: YYYY-MM-DD) - Optionnel (par défaut: toutes)
  --end-date, -e <date>    Date de fin (format: YYYY-MM-DD) - Optionnel (par défaut: toutes)
  --output, -o <path>      Chemin du fichier de sortie (défaut: exports/Export_Interventions_YYYY-MM-DD.csv)
  --verbose, -v            Mode verbeux
  --help, -h               Affiche cette aide

Exemples:
  node scripts/exports/export-interventions-csv.js
  node scripts/exports/export-interventions-csv.js --start-date 2024-01-01 --end-date 2024-12-31
  node scripts/exports/export-interventions-csv.js -s 2024-01-01 -e 2024-12-31 -o ./backup.csv
  node scripts/exports/export-interventions-csv.js -s 2024-01-01 -e 2024-12-31 --verbose
`);
}

/**
 * Valide les dates (optionnelles)
 */
function validateDates(startDate, endDate) {
  let startDateObj = null;
  let endDateObj = null;

  // Si aucune date n'est fournie, retourner null pour les deux
  if (!startDate && !endDate) {
    return { startDateObj, endDateObj };
  }

  // Si une date est fournie, valider le format
  if (startDate) {
    startDateObj = new Date(startDate);
    if (isNaN(startDateObj.getTime())) {
      throw new Error(`Date de début invalide: ${startDate}. Format attendu: YYYY-MM-DD`);
    }
  }

  if (endDate) {
    endDateObj = new Date(endDate);
    if (isNaN(endDateObj.getTime())) {
      throw new Error(`Date de fin invalide: ${endDate}. Format attendu: YYYY-MM-DD`);
    }
  }

  // Si les deux dates sont fournies, vérifier la cohérence
  if (startDateObj && endDateObj && startDateObj > endDateObj) {
    throw new Error('La date de début doit être antérieure à la date de fin');
  }

  return { startDateObj, endDateObj };
}

/**
 * Crée le dossier de sortie si nécessaire
 */
async function ensureOutputDir(outputPath) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Dossier créé: ${dir}`);
  }
}

/**
 * Échappe les valeurs pour CSV (gestion des guillemets et virgules)
 */
function escapeCSV(value) {
  if (value == null) return '';

  const stringValue = String(value);

  // Si la valeur contient des guillemets, virgules ou sauts de ligne, on l'entoure de guillemets
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
    // Doubler les guillemets internes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Formate une date au format DD/MM/YYYY
 */
function formatDate(dateString) {
  if (!dateString) return '';

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Formate un montant
 */
function formatAmount(amount) {
  if (amount == null || amount === '') return '';
  return String(amount);
}

/**
 * Récupère les coûts d'une intervention par type
 */
function getCostByType(costs, costType) {
  if (!costs || costs.length === 0) return '';

  const cost = costs.find(c => c.cost_type === costType);
  return cost ? formatAmount(cost.amount) : '';
}

/**
 * Récupère les interventions avec toutes leurs relations
 */
async function fetchInterventions(startDate, endDate, verbose = false) {
  if (startDate && endDate) {
    console.log(`🔍 Récupération des interventions entre ${startDate} et ${endDate}...`);
  } else if (startDate) {
    console.log(`🔍 Récupération des interventions depuis ${startDate}...`);
  } else if (endDate) {
    console.log(`🔍 Récupération des interventions jusqu'au ${endDate}...`);
  } else {
    console.log(`🔍 Récupération de toutes les interventions...`);
  }

  // Construire la requête avec filtres optionnels
  let query = supabaseAdmin
    .from('interventions')
    .select(`
      *,
      agencies!agence_id(code, label),
      tenants!tenant_id(firstname, lastname, telephone, email),
      owner!owner_id(owner_firstname, owner_lastname),
      users!assigned_user_id(username),
      intervention_statuses!statut_id(label),
      metiers!metier_id(label)
    `);

  // Ajouter les filtres de date si fournis
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  query = query.order('created_at', { ascending: false });

  const { data: interventions, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des interventions: ${error.message}`);
  }

  if (!interventions || interventions.length === 0) {
    console.log('   ⚠️  Aucune intervention trouvée pour cette période');
    return [];
  }

  if (verbose) {
    console.log(`   ✅ ${interventions.length} interventions trouvées`);
  }

  // Enrichir avec les artisans et les coûts
  console.log('📊 Enrichissement des données...');
  const enrichedData = await enrichInterventionsData(interventions, verbose);

  return enrichedData;
}

/**
 * Enrichit les données d'interventions avec les artisans, coûts et commentaires
 */
async function enrichInterventionsData(interventions, verbose = false) {
  const enriched = [];
  let processedCount = 0;

  for (const intervention of interventions) {
    // Récupérer le technicien principal (artisan)
    const { data: artisansData } = await supabaseAdmin
      .from('intervention_artisans')
      .select(`
        is_primary,
        artisans(plain_nom)
      `)
      .eq('intervention_id', intervention.id)
      .order('is_primary', { ascending: false })
      .limit(1);

    const technicien = artisansData?.[0]?.artisans?.plain_nom || '';

    // Récupérer les coûts
    const { data: costsData } = await supabaseAdmin
      .from('intervention_costs')
      .select('cost_type, amount')
      .eq('intervention_id', intervention.id);

    // Récupérer les commentaires (uniquement internal, triés par date décroissante)
    const { data: commentsData } = await supabaseAdmin
      .from('comments')
      .select('content, created_at')
      .eq('entity_type', 'intervention')
      .eq('entity_id', intervention.id)
      .eq('is_internal', true)
      .order('created_at', { ascending: false });

    // Concaténer tous les commentaires avec leur date
    const commentaires = commentsData?.map(c =>
      `[${formatDate(c.created_at)}] ${c.content}`
    ).join(' || ') || '';

    enriched.push({
      ...intervention,
      technicien,
      costs: costsData || [],
      commentaires
    });

    processedCount++;
    if (verbose && processedCount % 100 === 0) {
      console.log(`   📦 ${processedCount}/${interventions.length} interventions enrichies...`);
    }
  }

  if (verbose) {
    console.log(`   ✅ ${enriched.length} interventions enrichies au total`);
  }

  return enriched;
}

/**
 * Convertit les interventions en format CSV
 */
function convertToCSV(interventions) {
  const rows = [];

  // En-tête
  rows.push(CSV_COLUMNS.map(escapeCSV).join(','));

  // Données
  for (const intervention of interventions) {
    const proprio = [
      intervention.owner?.owner_firstname || '',
      intervention.owner?.owner_lastname || ''
    ].filter(Boolean).join(' ').trim();

    const locataire = [
      intervention.tenants?.firstname || '',
      intervention.tenants?.lastname || ''
    ].filter(Boolean).join(' ').trim();

    const row = [
      formatDate(intervention.created_at),                           // Date
      intervention.agencies?.label || '',                             // Agence
      intervention.adresse || '',                                     // Adresse d'intervention
      intervention.id_inter || '',                                    // ID
      intervention.intervention_statuses?.label || '',                // Statut
      intervention.contexte_intervention || '',                       // Contexte d'intervention
      intervention.metiers?.label || '',                              // Métier
      intervention.users?.username || '',                             // Gest.
      intervention.technicien || '',                                  // Technicien
      getCostByType(intervention.costs, 'sst'),                       // COUT SST
      getCostByType(intervention.costs, 'materiel'),                  // COÛT MATERIEL
      intervention.numero_sst || '',                                  // Numéro SST
      getCostByType(intervention.costs, 'intervention'),              // COUT INTER
      formatAmount(intervention.pourcentage_sst),                     // % SST
      proprio,                                                        // PROPRIO
      formatDate(intervention.date_prevue),                           // Date d'intervention
      intervention.tenants?.telephone || '',                          // TEL LOC
      locataire,                                                      // Locataire
      intervention.tenants?.email || '',                              // Em@il Locataire
      intervention.commentaires || ''                                 // COMMENTAIRE
    ];

    rows.push(row.map(escapeCSV).join(','));
  }

  return rows.join('\n');
}

/**
 * Sauvegarde le CSV dans un fichier
 */
async function saveCSV(csvContent, outputPath) {
  console.log(`💾 Sauvegarde du fichier: ${outputPath}`);

  // Ajouter le BOM UTF-8 pour une meilleure compatibilité avec Excel
  const BOM = '\uFEFF';
  fs.writeFileSync(outputPath, BOM + csvContent, 'utf-8');

  console.log('   ✅ Fichier sauvegardé avec succès');
}

/**
 * Fonction principale
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  console.log('🚀 Démarrage de l\'export CSV des interventions...\n');

  try {
    // Valider les dates
    const { startDateObj, endDateObj } = validateDates(options.startDate, options.endDate);

    // Déterminer le chemin de sortie
    const outputPath = options.output
      ? path.resolve(options.output)
      : path.join(DEFAULT_OUTPUT_DIR, DEFAULT_FILENAME);

    await ensureOutputDir(outputPath);

    // Récupérer les interventions
    const interventions = await fetchInterventions(
      options.startDate,
      options.endDate,
      options.verbose
    );

    if (interventions.length === 0) {
      console.log('\n⚠️  Aucune intervention à exporter');
      return;
    }

    // Convertir en CSV
    console.log('📝 Conversion en CSV...');
    const csvContent = convertToCSV(interventions);

    // Sauvegarder
    await saveCSV(csvContent, outputPath);

    console.log('\n✅ Export terminé avec succès!');
    console.log(`   📊 Interventions exportées: ${interventions.length}`);
    console.log(`   📅 Période: ${formatDate(startDateObj)} - ${formatDate(endDateObj)}`);
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

module.exports = { main, convertToCSV, fetchInterventions };
