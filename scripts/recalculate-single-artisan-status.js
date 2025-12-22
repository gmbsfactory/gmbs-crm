#!/usr/bin/env node

/**
 * Script pour recalculer le statut d'un seul artisan selon les règles définies
 *
 * Ce script est appelé automatiquement quand une intervention est terminée
 * pour mettre à jour uniquement l'artisan concerné (plus efficace qu'un recalcul global).
 *
 * Usage: node scripts/recalculate-single-artisan-status.js <artisan_id>
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
const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');

if (require('fs').existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (require('fs').existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = requiredEnv.filter((key) => !process.env[key] || process.env[key].trim().length === 0);
if (missing.length > 0) {
  console.error(`❌ Variables d'environnement manquantes: ${missing.join(', ')}`);
  process.exit(1);
}

// Récupérer l'ID de l'artisan depuis les arguments
const artisanId = process.argv[2];
if (!artisanId) {
  console.error('❌ Usage: node scripts/recalculate-single-artisan-status.js <artisan_id>');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function recalculateSingleArtisan(artisanId) {
  try {
    // 1. Récupérer l'artisan
    const { data: artisan, error: artisanError } = await supabase
      .from('artisans')
      .select('id, statut_id')
      .eq('id', artisanId)
      .single();

    if (artisanError || !artisan) {
      throw new Error(`Artisan non trouvé: ${artisanError?.message || 'NOT_FOUND'}`);
    }

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

    // 4. Ne pas modifier le statut ARCHIVE automatiquement
    // ONE_SHOT peut maintenant progresser automatiquement selon le nombre d'interventions
    const currentStatusId = artisan.statut_id;
    const currentCode = currentStatusId ? statusIdToCode.get(currentStatusId) : null;

    if (currentCode === 'ARCHIVE') {
      // Mettre à jour uniquement le statut de dossier si nécessaire
      const { data: attachments } = await supabase
        .from('artisan_attachments')
        .select('kind')
        .eq('artisan_id', artisanId);

      const { data: interventions } = await supabase
        .from('intervention_artisans')
        .select(`
          intervention_id,
          interventions!inner(
            id,
            statut_id
          )
        `)
        .eq('artisan_id', artisanId)
        .eq('is_primary', true);

      const completedCount = interventions?.filter(int => 
        terminatedStatusIds.includes(int.interventions.statut_id)
      ).length || 0;

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
        newDossierStatus = 'À compléter';
      } else {
        newDossierStatus = 'INCOMPLET';
      }

      const { data: currentArtisan } = await supabase
        .from('artisans')
        .select('statut_dossier')
        .eq('id', artisanId)
        .single();

      if (newDossierStatus !== currentArtisan?.statut_dossier) {
        await supabase
          .from('artisans')
          .update({
            statut_dossier: newDossierStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', artisanId);
      }

      console.log(`✅ Statut de dossier mis à jour pour artisan ${artisanId} (statut ARCHIVE non modifié)`);
      return;
    }

    // 5. Compter les interventions terminées (uniquement primaires)
    const { data: interventions, error: intError } = await supabase
      .from('intervention_artisans')
      .select(`
        intervention_id,
        interventions!inner(
          id,
          statut_id
        )
      `)
      .eq('artisan_id', artisanId)
      .eq('is_primary', true);

    if (intError) {
      throw new Error(`Erreur pour artisan ${artisanId}: ${intError.message}`);
    }

    const completedCount = interventions?.filter(int => 
      terminatedStatusIds.includes(int.interventions.statut_id)
    ).length || 0;

    // 6. Calculer le nouveau statut selon les règles
    let newCode = null;

    if (completedCount >= 10) {
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
      // Vérifier quand même le statut de dossier
      const { data: attachments } = await supabase
        .from('artisan_attachments')
        .select('kind')
        .eq('artisan_id', artisanId);

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
        newDossierStatus = 'À compléter';
      } else {
        newDossierStatus = 'INCOMPLET';
      }

      const { data: currentArtisan } = await supabase
        .from('artisans')
        .select('statut_dossier')
        .eq('id', artisanId)
        .single();

      if (newDossierStatus !== currentArtisan?.statut_dossier) {
        await supabase
          .from('artisans')
          .update({
            statut_dossier: newDossierStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', artisanId);
        console.log(`✅ Statut de dossier mis à jour pour artisan ${artisanId}`);
      } else {
        console.log(`ℹ️  Aucun changement pour artisan ${artisanId} (statut: ${currentCode}, dossier: ${currentArtisan?.statut_dossier})`);
      }
      return;
    }

    const newStatusId = codeToStatusId.get(newCode);
    if (!newStatusId) {
      throw new Error(`Statut ${newCode} introuvable pour artisan ${artisanId}`);
    }

    // 7. Récupérer les documents pour calculer le statut de dossier
    const { data: attachments, error: attError } = await supabase
      .from('artisan_attachments')
      .select('kind')
      .eq('artisan_id', artisanId);

    if (attError) {
      console.warn(`⚠️  Erreur lors de la récupération des documents: ${attError.message}`);
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
      newDossierStatus = 'À compléter';
    } else {
      newDossierStatus = 'INCOMPLET';
    }

    // 8. Règle ARC-002 : Si statut dossier = INCOMPLET ET statut artisan devient NOVICE → statut dossier passe à "À compléter"
    const { data: currentArtisan } = await supabase
      .from('artisans')
      .select('statut_dossier')
      .eq('id', artisanId)
      .single();

    const currentDossierStatus = currentArtisan?.statut_dossier;
    if (currentDossierStatus === 'INCOMPLET' && newCode === 'NOVICE' && currentCode !== 'NOVICE') {
      newDossierStatus = 'À compléter';
    }

    // 9. Mettre à jour l'artisan
    const { error: updateError } = await supabase
      .from('artisans')
      .update({
        statut_id: newStatusId,
        statut_dossier: newDossierStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', artisanId);

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour de l'artisan ${artisanId}: ${updateError.message}`);
    }

    console.log(`✅ Artisan ${artisanId} mis à jour: ${currentCode || 'NULL'} → ${newCode}, dossier: ${currentDossierStatus || 'NULL'} → ${newDossierStatus}`);

  } catch (error) {
    console.error(`❌ Erreur pour artisan ${artisanId}: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

recalculateSingleArtisan(artisanId).catch((error) => {
  console.error(`❌ Erreur fatale: ${error.message}`);
  if (process.env.DEBUG) {
    console.error(error);
  }
  process.exit(1);
});

