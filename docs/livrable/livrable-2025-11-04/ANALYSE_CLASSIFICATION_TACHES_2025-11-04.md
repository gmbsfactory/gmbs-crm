# 📋 Analyse et Classification des Tâches - Spécifications Interventions & Artisans

**Date d'analyse** : 5 novembre 2025  
**Source** : `livrable-specs-interventions-artisans_2025-11-04.html`  
**Objectif** : Classifier les tâches par complexité (modifications BDD vs implémentations simples)

---

## 📊 Vue d'ensemble

| Catégorie | Nombre | Priorité suggérée |
|-----------|--------|-------------------|
| **Modifications BDD complexes** | 10 | Phase 1 - Infrastructure |
| **Implémentations simples** | 11 | Phase 2 - UI/UX |
| **Points à clarifier** | 3 | Phase 0 - Cadrage |

---

## 🔴 Phase 0 : Points à clarifier (BLOQUANTS)

Ces éléments nécessitent des décisions produit avant implémentation.

### ART-001 : Gestion IBAN avec validation Admin
**Référence** : ART-001  
**Statut** : ⚠️ À cadrer  
**Complexité estimée** : 🔴 Haute (si notification complexe)

**Questions à clarifier** :
- Comment l'Admin est-il informé qu'un IBAN a été ajouté ?
  - Notification email ?
  - Notification in-app ?
  - File d'attente avec badge/compteur ?
- Où afficher l'état de validation ? (fiche artisan, liste, etc.)

**Impact BDD** :
```sql
ALTER TABLE artisans ADD COLUMN iban TEXT;
ALTER TABLE artisans ADD COLUMN iban_validated BOOLEAN DEFAULT false;
ALTER TABLE artisans ADD COLUMN iban_validated_at TIMESTAMPTZ;
ALTER TABLE artisans ADD COLUMN iban_validated_by UUID REFERENCES users(id);
```

**Impact technique** :
- Table artisans (4 nouveaux champs)
- Système de notifications (si requis)
- Permissions (gestionnaire vs admin)
- Validation format IBAN

---

### Perspectives futures : WhatsApp & SMS
**Référence** : Section 11  
**Statut** : ⚠️ À cadrer  
**Volumétrie** : ~350-400 messages/mois

**Points à définir** :
- Intégration API WhatsApp Business
- Fallback SMS en cas d'indisponibilité
- Coût et fournisseur
- Conformité RGPD

---

### Perspectives futures : Dépôt de documents & contrats
**Référence** : Section 11  
**Statut** : ⚠️ À cadrer  

**Points à définir** :
- Lien d'accès unique ou permanent ?
- Mode d'hébergement (Supabase Storage, autre ?)
- Signature électronique (DocuSign, HelloSign, autre ?)
- Workflow de validation

---

## 🔴 Phase 1 : Modifications BDD complexes

Ces tâches nécessitent des modifications structurelles du schéma de base de données et/ou des automatisations backend.

### 1. INT-002 : Logement vacant avec champs conditionnels
**Référence** : INT-002  
**Complexité** : 🔴 Haute  
**Impact** : Schéma interventions + logique conditionnelle UI

**Modifications BDD requises** :
```sql
-- Table interventions
ALTER TABLE interventions ADD COLUMN logement_vacant BOOLEAN DEFAULT false;
ALTER TABLE interventions ADD COLUMN info_clef TEXT;
ALTER TABLE interventions ADD COLUMN etage TEXT;
ALTER TABLE interventions ADD COLUMN numero_appartement TEXT;
```

**Logique métier** :
- Si `logement_vacant = true`, remplacer les champs :
  - ❌ Client (via tenant_id)
  - ❌ Téléphone
  - ✅ Information clef (code)
  - ✅ Étage
  - ✅ Numéro d'appartement
  - ✅ Contexte (renforcé)

**Composants impactés** :
- `NewInterventionModalContent.tsx`
- `InterventionModalContent.tsx`
- Types TypeScript
- API `/api/interventions/*`

**Estimation** : 3-4 jours

---

### 2. AGN-001 : Référence agence obligatoire
**Référence** : AGN-001  
**Complexité** : 🟡 Moyenne  
**Impact** : Schéma interventions + validation conditionnelle

**Modifications BDD requises** :
```sql
-- Vérifier si le champ existe déjà
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS reference_agence TEXT;
```

**Règles métier** :
- Agences requérant une référence :
  - ImoDirect
  - AFEDIM
  - Locoro
- Validation bloquante à la création

**Table de configuration suggérée** :
```sql
CREATE TABLE IF NOT EXISTS agency_config (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id),
  requires_reference BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Peupler avec les 3 agences
INSERT INTO agency_config (agency_id, requires_reference)
SELECT id, true FROM agencies WHERE name IN ('ImoDirect', 'AFEDIM', 'Locoro');
```

**Estimation** : 1-2 jours

---

### 3. ACPT-001 : Gestion complète des acomptes
**Référence** : ACPT-001  
**Complexité** : 🔴 Haute  
**Impact** : Multiples champs + automatisations de statut

**Modifications BDD requises** :
```sql
-- Dans intervention_payments, vérifier/ajouter :
ALTER TABLE intervention_payments ADD COLUMN IF NOT EXISTS montant_acompte_reclame NUMERIC(12,2);
ALTER TABLE intervention_payments ADD COLUMN IF NOT EXISTS acompte_recu BOOLEAN DEFAULT false;
ALTER TABLE intervention_payments ADD COLUMN IF NOT EXISTS date_reception_acompte TIMESTAMPTZ;
```

**Workflow automatisé** :
1. **Saisie montant réclamé** (depuis statut "Accepté") → Statut "Attente acompte" ⏱️
2. **Case "Acompte reçu" cochée** → Obligation de saisir `date_reception_acompte` 📅
3. **Date saisie** → Statut "Accepté $" ✅ (symbole $ pour indiquer réception)

**Règles de validation** :
- Montant réclamé > 0
- Date réception ≤ date du jour
- Impossible de passer à "Accepté $" sans date réception

**Composants impactés** :
- `InterventionModalContent.tsx` (section paiement)
- API `/api/interventions/[id]/route.ts` (logique de transition de statut)
- Nouveau statut "Attente acompte" dans `intervention_statuses`
- Nouveau statut "Accepté $" dans `intervention_statuses`

**Estimation** : 4-5 jours

---

### 4. DAT-001 : Due date → Statut "Check" automatique
**Référence** : DAT-001  
**Complexité** : 🔴 Haute  
**Impact** : Job automatique + logique de transition

**Modifications BDD requises** :
```sql
-- Vérifier que due_date existe (déjà présent dans le schéma)
-- Ajouter un champ pour stocker le statut précédent si besoin
ALTER TABLE interventions ADD COLUMN previous_statut_id UUID REFERENCES intervention_statuses(id);
```

**Automatisation requise** :
- **Job cron** (toutes les heures ou quotidien à minuit)
- **Conditions** :
  - `due_date < NOW()`
  - `statut IN ('Visite technique', 'Intervention en cours')`
  - → Passer à statut "Check"
  - → Sauvegarder le statut précédent dans `previous_statut_id`

**Règle de retour** :
- Modification de `date_termine` (prolongation) → Retour au `previous_statut_id`

**Validation** :
- VT ou EC **DOIVENT** avoir une `due_date` (blocage à la sauvegarde)

**Implémentation technique** :
```typescript
// supabase/functions/check-due-dates/index.ts
// OU
// Edge Function avec pg_cron
```

**Composants impactés** :
- Nouvelle Edge Function Supabase
- `InterventionModalContent.tsx` (validation due_date obligatoire)
- Logique de modification de `date_termine`

**Estimation** : 3-4 jours

---

### 5. DEVI-001 : ID devis pré-requis pour "Devis envoyé"
**Référence** : DEVI-001  
**Complexité** : 🟡 Moyenne  
**Impact** : Validation conditionnelle + logique menu contextuel

**Modifications BDD requises** :
```sql
-- Vérifier si le champ existe
ALTER TABLE interventions ADD COLUMN IF NOT EXISTS id_devis TEXT;
```

**Règles métier** :
- ❌ Sans `id_devis` → Action "Passer à Devis envoyé" **masquée** dans le menu contextuel
- ✅ Avec `id_devis` → Action disponible
- 🚫 **Pas d'automatisation** : pas de passage automatique "Demandé → Devis envoyé" lors de la saisie

**Composants impactés** :
- Menu contextuel interventions (clic droit)
- `InterventionModalContent.tsx` (champ ID devis)
- Validation avant changement de statut

**Estimation** : 1-2 jours

---

### 6. DUP-001 : "Devis supp" - Duplication d'intervention
**Référence** : DUP-001  
**Complexité** : 🟡 Moyenne  
**Impact** : Logique de duplication + champs exclus

**Modifications BDD requises** :
```sql
-- Aucune modification structurelle, utiliser les champs existants
-- Possiblement ajouter un champ pour lier les interventions dupliquées
ALTER TABLE interventions ADD COLUMN duplicated_from UUID REFERENCES interventions(id);
```

**Règles de duplication** :
- **Copier** : Tous les champs sauf :
  - ❌ `id` (nouveau UUID)
  - ❌ `id_inter` (nouveau, généré)
  - ❌ `contexte_intervention`
  - ❌ `consigne_intervention`
- **Ajouter commentaire automatique** : `"Devis supp avec l'ancien ID [id_inter]"`
- **Nouveau statut** : "Demandé" (par défaut)

**Composants impactés** :
- Menu contextuel "Devis supp"
- API `/api/interventions/duplicate` (nouvelle route)
- Système de commentaires

**Estimation** : 2-3 jours

---

### 7. ARC-001 : Commentaire obligatoire à l'archivage
**Référence** : ARC-001  
**Complexité** : 🟡 Moyenne  
**Impact** : Champs d'archivage + validation UI

**Modifications BDD requises** :
```sql
-- Artisans
ALTER TABLE artisans ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE artisans ADD COLUMN archived_by UUID REFERENCES users(id);
ALTER TABLE artisans ADD COLUMN archived_reason TEXT;

-- Interventions
ALTER TABLE interventions ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE interventions ADD COLUMN archived_by UUID REFERENCES users(id);
ALTER TABLE interventions ADD COLUMN archived_reason TEXT;
```

**Règles métier** :
- À l'archivage → Pop-up modal avec champ texte **obligatoire**
- Impossible de valider sans raison
- Stockage de l'utilisateur et de la date

**Composants impactés** :
- Menu contextuel Artisans (clic droit → Archiver)
- Pop-up d'archivage (nouveau composant)
- Système de filtres (exclure archivés par défaut)

**Estimation** : 2 jours

---

### 8. ART-002 : Règle automatique "Incomplet → Novice → À compléter"
**Référence** : ART-002  
**Complexité** : 🟡 Moyenne  
**Impact** : Trigger ou logique applicative

**Modifications BDD requises** :
```sql
-- Trigger PostgreSQL
CREATE OR REPLACE FUNCTION update_artisan_statut_on_niveau_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Si statut dossier = "Incomplet" ET niveau passe à "Novice"
  IF OLD.niveau != 'Novice' AND NEW.niveau = 'Novice' THEN
    IF EXISTS (
      SELECT 1 FROM artisan_statuses 
      WHERE id = NEW.statut_id AND code = 'incomplet'
    ) THEN
      NEW.statut_id := (
        SELECT id FROM artisan_statuses WHERE code = 'a_completer' LIMIT 1
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_artisan_statut_on_niveau
BEFORE UPDATE ON artisans
FOR EACH ROW
EXECUTE FUNCTION update_artisan_statut_on_niveau_change();
```

**Alternative** : Logique applicative dans l'API

**Estimation** : 1-2 jours

---

### 9. INT-003 : Droits d'édition "Contexte"
**Référence** : INT-003  
**Complexité** : 🟢 Faible  
**Impact** : Permissions UI

**Modifications BDD requises** :
❌ Aucune (gestion au niveau applicatif)

**Règles métier** :
- `NewInterventionModalContent` → Contexte **modifiable**
- `InterventionModalContent` → Contexte **lecture seule**
- **Administrateurs** → Peuvent modifier après création

**Composants impactés** :
- `NewInterventionModalContent.tsx`
- `InterventionModalContent.tsx`
- Hook `useUserRole()` ou équivalent

**Estimation** : 0.5 jour

---

### 10. INT-001 : Validation champs obligatoires
**Référence** : INT-001  
**Complexité** : 🟢 Faible  
**Impact** : Validation frontend + backend

**Modifications BDD requises** :
```sql
-- Contraintes NOT NULL (si pas déjà en place)
ALTER TABLE interventions ALTER COLUMN adresse SET NOT NULL;
ALTER TABLE interventions ALTER COLUMN contexte_intervention SET NOT NULL;
ALTER TABLE interventions ALTER COLUMN metier_id SET NOT NULL;
ALTER TABLE interventions ALTER COLUMN statut_id SET NOT NULL;
ALTER TABLE interventions ALTER COLUMN agence_id SET NOT NULL;
```

**Règles de validation** :
- Champs **obligatoires** à la création :
  - ✅ Adresse
  - ✅ Contexte
  - ✅ Métier
  - ✅ Statut
  - ✅ Agence

**Composants impactés** :
- `NewInterventionModalContent.tsx` (validation React Hook Form)
- API `/api/interventions/route.ts` (validation backend)

**Estimation** : 0.5 jour

---

## 🟢 Phase 2 : Implémentations simples (UI/UX)

Ces tâches n'impactent pas le schéma de la base de données ou ont un impact mineur.

### 11. MSG-001 : Prévisualisation & copie du message type
**Référence** : MSG-001  
**Complexité** : 🟢 Faible  
**Impact** : Frontend uniquement

**Fonctionnalités** :
- Affichage fidèle du message final (WhatsApp/SMS)
- Icône "copier" → Copie dans le presse-papiers
- Utilisation de `navigator.clipboard.writeText()`

**Composants impactés** :
- Composant de messagerie (à identifier/créer)
- Icône Lucide React `Copy`

**Estimation** : 1 jour

---

### 12. TPL-001 : Intégration des modèles (2 emails + 1 SMS)
**Référence** : TPL-001  
**Complexité** : 🟢 Faible  
**Impact** : Configuration de templates

**Contenu reçu** :
- 2 modèles d'emails
- 1 modèle de SMS

**Implémentation** :
- Créer fichiers de templates dans `/src/lib/templates/`
- Variables dynamiques : `{{nom}}`, `{{adresse}}`, etc.
- Fonction de remplacement des variables

**Structure suggérée** :
```
/src/lib/templates/
  ├── email-template-1.ts
  ├── email-template-2.ts
  └── sms-template-1.ts
```

**Estimation** : 1 jour

---

### 13. MAP-001 : Mapping "Montant du budget" = "SST"
**Référence** : MAP-001  
**Complexité** : 🟢 Très faible  
**Impact** : Configuration

**Action** :
- Confirmer que le champ `Montant du budget` dans l'UI correspond à la colonne `SST` du Google Sheet
- Vérifier la table `intervention_costs` avec `cost_type = 'sst'`

**Composants impactés** :
- Sync Google Sheets (si existant)
- Formulaire d'intervention (label du champ)

**Estimation** : 0.5 jour

---

### 14. UI-001 : Menus contextuels (clic droit)
**Référence** : UI-001  
**Complexité** : 🟡 Moyenne  
**Impact** : UX

**Menus à implémenter** :

#### Artisans :
- Ouvrir fiche artisan
- Modifier fiche artisan
- Archiver (→ pop-up avec motif)

#### Market / Carte :
- "Je gère" → Attribue `assigned_user_id`

#### Liste des interventions :
- Ouvrir
- Ouvrir dans un nouvel onglet
- Passer de "Demandé" à "Devis envoyé" (si `id_devis` renseigné)
- Passer de "Devis envoyé" à "Accepté"
- Devis supp (duplication)

**Librairies suggérées** :
- `@radix-ui/react-context-menu` ou
- `react-contexify`

**Composants impactés** :
- `ArtisansTable.tsx` / `ArtisansCard.tsx`
- `InterventionsTable.tsx` / `InterventionsCard.tsx`
- `MarketMap.tsx`

**Estimation** : 3-4 jours

---

### 15. NOT-001 : Pop-ups d'information
**Référence** : NOT-001  
**Complexité** : 🟢 Faible  
**Impact** : UX

**Fonctionnalités** :
- Toast notifications à la création/modification
- Messages :
  - "Artisan créé avec succès"
  - "Intervention modifiée"
  - "Statut mis à jour"
  - etc.

**Librairie suggérée** :
- `sonner` (moderne, léger)
- `react-hot-toast`

**Implémentation** :
```typescript
import { toast } from 'sonner';

// Après création
toast.success('Intervention créée avec succès');

// Après modification
toast.success('Artisan modifié');

// Erreur
toast.error('Impossible de supprimer l\'intervention');
```

**Estimation** : 1 jour

---

### 16. ARC-002 : Indication "Indisponible" pour artisans
**Référence** : ARC-002  
**Complexité** : 🟢 Faible  
**Impact** : UI

**Règles d'affichage** :
- Artisans **indisponibles** → Pastille visible dans les recherches
- Artisans **archivés** → ❌ N'apparaissent PAS sur la carte
- Artisan archivé → **Conserve** son statut de compétence (Novice, Confirmé, etc.)

**Composants impactés** :
- `ArtisanCard.tsx` (badge "Indisponible")
- `MarketMap.tsx` (filtre archivés)
- Requêtes API (filtrer `is_active = true`)

**Estimation** : 1 jour

---

### 17. Ajout du champ "Logement vacant" (UI)
**Référence** : INT-002 (UI uniquement)  
**Complexité** : 🟡 Moyenne  
**Impact** : Logique conditionnelle UI

**Fonctionnalité** :
- Checkbox "Logement vacant" dans section "Détails propriétaire et client"
- Si cochée → Afficher : Info clef, Étage, N° appartement, Contexte
- Si non cochée → Afficher : Client, Téléphone

**Logique React** :
```typescript
const [logementVacant, setLogementVacant] = useState(false);

{logementVacant ? (
  <>
    <Input name="info_clef" label="Information clef (code)" />
    <Input name="etage" label="Étage" />
    <Input name="numero_appartement" label="Numéro d'appartement" />
    <Textarea name="contexte" label="Contexte" />
  </>
) : (
  <>
    <Select name="tenant_id" label="Client" />
    <Input name="telephone" label="Téléphone" />
  </>
)}
```

**Composants impactés** :
- `NewInterventionModalContent.tsx`
- `InterventionModalContent.tsx`

**Estimation** : 2 jours (couplé avec Phase 1 #1)

---

### 18. Validation "Référence agence" pour 3 agences (UI)
**Référence** : AGN-001 (UI uniquement)  
**Complexité** : 🟡 Moyenne  
**Impact** : Validation conditionnelle

**Logique** :
```typescript
const agencesRequieringRef = ['ImoDirect', 'AFEDIM', 'Locoro'];
const selectedAgency = watch('agence_id');

// Validation dynamique
const requiresRef = agencesRequieringRef.includes(selectedAgency?.name);

<Input
  name="reference_agence"
  label="Référence agence"
  required={requiresRef}
  rules={{ required: requiresRef ? 'Référence requise pour cette agence' : false }}
/>
```

**Composants impactés** :
- `NewInterventionModalContent.tsx`

**Estimation** : 1 jour (couplé avec Phase 1 #2)

---

### 19. Gestion de la "Due date" obligatoire pour VT/EC (UI)
**Référence** : DAT-001 (UI uniquement)  
**Complexité** : 🟢 Faible  
**Impact** : Validation conditionnelle

**Règles** :
- Statuts "Visite technique" ou "Intervention en cours" → `due_date` **obligatoire**
- Validation bloquante

**Logique** :
```typescript
const statut = watch('statut_id');
const isDueDateRequired = ['visite_technique', 'intervention_en_cours'].includes(statut?.code);

<DatePicker
  name="due_date"
  label="Date limite"
  required={isDueDateRequired}
/>
```

**Estimation** : 0.5 jour (couplé avec Phase 1 #4)

---

### 20. Masquage conditionnel "Devis envoyé" (UI)
**Référence** : DEVI-001 (UI uniquement)  
**Complexité** : 🟢 Faible  
**Impact** : Menu contextuel

**Règles** :
- Si `id_devis` vide → Action "Passer à Devis envoyé" **masquée**
- Si `id_devis` renseigné → Action **visible**

**Logique** :
```typescript
const menuItems = [
  { label: 'Ouvrir', action: () => openIntervention() },
  {
    label: 'Passer à "Devis envoyé"',
    action: () => updateStatus('devis_envoye'),
    hidden: !intervention.id_devis, // ← Condition
  },
];
```

**Estimation** : 0.5 jour (couplé avec Phase 1 #5)

---

### 21. Menu "Devis supp" (UI)
**Référence** : DUP-001 (UI uniquement)  
**Complexité** : 🟢 Faible  
**Impact** : Menu contextuel

**Action** :
- Ajouter l'option "Devis supp" dans le menu contextuel
- Appeler l'API de duplication

**Estimation** : 0.5 jour (couplé avec Phase 1 #6)

---

## 📅 Planning suggéré

| Phase | Durée estimée | Dépendances |
|-------|--------------|-------------|
| **Phase 0 : Cadrage** | 1-2 jours | Décisions clients |
| **Phase 1 : Migrations BDD** | 15-20 jours | Aucune |
| **Phase 2 : UI/UX** | 10-12 jours | Phase 1 terminée |
| **Tests & QA** | 5 jours | Phases 1 & 2 terminées |
| **Total** | **33-41 jours** | ~7-8 semaines |

---

## 🎯 Priorisation recommandée

### Sprint 1 (Semaine 1-2) : Fondations BDD
1. ✅ AGN-001 : Référence agence (simple)
2. ✅ INT-001 : Champs obligatoires (simple)
3. ✅ INT-003 : Droits d'édition Contexte (simple)
4. ✅ DEVI-001 : ID devis pré-requis (simple)
5. ✅ ARC-001 : Commentaire archivage (moyen)

### Sprint 2 (Semaine 3-4) : Fonctionnalités métier
6. ✅ INT-002 : Logement vacant (complexe)
7. ✅ ACPT-001 : Gestion acomptes (complexe)
8. ✅ ART-002 : Règle statut automatique (moyen)
9. ✅ DUP-001 : Duplication devis (moyen)

### Sprint 3 (Semaine 5) : Automatisations
10. ✅ DAT-001 : Due date → Check (complexe + job cron)

### Sprint 4 (Semaine 6-7) : UI/UX
11. ✅ UI-001 : Menus contextuels (priorité haute)
12. ✅ NOT-001 : Pop-ups d'information
13. ✅ MSG-001 : Prévisualisation messages
14. ✅ TPL-001 : Templates emails/SMS
15. ✅ ARC-002 : Indication "Indisponible"
16. ✅ MAP-001 : Mapping budget

### Sprint 5 (Semaine 8) : Tests & corrections
17. Tests end-to-end
18. Tests unitaires règles métier
19. Tests d'intégration
20. Corrections de bugs

---

## 🚨 Risques identifiés

| Risque | Impact | Mitigation |
|--------|--------|------------|
| **ART-001 non cadré** | 🔴 Bloquant | Réunion urgente avec client |
| **Complexité job cron DAT-001** | 🟡 Moyen | Prévoir Edge Functions Supabase |
| **Conflits schéma BDD existant** | 🔴 Élevé | Backup BDD avant chaque migration |
| **Tests régression** | 🟡 Moyen | Suite de tests automatisés complète |
| **Duplication devis complexe** | 🟡 Moyen | Bien gérer les relations (artisans, costs, etc.) |

---

## 📝 Notes techniques

### Outils recommandés
- **Migrations BDD** : Supabase CLI + fichiers SQL versionnés
- **Menus contextuels** : `@radix-ui/react-context-menu`
- **Notifications** : `sonner`
- **Validation formulaires** : `react-hook-form` + `zod`
- **Jobs cron** : Supabase Edge Functions + `pg_cron`

### Bonnes pratiques
- ✅ Créer une migration BDD par fonctionnalité
- ✅ Tester chaque migration sur un environnement de staging
- ✅ Documenter chaque règle métier dans `/docs/BUSINESS_RULES.md`
- ✅ Créer des tests unitaires pour chaque automatisation
- ✅ Versionner les templates de messages

---

## 🔗 Liens utiles
- [Fichier de règles métier](/docs/BUSINESS_RULES_2025-11-04.md)
- [Spécifications HTML source](/livrable-specs-interventions-artisans_2025-11-04.html)
- [Schéma BDD actuel](/supabase/migrations/20251005_clean_schema.sql)

---

**Dernière mise à jour** : 5 novembre 2025  
**Maintenu par** : Équipe Dev GMBS CRM

