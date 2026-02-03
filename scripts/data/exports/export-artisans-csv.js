#!/usr/bin/env node

/**
 * Script d'export des artisans au format CSV
 *
 * Exporte les artisans de la base de données vers un fichier CSV
 * en respectant le format client défini dans le mapping
 *
 * Usage:
 *   node scripts/exports/export-artisans-csv.js (exporte tous les artisans)
 *   node scripts/exports/export-artisans-csv.js --active-only (exporte uniquement les artisans actifs)
 *   node scripts/exports/export-artisans-csv.js --output ./exports/artisans.csv
 */

const path = require('path');
const fs = require('fs');
const { supabaseAdmin } = require('../lib/supabase-client');

// Configuration
const DEFAULT_OUTPUT_DIR = path.join(process.cwd(), 'exports');
const DEFAULT_FILENAME = `Export_Artisans_${new Date().toISOString().split('T')[0]}.csv`;

// Colonnes CSV dans l'ordre défini par le client
const CSV_COLUMNS = [
  'Nom Prénom',
  'Raison Social',
  'MÉTIER',
  'DPT',
  'STATUT',
  'Adresse Postale',
  'Adresse Mail',
  'Numéro Téléphone',
  'STATUT JURIDIQUE',
  'Siret',
  'IBAN',
  'DOSSIER ARTISAN',
  'Document Drive',
  'Commentaire',
  'Gestionnaire',
  'DATE D\'AJOUT',
  'SUIVI DES RELANCES DOCS'
];

/**
 * Parse les arguments de la ligne de commande
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    activeOnly: false,
    output: null,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--active-only' || arg === '-a') {
      options.activeOnly = true;
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
📊 Export des Artisans au format CSV

Usage:
  node scripts/exports/export-artisans-csv.js [options]

Options:
  --active-only, -a        Exporte uniquement les artisans actifs (défaut: tous)
  --output, -o <path>      Chemin du fichier de sortie (défaut: exports/Export_Artisans_YYYY-MM-DD.csv)
  --verbose, -v            Mode verbeux
  --help, -h               Affiche cette aide

Exemples:
  node scripts/exports/export-artisans-csv.js
  node scripts/exports/export-artisans-csv.js --active-only
  node scripts/exports/export-artisans-csv.js -a -o ./backup.csv
  node scripts/exports/export-artisans-csv.js --verbose
`);
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
 * Récupère les artisans avec toutes leurs relations
 */
async function fetchArtisans(activeOnly = false, verbose = false) {
  if (activeOnly) {
    console.log(`🔍 Récupération des artisans actifs...`);
  } else {
    console.log(`🔍 Récupération de tous les artisans...`);
  }

  // Construire la requête avec filtres optionnels
  let query = supabaseAdmin
    .from('artisans')
    .select(`
      *,
      users!gestionnaire_id(username),
      artisan_statuses!statut_id(label)
    `);

  // Filtrer les artisans actifs si demandé
  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  query = query.order('created_at', { ascending: false });

  const { data: artisans, error } = await query;

  if (error) {
    throw new Error(`Erreur lors de la récupération des artisans: ${error.message}`);
  }

  if (!artisans || artisans.length === 0) {
    console.log('   ⚠️  Aucun artisan trouvé');
    return [];
  }

  if (verbose) {
    console.log(`   ✅ ${artisans.length} artisans trouvés`);
  }

  // Enrichir avec les métiers, documents et commentaires
  console.log('📊 Enrichissement des données...');
  const enrichedData = await enrichArtisansData(artisans, verbose);

  return enrichedData;
}

/**
 * Enrichit les données d'artisans avec les métiers, documents et commentaires
 */
async function enrichArtisansData(artisans, verbose = false) {
  const enriched = [];
  let processedCount = 0;

  for (const artisan of artisans) {
    // Récupérer les métiers
    const { data: metiersData } = await supabaseAdmin
      .from('artisan_metiers')
      .select(`
        metiers(label)
      `)
      .eq('artisan_id', artisan.id);

    const metiers = metiersData?.map(m => m.metiers?.label).filter(Boolean).join(', ') || '';

    // Récupérer les documents
    const { data: documentsData } = await supabaseAdmin
      .from('artisan_attachments')
      .select('kind, url, filename')
      .eq('artisan_id', artisan.id);

    // Créer une liste de documents avec leurs types
    const documents = documentsData?.map(d => `${d.kind}: ${d.filename || d.url}`).join(' | ') || '';

    // Récupérer les commentaires (uniquement internal, triés par date décroissante)
    const { data: commentsData } = await supabaseAdmin
      .from('comments')
      .select('content, created_at')
      .eq('entity_type', 'artisan')
      .eq('entity_id', artisan.id)
      .eq('is_internal', true)
      .order('created_at', { ascending: false });

    // Concaténer tous les commentaires avec leur date
    const commentaires = commentsData?.map(c =>
      `[${formatDate(c.created_at)}] ${c.content}`
    ).join(' || ') || '';

    enriched.push({
      ...artisan,
      metiers,
      documents,
      commentaires
    });

    processedCount++;
    if (verbose && processedCount % 100 === 0) {
      console.log(`   📦 ${processedCount}/${artisans.length} artisans enrichis...`);
    }
  }

  if (verbose) {
    console.log(`   ✅ ${enriched.length} artisans enrichis au total`);
  }

  return enriched;
}

/**
 * Convertit les artisans en format CSV
 */
function convertToCSV(artisans) {
  const rows = [];

  // En-tête
  rows.push(CSV_COLUMNS.map(escapeCSV).join(','));

  // Données
  for (const artisan of artisans) {
    const nomPrenom = [
      artisan.nom || '',
      artisan.prenom || ''
    ].filter(Boolean).join(' ').trim();

    const adressePostale = [
      artisan.adresse_siege_social || '',
      artisan.code_postal_siege_social || '',
      artisan.ville_siege_social || ''
    ].filter(Boolean).join(', ').trim();

    const row = [
      nomPrenom,                                      // Nom Prénom
      artisan.raison_sociale || '',                   // Raison Social
      artisan.metiers || '',                          // MÉTIER
      artisan.departement || '',                      // DPT
      artisan.artisan_statuses?.label || '',          // STATUT
      adressePostale,                                 // Adresse Postale
      artisan.email || '',                            // Adresse Mail
      artisan.telephone || '',                        // Numéro Téléphone
      artisan.statut_juridique || '',                 // STATUT JURIDIQUE
      artisan.siret || '',                            // Siret
      artisan.iban || '',                             // IBAN
      artisan.statut_dossier || '',                   // DOSSIER ARTISAN
      artisan.documents || '',                        // Document Drive
      artisan.commentaires || '',                     // Commentaire
      artisan.users?.username || '',                  // Gestionnaire
      formatDate(artisan.date_ajout),                 // DATE D'AJOUT
      artisan.suivi_relances_docs || ''               // SUIVI DES RELANCES DOCS
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

  console.log('🚀 Démarrage de l\'export CSV des artisans...\n');

  try {
    // Déterminer le chemin de sortie
    const outputPath = options.output
      ? path.resolve(options.output)
      : path.join(DEFAULT_OUTPUT_DIR, DEFAULT_FILENAME);

    await ensureOutputDir(outputPath);

    // Récupérer les artisans
    const artisans = await fetchArtisans(
      options.activeOnly,
      options.verbose
    );

    if (artisans.length === 0) {
      console.log('\n⚠️  Aucun artisan à exporter');
      return;
    }

    // Convertir en CSV
    console.log('📝 Conversion en CSV...');
    const csvContent = convertToCSV(artisans);

    // Sauvegarder
    await saveCSV(csvContent, outputPath);

    console.log('\n✅ Export terminé avec succès!');
    console.log(`   📊 Artisans exportés: ${artisans.length}`);
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

module.exports = { main, convertToCSV, fetchArtisans };
