# 📊 Tableau Récapitulatif - Livrable Interventions & Artisans

**Version** : 1.0  
**Date** : 5 novembre 2025  
**Vue** : Tableau synthétique des 21 tâches

---

## 🎯 Vue d'ensemble

| Métrique | Valeur |
|----------|--------|
| **Total tâches** | 21 |
| **Règles métier** | 18 |
| **Modifications BDD** | 23 champs + 2 statuts |
| **Durée estimée** | 33-41 jours (7-8 semaines) |
| **Points bloquants** | 1 (ART-001 à clarifier) |

---

## 📋 Tableau complet des tâches

| # | Réf | Nom | Type | Complexité | Durée | Sprint | Priorité | BDD | UI | Backend | Tests |
|---|-----|-----|------|------------|-------|--------|----------|-----|----|---------|----- |
| 1 | INT-002 | Logement vacant | BDD+UI | 🔴 Haute | 3-4j | 2 | P1 | ✅ | ✅ | ✅ | ✅ |
| 2 | ACPT-001 | Workflow acomptes | BDD+Backend | 🔴 Haute | 4-5j | 2 | P1 | ✅ | ⚠️ | ✅ | ✅ |
| 3 | DAT-001 | Due date → Check | Backend+Job | 🔴 Haute | 3-4j | 3 | P1 | ✅ | ⚠️ | ✅ | ✅ |
| 4 | AGN-001 | Référence agence | BDD+Validation | 🟡 Moyenne | 1-2j | 1 | P1 | ✅ | ✅ | ✅ | ✅ |
| 5 | DEVI-001 | ID devis pré-requis | Validation | 🟡 Moyenne | 1-2j | 1 | P1 | ⚠️ | ✅ | ✅ | ✅ |
| 6 | DUP-001 | Duplication devis | Backend | 🟡 Moyenne | 2-3j | 2 | P2 | ⚠️ | ⚠️ | ✅ | ✅ |
| 7 | ARC-001 | Commentaire archivage | BDD+UI | 🟡 Moyenne | 2j | 1 | P2 | ✅ | ✅ | ✅ | ✅ |
| 8 | ART-002 | Règle Incomplet → Novice | Backend | 🟡 Moyenne | 1-2j | 2 | P2 | ⚠️ | ❌ | ✅ | ✅ |
| 9 | INT-003 | Droits Contexte | Permissions | 🟢 Faible | 0.5j | 1 | P1 | ❌ | ✅ | ⚠️ | ⚠️ |
| 10 | INT-001 | Champs obligatoires | Validation | 🟢 Faible | 0.5j | 1 | P1 | ⚠️ | ✅ | ✅ | ✅ |
| 11 | UI-001 | Menus contextuels | UI | 🟡 Moyenne | 3-4j | 4 | P1 | ❌ | ✅ | ⚠️ | ✅ |
| 12 | MSG-001 | Prévisualisation messages | UI | 🟢 Faible | 1j | 4 | P2 | ❌ | ✅ | ❌ | ⚠️ |
| 13 | TPL-001 | Templates emails/SMS | Config | 🟢 Faible | 1j | 4 | P2 | ❌ | ⚠️ | ⚠️ | ⚠️ |
| 14 | NOT-001 | Pop-ups info | UI | 🟢 Faible | 1j | 4 | P2 | ❌ | ✅ | ❌ | ⚠️ |
| 15 | ARC-002 | Pastille indisponible | UI | 🟢 Faible | 1j | 4 | P2 | ❌ | ✅ | ❌ | ⚠️ |
| 16 | MAP-001 | Mapping Budget=SST | Config | 🟢 Très faible | 0.5j | 4 | P3 | ❌ | ⚠️ | ⚠️ | ❌ |
| 17 | UI-LV | UI Logement vacant | UI | 🟡 Moyenne | 2j | 2 | P1 | ❌ | ✅ | ❌ | ✅ |
| 18 | UI-AGN | UI Référence agence | UI | 🟡 Moyenne | 1j | 1 | P1 | ❌ | ✅ | ❌ | ✅ |
| 19 | UI-DD | UI Due date VT/EC | UI | 🟢 Faible | 0.5j | 3 | P1 | ❌ | ✅ | ❌ | ✅ |
| 20 | UI-DEV | UI Devis envoyé | UI | 🟢 Faible | 0.5j | 1 | P1 | ❌ | ✅ | ❌ | ✅ |
| 21 | UI-DUP | UI Devis supp | UI | 🟢 Faible | 0.5j | 2 | P1 | ❌ | ✅ | ❌ | ✅ |

**Légende** :
- ✅ : Requis / Complet
- ⚠️ : Partiel / Mineur
- ❌ : Non requis

---

## 📊 Répartition par type

### Par complexité
```
🔴 Haute :      3 tâches (14%)  ████░░░░░░░░░░░░░░░░
🟡 Moyenne :   10 tâches (48%)  ███████████████░░░░░
🟢 Faible :     8 tâches (38%)  ████████████░░░░░░░░
```

### Par sprint
```
Sprint 1 :  5 tâches (24%)  █████░░░░░░░░░░░░░░░
Sprint 2 :  5 tâches (24%)  █████░░░░░░░░░░░░░░░
Sprint 3 :  2 tâches (10%)  ██░░░░░░░░░░░░░░░░░░
Sprint 4 :  6 tâches (29%)  ██████░░░░░░░░░░░░░░
Sprint 5 :  Tests & QA      ███░░░░░░░░░░░░░░░░░
```

### Par priorité
```
P1 : 14 tâches (67%)  █████████████░░░░░░░
P2 :  6 tâches (29%)  ██████░░░░░░░░░░░░░░
P3 :  1 tâche  (5%)   █░░░░░░░░░░░░░░░░░░░
```

### Par impact technique
```
Modifications BDD :    10 tâches  ████████████░░░░░░░░
UI/Frontend :          15 tâches  ███████████████████░
Backend/Logique :      11 tâches  ██████████████░░░░░░
Tests requis :         17 tâches  █████████████████░░░
```

---

## 🗂️ Modifications BDD par table

| Table | Champs ajoutés | Exemples |
|-------|----------------|----------|
| **interventions** | 11 | `logement_vacant`, `info_clef`, `etage`, `numero_appartement`, `reference_agence`, `id_devis`, `previous_statut_id`, `archived_at`, `archived_by`, `archived_reason`, `duplicated_from` |
| **intervention_payments** | 3 | `montant_acompte_reclame`, `acompte_recu`, `date_reception_acompte` |
| **artisans** | 7 | `iban`, `iban_validated`, `iban_validated_at`, `iban_validated_by`, `archived_at`, `archived_by`, `archived_reason` |
| **intervention_statuses** | 2 nouveaux | `attente_acompte`, `accepte_acompte_recu` |

**Total : 23 modifications**

---

## 📜 Règles métier par catégorie

| Catégorie | Nombre | Règles |
|-----------|--------|--------|
| **Interventions** | 3 | BR-INT-001, BR-INT-002, BR-INT-003 |
| **Statuts** | 3 | BR-STAT-001, BR-STAT-002, BR-STAT-003 |
| **Devis & Acomptes** | 5 | BR-DEVI-001, BR-DEVI-002, BR-ACPT-001, BR-ACPT-002, BR-ACPT-003 |
| **Artisans** | 2 | BR-ART-001, BR-ART-002 |
| **Agences** | 1 | BR-AGN-001 |
| **Archivage** | 2 | BR-ARC-001, BR-ARC-002 |
| **Permissions** | 1 | BR-PERM-001 |
| **Duplication** | 1 | BR-DUP-001 |

**Total : 18 règles**

### Par type
```
🔒 Bloquantes :     8 règles (44%)  ████████░░░░░░░░░░░░
⚙️ Automatiques :   9 règles (50%)  ██████████░░░░░░░░░░
ℹ️ Informatives :   1 règle  (6%)   █░░░░░░░░░░░░░░░░░░░
```

---

## 📅 Planning détaillé par sprint

### Sprint 1 : Fondations BDD (Semaines 1-2)
| Tâche | Durée | Dev | Tests | Total |
|-------|-------|-----|-------|-------|
| AGN-001 | 1-2j | 1.5j | 0.5j | 2j |
| INT-001 | 0.5j | 0.3j | 0.2j | 0.5j |
| INT-003 | 0.5j | 0.3j | 0.2j | 0.5j |
| DEVI-001 | 1-2j | 1.5j | 0.5j | 2j |
| ARC-001 | 2j | 1.5j | 0.5j | 2j |
| **Total Sprint 1** | **5.5-7.5j** | **5j** | **1.9j** | **7j** |

### Sprint 2 : Fonctionnalités métier (Semaines 3-4)
| Tâche | Durée | Dev | Tests | Total |
|-------|-------|-----|-------|-------|
| INT-002 | 3-4j | 3j | 1j | 4j |
| ACPT-001 | 4-5j | 4j | 1j | 5j |
| ART-002 | 1-2j | 1.5j | 0.5j | 2j |
| DUP-001 | 2-3j | 2.5j | 0.5j | 3j |
| UI-LV | 2j | 1.5j | 0.5j | 2j |
| UI-DUP | 0.5j | 0.3j | 0.2j | 0.5j |
| **Total Sprint 2** | **13-16.5j** | **12.8j** | **3.7j** | **16.5j** |

### Sprint 3 : Automatisations (Semaine 5)
| Tâche | Durée | Dev | Tests | Total |
|-------|-------|-----|-------|-------|
| DAT-001 | 3-4j | 3j | 1j | 4j |
| UI-DD | 0.5j | 0.3j | 0.2j | 0.5j |
| **Total Sprint 3** | **3.5-4.5j** | **3.3j** | **1.2j** | **4.5j** |

### Sprint 4 : UI/UX (Semaines 6-7)
| Tâche | Durée | Dev | Tests | Total |
|-------|-------|-----|-------|-------|
| UI-001 | 3-4j | 3.5j | 0.5j | 4j |
| MSG-001 | 1j | 0.8j | 0.2j | 1j |
| TPL-001 | 1j | 0.8j | 0.2j | 1j |
| NOT-001 | 1j | 0.8j | 0.2j | 1j |
| ARC-002 | 1j | 0.8j | 0.2j | 1j |
| MAP-001 | 0.5j | 0.5j | 0j | 0.5j |
| UI-AGN | 1j | 0.8j | 0.2j | 1j |
| UI-DEV | 0.5j | 0.3j | 0.2j | 0.5j |
| **Total Sprint 4** | **9-10j** | **8.3j** | **1.7j** | **10j** |

### Sprint 5 : Tests & QA (Semaine 8)
| Activité | Durée |
|----------|-------|
| Tests unitaires complémentaires | 1j |
| Tests E2E (5 scénarios critiques) | 2j |
| Tests d'intégration | 1j |
| Corrections de bugs | 1j |
| **Total Sprint 5** | **5j** |

---

## 📊 Statistiques globales

### Durée totale estimée
```
Sprint 1 :   7j     ████░░░░░░░░░░░░░░░░
Sprint 2 :  16.5j   ████████░░░░░░░░░░░░
Sprint 3 :   4.5j   ██░░░░░░░░░░░░░░░░░░
Sprint 4 :  10j     █████░░░░░░░░░░░░░░░
Sprint 5 :   5j     ██░░░░░░░░░░░░░░░░░░
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total :     43j     █████████████████████
(≈ 8.6 semaines avec 5 jours/semaine)
```

### Répartition Développement vs Tests
```
Développement :  29.4j (68%)  █████████████░░░░░░░
Tests :          8.5j (20%)   ████░░░░░░░░░░░░░░░░
QA :             5j (12%)     ██░░░░░░░░░░░░░░░░░░
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total :          42.9j (100%)
```

---

## 🚨 Risques et dépendances

| Risque | Impact | Probabilité | Mitigation | Tâches concernées |
|--------|--------|-------------|------------|-------------------|
| ART-001 non cadré | 🔴 Bloquant | 90% | Clarifier ASAP avec client | ART-001, Sprint 3 |
| Complexité job cron DAT-001 | 🟡 Moyen | 40% | Utiliser Edge Functions Supabase | DAT-001 |
| Conflits schéma BDD existant | 🔴 Élevé | 30% | Backup BDD avant chaque migration | Tous les sprints |
| Tests régression | 🟡 Moyen | 50% | Suite de tests automatisés complète | Sprint 5 |
| Duplication devis complexe | 🟡 Moyen | 40% | Bien gérer les relations (artisans, costs) | DUP-001 |
| Performance job due_date | 🟢 Faible | 20% | Indexer colonne due_date | DAT-001 |

---

## 🎯 Jalons clés

| Jalon | Date cible | Critères de succès |
|-------|------------|-------------------|
| **Kick-off** | Semaine 0 | ✅ Clarification ART-001, tickets créés |
| **Fin Sprint 1** | Semaine 2 | ✅ 5 tâches BDD simples terminées |
| **Fin Sprint 2** | Semaine 4 | ✅ Logement vacant + Acomptes opérationnels |
| **Fin Sprint 3** | Semaine 5 | ✅ Job cron due_date fonctionnel |
| **Fin Sprint 4** | Semaine 7 | ✅ Tous les menus contextuels opérationnels |
| **Livraison** | Semaine 8 | ✅ Tests passants, documentation à jour |

---

## 📈 Métriques de succès

### Couverture des tests
- ✅ **18/18** règles métier testées unitairement
- ✅ **5/5** scénarios E2E critiques couverts
- ✅ **Couverture de code** > 80% sur nouvelles fonctionnalités

### Performance
- ✅ Job `due_date` : < 5s (même avec 10K interventions)
- ✅ Menus contextuels : < 100ms
- ✅ Validation formulaires : < 50ms

### Qualité
- ✅ Zéro régression sur fonctionnalités existantes
- ✅ Toutes les migrations réversibles
- ✅ Documentation à jour

---

## 🔗 Liens rapides

- 📋 [INDEX](INDEX_LIVRABLE_2025-11-04.md)
- 📊 [RÉSUMÉ EXÉCUTIF](RESUME_EXECUTIF_LIVRABLE_2025-11-04.md)
- 📜 [RÈGLES MÉTIER](BUSINESS_RULES_2025-11-04.md)
- 🔄 [WORKFLOWS](WORKFLOW_REGLES_METIER.md)
- 📊 [CLASSIFICATION](ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md)
- ⚡ [TL;DR](../TLDR_LIVRABLE_2025-11-04.md)

---

**Créé le** : 5 novembre 2025  
**Maintenu par** : Équipe Dev GMBS CRM  
**Version** : 1.0

📊 **Tableau à jour et prêt pour l'exécution !**

