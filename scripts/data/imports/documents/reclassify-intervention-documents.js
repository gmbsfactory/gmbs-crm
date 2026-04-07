/**
 * Script de reclassification des documents d'interventions existants
 *
 * Corrige les documents importés avec kind = "a_classe" alors qu'ils
 * auraient dû être classifiés automatiquement (ex: facturesGMBS).
 *
 * Usage:
 *   node scripts/data/imports/documents/reclassify-intervention-documents.js [--dry-run]
 *
 * Options:
 *   --dry-run    Affiche les changements sans les appliquer
 */

const { createClient } = require('@supabase/supabase-js');
const { classifyDocument } = require('./document-classifier');

// Charger les variables d'environnement
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.local';
require('dotenv').config({ path: envFile });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requises');
  process.exit(1);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  console.log(`📁 Variables chargées depuis ${envFile}`);
  console.log(dryRun ? '🔍 Mode DRY RUN — aucune modification\n' : '💾 Mode ÉCRITURE\n');

  // Récupérer tous les documents avec kind = "a_classe"
  // Paginer car il peut y en avoir beaucoup
  const PAGE_SIZE = 1000;
  let allDocuments = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('intervention_attachments')
      .select('id, filename, kind')
      .eq('kind', 'a_classe')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('❌ Erreur lors de la récupération:', error.message);
      process.exit(1);
    }

    allDocuments = allDocuments.concat(data);
    hasMore = data.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  console.log(`📄 ${allDocuments.length} document(s) avec kind = "a_classe" trouvé(s)\n`);

  if (allDocuments.length === 0) {
    console.log('✅ Rien à reclassifier.');
    return;
  }

  // Classifier chaque document
  const updates = [];
  const stats = {};

  for (const doc of allDocuments) {
    const newKind = classifyDocument(doc.filename);
    if (newKind !== 'autre') {
      updates.push({ id: doc.id, filename: doc.filename, newKind });
      stats[newKind] = (stats[newKind] || 0) + 1;
    }
  }

  console.log(`🔄 ${updates.length} document(s) à reclassifier sur ${allDocuments.length}:`);
  Object.entries(stats).forEach(([kind, count]) => {
    console.log(`   ${kind}: ${count}`);
  });
  console.log();

  if (updates.length === 0) {
    console.log('✅ Aucun document ne correspond à un pattern connu.');
    return;
  }

  // Aperçu
  const preview = updates.slice(0, 10);
  console.log('📋 Aperçu (max 10):');
  preview.forEach(u => {
    console.log(`   "${u.filename}" → ${u.newKind}`);
  });
  if (updates.length > 10) {
    console.log(`   ... et ${updates.length - 10} autre(s)`);
  }
  console.log();

  if (dryRun) {
    console.log('🔍 Dry run terminé. Relancez sans --dry-run pour appliquer.');
    return;
  }

  // Appliquer les mises à jour
  let updated = 0;
  let errors = 0;

  for (const item of updates) {
    const { error: updateError } = await supabase
      .from('intervention_attachments')
      .update({ kind: item.newKind })
      .eq('id', item.id);

    if (updateError) {
      console.error(`   ❌ "${item.filename}": ${updateError.message}`);
      errors++;
    } else {
      updated++;
    }
  }

  console.log(`\n✅ Reclassification terminée: ${updated} mis à jour, ${errors} erreur(s)`);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
