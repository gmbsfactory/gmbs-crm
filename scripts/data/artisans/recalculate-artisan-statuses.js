/usr/bin/env node

/**
 * Script pour recalculer les statuts des artisans selon les règles définies
 *
 * Ce script doit être exécuté après l'import des données pour écraser
 * les statuts importés depuis Google Sheets avec les statuts calculés
 * selon les règles métier.
 *
 * Règles appliquées (progression automatique) :
 * - potentiel/candidat/one_shot -> novice : 1 intervention terminée
 * - novice -> formation : 3 interventions terminées
 * - formation -> confirmé : 6 interventions terminées
 * - confirmé -> expert : 10+ interventions terminées
 *
 * Transitions manuelles possibles :
 * - potentiel <-> candidat (bidirectionnel)
 * - potentiel/candidat -> one_shot
 * - one_shot -> potentiel/candidat (pour réintégrer dans le workflow auto)
 * - tout statut -> archive
 *
 * Statut gelé (pas de progression auto) :
 * - archive : reste archivé définitivement
 *
 * Le statut de dossier est également recalculé selon les règles ARC-002.
 */

const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Charger les variables d'environnement
// Priorité: .env.production si NODE_ENV=production, sinon .env.local, puis .env
const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envProductionPath = path.resolve(process.cwd(), '.env.production');

// Charger selon l'environnement
if (process.env.NODE_ENV === 'production' && require('fs').existsSync(envProductionPath)) {
  dotenv.config({ path: envProductionPath });
  console.log('📝 Variables chargées depuis: .env.production');
} else if (require('fs').existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = requiredEnv.filter((key) => !process.env[key] || process.env[key].trim().length === 0);
if (missing.length > 0) {
  console.error(`❌ Variables d'environnement manquantes: ${missing.join(', ')}`);
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function main() {
  console.log('🔄 Recalcul des statuts des artisans...\n');

  try {
    // 1. Récupérer tous les artisans
    const { data: artisans, error: artisansError } = await supabase
      .from('artisans')
      .select('id, statut_id')
      .order('created_at', { ascending: true });

    if (artisansError) {
      throw new Error(`Erreur lors de la récupération des artisans: ${artisansError.message}`);
    }

    console.log(`📊 ${artisans.length} artisans trouvés\n`);

    // 2. Récupérer les statuts terminés
    const { data: terminatedStatuses, error: statusError } = await supabase
      .from('intervention_statuses')
      .select('id')
      .in('code', ['TERMINE', 'INTER_TERMINEE']);

    if (statusError) {
      throw new Error(`Erreur lors de la récupération des statuts terminés: ${statusError.message}`);
    }

    const terminatedStatusIds = terminatedStatuses.map(s => s.id);

    // 3. Récupérer tous les statuts d'artisans pour le mapping
    const { data: artisanStatuses, error: artisanStatusError } = await supabase
      .from('artisan_statuses')
      .select('id, code');

    if (artisanStatusError) {
      throw new Error(`Erreur lors de la récupération des statuts d'artisans: ${artisanStatusError.message}`);
    }

    const codeToStatusId = new Map();
    const statusIdToCode = new Map();
    artisanStatuses.forEach(status => {
      codeToStatusId.set(status.code.toUpperCase(), status.id);
      statusIdToCode.set(status.id, status.code.toUpperCase());
    });

    // 4. Pour chaque artisan, calculer le nouveau statut
    let updated = 0;
    let errors = 0;
    const stats = {
      CANDIDAT: 0,
      POTENTIEL: 0,
      NOVICE: 0,
      FORMATION: 0,
      CONFIRME: 0,
      EXPERT: 0,
      ARCHIVER: 0,
      UNKNOWN: 0
    };

    for (const artisan of artisans) {
      try {
        // Compter les interventions terminées (uniquement primaires)
        const { data: interventions, error: intError } = await supabase
          .from('intervention_artisans')
          .select(`
            intervention_id,
            interventions!inner(
              id,
              statut_id
            )
          `)
          .eq('artisan_id', artisan.id)
          .eq('is_primary', true);

        if (intError) {
          console.error(`  ⚠️  Erreur pour artisan ${artisan.id}: ${intError.message}`);
          errors++;
          continue;
        }

        const completedCount = interventions?.filter(int => 
          terminatedStatusIds.includes(int.interventions.statut_id)
        ).length || 0;

        // Récupérer le statut actuel
        const currentStatusId = artisan.statut_id;
        const currentCode = currentStatusId ? statusIdToCode.get(currentStatusId) : null;

        // Calculer le nouveau statut selon les règles
        let newCode = null;

        // Ne pas modifier ARCHIVE automatiquement
        if (currentCode === 'ARCHIVE' || currentCode === 'ARCHIVER') {
          newCode = currentCode;
        } else if (completedCount >= 10) {
          newCode = 'EXPERT';
        } else if (completedCount >= 6) {
          newCode = 'CONFIRME';
        } else if (completedCount >= 3) {
          newCode = 'FORMATION';
        } else if (completedCount >= 1) {
          // Si CANDIDAT, POTENTIEL ou ONE_SHOT → NOVICE après 1 intervention
          if (currentCode === 'CANDIDAT' || currentCode === 'POTENTIEL' || currentCode === 'ONE_SHOT' || currentCode === null) {
            newCode = 'NOVICE';
          } else {
            // Pour les autres statuts, garder le statut actuel jusqu'au seuil suivant
            newCode = currentCode;
          }
        } else {
          // Moins de 1 intervention → reste au statut actuel ou POTENTIEL par défaut
          newCode = currentCode || 'POTENTIEL';
        }

        // Ne pas modifier si le statut n'a pas changé
        if (newCode === currentCode) {
          if (newCode) stats[newCode] = (stats[newCode] || 0) + 1;
          continue;
        }

        const newStatusId = codeToStatusId.get(newCode);
        if (!newStatusId) {
          console.error(`  ⚠️  Statut ${newCode} introuvable pour artisan ${artisan.id}`);
          errors++;
          continue;
        }

        // Récupérer les documents pour calculer le statut de dossier
        const { data: attachments, error: attError } = await supabase
          .from('artisan_attachments')
          .select('kind')
          .eq('artisan_id', artisan.id);

        if (attError) {
          console.error(`  ⚠️  Erreur lors de la récupération des documents: ${attError.message}`);
        }

        const requiredKinds = ['kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat'];
        const presentKinds = new Set(
          (attachments || [])
            .map(att => att.kind?.toLowerCase().trim())
            .filter(Boolean)
            .filter(k => k !== 'autre')
        );

        const missingCount = requiredKinds.filter(kind => !presentKinds.has(kind.toLowerCase())).length;

        let newDossierStatus;
        if (missingCount === 0) {
          newDossierStatus = 'COMPLET';
        } else if (completedCount > 0 && (missingCount === requiredKinds.length || missingCount === 1)) {
          // À compléter : dossier vide (tous manquants) OU 1 seul fichier manquant ET artisan a effectué une intervention
          newDossierStatus = 'À compléter';
        } else {
          newDossierStatus = 'INCOMPLET';
        }

        // Règle ARC-002 : Si statut dossier = INCOMPLET ET statut artisan devient NOVICE → statut dossier passe à "À compléter"
        const { data: currentArtisan } = await supabase
          .from('artisans')
          .select('statut_dossier')
          .eq('id', artisan.id)
          .single();

        const currentDossierStatus = currentArtisan?.statut_dossier;
        if (currentDossierStatus === 'INCOMPLET' && newCode === 'NOVICE' && currentCode !== 'NOVICE') {
          newDossierStatus = 'À compléter';
        }

        // Mettre à jour l'artisan
        const { error: updateError } = await supabase
          .from('artisans')
          .update({
            statut_id: newStatusId,
            statut_dossier: newDossierStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', artisan.id);

        if (updateError) {
          console.error(`  ⚠️  Erreur lors de la mise à jour de l'artisan ${artisan.id}: ${updateError.message}`);
          errors++;
          continue;
        }

        updated++;
        stats[newCode] = (stats[newCode] || 0) + 1;

        if (updated % 10 === 0) {
          process.stdout.write(`\r  ✅ ${updated}/${artisans.length} artisans traités...`);
        }
      } catch (error) {
        console.error(`  ⚠️  Erreur pour artisan ${artisan.id}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n\n✅ Recalcul terminé !`);
    console.log(`   - ${updated} artisans mis à jour`);
    console.log(`   - ${errors} erreurs`);
    console.log(`\n📊 Répartition des statuts :`);
    Object.entries(stats).forEach(([code, count]) => {
      if (count > 0) {
        console.log(`   - ${code}: ${count}`);
      }
    });

  } catch (error) {
    console.error(`\n❌ Erreur: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`\n❌ Erreur fatale: ${error.message}`);
  if (process.env.DEBUG) {
    console.error(error);
  }
  process.exit(1);
});

