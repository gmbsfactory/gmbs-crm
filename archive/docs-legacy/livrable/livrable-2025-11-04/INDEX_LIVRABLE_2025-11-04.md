# 📚 Index de la Documentation - Livrable Interventions & Artisans

**Version** : 1.0  
**Date de création** : 5 novembre 2025  
**Dernière mise à jour** : 5 novembre 2025

---

## 🎯 Vue d'ensemble

Ce dossier contient l'analyse complète du livrable « Spécifications Interventions & Artisans » fourni par vos clients le 4 novembre 2025.

**4 documents créés** pour faciliter l'implémentation :
1. 📋 Résumé exécutif (vue rapide en 5 min)
2. 📜 Règles métier (18 règles documentées)
3. 📊 Classification des tâches (21 tâches analysées)
4. 🔄 Workflows & diagrammes (visualisation)

**Durée totale estimée** : 7-8 semaines (33-41 jours)

---

## 📁 Structure de la documentation

```
/docs/
├── INDEX_LIVRABLE_2025-11-04.md              ← Vous êtes ici !
├── RESUME_EXECUTIF_LIVRABLE_2025-11-04.md    ← Commencez par celui-ci
├── BUSINESS_RULES_2025-11-04.md              ← Règles métier détaillées
├── ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md  ← Détails techniques
└── WORKFLOW_REGLES_METIER.md                 ← Diagrammes visuels

/livrable-specs-interventions-artisans_2025-11-04.html  ← Source HTML originale
```

---

## 🚀 Guide de démarrage rapide

### Pour les Chefs de Projet / Product Owners
**Temps de lecture : 10 minutes**

1. 📋 [RESUME_EXECUTIF_LIVRABLE_2025-11-04.md](RESUME_EXECUTIF_LIVRABLE_2025-11-04.md)
   - Vue d'ensemble en 30 secondes
   - Actions immédiates requises
   - Planning suggéré (8 semaines)
   - Métriques de succès

2. 🔄 [WORKFLOW_REGLES_METIER.md](WORKFLOW_REGLES_METIER.md)
   - Diagrammes visuels des workflows
   - Scénarios de test critiques

### Pour les Développeurs Backend
**Temps de lecture : 30 minutes**

1. 📜 [BUSINESS_RULES_2025-11-04.md](BUSINESS_RULES_2025-11-04.md)
   - **18 règles métier** avec exemples de code
   - Conditions bloquantes et automatisations
   - Tests unitaires suggérés

2. 📊 [ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md](ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md)
   - Modifications BDD détaillées (schémas SQL)
   - Estimations de complexité
   - Risques identifiés

3. 🔄 [WORKFLOW_REGLES_METIER.md](WORKFLOW_REGLES_METIER.md)
   - Diagrammes des workflows
   - Logique des automatisations

### Pour les Développeurs Frontend
**Temps de lecture : 20 minutes**

1. 📋 [RESUME_EXECUTIF_LIVRABLE_2025-11-04.md](RESUME_EXECUTIF_LIVRABLE_2025-11-04.md)
   - Section "Phase 2 : Implémentations simples"
   - UI/UX à développer

2. 📜 [BUSINESS_RULES_2025-11-04.md](BUSINESS_RULES_2025-11-04.md)
   - Règles de validation frontend
   - Logique conditionnelle UI

3. 🔄 [WORKFLOW_REGLES_METIER.md](WORKFLOW_REGLES_METIER.md)
   - Workflows UI (champs conditionnels)

### Pour les QA / Testeurs
**Temps de lecture : 15 minutes**

1. 🔄 [WORKFLOW_REGLES_METIER.md](WORKFLOW_REGLES_METIER.md)
   - Section "Scénarios de test critiques"
   - 5 scénarios détaillés à tester

2. 📜 [BUSINESS_RULES_2025-11-04.md](BUSINESS_RULES_2025-11-04.md)
   - Matrice de tests (18 règles)
   - Tests unitaires suggérés

---

## 📋 Contenu détaillé des documents

### 1. RESUME_EXECUTIF_LIVRABLE_2025-11-04.md

**Objectif** : Comprendre rapidement le périmètre et l'organisation

**Contenu** :
- ✅ Vue d'ensemble en 30 secondes
- ⚠️ Actions immédiates requises (points bloquants)
- 📊 Classification des 21 tâches
- 🗂️ Structure des modifications BDD (17 nouveaux champs)
- 📜 Top 10 des règles métier critiques
- 📅 Planning suggéré (8 semaines / 5 sprints)
- 🎯 Métriques de succès
- 💡 Recommandations et FAQ

**Quand le lire ?** : En premier, pour avoir une vision globale

---

### 2. BUSINESS_RULES_2025-11-04.md

**Objectif** : Implémenter correctement les règles métier

**Contenu** :
- 📜 **18 règles métier** documentées avec identifiants uniques
- 🔒 Règles bloquantes (8)
- ⚙️ Règles automatiques (9)
- ℹ️ Règles informatives (1)
- 💻 Exemples de code TypeScript/SQL pour chaque règle
- 🧪 Tests unitaires suggérés
- 📊 Matrice de tests complète

**Structure** :
```
1. Règles : Interventions (3 règles)
2. Règles : Statuts des interventions (3 règles)
3. Règles : Devis & Acomptes (5 règles)
4. Règles : Artisans (2 règles)
5. Règles : Agences (1 règle)
6. Règles : Archivage (2 règles)
7. Règles : Permissions & Droits (1 règle)
8. Règles : Logement vacant (référence à BR-INT-003)
```

**Quand le lire ?** : Avant de coder une fonctionnalité, pour comprendre la logique métier

---

### 3. ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md

**Objectif** : Planifier et estimer le travail de développement

**Contenu** :
- 📊 Vue d'ensemble (tableau récapitulatif)
- ⚠️ **Phase 0** : Points à clarifier (3 items bloquants)
- 🔴 **Phase 1** : Modifications BDD complexes (10 tâches, 15-20 jours)
- 🟢 **Phase 2** : Implémentations simples (11 tâches, 10-12 jours)
- 📅 Planning recommandé (5 sprints)
- 🎯 Priorisation par sprint
- 🚨 Risques identifiés
- 📝 Notes techniques et outils recommandés

**Chaque tâche contient** :
- Référence (ex: INT-001, DEVI-001)
- Niveau de complexité (🔴 Haute, 🟡 Moyenne, 🟢 Faible)
- Impact (BDD, UI, Backend)
- Modifications SQL détaillées
- Composants impactés
- Estimation en jours

**Quand le lire ?** : Pour estimer, planifier et prioriser le travail

---

### 4. WORKFLOW_REGLES_METIER.md

**Objectif** : Visualiser les flux et comprendre les interactions

**Contenu** :
- 🔄 **10 workflows** sous forme de diagrammes Mermaid
- 📊 Matrice de décision (menus contextuels)
- 🧪 **5 scénarios de test critiques** détaillés
- 📈 Statistiques du livrable

**Workflows documentés** :
1. Gestion des Acomptes
2. Due Date → Check
3. Passage à "Devis envoyé"
4. Duplication "Devis supp"
5. Artisan Incomplet → Novice
6. Référence agence obligatoire
7. Archivage avec commentaire
8. Logement vacant - Champs conditionnels
9. Validation IBAN (à cadrer)
10. Champs obligatoires création intervention

**Quand le lire ?** : Pour comprendre visuellement les flux et préparer les tests

---

## 🔍 Recherche rapide par thème

### Acomptes
- 📜 Règles : `BR-ACPT-001`, `BR-ACPT-002`, `BR-ACPT-003`
- 📊 Tâche : `ACPT-001` (Phase 1, 🔴 Haute)
- 🔄 Workflow : "Gestion des Acomptes"

### Devis
- 📜 Règles : `BR-DEVI-001`, `BR-DEVI-002`
- 📊 Tâches : `DEVI-001` (Phase 1, 🟡 Moyenne), `DUP-001` (Phase 1, 🟡 Moyenne)
- 🔄 Workflows : "Passage à Devis envoyé", "Duplication Devis supp"

### Dates & Statuts
- 📜 Règles : `BR-STAT-001`, `BR-STAT-002`, `BR-STAT-003`
- 📊 Tâche : `DAT-001` (Phase 1, 🔴 Haute)
- 🔄 Workflow : "Due Date → Check"

### Agences
- 📜 Règle : `BR-AGN-001`
- 📊 Tâche : `AGN-001` (Phase 1, 🟡 Moyenne)
- 🔄 Workflow : "Référence agence obligatoire"

### Artisans
- 📜 Règles : `BR-ART-001`, `BR-ART-002`
- 📊 Tâches : `ART-001` (⚠️ À cadrer), `ART-002` (Phase 1, 🟡 Moyenne)
- 🔄 Workflows : "Artisan Incomplet → Novice", "Validation IBAN"

### Archivage
- 📜 Règles : `BR-ARC-001`, `BR-ARC-002`
- 📊 Tâche : `ARC-001` (Phase 1, 🟡 Moyenne), `ARC-002` (Phase 2, UI)
- 🔄 Workflow : "Archivage avec commentaire"

### Logement vacant
- 📜 Règle : `BR-INT-003`
- 📊 Tâche : `INT-002` (Phase 1, 🔴 Haute)
- 🔄 Workflow : "Logement vacant - Champs conditionnels"

### Menus contextuels
- 📜 Règle : `BR-PERM-001`
- 📊 Tâche : `UI-001` (Phase 2, 🟡 Moyenne)
- 🔄 Diagramme : "Matrice de décision : Menus contextuels"

---

## 📊 Statistiques globales

### Règles métier
```
Total : 18 règles
├── 🔒 Bloquantes : 8 (44%)
├── ⚙️ Automatiques : 9 (50%)
└── ℹ️ Informatives : 1 (6%)
```

### Tâches
```
Total : 21 tâches
├── 🔴 Complexité haute : 3 (14%)
├── 🟡 Complexité moyenne : 10 (48%)
└── 🟢 Complexité faible : 8 (38%)
```

### Modifications BDD
```
Total : 23 modifications
├── Table interventions : +11 champs
├── Table intervention_payments : +3 champs
├── Table artisans : +7 champs
└── Nouveaux statuts : +2
```

### Durée estimée
```
Total : 33-41 jours
├── Phase 0 (Cadrage) : 1-2 jours
├── Phase 1 (BDD) : 15-20 jours
├── Phase 2 (UI/UX) : 10-12 jours
└── Phase 3 (Tests) : 5 jours
```

---

## ⚠️ Points d'attention critiques

### 1. Bloquants à clarifier immédiatement

#### ART-001 : Validation IBAN
**Question** : Quel système de notification pour les admins ?
- Option A : Email
- Option B : In-app
- Option C : File d'attente

**Impact** : Bloque l'implémentation complète de la gestion IBAN

### 2. Décisions techniques majeures

#### Job automatique Due Date (DAT-001)
**Recommandation** : Supabase Edge Function + Trigger quotidien

#### Gestion des menus contextuels (UI-001)
**Recommandation** : `@radix-ui/react-context-menu`

#### Notifications (NOT-001)
**Recommandation** : `sonner` (toast moderne)

---

## 🔗 Liens utiles

### Documentation interne
- [README principal du projet](../README.md)
- [Guide de contribution](QUICKSTART_FOR_COLLABORATORS.md)
- [API Documentation](API_CRM_COMPLETE.md)

### Documentation externe
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Radix UI Context Menu](https://www.radix-ui.com/docs/primitives/components/context-menu)
- [Sonner Toast](https://sonner.emilkowal.ski/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod Validation](https://zod.dev/)

---

## 📝 Historique des versions

| Version | Date | Auteur | Changements |
|---------|------|--------|-------------|
| 1.0 | 05/11/2025 | Équipe Dev | Création initiale de la documentation |

---

## 🎯 Prochaines étapes

### Immédiat (Semaine 1)
1. ✅ Lire le résumé exécutif
2. ⚠️ Clarifier ART-001 avec le client
3. ✅ Créer les tickets dans l'outil de gestion
4. ✅ Assigner les tâches Sprint 1

### Court terme (Semaines 2-3)
5. 🔴 Implémenter Phase 1 - Sprint 1 (fondations BDD)
6. 🧪 Tests unitaires des règles Sprint 1
7. 📝 Documentation technique au fil de l'eau

### Moyen terme (Semaines 4-7)
8. 🔴 Implémenter Phase 1 - Sprints 2-3 (fonctionnalités complexes)
9. 🟢 Implémenter Phase 2 - Sprint 4 (UI/UX)
10. 🧪 Tests E2E

### Livraison (Semaine 8)
11. 🧪 Sprint 5 : Tests finaux et corrections
12. 📚 Finalisation documentation
13. 🚀 Déploiement en production

---

## 💡 Conseils d'utilisation

### Pour une lecture linéaire complète
1. INDEX (ce fichier) → 5 min
2. RESUME_EXECUTIF → 15 min
3. BUSINESS_RULES → 30 min
4. ANALYSE_CLASSIFICATION → 20 min
5. WORKFLOW_REGLES_METIER → 15 min
**Total : ~1h30**

### Pour une compréhension rapide
1. INDEX (ce fichier) → 5 min
2. RESUME_EXECUTIF → Sections "Vue d'ensemble" et "Top 10" → 10 min
3. WORKFLOW_REGLES_METIER → Diagrammes uniquement → 10 min
**Total : ~25 min**

### Pour implémenter une fonctionnalité spécifique
1. INDEX → Recherche par thème → 2 min
2. BUSINESS_RULES → Règle concernée → 5 min
3. ANALYSE_CLASSIFICATION → Tâche concernée → 5 min
4. WORKFLOW_REGLES_METIER → Workflow concerné → 3 min
**Total : ~15 min par fonctionnalité**

---

## 📞 Support & Questions

### Ambiguïté dans une règle métier ?
→ Consulter `BUSINESS_RULES_2025-11-04.md` section concernée  
→ Si toujours ambigu : clarifier avec le client

### Estimation d'une tâche ?
→ Consulter `ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md`  
→ Ajuster selon votre contexte

### Workflow pas clair ?
→ Consulter `WORKFLOW_REGLES_METIER.md` diagramme concerné  
→ Créer des scénarios de test pour valider

---

## ✅ Checklist avant de commencer

- [ ] J'ai lu le résumé exécutif
- [ ] J'ai identifié les points bloquants (ART-001)
- [ ] J'ai consulté les règles métier de ma tâche
- [ ] J'ai compris le workflow associé
- [ ] J'ai estimé ma tâche
- [ ] J'ai créé ma branche Git
- [ ] J'ai préparé mes migrations BDD (si applicable)
- [ ] J'ai préparé mes tests unitaires

---

**Créé le** : 5 novembre 2025  
**Maintenu par** : Équipe Dev GMBS CRM  
**Version** : 1.0

🎉 **Bonne lecture et bon développement !**

