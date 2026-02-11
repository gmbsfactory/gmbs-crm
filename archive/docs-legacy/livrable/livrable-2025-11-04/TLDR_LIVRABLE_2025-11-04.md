# ⚡ TL;DR - Livrable Interventions & Artisans

**Lecture : 2 minutes** | **Date : 5 novembre 2025**

---

## 🎯 L'essentiel

Vos clients ont fourni une liste complète de 21 tâches à réaliser. J'ai analysé et documenté l'ensemble.

**📊 Résultat :**
- ✅ **21 tâches** classées par complexité
- ✅ **18 règles métier** documentées avec code
- ✅ **10 workflows** visuels créés
- ✅ **Estimation** : 7-8 semaines (33-41 jours)

---

## 📁 4 documents créés pour vous

| Document | Quand le lire ? | Durée |
|----------|----------------|-------|
| **[INDEX](docs/INDEX_LIVRABLE_2025-11-04.md)** | D'abord (navigation) | 5 min |
| **[RÉSUMÉ EXÉCUTIF](docs/RESUME_EXECUTIF_LIVRABLE_2025-11-04.md)** | Vue d'ensemble | 15 min |
| **[RÈGLES MÉTIER](docs/BUSINESS_RULES_2025-11-04.md)** | Avant de coder | 30 min |
| **[WORKFLOWS](docs/WORKFLOW_REGLES_METIER.md)** | Visualiser les flux | 15 min |

---

## 🔴 Actions IMMÉDIATES requises

### ⚠️ BLOQUANT : Clarifier avec le client

**ART-001 : Système de validation IBAN**

**Question** : Comment l'admin est-il informé qu'un IBAN a été ajouté ?

**3 options** :
- A. 📧 Notification email
- B. 🔔 Notification in-app
- C. 📋 File d'attente avec badge

**Impact** : Bloque l'implémentation IBAN (estimation : 2-3 jours supplémentaires)

---

## 📊 Classification rapide

### 🔴 Complexe (BDD + Backend) — 15-20 jours
1. **INT-002** : Logement vacant (4 nouveaux champs BDD)
2. **ACPT-001** : Workflow acomptes complet (3 champs + 2 statuts)
3. **DAT-001** : Job cron due_date → Check automatique
4. **AGN-001** : Référence agence obligatoire
5. **DEVI-001** : ID devis pré-requis
6. **DUP-001** : Duplication "Devis supp"
7. **ARC-001** : Commentaire archivage obligatoire
8. **ART-002** : Règle Incomplet → Novice
9. **INT-003** : Droits édition Contexte
10. **INT-001** : Champs obligatoires

### 🟢 Simple (UI/UX) — 10-12 jours
11. **UI-001** : Menus contextuels (clic droit)
12. **MSG-001** : Prévisualisation messages
13. **TPL-001** : Templates emails/SMS
14. **NOT-001** : Pop-ups d'information
15. **ARC-002** : Pastille "Indisponible"
16. **MAP-001** : Mapping Budget = SST
17-21. **UI diverses** : Logique conditionnelle frontend

---

## 📜 Top 5 des règles métier à connaître

### 1. BR-DEVI-001 : Pas d'ID devis → Pas de "Devis envoyé"
```
🔒 BLOQUANT
Sans id_devis renseigné, l'action "Devis envoyé" est MASQUÉE dans le menu
```

### 2. BR-ACPT-001-002-003 : Workflow acomptes
```
⚙️ AUTOMATIQUE
Montant saisi → "Attente acompte"
Case cochée → Date obligatoire
Date saisie → "Accepté $"
```

### 3. BR-STAT-001 : Due date dépassée → "Check"
```
⚙️ AUTOMATIQUE (Job quotidien)
Si due_date < NOW() ET statut IN (VT, EC) → Statut "Check"
```

### 4. BR-AGN-001 : 3 agences requièrent une référence
```
🔒 BLOQUANT
ImoDirect, AFEDIM, Locoro → reference_agence obligatoire
```

### 5. BR-INT-001 : 5 champs obligatoires à la création
```
🔒 BLOQUANT
Adresse, Contexte, Métier, Statut, Agence = requis
```

---

## 🗂️ Modifications BDD en bref

```sql
-- Table interventions : +11 champs
logement_vacant, info_clef, etage, numero_appartement,
reference_agence, id_devis, previous_statut_id,
archived_at, archived_by, archived_reason, duplicated_from

-- Table intervention_payments : +3 champs
montant_acompte_reclame, acompte_recu, date_reception_acompte

-- Table artisans : +7 champs
iban, iban_validated, iban_validated_at, iban_validated_by,
archived_at, archived_by, archived_reason

-- Nouveaux statuts : +2
"Attente acompte", "Accepté $"
```

**Total : 23 modifications BDD**

---

## 📅 Planning ultra-simplifié

| Sprint | Semaines | Focus |
|--------|----------|-------|
| **Sprint 1** | 1-2 | Fondations BDD simples |
| **Sprint 2** | 3-4 | Fonctionnalités complexes |
| **Sprint 3** | 5 | Automatisations (job cron) |
| **Sprint 4** | 6-7 | UI/UX |
| **Sprint 5** | 8 | Tests & QA |

**Total : 8 semaines**

---

## 🚀 Pour démarrer maintenant

### 1. Lire la doc (30 min)
```bash
1. Ce TL;DR (fait ✅)
2. docs/INDEX_LIVRABLE_2025-11-04.md (5 min)
3. docs/RESUME_EXECUTIF_LIVRABLE_2025-11-04.md (15 min)
4. docs/WORKFLOW_REGLES_METIER.md (10 min)
```

### 2. Clarifier le bloquant
```
☎️ Appeler/écrire au client pour ART-001 (validation IBAN)
```

### 3. Créer les tickets
```
📋 Créer 21 tickets dans votre outil de gestion
   (Jira, Linear, GitHub Issues, etc.)
```

### 4. Commencer Sprint 1
```
🔴 Tâches prioritaires :
- AGN-001 : Référence agence (1-2j)
- INT-001 : Champs obligatoires (0.5j)
- INT-003 : Droits Contexte (0.5j)
- DEVI-001 : ID devis (1-2j)
- ARC-001 : Commentaire archivage (2j)
```

---

## 🔗 Liens rapides

- 📋 **Navigation** : [INDEX_LIVRABLE_2025-11-04.md](docs/INDEX_LIVRABLE_2025-11-04.md)
- 📊 **Vue d'ensemble** : [RESUME_EXECUTIF_LIVRABLE_2025-11-04.md](docs/RESUME_EXECUTIF_LIVRABLE_2025-11-04.md)
- 📜 **Règles métier** : [BUSINESS_RULES_2025-11-04.md](docs/BUSINESS_RULES_2025-11-04.md)
- 🔄 **Workflows** : [WORKFLOW_REGLES_METIER.md](docs/WORKFLOW_REGLES_METIER.md)
- 📊 **Classification** : [ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md](docs/ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md)
- 📄 **Source HTML** : [livrable-specs-interventions-artisans_2025-11-04.html](livrable-specs-interventions-artisans_2025-11-04.html)

---

## 💡 Une question ?

### "Par où commencer ?"
→ Lire [RESUME_EXECUTIF_LIVRABLE_2025-11-04.md](docs/RESUME_EXECUTIF_LIVRABLE_2025-11-04.md)

### "Comment implémenter une règle ?"
→ Consulter [BUSINESS_RULES_2025-11-04.md](docs/BUSINESS_RULES_2025-11-04.md) + code d'exemple

### "Quel est le workflow ?"
→ Voir [WORKFLOW_REGLES_METIER.md](docs/WORKFLOW_REGLES_METIER.md) + diagramme visuel

### "Combien de temps ça prend ?"
→ Consulter [ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md](docs/ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md)

---

## ✅ Checklist rapide

- [ ] J'ai lu ce TL;DR
- [ ] J'ai consulté l'INDEX
- [ ] J'ai lu le résumé exécutif
- [ ] J'ai clarifié ART-001 avec le client
- [ ] J'ai créé les 21 tickets
- [ ] J'ai assigné les tâches Sprint 1
- [ ] Je suis prêt à coder ! 🚀

---

**Créé le** : 5 novembre 2025  
**Temps de lecture** : 2 minutes  
**Prochaine étape** : Lire [INDEX_LIVRABLE_2025-11-04.md](docs/INDEX_LIVRABLE_2025-11-04.md)

🎉 **Vous êtes prêt ! Bon développement !**

