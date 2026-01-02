📊 SYSTÈME DE CALCUL DES STATUTS D'ARTISANS - GUIDE COMPLET

1. CALCUL DU STATUT ARTISAN
Comment le statut artisan est-il calculé automatiquement ?
Le statut artisan est calculé en fonction du nombre d'interventions terminées par l'artisan. La logique se trouve dans src/lib/artisans/statusRules.ts. Règles de progression automatique :

const STATUS_THRESHOLDS = {
  CANDIDAT: 0,     // Initial
  NOVICE: 1,       // ≥ 1 intervention terminée
  FORMATION: 3,    // ≥ 3 interventions terminées
  CONFIRME: 6,     // ≥ 6 interventions terminées
  EXPERT: 10,      // ≥ 10 interventions terminées
  POTENTIEL: 0,    // Initial (défaut)
  ONE_SHOT: 0,     // Peut progresser automatiquement
  ARCHIVE: -1,     // Gelé (pas de progression)
}
Points importants :
Seules les interventions PRIMARY (is_primary = true) sont comptées
Seules les interventions TERMINÉES (statut_id = TERMINE ou INTER_TERMINEE) sont comptées
La progression est unidirectionnelle (pas de régression automatique)
Cycle de vie complet d'un artisan

POTENTIEL → NOVICE → FORMATION → CONFIRME → EXPERT
    ↓         ↑
CANDIDAT ←→ (manuel)
    ↓
ONE_SHOT → (peut revenir à POTENTIEL/CANDIDAT manuellement)

N'importe quel statut → ARCHIVE (manuel, gelé définitivement)
Exemple concret :
Nouvel artisan créé : POTENTIEL (statut par défaut)
Termine 1ère intervention : NOVICE (automatique)
Termine 3ème intervention : FORMATION (automatique)
Termine 6ème intervention : CONFIRME (automatique)
Termine 10ème intervention : EXPERT (automatique)
Statuts nécessitant une modification manuelle vs automatique
Progression AUTOMATIQUE :
POTENTIEL → NOVICE (1 intervention)
CANDIDAT → NOVICE (1 intervention)
ONE_SHOT → NOVICE (1 intervention)
NOVICE → FORMATION (3 interventions)
FORMATION → CONFIRME (6 interventions)
CONFIRME → EXPERT (10 interventions)
Modification MANUELLE uniquement :
POTENTIEL ↔ CANDIDAT (changement de catégorisation)
N'importe quel statut → ONE_SHOT (artisan ponctuel)
ONE_SHOT → POTENTIEL/CANDIDAT (réintégratio n)
N'importe quel statut → ARCHIVE (archivage avec raison)
Fichier concerné : src/lib/artisans/statusTransition.ts
Qu'est-ce qui empêche la progression automatique ?
Statut ARCHIVE : Gelé définitivement, aucune progression possible
Interventions non-terminées : Les interventions en cours, annulées, ou autres ne comptent pas
Interventions non-PRIMARY : Les interventions secondaires ne comptent pas
Modifications manuelles : Un gestionnaire peut décider de bloquer temporairement un artisan à un certain statut (mais le système recalculera au prochain trigger)
2. CALCUL DU STATUT DE DOSSIER
Comment le statut de dossier est-il déterminé ?
Le statut de dossier est calculé dans src/lib/artisans/dossierStatus.ts selon cette logique :

function calculateDossierStatus(
  attachments: ArtisanAttachment[],
  hasCompletedIntervention: boolean
): DossierStatus {
  // 1. Aucun document
  if (requiredDocsCount === 0) {
    return hasCompletedIntervention ? "À compléter" : "INCOMPLET"
  }
  
  // 2. Tous les documents présents
  if (requiredDocsCount === 5) {
    return "COMPLET"
  }
  
  // 3. Il manque exactement 1 document OU l'artisan a une intervention
  if (requiredDocsCount === 4 || hasCompletedIntervention) {
    return "À compléter"
  }
  
  // 4. Sinon
  return "INCOMPLET"
}
Les 5 documents requis

const REQUIRED_DOCUMENT_KINDS = [
  "kbis",                   // Extrait Kbis
  "assurance",              // Attestation d'assurance
  "cni_recto_verso",        // CNI recto/verso
  "iban",                   // IBAN
  "decharge_partenariat",   // Décharge partenariat
]
Note importante : Les documents de type "autre" ne comptent pas pour la complétion du dossier.
Différence entre "INCOMPLET" et "À compléter"
Statut Condition Priorité Signification
INCOMPLET Manque ≥ 2 documents ET aucune intervention Basse Artisan passif, dossier très incomplet
À compléter Manque 1 document OU a une intervention Haute Artisan actif, dossier presque complet
COMPLET Tous les 5 documents présents N/A Dossier administratif complet
Exemples concrets :
Artisan sans intervention, 0 documents → INCOMPLET
Artisan sans intervention, 3 documents → INCOMPLET
Artisan sans intervention, 4 documents → À compléter (il ne manque qu'un seul document !)
Artisan avec 1 intervention, 0 documents → À compléter (prioritaire car actif)
Artisan avec 1 intervention, 4 documents → À compléter
Artisan avec ou sans intervention, 5 documents → COMPLET
Règle ARC-002 : Transition automatique INCOMPLET → À compléter
Documentation : docs/REGLES_STATUTS_ARTISANS.md Règle : Lorsqu'un artisan passe au statut NOVICE pour la première fois ET que son dossier est INCOMPLET, le statut de dossier passe automatiquement à "À compléter". Implémentation : src/lib/artisans/statusTransition.ts

// Application de la règle ARC-002
if (
  currentDossierStatus === "INCOMPLET" &&
  newArtisanStatus === "NOVICE" &&
  oldStatus !== "NOVICE"  // Transition VERS novice
) {
  finalDossierStatus = "À compléter"
}
Objectif : Alerter l'équipe qu'un artisan maintenant actif (au moins 1 intervention terminée) doit compléter son dossier administratif en priorité.
3. MOMENTS DE CALCUL/RECALCUL
Triggers automatiques dans la base de données
Fichier : supabase/migrations/00008_artisan_triggers.sql
Trigger 1 : Completion d'intervention

CREATE TRIGGER trigger_update_artisan_status_on_intervention_completion
  AFTER UPDATE OF statut_id ON interventions
  FOR EACH ROW
  WHEN (NEW.statut_id IS DISTINCT FROM OLD.statut_id)
  EXECUTE FUNCTION update_artisan_status_on_intervention_completion()
Déclenché quand :
Le statut d'une intervention change
Vérifie si le nouveau statut est TERMINE ou INTER_TERMINEE
Recalcule le statut de TOUS les artisans PRIMARY de cette intervention
Trigger 2 : Ajout de document

CREATE TRIGGER trigger_update_dossier_status_on_attachment_insert
  AFTER INSERT ON artisan_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_dossier_status_on_attachment_change()
Déclenché quand : Un document est ajouté à un artisan
Trigger 3 : Suppression de document

CREATE TRIGGER trigger_update_dossier_status_on_attachment_delete
  AFTER DELETE ON artisan_attachments
  FOR EACH ROW
  EXECUTE FUNCTION update_artisan_dossier_status_on_attachment_change()
Déclenché quand : Un document est supprimé d'un artisan
Scripts de recalcul manuel
Script global : scripts/recalculate-artisan-statuses.js

node scripts/recalculate-artisan-statuses.js
Utilisation :
Recalcule TOUS les artisans de la base
À utiliser après des migrations ou des corrections de données
Traite les artisans séquentiellement
Affiche la progression en temps réel
Exemple de sortie :

Processing artisan 1/247: Jean Dupont (POTENTIEL)
  Completed interventions: 5
  New status: FORMATION
  Dossier status: À compléter (3/5 documents)
Processing artisan 2/247: Marie Martin (NOVICE)
  ...
Script individuel : scripts/recalculate-single-artisan-status.js

node scripts/recalculate-single-artisan-status.js <artisan_id>
Utilisation :
Recalcule un seul artisan
Plus rapide pour le debug
Utile pour tester des changements
Quand exécuter le script manuellement ?
Après une migration de données : Les triggers ne s'appliquent pas aux imports en masse
Après correction manuelle en BDD : Si vous modifiez directement la base
En cas d'incohérence détectée : Si un artisan a un statut incorrect
Après désactivation temporaire des triggers : Pour des opérations de maintenance
Pour un audit complet : Vérifier que tous les statuts sont corrects
Que se passe-t-il à la création d'un nouvel artisan ?
Fichier : src/lib/api/v2/artisansApi.ts

// Lors de la création
const newArtisan = {
  ...data,
  statut_id: POTENTIEL_STATUS_ID,  // Statut par défaut
  statut_dossier: "INCOMPLET",     // Dossier vide par défaut
  date_ajout: new Date(),
  is_active: true
}
Séquence :
Artisan créé avec statut POTENTIEL et dossier INCOMPLET
Aucun trigger ne se déclenche (pas d'intervention, pas de document)
Attente de la première action (ajout document ou intervention)
Que se passe-t-il quand on termine une intervention ?
Séquence détaillée :
Modification du statut de l'intervention (ex: EN_COURS → TERMINE)

UPDATE interventions SET statut_id = 'TERMINE' WHERE id = '...'
Trigger se déclenche : trigger_update_artisan_status_on_intervention_completion
Fonction PostgreSQL exécute :

-- Récupère tous les artisans PRIMARY de l'intervention
SELECT artisan_id FROM intervention_artisans
WHERE intervention_id = NEW.id AND is_primary = true

-- Pour chaque artisan :
-- 1. Compte les interventions terminées
SELECT COUNT(*) FROM interventions i
JOIN intervention_artisans ia ON ia.intervention_id = i.id
WHERE ia.artisan_id = artisan.id
  AND ia.is_primary = true
  AND i.statut_id IN ('TERMINE', 'INTER_TERMINEE')

-- 2. Détermine le nouveau statut selon les seuils
-- 3. Recalcule le statut de dossier
-- 4. Applique la règle ARC-002 si applicable
-- 5. Enregistre l'historique dans artisan_status_history
-- 6. Met à jour l'artisan
Résultat visible dans l'interface utilisateur immédiatement
Exemple concret :

Artisan : Jean Dupont
Statut actuel : NOVICE (2 interventions terminées)
Dossier : INCOMPLET (2/5 documents)

Action : Terminer intervention #123

Résultat :

- Interventions terminées : 2 → 3
- Nouveau statut artisan : NOVICE → FORMATION (seuil de 3 atteint)
- Statut dossier : INCOMPLET (inchangé, pas de document ajouté)
- Historique créé avec raison "automatic"
Que se passe-t-il quand on ajoute/supprime un document ?
Ajout de document :
Insertion dans artisan_attachments

INSERT INTO artisan_attachments (artisan_id, kind, url, ...)
Trigger se déclenche : trigger_update_dossier_status_on_attachment_insert
Fonction recalcule le statut de dossier :

-- Compte les documents requis
SELECT COUNT(DISTINCT kind) FROM artisan_attachments
WHERE artisan_id = NEW.artisan_id
  AND kind IN ('kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat')

-- Vérifie si l'artisan a une intervention terminée
SELECT EXISTS (
  SELECT 1 FROM interventions i
  JOIN intervention_artisans ia ON ia.intervention_id = i.id
  WHERE ia.artisan_id = NEW.artisan_id
    AND ia.is_primary = true
    AND i.statut_id IN ('TERMINE', 'INTER_TERMINEE')
)

-- Applique la logique de calcul
-- Met à jour artisan.statut_dossier
Exemple concret :

Artisan : Marie Martin
Dossier actuel : À compléter (4/5 documents, 1 intervention)

Action : Ajouter document "decharge_partenariat"

Résultat :

- Documents requis : 4/5 → 5/5
- Statut dossier : À compléter → COMPLET
Suppression de document : Même logique, mais le trigger trigger_update_dossier_status_on_attachment_delete se déclenche.

1. ARCHITECTURE TECHNIQUE
Répartition Frontend vs Backend
Composant Emplacement Responsabilité
Logique métier Backend (PostgreSQL functions) Calcul des statuts, application des règles
API Backend (Supabase Edge Functions) CRUD artisans, gestion documents
Scripts de recalcul Backend (Node.js scripts) Recalcul en masse ou individuel
Affichage Frontend (React components) UI, filtres, badges colorés
Hooks Frontend (React hooks) Récupération données, gestion vues
Fichiers clés contenant la logique de calcul
Backend (Logique métier)
supabase/migrations/00008_artisan_triggers.sql
Triggers PostgreSQL
Fonctions de calcul des statuts
C'est ici que la logique RÉELLE s'exécute en production
scripts/recalculate-artisan-statuses.js
Script de recalcul global
Utilise la même logique que les triggers
Pour maintenance et corrections
scripts/recalculate-single-artisan-status.js
Script de recalcul individuel
Pour debug et tests
Frontend (TypeScript - Définitions et helpers)
src/lib/artisans/statusRules.ts
Constantes et seuils
Fonctions helper pour déterminer le statut attendu
Utilisé pour affichage et validation côté client
src/lib/artisans/dossierStatus.ts
Calcul du statut de dossier côté client
Utilisé pour prévisualisation avant soumission
src/lib/artisans/statusTransition.ts
Logique de transition de statuts
Application de ARC-002
Validation des transitions manuelles
Configuration et affichage
src/config/status-colors.ts
Couleurs des badges de statuts
Fonctions pour obtenir les styles
src/hooks/useArtisanViews.ts
Vues prédéfinies (filtres)
"Liste générale", "Ma liste", "À compléter", etc.
app/artisans/page.tsx
Page principale de la liste des artisans
Affichage des badges de statuts
Filtres interactifs
src/components/ui/ArtisanDossierStatusIcon.tsx
Icône visuelle du statut de dossier
Utilisé dans les cartes et modals
Comment les statuts sont-ils stockés dans la base de données ?
Table artisans :

CREATE TABLE artisans (
  id uuid PRIMARY KEY,
  -- Informations artisan...
  
  -- Statut artisan (FK vers table de référence)
  statut_id uuid REFERENCES artisan_statuses(id),
  
  -- Statut de dossier (ENUM inline)
  statut_dossier text CHECK (statut_dossier IN ('INCOMPLET', 'À compléter', 'COMPLET')),
  
  -- Autres champs...
)
Table de référence artisan_statuses :

CREATE TABLE artisan_statuses (
  id uuid PRIMARY KEY,
  code text UNIQUE,          -- 'CANDIDAT', 'NOVICE', etc.
  label text,                -- 'Candidat', 'Novice', etc.
  color text,                -- '#A855F7', '#60A5FA', etc.
  sort_order integer,        -- Pour tri dans l'UI
  created_at timestamptz,
  updated_at timestamptz
)
Seed data : supabase/seeds/seed_essential.sql

INSERT INTO artisan_statuses (code, label, color, sort_order) VALUES
('CANDIDAT', 'Candidat', '#A855F7', 1),
('ONE_SHOT', 'One Shot', '#F97316', 2),
('POTENTIEL', 'Potentiel', '#FACC15', 3),
('NOVICE', 'Novice', '#60A5FA', 4),
('FORMATION', 'Formation', '#38BDF8', 5),
('CONFIRME', 'Confirmé', '#22C55E', 6),
('EXPERT', 'Expert', '#6366F1', 7),
('INACTIF', 'Inactif', '#EF4444', 8),
('ARCHIVE', 'Archivé', '#6B7280', 9);
Table d'historique artisan_status_history :

CREATE TABLE artisan_status_history (
  id uuid PRIMARY KEY,
  artisan_id uuid REFERENCES artisans(id),
  old_status_id uuid REFERENCES artisan_statuses(id),
  new_status_id uuid REFERENCES artisan_statuses(id),
  changed_at timestamptz,
  changed_by uuid REFERENCES users(id),
  change_reason text,  -- 'manual', 'automatic', 'one_shot_return'
  completed_interventions_count integer
)
Pourquoi certains artisans n'ont-ils pas de statut_dossier calculé ?
Raisons possibles :
Artisan créé avant l'implémentation du système : Les anciens artisans n'ont pas de statut de dossier
Solution : Exécuter node scripts/recalculate-artisan-statuses.js
Import en masse sans triggers : Si des artisans ont été importés avec COPY ou bulk insert
Solution : Exécuter le script de recalcul
Triggers désactivés temporairement : Pour maintenance
Solution : Réactiver les triggers et recalculer
Erreur dans la fonction trigger : Bug dans la logique PostgreSQL
Solution : Vérifier les logs PostgreSQL, corriger le trigger, recalculer
Valeur NULL dans la base : Le champ statut_dossier est NULL
Solution : Recalcul forcé
Vérification :

-- Compter les artisans sans statut de dossier
SELECT COUNT(*) FROM artisans WHERE statut_dossier IS NULL;

-- Lister ces artisans
SELECT id, nom, prenom, statut_dossier
FROM artisans
WHERE statut_dossier IS NULL;
Comment le filtre "Dossier à compléter" fonctionne-t-il ?
Fichier : src/hooks/useArtisanViews.ts

{
  id: "incomplete-dossiers",
  name: "Liste Artisans à compléter",
  description: "Tous les artisans avec dossier à compléter",
  filters: {
    dossier_status: "À compléter"  // Filtre sur statut_dossier
  },
  order: 3
}
Requête SQL générée :

SELECT * FROM artisans
WHERE statut_dossier = 'À compléter'
ORDER BY updated_at DESC;
Utilisation dans l'UI : app/artisans/page.tsx:250

// Filtrage côté client
const filteredArtisans = artisans.filter(artisan => {
  if (filters.dossier_status && artisan.statut_dossier !== filters.dossier_status) {
    return false
  }
  // Autres filtres...
  return true
})
5. CAS PARTICULIERS
Que se passe-t-il si un artisan a effectué des interventions mais n'a aucun document ?
Scénario :
Artisan : Pierre Dubois
Interventions terminées : 4
Documents : 0/5
Résultat :
Statut artisan : FORMATION (basé sur 4 interventions, seuil de 3 atteint)
Statut dossier : À compléter (a une intervention mais aucun document)
Explication : Le statut artisan et le statut de dossier sont indépendants. Un artisan peut progresser professionnellement (NOVICE → FORMATION → CONFIRME) même si son dossier administratif est incomplet. Alerte : Cet artisan apparaîtra dans la vue "Liste Artisans à compléter" pour signaler l'urgence de compléter son dossier.
Que se passe-t-il si un artisan a tous les documents mais aucune intervention ?
Scénario :
Artisan : Sophie Leroy
Interventions terminées : 0
Documents : 5/5
Résultat :
Statut artisan : POTENTIEL (aucune intervention, reste au statut initial)
Statut dossier : COMPLET (tous les documents présents)
Explication : C'est un cas idéal : l'artisan est prêt administrativement mais n'a pas encore travaillé. Dès sa première intervention terminée, il passera automatiquement à NOVICE.
Que se passe-t-il si un artisan manque exactement 1 document ?
Scénario :
Artisan : Luc Martin
Interventions terminées : 0
Documents : 4/5 (manque IBAN)
Résultat :
Statut artisan : POTENTIEL (aucune intervention)
Statut dossier : À compléter (règle : si exactement 1 document manque)
Explication : Même sans intervention, un artisan à qui il ne manque qu'un seul document passe à "À compléter" pour signaler qu'il est presque prêt et prioritaire. Code : src/lib/artisans/dossierStatus.ts

// Si exactement 4 documents (donc 1 manquant)
if (requiredDocsCount === 4) {
  return "À compléter"
}
Comment fonctionne le statut "Archive" ?
Caractéristiques :
Statut gelé : Aucune progression automatique possible
Permanent : Ne peut pas revenir automatiquement à un statut actif
Raison obligatoire : L'archivage nécessite une justification
Utilisation :
Artisan qui ne travaille plus avec l'entreprise
Artisan suspendu temporairement
Artisan radié
Implémentation : src/lib/artisans/statusRules.ts

const STATUS_THRESHOLDS = {
  ARCHIVE: -1  // -1 signifie "gelé, pas de seuil"
}

function canProgressAutomatically(currentStatus: string): boolean {
  return currentStatus !== "ARCHIVE"
}
Trigger PostgreSQL : supabase/migrations/00008_artisan_triggers.sql

-- Ne pas recalculer si le statut actuel est ARCHIVE
IF current_artisan_status.code = 'ARCHIVE' THEN
  RETURN NEW;  -- Sortir sans rien faire
END IF;
Effet : Un artisan ARCHIVE qui termine une intervention ne verra pas son statut évoluer. Il restera ARCHIVE jusqu'à ce qu'un gestionnaire le réactive manuellement.
Peut-on revenir en arrière dans les statuts ?
Progression automatique : NON, uniquement vers l'avant
NOVICE ne peut pas redevenir automatiquement CANDIDAT
CONFIRME ne peut pas redevenir automatiquement FORMATION
Modification manuelle : OUI, avec justification
Un gestionnaire peut manuellement changer CONFIRME → FORMATION
L'historique enregistre la raison du changement
Le champ change_reason dans artisan_status_history contiendra "manual"
Exception : Statut ONE_SHOT Un artisan ONE_SHOT peut être réintégré dans le parcours normal :
ONE_SHOT → POTENTIEL (manuel)
ONE_SHOT → CANDIDAT (manuel)
ONE_SHOT → NOVICE (automatique s'il termine 1 intervention)
Historique de transition :

-- Exemple d'historique
INSERT INTO artisan_status_history VALUES (
  gen_random_uuid(),
  'artisan-123',
  'CONFIRME',              -- old_status_id
  'FORMATION',             -- new_status_id
  now(),
  'user-456',              -- changed_by
  'manual',                -- change_reason
  5                        -- completed_interventions_count
)
6. MAINTENANCE ET MONITORING
Comment vérifier que tous les artisans ont un statut de dossier calculé ?
Requête SQL :

-- Compter les artisans sans statut de dossier
SELECT COUNT(*) as artisans_sans_statut_dossier
FROM artisans
WHERE statut_dossier IS NULL;

-- Lister les artisans avec détails
SELECT
  a.id,
  a.nom,
  a.prenom,
  a.statut_dossier,
  s.label as statut_artisan,
  (SELECT COUNT(*) FROM intervention_artisans ia
   JOIN interventions i ON ia.intervention_id = i.id
   WHERE ia.artisan_id = a.id
     AND ia.is_primary = true
     AND i.statut_id IN (
       SELECT id FROM intervention_statuses
       WHERE code IN ('TERMINE', 'INTER_TERMINEE')
     )
  ) as interventions_terminees,
  (SELECT COUNT(DISTINCT kind) FROM artisan_attachments
   WHERE artisan_id = a.id
     AND kind IN ('kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat')
  ) as documents_requis
FROM artisans a
LEFT JOIN artisan_statuses s ON a.statut_id = s.id
WHERE a.statut_dossier IS NULL
ORDER BY a.nom, a.prenom;
Script de vérification : Créer un fichier scripts/verify-artisan-statuses.js :

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function verifyStatuses() {
  const { data, error } = await supabase
    .from('artisans')
    .select('id, nom, prenom, statut_dossier')
    .is('statut_dossier', null)
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log(`Found ${data.length} artisans without statut_dossier`)
  
  if (data.length > 0) {
    console.log('\n⚠️  Please run: node scripts/recalculate-artisan-statuses.js')
  } else {
    console.log('\n✅ All artisans have a statut_dossier')
  }
}

verifyStatuses()
Existe-t-il des logs ou rapports sur les changements de statuts ?
Oui, table d'historique : artisan_status_history Fichier : supabase/migrations/00052_artisan_status_history.sql Requêtes utiles :

-- Historique complet d'un artisan
SELECT
  h.changed_at,
  old.label as ancien_statut,
  new.label as nouveau_statut,
  h.change_reason,
  h.completed_interventions_count,
  u.email as changed_by_user
FROM artisan_status_history h
LEFT JOIN artisan_statuses old ON h.old_status_id = old.id
LEFT JOIN artisan_statuses new ON h.new_status_id = new.id
LEFT JOIN users u ON h.changed_by = u.id
WHERE h.artisan_id = 'artisan-123'
ORDER BY h.changed_at DESC;

-- Changements de statut aujourd'hui
SELECT
  a.nom,
  a.prenom,
  old.label as ancien_statut,
  new.label as nouveau_statut,
  h.change_reason,
  h.completed_interventions_count
FROM artisan_status_history h
JOIN artisans a ON h.artisan_id = a.id
LEFT JOIN artisan_statuses old ON h.old_status_id = old.id
LEFT JOIN artisan_statuses new ON h.new_status_id = new.id
WHERE DATE(h.changed_at) = CURRENT_DATE
ORDER BY h.changed_at DESC;

-- Statistiques : combien d'artisans ont progressé automatiquement ce mois-ci
SELECT
  new.label as nouveau_statut,
  COUNT(*) as nombre_promotions
FROM artisan_status_history h
JOIN artisan_statuses new ON h.new_status_id = new.id
WHERE h.change_reason = 'automatic'
  AND h.changed_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY new.label
ORDER BY nombre_promotions DESC;
Logging dans les scripts : Les scripts de recalcul (scripts/recalculate-artisan-statuses.js) affichent :
Progression artisan par artisan
Statut avant/après
Nombre d'interventions
Statut de dossier
Comment déboguer un artisan dont le statut semble incorrect ?
Méthodologie de debug :
Étape 1 : Collecter les informations

-- Informations complètes sur l'artisan
SELECT
  a.*,
  s.code as statut_code,
  s.label as statut_label
FROM artisans a
LEFT JOIN artisan_statuses s ON a.statut_id = s.id
WHERE a.id = 'artisan-123';
Étape 2 : Compter les interventions terminées

-- Interventions terminées de l'artisan
SELECT
  i.id,
  i.numero,
  i.titre,
  ist.code as statut_code,
  ist.label as statut_label,
  ia.is_primary
FROM intervention_artisans ia
JOIN interventions i ON ia.intervention_id = i.id
JOIN intervention_statuses ist ON i.statut_id = ist.id
WHERE ia.artisan_id = 'artisan-123'
  AND ia.is_primary = true
  AND ist.code IN ('TERMINE', 'INTER_TERMINEE')
ORDER BY i.created_at;

-- Nombre total
SELECT COUNT(*) as interventions_terminees
FROM intervention_artisans ia
JOIN interventions i ON ia.intervention_id = i.id
JOIN intervention_statuses ist ON i.statut_id = ist.id
WHERE ia.artisan_id = 'artisan-123'
  AND ia.is_primary = true
  AND ist.code IN ('TERMINE', 'INTER_TERMINEE');
Étape 3 : Vérifier les documents

-- Documents de l'artisan
SELECT
  kind,
  file_name,
  created_at
FROM artisan_attachments
WHERE artisan_id = 'artisan-123'
ORDER BY kind, created_at DESC;

-- Documents requis présents
SELECT
  kind,
  COUNT(*) as count
FROM artisan_attachments
WHERE artisan_id = 'artisan-123'
  AND kind IN ('kbis', 'assurance', 'cni_recto_verso', 'iban', 'decharge_partenariat')
GROUP BY kind;
Étape 4 : Consulter l'historique

-- Historique des changements de statut
SELECT
  h.changed_at,
  old.label as ancien_statut,
  new.label as nouveau_statut,
  h.change_reason,
  h.completed_interventions_count,
  u.email as changed_by
FROM artisan_status_history h
LEFT JOIN artisan_statuses old ON h.old_status_id = old.id
LEFT JOIN artisan_statuses new ON h.new_status_id = new.id
LEFT JOIN users u ON h.changed_by = u.id
WHERE h.artisan_id = 'artisan-123'
ORDER BY h.changed_at DESC
LIMIT 10;
Étape 5 : Calculer le statut attendu
Utiliser les seuils :
0 interventions → POTENTIEL (ou statut actuel si manuel)
1 intervention → NOVICE
3 interventions → FORMATION
6 interventions → CONFIRME
10+ interventions → EXPERT
Étape 6 : Recalculer le statut

# Recalculer l'artisan spécifique

node scripts/recalculate-single-artisan-status.js artisan-123
Étape 7 : Vérifier les triggers

-- Vérifier que les triggers sont actifs
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%artisan%'
ORDER BY trigger_name;
Checklist de debug :
 Artisan existe dans la table artisans
 statut_id pointe vers un statut valide dans artisan_statuses
 Nombre d'interventions PRIMARY terminées est correct
 Documents requis comptés correctement
 Triggers sont actifs
 Historique montre les transitions
 Recalcul manuel corrige le problème
Y a-t-il des tests automatisés pour valider les règles de calcul ?
Actuellement, je ne vois pas de tests automatisés dans le code. Recommandation forte : Créer une suite de tests. Tests à créer :

1. Tests unitaires des fonctions de calcul
Fichier à créer : src/lib/artisans/__tests__/statusRules.test.ts

import { determineArtisanStatus, STATUS_THRESHOLDS } from '../statusRules'

describe('Artisan Status Rules', () => {
  test('0 interventions → POTENTIEL', () => {
    expect(determineArtisanStatus(0, 'POTENTIEL')).toBe('POTENTIEL')
  })
  
  test('1 intervention → NOVICE', () => {
    expect(determineArtisanStatus(1, 'POTENTIEL')).toBe('NOVICE')
  })
  
  test('3 interventions → FORMATION', () => {
    expect(determineArtisanStatus(3, 'NOVICE')).toBe('FORMATION')
  })
  
  test('6 interventions → CONFIRME', () => {
    expect(determineArtisanStatus(6, 'FORMATION')).toBe('CONFIRME')
  })
  
  test('10+ interventions → EXPERT', () => {
    expect(determineArtisanStatus(12, 'CONFIRME')).toBe('EXPERT')
  })
  
  test('ARCHIVE reste ARCHIVE', () => {
    expect(determineArtisanStatus(100, 'ARCHIVE')).toBe('ARCHIVE')
  })
})
2. Tests du calcul de statut de dossier
Fichier à créer : src/lib/artisans/__tests__/dossierStatus.test.ts

import { calculateDossierStatus } from '../dossierStatus'

describe('Dossier Status Calculation', () => {
  test('0 documents, 0 interventions → INCOMPLET', () => {
    expect(calculateDossierStatus([], false)).toBe('INCOMPLET')
  })
  
  test('0 documents, 1 intervention → À compléter', () => {
    expect(calculateDossierStatus([], true)).toBe('À compléter')
  })
  
  test('5 documents requis → COMPLET', () => {
    const docs = [
      { kind: 'kbis' },
      { kind: 'assurance' },
      { kind: 'cni_recto_verso' },
      { kind: 'iban' },
      { kind: 'decharge_partenariat' }
    ]
    expect(calculateDossierStatus(docs, false)).toBe('COMPLET')
  })
  
  test('4 documents (1 manquant) → À compléter', () => {
    const docs = [
      { kind: 'kbis' },
      { kind: 'assurance' },
      { kind: 'cni_recto_verso' },
      { kind: 'iban' }
    ]
    expect(calculateDossierStatus(docs, false)).toBe('À compléter')
  })
  
  test('Documents "autre" ne comptent pas', () => {
    const docs = [
      { kind: 'kbis' },
      { kind: 'autre' },
      { kind: 'autre' }
    ]
    expect(calculateDossierStatus(docs, false)).toBe('INCOMPLET')
  })
})
3. Tests d'intégration (avec base de test)
Fichier à créer : tests/integration/artisan-status-calculation.test.ts

describe('Artisan Status Integration Tests', () => {
  test('Completing first intervention updates status to NOVICE', async () => {
    // Créer artisan POTENTIEL
    // Créer intervention
    // Terminer intervention
    // Vérifier statut = NOVICE
  })
  
  test('Adding 5th document sets dossier to COMPLET', async () => {
    // Créer artisan
    // Ajouter 4 documents
    // Vérifier statut = À compléter
    // Ajouter 5ème document
    // Vérifier statut = COMPLET
  })
  
  test('ARC-002: NOVICE + INCOMPLET → À compléter', async () => {
    // Créer artisan CANDIDAT, dossier INCOMPLET
    // Terminer 1 intervention
    // Vérifier statut artisan = NOVICE
    // Vérifier statut dossier = À compléter (ARC-002)
  })
})
4. Tests SQL (triggers)
Fichier à créer : supabase/tests/artisan_triggers.test.sql

-- Test trigger intervention completion
BEGIN;
  -- Setup
  INSERT INTO artisans VALUES (...);
  INSERT INTO interventions VALUES (...);
  
  -- Action
  UPDATE interventions SET statut_id = 'TERMINE' WHERE id = '...';
  
  -- Assert
  SELECT statut_id FROM artisans WHERE id = '...';
  -- Should be NOVICE
ROLLBACK;
7. RÉCAPITULATIF DES RÈGLES MÉTIER
Règles de progression artisan
Seuil Statut obtenu Condition
0 POTENTIEL Statut par défaut
1 NOVICE 1+ intervention terminée PRIMARY
3 FORMATION 3+ interventions terminées PRIMARY
6 CONFIRME 6+ interventions terminées PRIMARY
10+ EXPERT 10+ interventions terminées PRIMARY
N/A ARCHIVE Manuel uniquement, gelé
Règles de statut de dossier
Documents requis Interventions Statut dossier
0 0 INCOMPLET
0 1+ À compléter
1-3 N/A INCOMPLET
4 (1 manquant) N/A À compléter
4 1+ À compléter
5 N/A COMPLET
Règle ARC-002

SI (
  statut_artisan PASSE À "NOVICE" POUR LA PREMIÈRE FOIS
  ET
  statut_dossier == "INCOMPLET"
)
ALORS
  statut_dossier = "À compléter"
8. SCHÉMA VISUEL DU SYSTÈME

┌─────────────────────────────────────────────────────────────────┐
│                    ÉVÉNEMENTS DÉCLENCHEURS                      │
└─────────────────────────────────────────────────────────────────┘
           │                        │                        │
           │                        │                        │
     Intervention              Document                Document
      terminée                  ajouté                supprimé
           │                        │                        │
           ▼                        ▼                        │
    ┌──────────────┐        ┌──────────────┐               │
    │   TRIGGER    │        │   TRIGGER    │◄──────────────┘
    │  on UPDATE   │        │ on INSERT/   │
    │ interventions│        │   DELETE     │
    └──────┬───────┘        └──────┬───────┘
           │                        │
           │                        │
           ▼                        ▼
    ┌──────────────────────────────────────────┐
    │  FONCTION POSTGRESQL DE CALCUL           │
    │                                          │
    │  1. Compter interventions PRIMARY        │
    │  2. Compter documents requis             │
    │  3. Déterminer nouveau statut_artisan    │
    │  4. Calculer nouveau statut_dossier      │
    │  5. Appliquer règle ARC-002              │
    │  6. Enregistrer historique               │
    │  7. Mettre à jour artisan                │
    └──────────────┬───────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────────┐
    │       TABLE: artisans                    │
    │                                          │
    │  - statut_id (FK artisan_statuses)       │
    │  - statut_dossier (ENUM)                 │
    └──────────────┬───────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────────────────────┐
    │  TABLE: artisan_status_history           │
    │                                          │
    │  - old_status_id                         │
    │  - new_status_id                         │
    │  - change_reason (automatic/manual)      │
    │  - completed_interventions_count         │
    └──────────────────────────────────────────┘
9. BONNES PRATIQUES
Pour les développeurs
Ne jamais modifier directement statut_id ou statut_dossier sans raison
Laisser les triggers faire leur travail
Utiliser les scripts de recalcul si nécessaire
Toujours utiliser is_primary = true pour les artisans principaux
Seules les interventions PRIMARY comptent pour la progression
Respecter les codes de statut d'intervention
TERMINE ou INTER_TERMINEE pour compter comme terminée
Ne pas inventer de nouveaux codes sans mise à jour de la logique
Documenter les changements manuels de statut
Utiliser le champ change_reason dans l'historique
Justifier les modifications
Tester après toute migration
Exécuter node scripts/recalculate-artisan-statuses.js
Vérifier que tous les artisans ont un statut_dossier
Pour les gestionnaires
Utiliser la vue "À compléter" régulièrement
C'est la liste prioritaire des dossiers à finaliser
Ne pas archiver un artisan sans raison
L'archivage est permanent (pas de retour automatique)
Vérifier le statut de dossier avant la première intervention
Idéalement, obtenir tous les documents avant que l'artisan ne travaille
Utiliser les filtres pour suivre la progression
"Ma liste artisans" pour vos artisans assignés
Filtrer par statut artisan pour cibler des profils (NOVICE, FORMATION, etc.)
10. FICHIERS CLÉS - RÉFÉRENCE RAPIDE
Fichier Responsabilité Importance
supabase/migrations/00008_artisan_triggers.sql Triggers et fonctions PostgreSQL ⭐⭐⭐ CRITIQUE
scripts/recalculate-artisan-statuses.js Script de recalcul global ⭐⭐⭐
src/lib/artisans/statusRules.ts Règles et seuils ⭐⭐⭐
src/lib/artisans/dossierStatus.ts Calcul statut dossier ⭐⭐⭐
src/lib/artisans/statusTransition.ts Transitions et ARC-002 ⭐⭐
docs/REGLES_STATUTS_ARTISANS.md Documentation métier ⭐⭐
app/artisans/page.tsx Interface utilisateur ⭐⭐
src/config/status-colors.ts Configuration visuelle ⭐
supabase/seeds/seed_essential.sql Données de référence ⭐
Voilà ! Vous avez maintenant une compréhension complète du système de calcul des statuts d'artisans. N'hésitez pas si vous avez des questions supplémentaires ou si vous souhaitez que je vous aide à créer les tests automatisés ou tout autre amélioration du système ! 🚀
