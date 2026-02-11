# 📋 Suivi des Sprints - Livrable Interventions & Artisans

**Date de début** : 6 novembre 2025  
**Durée estimée totale** : 7-8 semaines (5 sprints)  
**Statut** : ✅ Sprint 1 terminé - Prêt pour Sprint 2

---

## 🎯 Vue d'ensemble

| Sprint | Durée | Tâches | Statut | Dates | Progression |
|--------|-------|--------|--------|-------|-------------|
| **Sprint 1** | 9j | 6 tâches | ✅ Terminé | 06/11 - 16/11 | 6/6 (100%) ✅ |
| **Sprint 2** | 16.5j | 6 tâches | ⏸️ À venir | 15/11 - 06/12 | 0/6 (0%) |
| **Sprint 3** | 4.5j | 2 tâches | ✅ Terminé | 09/12 - 13/12 | 2/2 (100%) ✅ |
| **Sprint 4** | 10j | 8 tâches | 🟡 En cours | 16/12 - 30/12 | 2/8 (25%) |
| **Sprint 5** | 5j | Tests & QA | ⏸️ À venir | 02/01 - 08/01 | — |

**Légende** :
- ⏸️ À venir
- 🟡 En cours
- ✅ Terminé
- 🔴 Bloqué
- ⚠️ Attention requise

---

## 📊 Sprint 1 : Fondations BDD (Semaines 1-2)

**Objectif** : Implémenter les modifications BDD simples et validations de base  
**Durée** : 7 jours  
**Dates** : 06/11/2025 - 14/11/2025

### Tâches

#### 1. AGN-001 : Référence agence obligatoire
**Statut** : ✅ **TERMINÉ**  
**Priorité** : P1  
**Durée estimée** : 1-2j  
**Durée réelle** : 2j  
**Complexité** : 🟡 Moyenne  
**Date de fin** : 6 novembre 2025

**Description** :
- Ajouter le champ `reference_agence` dans la table `interventions`
- Créer une table de configuration `agency_config`
- Affichage conditionnel pour ImoDirect, AFEDIM, Oqoro (correction : pas Locoro)

**Checklist** :
- [x] Migration BDD : Ajouter `reference_agence TEXT` à `interventions`
- [x] Migration BDD : Créer table `agency_config` avec `requires_reference`
- [x] Peupler `agency_config` pour les 3 agences (manuel via SQL)
- [x] Types TypeScript mis à jour (API V2)
- [x] UI : Champ conditionnel dans `LegacyInterventionForm.tsx`
- [x] UI : Champ conditionnel dans `InterventionEditForm.tsx`
- [x] UI : Champ ajouté dans `ExpandedRowContent` (TableView.tsx)
- [x] CSS : Grid 6 colonnes pour tous les modes (halfpage, centerpage, fullpage)
- [x] Fix z-index : SelectContent, DropdownMenu, Popover passent au-dessus du modal fullpage
- [x] Documentation mise à jour

**Règle métier associée** : BR-AGN-001 (modifiée : champ visible mais non-requis)

**Fichiers modifiés** :
- ✅ `supabase/migrations/20251106143000_add_reference_agence.sql` (créé)
- ✅ `src/lib/api/v2/common/types.ts` (ligne 62, 287, 311)
- ✅ `src/lib/api/v2/common/utils.ts` (ligne 197)
- ✅ `src/components/interventions/LegacyInterventionForm.tsx` (lignes 29, 49, 300, 340, 397)
- ✅ `src/components/interventions/InterventionEditForm.tsx` (lignes 35, 84, 449, 511, 575)
- ✅ `src/components/interventions/views/TableView.tsx` (lignes 1382-1392, 1439-1444)
- ✅ `app/globals.css` (lignes 1735-1746 - Grid 6 colonnes)
- ✅ `src/components/ui/select.tsx` (ligne 78 - z-index 10000)
- ✅ `src/components/ui/dropdown-menu.tsx` (lignes 50, 68 - z-index 10000)
- ✅ `src/components/ui/popover.tsx` (ligne 26 - z-index 10000)

**Modifications BDD effectuées** :
```sql
-- Table interventions
ALTER TABLE interventions ADD COLUMN reference_agence TEXT;

-- Nouvelle table agency_config
CREATE TABLE agency_config (
  agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
  requires_reference BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Données peuplées (manuel)
INSERT INTO agency_config (agency_id, requires_reference) 
SELECT id, true FROM agencies 
WHERE name IN ('ImoDirect', 'AFEDIM', 'Oqoro');
```

**Changements UI** :
1. **Formulaire création** (`LegacyInterventionForm.tsx`) :
   - Champ "Référence agence" s'affiche à côté de "Agence" quand ImoDirect/AFEDIM/Oqoro sélectionné
   - Layout : 5 champs → 6 champs sur la même ligne (grâce au CSS)
   
2. **Formulaire édition** (`InterventionEditForm.tsx`) :
   - Même comportement que le formulaire création
   - Affiche la valeur existante si présente
   
3. **Vue étendue** (clic sur ligne dans `TableView.tsx`) :
   - Section "Référence agence" ajoutée dans Colonne 2 (au-dessus d'Adresse)
   - Visible uniquement pour les 3 agences concernées
   - Affiche la valeur ou "—" si vide

**Corrections techniques** :
- CSS Grid responsive pour 3 modes de modal (halfpage, centerpage, fullpage)
- z-index des dropdowns augmenté à 10000 pour passer au-dessus du modal fullpage

**Tests effectués** :
- ✅ Migration appliquée sans erreur
- ✅ Table `agency_config` peuplée avec 3 agences
- ✅ Champ visible dans les 3 endroits de l'UI
- ✅ Dropdowns fonctionnels en mode fullpage
- ✅ Layout 6 colonnes correct dans tous les modes

**Liens utiles** :
- Migration : `supabase/migrations/20251106143000_add_reference_agence.sql`
- Règle métier : `BUSINESS_RULES_2025-11-04.md` → BR-AGN-001
- Workflow : `WORKFLOW_REGLES_METIER.md` → Workflow 6

**Notes** :
- Correction importante : Le nom exact est **"Oqoro"** et non "Locoro"
- Règle clarifiée : Le champ doit être **visible** (obligation d'affichage) mais peut rester **vide/null** (pas de validation bloquante)
- Fix bonus : Problème de z-index résolu pour tous les popovers/dropdowns en mode fullpage

**Bloquants rencontrés** : 
- ❌ Conflit de version de migration (résolu par renommage avec timestamp complet)
- ❌ Nom d'agence incorrect "Locoro" → "Oqoro" (corrigé)

---

#### 2. INT-001 : Champs obligatoires à la création
**Statut** : ✅ **TERMINÉ**  
**Priorité** : P1  
**Durée estimée** : 0.5j  
**Durée réelle** : 0.5j  
**Complexité** : 🟢 Faible  
**Date de fin** : 6 novembre 2025

**Description** :
- Validation des 5 champs obligatoires : Adresse, Contexte, Métier, Statut, Agence
- Documentation en BDD (COMMENT ON COLUMN)
- Validation frontend avec messages d'erreur clairs

**Checklist** :
- [x] Migration BDD : Documentation des champs obligatoires (COMMENT ON COLUMN)
- [x] Validation frontend dans LegacyInterventionForm
- [x] Labels avec astérisque (*) pour les 5 champs
- [x] Messages d'erreur clairs en français

**Règle métier associée** : BR-INT-001

**Fichiers modifiés** :
- ✅ `supabase/migrations/20251106160000_document_required_fields.sql` (créé)
- ✅ `src/components/interventions/LegacyInterventionForm.tsx` (lignes 295-319, 429, 482)

**Validation implémentée** :
```typescript
// Frontend - LegacyInterventionForm.tsx (lignes 295-319)
const errors: string[] = []

if (!formData.adresse?.trim()) errors.push('Adresse est obligatoire')
if (!formData.contexteIntervention?.trim()) errors.push('Contexte est obligatoire')
if (!formData.metier_id) errors.push('Métier est obligatoire')
if (!formData.statut_id) errors.push('Statut est obligatoire')
if (!formData.agence_id) errors.push('Agence est obligatoire')

if (errors.length > 0) {
  alert('Champs obligatoires manquants :\n\n' + errors.join('\n'))
  return // Bloque la soumission
}
```

**Labels UI mis à jour** :
- "Statut *" (déjà présent)
- "Agence *" (ajouté)
- "Type (Métier) *" (ajouté)
- "Contexte d'intervention *" (déjà présent)
- "Adresse *" (déjà présent)

**Tests effectués** :
- ✅ Tentative création sans adresse → Erreur affichée
- ✅ Tentative création sans contexte → Erreur affichée
- ✅ Tentative création sans métier → Erreur affichée
- ✅ Tentative création sans statut → Erreur affichée
- ✅ Tentative création sans agence → Erreur affichée
- ✅ Création avec tous les champs → Succès

**Notes** :
- Contraintes NOT NULL non ajoutées en BDD pour préserver la compatibilité avec les données existantes
- Validation au niveau applicatif (frontend uniquement pour la création)
- Migration de documentation pour tracer les champs obligatoires

**Bloquants rencontrés** : Aucun

---

#### 3. INT-003 : Droits d'édition du champ Contexte
**Statut** : ✅ **TERMINÉ**  
**Priorité** : P1  
**Durée estimée** : 0.5j  
**Durée réelle** : 0.5j  
**Complexité** : 🟢 Faible  
**Date de fin** : 7 novembre 2025

**Description** :
- Contexte modifiable uniquement à la création
- Lecture seule après création (sauf pour les admins)
- Gestion des permissions

**Checklist** :
- [x] API `/api/auth/me` enrichie avec la liste des rôles utilisateur
- [x] Vérification backend des rôles lors des PATCH `/api/interventions/:id`
- [x] Champ Contexte en lecture seule côté édition (`InterventionEditForm.tsx`) pour les non-admins
- [x] Formulaire générique (`InterventionForm.tsx` + `useInterventionForm.ts`) respectant la même restriction
- [x] Garantis côté SDK (`interventionsApi.update`) pour bloquer toute mise à jour non autorisée
- [x] Documentation sprint mise à jour

**Règle métier associée** : BR-INT-002

**Fichiers impactés** :
- `app/api/auth/me/route.ts`
- `app/api/interventions/[id]/route.ts`
- `src/components/interventions/InterventionEditForm.tsx`
- `src/components/interventions/InterventionForm.tsx`
- `src/hooks/useInterventionForm.ts`
- `src/lib/api/v2/interventionsApi.ts`

**Tests / Vérifications** :
- ✅ Vérification manuelle : édition d'une intervention en tant que non-admin → champ grisé + blocage API
- ✅ Vérification manuelle : édition en tant qu'admin → champ éditable
- ⚠️ `npm run lint` en échec (configuration ESLint manquante) – à traiter séparément

---

#### 4. DEVI-001 : ID devis pré-requis pour "Devis envoyé"
**Statut** : ✅ **TERMINÉ**  
**Priorité** : P1  
**Durée estimée** : 1-2j  
**Durée réelle** : 1j  
**Complexité** : 🟡 Moyenne  
**Date de fin** : 7 novembre 2025

**Description** :
- **Règle simple** : L'ID du devis doit être renseigné avant le passage au statut « Devis envoyé »
- **Pas de clic droit** : On n'implémente pas de menu contextuel ici
- **Pas d'automatisation** : La saisie de l'ID ne déclenche pas automatiquement le changement de statut
- **Deux points d'entrée** :
  1. `NewInterventionModalContent` (création) : Si statut = "Devis envoyé" → `id_devis` obligatoire
  2. `InterventionModalContent` (édition) : Si changement vers "Devis envoyé" → `id_devis` obligatoire

**Checklist** :
- [x] Migration BDD : Pas nécessaire, `id_inter` existe déjà ✅
- [x] Mapping API : Déjà fait ✅
- [x] Rendre `disabled` conditionnel (éditable uniquement si "Devis envoyé") ✅
- [x] Ajouter validation conditionnelle (required si statut = "Devis envoyé") ✅
- [x] Ajouter astérisque conditionnel au Label ✅
- [x] Pattern regex pour bloquer ID provisoires (`auto-XXX`) ✅
- [x] Validation au submit (HTML5 native + vérification `auto-`) ✅
- [x] Tests manuels : création avec statut "Devis envoyé" sans ID → **bloqué** ✅
- [x] Tests manuels : édition vers "Devis envoyé" avec ID provisoire → **bloqué** ✅
- [x] Tests manuels : édition vers "Devis envoyé" avec ID vide → **bloqué** ✅
- [x] Documentation mise à jour ✅

**Règle métier associée** : BR-DEVI-001

**Fichiers impactés** :
- ✅ Migration BDD : Pas nécessaire, `id_inter` existe déjà
- `src/components/interventions/LegacyInterventionForm.tsx` (retirer `disabled`, ajouter validation)
- `src/components/interventions/InterventionEditForm.tsx` (rendre éditable, ajouter validation)
- ✅ `src/lib/supabase-api-v2.ts` : Déjà mappé (ligne 391)
- ✅ `supabase/functions/interventions-v2/index.ts` : Déjà dans les colonnes

**Prompt pour Codex** : `docs/livrable-2025-11-04/PROMPT_DEVI-001.md`

**Implémentation réalisée** :

1. **`LegacyInterventionForm.tsx` (création)** :
   - Champ `disabled` par défaut, devient éditable si statut = "Devis envoyé"
   - Validation HTML5 : `required` + `pattern="^(?!auto-).*"` (bloque `auto-XXX`)
   - Validation submit : Vérifie ID vide ou provisoire

2. **`InterventionEditForm.tsx` (édition)** :
   - Champ éditable avec validation conditionnelle
   - Même pattern regex pour bloquer ID provisoires
   - Validation submit : Vérifie ID vide ou provisoire

**Logique des ID** :
- **ID provisoire** : `auto-123` (auto-généré)
- **ID définitif** : Saisi par le gestionnaire (ex: `DEV-2024-001`)
- **Règle** : "Devis envoyé" bloqué si ID vide OU ID provisoire

**Résultat** :
- ✅ Création : Champ grisé par défaut, éditable uniquement si "Devis envoyé"
- ✅ Édition : Champ éditable, bloque changement vers "Devis envoyé" si ID provisoire
- ✅ Messages d'erreur clairs via validation HTML5

**Bloquants rencontrés** : Aucun

---

#### 5. ARC-001 : Commentaire obligatoire à l'archivage / fin d'intervention
**Statut** : ✅ Terminé (07/11/2025)  
**Priorité** : P2  
**Durée estimée** : 0.5j (après COM-001)  
**Complexité** : 🟢 Faible

**Description** :
- Lorsqu'on passe une intervention ou un artisan à `Archivée` ou `Terminée`, on bloque la sauvegarde tant qu'un commentaire obligatoire n'est pas saisi.
- La pop-up (`StatusReasonModal`) affiche un textarea contextuel (`motif d'archivage` ou `comment s'est déroulée l'intervention ?`).
- À la validation, le module `commentsApi` est appelé avec la métadonnée `reason_type` (`archive` | `done`) et la section commentaires se rafraîchit immédiatement avec un badge dédié.

**Checklist** :
- [x] Détecter les transitions de statut vers `Archivée` / `Terminée` (artisans & interventions).
- [x] Pop-up légère (`StatusReasonModal`) avec textarea obligatoire et libellé contextuel.
- [x] Appel `commentsApi.create` avec payload enrichi (`reason_type = archive|done`).
- [x] Affichage du badge dans `CommentSection` (labels + style).
- [x] Tests manuels (archiver, terminer, annuler, recharger la page).
- [x] Documentation (README + BR-ARC-001 si ajustement procédé).

**Règle métier associée** : BR-ARC-001

**Fichiers impactés** :
- `src/components/interventions/InterventionEditForm.tsx`
- `src/components/ui/artisan-modal/ArtisanModalContent.tsx`
- `src/components/shared/CommentSection.tsx`
- `src/components/shared/StatusReasonModal.tsx` (nouveau)
- `src/lib/api/v2/commentsApi.ts`
- `src/lib/comments/statusReason.ts` (nouveau helper)
- `supabase/functions/comments/index.ts` (si ajout champ type/badge)
- `supabase/migrations/20251107120000_add_comments_reason_type.sql`

**Bloquants** : Aucun (COM-001 terminé)

**Sous-tâches** :
- **COM-001** : Gestion complète des commentaires (1.5-2j) ✅

**Tests effectués** :
- ✅ Intervention → Terminé : modal affichée, commentaire enregistré avec badge `terminé`, persistance après rechargement.
- ✅ Intervention → Archivée : motif requis, annulation ferme la modal et n'impacte pas la fiche.
- ✅ Artisan → Archivé : blocage tant que le motif n'est pas rempli, commentaire visible côté artisan.
- ✅ Artisan → autre champ sans changement de statut : pas de modal.
- ✅ Rechargement page : badge toujours affiché dans `CommentSection`.

---

#### 5.1. COM-001 : Gestion complète des commentaires
**Statut** : ✅ Terminé (07/11/2025)  
**Priorité** : P1 (pré-requis pour ARC-001)  
**Durée estimée** : 1.5-2j  
**Complexité** : 🟡 Moyenne  
**Type** : Sous-tâche de ARC-001

**Description** :
La fonctionnalité d'archivage nécessite un système de commentaires fonctionnel.
- Table `comments` existe en BDD ✅
- Edge Function existe ✅
- **Mais UI non fonctionnelle** dans artisans et interventions ❌

**Objectif** :
Implémenter la gestion complète des commentaires dans :
1. Fiche Artisan (`ArtisanModalContent.tsx`)
2. Fiche Intervention (`InterventionEditForm.tsx`)

**Checklist** :
- [x] Vérifier/améliorer Edge Function `/comments`
- [x] Créer composant réutilisable `CommentSection.tsx`
- [x] Améliorer `commentsApi` (GET, POST, DELETE)
- [x] Intégrer dans fiche artisan (remplacer ancien code `suivi_relances_docs`)
- [x] Intégrer dans fiche intervention (nouvelle section collapsible)
- [x] Afficher historique avec auteur + date + heure
- [x] Formulaire d'ajout avec validation
- [x] Rafraîchissement automatique (React Query)
- [x] Tests manuels (ajout, affichage, persistence)
- [x] Documentation

**Règle métier associée** : Pré-requis pour BR-ARC-001

**Fichiers impactés** :
- `src/components/shared/CommentSection.tsx` (nouveau)
- `src/lib/api/v2/commentsApi.ts` (améliorer)
- `src/components/ui/artisan-modal/ArtisanModalContent.tsx` (lignes 692-727)
- `src/components/interventions/InterventionEditForm.tsx` (ajouter section)
- `supabase/functions/comments/index.ts` (vérifier JOIN users)

**Prompt pour Codex** : `docs/livrable-2025-11-04/PROMPT_COM-001.md`

**Implémentation** :
1. **Backend** : Edge Function `/comments` enrichie (JOIN `profiles`, tri anté-chronologique, nettoyage des champs inutiles)
2. **Composant** : `CommentSection` mutualisé avec affichage auteur/horodatage, formulaire contrôlé et upload en file d’attente
3. **Artisans** : Remplacement complet de `suivi_relances_docs` par la nouvelle section + migration des anciens commentaires
4. **Interventions** : Nouvelle section « Commentaires » (collapsible) intégrée dans `InterventionEditForm`
5. **Tests** : Campagne manuelle (ajout/suppression/rafraîchissement) sur artisans et interventions

**Résultats** :
- Commentaires synchronisés en temps réel avec notifications visuelles
- Historique cohérent entre artisan et intervention
- Base prête pour le commentaire automatique d’archivage (ARC-001)

**Bloquants** : Aucun

---

### 📊 Progression Sprint 1

```
Total : 6 tâches (5 principales + 1 sous-tâche)
├── ⏸️ À démarrer : 0 (0%)
├── 🟡 En cours : 0 (0%)
├── ✅ Terminées : 6 (100%)  ← AGN-001 ✅ INT-001 ✅ INT-003 ✅ DEVI-001 ✅ COM-001 ✅ ARC-001 ✅
└── 🔴 Bloquées : 0 (0%)
```

**Temps consommé** : 6j / 9j (67%)  
**Temps restant** : 3j

**Progression** : 🟩🟩🟩🟩🟩🟩🟩🟩🟩 100% ✅

---

## 📊 Sprint 2 : Fonctionnalités métier (Semaines 3-4)

**Objectif** : Logement vacant, workflow acomptes, duplication  
**Durée** : 16.5 jours  
**Dates** : 15/11/2025 - 06/12/2025  
**Statut** : ⏸️ À venir

### Tâches

#### 6. INT-002 : Logement vacant avec champs conditionnels
**Statut** : ⏸️ À démarrer  
**Priorité** : P1  
**Durée estimée** : 3-4j  
**Complexité** : 🔴 Haute

**Checklist** :
- [ ] Migration BDD : 4 nouveaux champs
- [ ] Logique conditionnelle UI
- [ ] Tests unitaires
- [ ] Documentation

**Règle métier associée** : BR-INT-003

---

#### 7. ACPT-001 : Workflow acomptes complet
**Statut** : ⏸️ À démarrer  
**Priorité** : P1  
**Durée estimée** : 4-5j  
**Complexité** : 🔴 Haute

**Checklist** :
- [ ] Migration BDD : 3 champs + 2 statuts
- [ ] Logique automatisation backend
- [ ] Tests unitaires
- [ ] Documentation

**Règles métier associées** : BR-ACPT-001, BR-ACPT-002, BR-ACPT-003

---

#### 8. ART-002 : Règle Incomplet → Novice → À compléter
**Statut** : ⏸️ À démarrer  
**Priorité** : P2  
**Durée estimée** : 1-2j  
**Complexité** : 🟡 Moyenne

**Checklist** :
- [ ] Trigger PostgreSQL ou logique applicative
- [ ] Tests unitaires
- [ ] Documentation

**Règle métier associée** : BR-ART-001

---

#### 9. DUP-001 : Duplication "Devis supp"
**Statut** : ⏸️ À démarrer  
**Priorité** : P2  
**Durée estimée** : 2-3j  
**Complexité** : 🟡 Moyenne

**Checklist** :
- [ ] API endpoint duplication
- [ ] Exclusion des champs (id, id_inter, contexte, consigne)
- [ ] Commentaire automatique
- [ ] Tests unitaires
- [ ] Documentation

**Règle métier associée** : BR-DUP-001

---

#### 10. UI-LV : UI Logement vacant
**Statut** : ⏸️ À démarrer  
**Priorité** : P1  
**Durée estimée** : 2j  
**Complexité** : 🟡 Moyenne

**Checklist** :
- [ ] Checkbox + logique conditionnelle
- [ ] Tests UI
- [ ] Documentation

---

#### 11. UI-DUP : UI Menu "Devis supp"
**Statut** : ⏸️ À démarrer  
**Priorité** : P1  
**Durée estimée** : 0.5j  
**Complexité** : 🟢 Faible

**Checklist** :
- [ ] Option menu contextuel
- [ ] Tests
- [ ] Documentation

---

### 📊 Progression Sprint 2

```
Total : 6 tâches
└── ⏸️ À venir
```

---

## 📊 Sprint 3 : Automatisations (Semaine 5)

**Objectif** : Job cron due_date, validation IBAN  
**Durée** : 4.5 jours  
**Dates** : 09/12/2025 - 13/12/2025  
**Statut** : ✅ Terminé (2/2 tâches)

### ⚠️ BLOQUANT

**ART-001 : Validation IBAN à clarifier avec le client**

**Question** : Comment l'admin est-il informé qu'un IBAN a été ajouté ?
- Option A : 📧 Notification email
- Option B : 🔔 Notification in-app
- Option C : 📋 File d'attente avec badge

**Action requise** : Clarifier AVANT de démarrer ce sprint

### Tâches

#### 12. DAT-001 : Due date → Check automatique
**Statut** : ✅ **TERMINÉ** (tâche annexe réalisée avant Sprint 2)  
**Priorité** : P1  
**Durée estimée** : 3-4j  
**Durée réelle** : 0.5j (implémentation simplifiée sans job cron)  
**Complexité** : 🟢 Faible (approche simplifiée)  
**Date de fin** : 7 novembre 2025

**Description** :
- Affichage visuel "CHECK" rouge avec animation clignotante pour les interventions en VT/EC avec date prévue <= aujourd'hui
- Pas de changement de statut en BDD (affichage uniquement)
- Validation date_prevue obligatoire pour VT/EC déjà en place

**Checklist** :
- [x] Fonction utilitaire `isCheckStatus` créée
- [x] Animation CSS `check-pulse` ajoutée
- [x] Badge "CHECK" remplace le texte du statut dans TableView
- [x] Badge "CHECK" remplace le texte du statut dans InterventionCard
- [x] Validation date_prevue obligatoire vérifiée (déjà en place)
- [x] Tests visuels effectués

**Règles métier associées** : BR-STAT-001 (adaptée : affichage visuel uniquement)

**Fichiers modifiés** :
- ✅ `src/lib/interventions/checkStatus.ts` (nouveau)
- ✅ `app/globals.css` (animation CSS ajoutée)
- ✅ `src/components/interventions/views/TableView.tsx` (badge Check ajouté)
- ✅ `src/features/interventions/components/InterventionCard.tsx` (badge Check ajouté)

**Implémentation** :
- Détection automatique si `date_prevue <= aujourd'hui` ET statut = VT/EC
- Badge rouge "CHECK" avec animation clignotante remplace le statut original
- Pas de job cron nécessaire : vérification côté frontend à chaque affichage

**Notes** :
- Approche simplifiée : pas de changement de statut en BDD, uniquement affichage visuel
- Le statut original reste en BDD, seul l'affichage change
- Animation respecte `prefers-reduced-motion`

---

#### 13. UI-DD : UI Due date VT/EC
**Statut** : ✅ **TERMINÉ**  
**Priorité** : P1  
**Durée estimée** : 0.5j  
**Durée réelle** : 0.5j (déjà implémenté)  
**Complexité** : 🟢 Faible  
**Date de fin** : 7 novembre 2025

**Description** :
- Validation conditionnelle de `date_prevue` obligatoire pour les statuts "Visite technique" et "Intervention en cours"
- Champ marqué `required` avec astérisque (*) et validation au submit
- Message d'erreur : "Date prévue obligatoire pour ce statut"

**Checklist** :
- [x] Validation conditionnelle ✅
- [x] Tests ✅
- [x] Documentation ✅

**Fichiers modifiés** :
- ✅ `src/components/interventions/LegacyInterventionForm.tsx` (lignes 458-472, 887-897)
- ✅ `src/components/interventions/InterventionEditForm.tsx` (lignes 352-366, 1102-1111)

**Implémentation** :
- Variable `requiresDatePrevue` vérifie si le statut est "Visite technique" ou "Intervention en cours"
- Validation HTML5 native avec `required` et `title` pour message d'erreur
- Validation au submit bloquante si date manquante

**Notes** :
- Implémentation déjà présente dans le code, vérifiée et confirmée complète

---

## 📊 Sprint 4 : UI/UX (Semaines 6-7)

**Objectif** : Menus contextuels, notifications, templates  
**Durée** : 10 jours  
**Dates** : 16/12/2025 - 30/12/2025  
**Statut** : ⏸️ À venir

### Tâches (8 tâches)

- UI-001 : Menus contextuels (3-4j)
- MSG-001 : Prévisualisation messages (1j)
- TPL-001 : Templates emails/SMS (1j)
- NOT-001 : Pop-ups info (1j)
- ARC-002 : Pastille indisponible (1j)
- MAP-001 : Mapping Budget=SST (0.5j)
- UI-AGN : UI Référence agence (1j) ✅ **TERMINÉ**
- UI-DEV : UI Devis envoyé (0.5j) ✅ **TERMINÉ**

#### 20. UI-AGN : UI Référence agence
**Statut** : ✅ **TERMINÉ**  
**Priorité** : P1  
**Durée estimée** : 1j  
**Durée réelle** : 1j (déjà implémenté)  
**Complexité** : 🟡 Moyenne  
**Date de fin** : 6 novembre 2025

**Description** :
- Champ `reference_agence` présent dans les formulaires de création et édition
- Affichage conditionnel pour ImoDirect, AFEDIM, Oqoro
- Affiché aussi dans TableView (vue étendue)
- Sauvegarde fonctionnelle

**Checklist** :
- [x] Champ dans formulaire création ✅
- [x] Champ dans formulaire édition ✅
- [x] Affichage conditionnel selon agence ✅
- [x] Affichage dans vue étendue ✅
- [x] Sauvegarde fonctionnelle ✅

**Fichiers modifiés** :
- ✅ `src/components/interventions/LegacyInterventionForm.tsx` (lignes 84, 369, 375, 612-627)
- ✅ `src/components/interventions/InterventionEditForm.tsx` (lignes 119, 549, 555, 801-816)
- ✅ `src/components/interventions/views/TableView.tsx` (ligne 1490)

**Notes** :
- Implémentation déjà présente dans le code, vérifiée et confirmée complète
- Fait partie de AGN-001 (Sprint 1)

---

#### 21. UI-DEV : UI Devis envoyé
**Statut** : ✅ **TERMINÉ**  
**Priorité** : P1  
**Durée estimée** : 0.5j  
**Durée réelle** : 0.5j (déjà implémenté)  
**Complexité** : 🟢 Faible  
**Date de fin** : 7 novembre 2025

**Description** :
- Validation pour "Devis envoyé" avec `requiresDefinitiveId`
- Bloque les ID provisoires (`auto-XXX`)
- Pattern regex : `^(?!.*(?:[Aa][Uu][Tt][Oo])).+$`
- Champ `required` avec message d'erreur clair
- Validation au submit dans les deux formulaires

**Checklist** :
- [x] Validation conditionnelle ✅
- [x] Blocage ID provisoires ✅
- [x] Pattern regex ✅
- [x] Message d'erreur clair ✅
- [x] Tests ✅

**Fichiers modifiés** :
- ✅ `src/components/interventions/LegacyInterventionForm.tsx` (lignes 34, 349-358, 499-509, 568-579)
- ✅ `src/components/interventions/InterventionEditForm.tsx` (lignes 45, 328-346, 671, 770-780)

**Implémentation** :
- Variable `requiresDefinitiveId` vérifie si le statut nécessite un ID définitif
- Validation HTML5 avec pattern regex pour bloquer "auto-XXX"
- Validation au submit bloquante si ID provisoire ou vide

**Notes** :
- Implémentation déjà présente dans le code, vérifiée et confirmée complète
- Fait partie de DEVI-001 (Sprint 1)

---

## 📊 Sprint 5 : Tests & QA (Semaine 8)

**Objectif** : Tests complets et corrections  
**Durée** : 5 jours  
**Dates** : 02/01/2026 - 08/01/2026  
**Statut** : ⏸️ À venir

### Activités

- [ ] Tests unitaires complémentaires (1j)
- [ ] Tests E2E - 5 scénarios critiques (2j)
- [ ] Tests d'intégration (1j)
- [ ] Corrections de bugs (1j)

#### AUT-001 : Auth robuste pour les commentaires
**Statut** : ⏸️ À démarrer  
**Priorité** : P0 (bloquant traçabilité)  
**Durée estimée** : 0.5j  
**Complexité** : 🟡 Moyenne

**Problème constaté** :
- L’UI déclenche `useEffect` asynchrone pour charger `/api/auth/me` → `currentUserId` reste `null` pendant plusieurs centaines de ms.
- Pendant cette fenêtre (ou en cas d’erreur réseau/session), l’utilisateur peut soumettre le formulaire → `comments.author_id` = `NULL`.
- La traçabilité est alors perdue (viol BR-AUD-001) et les commentaires semblent anonymes.

**Solutions à mettre en œuvre** :
- Mutualiser l’obtention du user via un hook `useCurrentUser()` (cache + état `isReady`).
- Bloquer toute soumission tant que `isReady === false` ou `user === null` (désactiver bouton + message explicite).
- Ajouter un garde backend : refuser `author_id` vide côté Edge Function (`400 Bad Request`).
- Ajouter un monitoring/log quand `author_id` est `NULL` pour détecter les régressions.

**Checklist** :
- [ ] Créer hook `useCurrentUser` (React Query + cache) exposant `{ user, isReady, error }`
- [ ] Remplacer les `useEffect` individuels dans `CommentSection`, `TableView`, `ArtisanModalContent`, `InterventionEditForm`
- [ ] Forcer `CommentSection` à désactiver le bouton + afficher un message tant que l’utilisateur n’est pas chargé
- [ ] Edge Function `/comments` : retourner 400 si `author_id` absent ou invalide
- [ ] Ajout logs/alerting (console Supabase) lorsque `author_id` est `NULL`
- [ ] Tests manuels : commenter en conditions réseau lentes / session expirée → aucun commentaire sans auteur

---

## 📈 Métriques globales

### Progression totale
```
Total : 22 tâches (21 principales + 1 sous-tâche)
├── ⏸️ À démarrer : 12 (55%)
├── 🟡 En cours : 0 (0%)
├── ✅ Terminées : 10 (45%)  ← AGN-001 ✅ INT-001 ✅ INT-003 ✅ DEVI-001 ✅ COM-001 ✅ ARC-001 ✅ DAT-001 ✅ UI-DD ✅ UI-AGN ✅ UI-DEV ✅
└── 🔴 Bloquées : 0 (0%)
```

**Progression globale** : 🟩🟩🟩🟩🟩🟩🟩🟩🟩🟩⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜⬜ 45%

### Par complexité
```
🔴 Haute : 3 tâches (0 terminées)
🟡 Moyenne : 10 tâches (5 terminées ✅✅✅✅✅)
🟢 Faible : 9 tâches (5 terminées ✅✅✅✅✅)
```

### Temps
```
Temps total estimé : 43 jours
Temps consommé : 8.5 jours (20%)
Temps restant : 34.5 jours
```

---

## 📝 Notes et décisions

### 07/11/2025 - Soirée (18h00)
- ✅ **DAT-001 TERMINÉ** : Due date → Check automatique (tâche annexe réalisée avant Sprint 2)
- ✅ Approche simplifiée : affichage visuel uniquement (pas de job cron)
- ✅ Badge "CHECK" rouge avec animation clignotante remplace le statut
- ✅ Détection automatique si `date_prevue <= aujourd'hui` ET statut = VT/EC
- ✅ Validation date_prevue obligatoire déjà en place
- 🎯 **Prochaine étape** : Démarrer Sprint 2 (Fonctionnalités métier)

### 07/11/2025 - Fin de journée
- ✅ **ARC-001 TERMINÉ** : Commentaire obligatoire à l'archivage/fin d'intervention
- ✅ `StatusReasonModal` implémenté et intégré dans artisans & interventions
- ✅ Migration BDD `reason_type` appliquée
- ✅ Badges "archivage" et "terminé" affichés dans `CommentSection`
- ✅ **SPRINT 1 COMPLÉTÉ** : 6/6 tâches terminées (100%)
- 🎯 **Prochaine étape** : Démarrer Sprint 2 (Fonctionnalités métier)

### 07/11/2025 - Après-midi (15h00)
- ✅ **COM-001 TERMINÉ** : Gestion complète des commentaires artisans & interventions
- ✅ `CommentSection` mutualisé + Edge Function `/comments` enrichie
- ✅ Synchronisation temps réel + refresh auto après création/suppression
- ✅ Documentation + tests manuels croisés
- 🎯 **Next** : Déclencher ARC-001 (ajout commentaire système + champs BDD)

### 07/11/2025 - Après-midi (15h30)
- 🔄 **ARC-001 RECADRÉ** : utilisation directe du module commentaires pour archiver / terminer
- 🎯 Pop-up légère avec saisie obligatoire (`motif` / `retour d'intervention`)
- 🚫 Plus de champs `archived_*` dédiés : on tag le commentaire (`archive` / `done`)
- 🗂️ Ajouter un badge dans `CommentSection` pour identifier ces commentaires

### 07/11/2025 - Matin (11h00)
- ✅ **DEVI-001 TERMINÉ** : ID devis pré-requis pour "Devis envoyé"
- ✅ Logique ID provisoire (`auto-XXX`) vs ID définitif implémentée
- ✅ Création : Champ éditable uniquement si statut = "Devis envoyé"
- ✅ Édition : Bloque changement vers "Devis envoyé" si ID provisoire/vide
- ✅ Validation HTML5 + pattern regex `^(?!auto-).*`
- 🎯 **Prochaine tâche** : ARC-001 (Commentaire archivage - 0.5j)

### 06/11/2025 - Soirée (18h00)
- ✅ **INT-003 TERMINÉ** par Codex : Contexte éditable uniquement à la création
- ✅ Double garde (backend + frontend) sur rôle Admin
- ✅ API `/api/auth/me` enrichie avec les rôles
- ✅ Formulaires harmonisés (lecture seule + message utilisateur)
- ⚠️ `npm run lint` à corriger (config manquante)

### 06/11/2025 - Fin d'après-midi (17h00)
- ✅ **INT-001 TERMINÉ** : Validation des 5 champs obligatoires à la création
- ✅ Migration de documentation (COMMENT ON COLUMN)
- ✅ Validation frontend avec messages d'erreur clairs
- ✅ Labels UI mis à jour avec astérisques

### 06/11/2025 - Après-midi (14h-16h)
- ✅ **AGN-001 TERMINÉ** : Référence agence implémentée (BDD + Types + UI complète)
- ✅ Correction importante : Nom d'agence "Oqoro" (et non "Locoro")
- ✅ Règle clarifiée : Champ visible mais non-requis (pas de validation bloquante)
- ✅ Fix bonus : z-index de tous les dropdowns/popovers (10000) pour modal fullpage
- ✅ CSS Grid 6 colonnes pour tous les modes (halfpage, centerpage, fullpage)

### 06/11/2025 - Après-midi (18h00)
- ✅ **COM-001 créée** : Sous-tâche pré-requise pour ARC-001
- ✅ Diagnostic ARC-001 : Système de commentaires UI non fonctionnel
- ✅ Documentation complète COM-001 (`PROMPT_COM-001.md`)
- ✅ Sprint 1 étendu de 7j à 9j (+2j pour COM-001)
- ✅ ARC-001 réduit de 2j à 0.5j (après COM-001)
- 🎯 **Décision** : Construire fondations (COM-001) avant archivage (ARC-001)
- 📝 Session documentée : `SESSION_06_NOV_2025.md`

### 06/11/2025 - Matin
- ✅ Documentation complète créée et organisée
- ✅ Sprint Tracker créé
- ✅ Sprint 1 démarré avec AGN-001
- ⚠️ ART-001 à clarifier avec le client (Sprint 3)

---

## 🔗 Liens utiles

- [README principal](README.md)
- [Résumé exécutif](RESUME_EXECUTIF_LIVRABLE_2025-11-04.md)
- [Règles métier](BUSINESS_RULES_2025-11-04.md)
- [Workflows](WORKFLOW_REGLES_METIER.md)
- [Tableau récapitulatif](TABLEAU_RECAPITULATIF_LIVRABLE.md)

---

**Dernière mise à jour** : 7 novembre 2025 (mise à jour : UI-DD, UI-AGN, UI-DEV terminés)  
**Maintenu par** : Équipe Dev GMBS CRM
