# 📋 Résumé Exécutif - Livrable Interventions & Artisans

**Date** : 5 novembre 2025  
**Version** : 1.0  
**Pour** : Équipe GMBS

---

## 🎯 Vue d'ensemble en 30 secondes

✅ **21 tâches identifiées** dont :
- 🔴 **10 modifications BDD complexes** (15-20 jours)
- 🟢 **11 implémentations simples** (10-12 jours)
- ⚠️ **3 points à clarifier** avec le client

✅ **18 règles métier documentées** dans `BUSINESS_RULES_2025-11-04.md`

📅 **Durée totale estimée** : **7-8 semaines** (33-41 jours)

---

## 🚨 Actions immédiates requises

### 1. Clarifier avec le client (BLOQUANT)

#### ART-001 : Système de validation IBAN
**Question** : Comment l'admin est-il informé qu'un IBAN a été ajouté ?
- Option A : Notification email
- Option B : Notification in-app
- Option C : File d'attente avec badge/compteur

**Impact** : Bloque l'implémentation complète de la gestion IBAN

---

### 2. Décisions techniques à prendre

#### Gestion des jobs automatiques (DAT-001)
- **Besoin** : Job cron pour vérifier les `due_date` quotidiennement
- **Options** :
  - A. Supabase Edge Function + Trigger quotidien
  - B. Extension `pg_cron` PostgreSQL
  - C. Job externe (cron système)

**Recommandation** : Option A (Edge Function Supabase) pour rester dans l'écosystème

---

## 📊 Classification détaillée

### 🔴 Phase 1 : Modifications BDD complexes (15-20 jours)

| ID | Tâche | Complexité | Durée | Priorité |
|----|-------|------------|-------|----------|
| **INT-002** | Logement vacant (4 nouveaux champs) | 🔴 Haute | 3-4j | P1 |
| **ACPT-001** | Gestion acomptes complète (workflow) | 🔴 Haute | 4-5j | P1 |
| **DAT-001** | Due date → Check automatique (job cron) | 🔴 Haute | 3-4j | P1 |
| **AGN-001** | Référence agence obligatoire | 🟡 Moyenne | 1-2j | P1 |
| **DEVI-001** | ID devis pré-requis | 🟡 Moyenne | 1-2j | P1 |
| **DUP-001** | Duplication "Devis supp" | 🟡 Moyenne | 2-3j | P2 |
| **ARC-001** | Commentaire archivage | 🟡 Moyenne | 2j | P2 |
| **ART-002** | Règle Incomplet → Novice | 🟡 Moyenne | 1-2j | P2 |
| **INT-003** | Droits édition Contexte | 🟢 Faible | 0.5j | P1 |
| **INT-001** | Champs obligatoires | 🟢 Faible | 0.5j | P1 |

**Total Phase 1** : 18-25 jours

---

### 🟢 Phase 2 : Implémentations simples (10-12 jours)

| ID | Tâche | Complexité | Durée | Priorité |
|----|-------|------------|-------|----------|
| **UI-001** | Menus contextuels (clic droit) | 🟡 Moyenne | 3-4j | P1 |
| **MSG-001** | Prévisualisation & copie messages | 🟢 Faible | 1j | P2 |
| **TPL-001** | Templates emails/SMS | 🟢 Faible | 1j | P2 |
| **NOT-001** | Pop-ups d'information (toasts) | 🟢 Faible | 1j | P2 |
| **ARC-002** | Pastille "Indisponible" | 🟢 Faible | 1j | P2 |
| **MAP-001** | Mapping Budget = SST | 🟢 Très faible | 0.5j | P3 |
| **UI logement vacant** | Checkbox + champs conditionnels | 🟡 Moyenne | 2j | P1 |
| **UI référence agence** | Validation conditionnelle | 🟡 Moyenne | 1j | P1 |
| **UI due date** | Validation VT/EC | 🟢 Faible | 0.5j | P1 |
| **UI devis envoyé** | Masquage conditionnel | 🟢 Faible | 0.5j | P1 |
| **UI devis supp** | Menu contextuel | 🟢 Faible | 0.5j | P1 |

**Total Phase 2** : 12-15 jours

---

## 📜 Top 10 des règles métier critiques

### 1. BR-DEVI-001 : Pas d'ID devis → Pas de "Devis envoyé"
```
🔒 BLOQUANT
Sans id_devis, impossible de passer au statut "Devis envoyé"
L'action est masquée dans le menu contextuel
```

### 2. BR-STAT-001 : Due date dépassée → "Check" automatique
```
⚙️ AUTOMATIQUE
Si due_date < NOW() ET statut IN (VT, EC) → Statut "Check"
Job quotidien requis
```

### 3. BR-ACPT-001-002-003 : Workflow acomptes complet
```
⚙️ AUTOMATIQUE + 🔒 BLOQUANT
1. Saisie montant → "Attente acompte"
2. Case cochée → Date obligatoire
3. Date saisie → "Accepté $"
```

### 4. BR-AGN-001 : Référence agence pour ImoDirect, AFEDIM, Locoro
```
🔒 BLOQUANT
Ces 3 agences requièrent obligatoirement une référence_agence
```

### 5. BR-INT-001 : Champs obligatoires (5 champs)
```
🔒 BLOQUANT
Adresse, Contexte, Métier, Statut, Agence = obligatoires
```

### 6. BR-INT-002 : Contexte modifiable uniquement à la création
```
🔒 BLOQUANT (sauf admin)
Après création, contexte en lecture seule
Seuls les admins peuvent le modifier
```

### 7. BR-STAT-003 : Due date obligatoire pour VT & EC
```
🔒 BLOQUANT
Statuts VT ou EC → due_date obligatoire
```

### 8. BR-ART-001 : Incomplet + Novice → À compléter
```
⚙️ AUTOMATIQUE
Changement de statut automatique détecté
```

### 9. BR-ARC-001 : Commentaire obligatoire à l'archivage
```
🔒 BLOQUANT
Pop-up modal avec motif obligatoire
```

### 10. BR-DUP-001 : Exclusions duplication "Devis supp"
```
⚙️ AUTOMATIQUE
Exclut : id, id_inter, contexte, consigne
Ajoute commentaire avec ancien ID
```

---

## 🗂️ Structure des modifications BDD

### Table `interventions` — 7 nouveaux champs
```sql
ALTER TABLE interventions ADD COLUMN logement_vacant BOOLEAN DEFAULT false;
ALTER TABLE interventions ADD COLUMN info_clef TEXT;
ALTER TABLE interventions ADD COLUMN etage TEXT;
ALTER TABLE interventions ADD COLUMN numero_appartement TEXT;
ALTER TABLE interventions ADD COLUMN reference_agence TEXT;
ALTER TABLE interventions ADD COLUMN id_devis TEXT;
ALTER TABLE interventions ADD COLUMN previous_statut_id UUID REFERENCES intervention_statuses(id);
ALTER TABLE interventions ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE interventions ADD COLUMN archived_by UUID REFERENCES users(id);
ALTER TABLE interventions ADD COLUMN archived_reason TEXT;
ALTER TABLE interventions ADD COLUMN duplicated_from UUID REFERENCES interventions(id);
```

### Table `intervention_payments` — 3 nouveaux champs
```sql
ALTER TABLE intervention_payments ADD COLUMN montant_acompte_reclame NUMERIC(12,2);
ALTER TABLE intervention_payments ADD COLUMN acompte_recu BOOLEAN DEFAULT false;
ALTER TABLE intervention_payments ADD COLUMN date_reception_acompte TIMESTAMPTZ;
```

### Table `artisans` — 7 nouveaux champs
```sql
ALTER TABLE artisans ADD COLUMN iban TEXT;
ALTER TABLE artisans ADD COLUMN iban_validated BOOLEAN DEFAULT false;
ALTER TABLE artisans ADD COLUMN iban_validated_at TIMESTAMPTZ;
ALTER TABLE artisans ADD COLUMN iban_validated_by UUID REFERENCES users(id);
ALTER TABLE artisans ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE artisans ADD COLUMN archived_by UUID REFERENCES users(id);
ALTER TABLE artisans ADD COLUMN archived_reason TEXT;
```

### Nouveaux statuts requis
```sql
INSERT INTO intervention_statuses (code, label, color) VALUES
  ('attente_acompte', 'Attente acompte', '#f59e0b'),
  ('accepte_acompte_recu', 'Accepté $', '#10b981');
```

**Total** : ~17 nouveaux champs + 2 nouveaux statuts

---

## 📅 Planning recommandé (8 semaines)

### Sprint 1 (Sem. 1-2) : Fondations BDD simples
- ✅ AGN-001, INT-001, INT-003, DEVI-001, ARC-001
- **Livrable** : Migrations BDD de base + validations simples

### Sprint 2 (Sem. 3-4) : Fonctionnalités métier complexes
- ✅ INT-002, ACPT-001, ART-002, DUP-001
- **Livrable** : Logement vacant + Workflow acomptes + Duplication

### Sprint 3 (Sem. 5) : Automatisations
- ✅ DAT-001 (job cron due_date)
- ✅ ART-001 (si cadré)
- **Livrable** : Job automatique + IBAN (si specs finales)

### Sprint 4 (Sem. 6-7) : UI/UX
- ✅ UI-001, NOT-001, MSG-001, TPL-001, ARC-002, MAP-001
- **Livrable** : Menus contextuels + Notifications + Templates

### Sprint 5 (Sem. 8) : Tests & QA
- ✅ Tests unitaires (18 règles)
- ✅ Tests E2E (scénarios critiques)
- ✅ Tests d'intégration
- **Livrable** : Application testée et validée

---

## 🎯 Métriques de succès

### Couverture des tests
- ✅ **18/18 règles métier** testées unitairement
- ✅ **10 scénarios E2E** critiques couverts
- ✅ **Couverture de code** > 80% sur les nouvelles fonctionnalités

### Performance
- ✅ Job `due_date` : Exécution < 5 secondes (même avec 10K interventions)
- ✅ Menus contextuels : Ouverture < 100ms
- ✅ Validation formulaires : < 50ms

### Qualité
- ✅ Zéro régression sur les fonctionnalités existantes
- ✅ Toutes les migrations réversibles (`DOWN` migrations)
- ✅ Documentation à jour (README + règles métier)

---

## 🚀 Quick Start pour les développeurs

### 1. Lire les documents
```bash
# Ordre de lecture recommandé
1. Ce fichier (RESUME_EXECUTIF_LIVRABLE_2025-11-04.md)
2. BUSINESS_RULES_2025-11-04.md (règles métier)
3. ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md (détails techniques)
4. livrable-specs-interventions-artisans_2025-11-04.html (source complète)
```

### 2. Créer une branche de travail
```bash
git checkout -b feature/livrable-interventions-artisans-2025-11-04
```

### 3. Créer les migrations BDD (Phase 1)
```bash
# Créer un fichier de migration par fonctionnalité
supabase migration new add_logement_vacant_fields
supabase migration new add_acompte_workflow
supabase migration new add_archiving_fields
# etc.
```

### 4. Implémenter les règles métier
```typescript
// Créer un fichier par domaine
/src/lib/business-rules/
  ├── interventions.ts
  ├── statuts.ts
  ├── devis.ts
  ├── artisans.ts
  ├── agences.ts
  └── archivage.ts
```

### 5. Tests unitaires
```typescript
// Un fichier de test par fichier de règles
/tests/unit/business-rules/
  ├── interventions.test.ts
  ├── statuts.test.ts
  ├── devis.test.ts
  ├── artisans.test.ts
  ├── agences.test.ts
  └── archivage.test.ts
```

---

## 🔗 Fichiers créés

| Fichier | Objectif |
|---------|----------|
| `RESUME_EXECUTIF_LIVRABLE_2025-11-04.md` | Ce document (vue d'ensemble rapide) |
| `BUSINESS_RULES_2025-11-04.md` | **18 règles métier** documentées + exemples de code |
| `ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md` | Classification détaillée des **21 tâches** + estimations |

---

## 💡 Recommandations

### ✅ Faire
1. **Commencer par les migrations BDD** (Phase 1) avant l'UI
2. **Tester chaque règle unitairement** avant l'intégration
3. **Créer un environnement de staging** avec données de test
4. **Documenter chaque migration** (UP et DOWN)
5. **Faire des backups BDD** avant chaque migration en prod

### ❌ Éviter
1. ❌ Modifier directement la BDD de production sans migration
2. ❌ Implémenter l'UI avant la logique métier backend
3. ❌ Sauter les tests unitaires "par manque de temps"
4. ❌ Merge sans code review d'un autre développeur
5. ❌ Déployer en production un vendredi après-midi 😅

---

## 📞 Questions fréquentes

### Q1 : Peut-on déployer progressivement ?
✅ **Oui**, mais par sprint complet (ne pas déployer une fonctionnalité à moitié).  
Recommandation : Déployer après chaque sprint validé.

### Q2 : Que faire si une règle métier est ambiguë ?
⚠️ **Ne pas deviner** → Clarifier avec le client immédiatement.  
Ajouter un commentaire `// TODO: À clarifier avec client` dans le code.

### Q3 : Comment gérer les données existantes ?
📦 Créer une **migration de données** séparée :
```sql
-- Exemple : Mettre un statut par défaut pour les interventions existantes
UPDATE interventions 
SET previous_statut_id = NULL 
WHERE previous_statut_id IS NULL;
```

### Q4 : Les tests sont-ils vraiment obligatoires ?
✅ **Oui** pour les règles métier critiques (🔴 Haute priorité).  
Optionnel mais recommandé pour les autres.

---

## 🏁 Prochaines étapes immédiates

1. ✅ **Valider ce résumé** avec l'équipe
2. ⚠️ **Clarifier ART-001** avec le client (BLOQUANT)
3. ✅ **Créer les tickets** dans l'outil de gestion de projet
4. ✅ **Assigner les tâches** selon les compétences
5. 🚀 **Commencer Sprint 1** (Fondations BDD)

---

**Document créé le** : 5 novembre 2025  
**Par** : Équipe Dev GMBS CRM  
**Version** : 1.0

🎉 **Bonne chance pour l'implémentation !**

