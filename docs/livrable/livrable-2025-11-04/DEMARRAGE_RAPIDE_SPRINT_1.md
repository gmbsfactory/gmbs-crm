# ⚡ Démarrage Rapide - Sprint 1

**Date** : 6 novembre 2025  
**Durée** : 7 jours  
**Objectif** : Fondations BDD et validations de base

---

## 🎯 En 30 secondes

**5 tâches** à réaliser dans l'ordre :
1. AGN-001 : Référence agence (1-2j)
2. INT-001 : Champs obligatoires (0.5j)
3. INT-003 : Droits Contexte (0.5j)
4. DEVI-001 : ID devis (1-2j)
5. ARC-001 : Commentaire archivage (2j)

---

## 📋 Checklist de démarrage

### Avant de commencer
- [ ] J'ai lu `README.md` de ce dossier
- [ ] J'ai lu `SPRINT_TRACKER.md` pour comprendre les tâches
- [ ] J'ai lu les règles métier dans `BUSINESS_RULES_2025-11-04.md`
- [ ] J'ai le fichier `PROMPT_POUR_CODEX.md` prêt

### Pour utiliser avec Codex
- [ ] Ouvrir Codex
- [ ] Copier le contenu de `PROMPT_POUR_CODEX.md`
- [ ] Coller dans Codex
- [ ] Suivre les instructions de Codex
- [ ] Mettre à jour `SPRINT_TRACKER.md` après chaque tâche

---

## 🚀 Commencer maintenant

### Option 1 : Avec Codex (recommandé)
```bash
# 1. Ouvrir le prompt
cat docs/livrable-2025-11-04/PROMPT_POUR_CODEX.md

# 2. Copier tout le contenu
# 3. Coller dans Codex
# 4. Laisser Codex vous guider !
```

### Option 2 : Manuellement
```bash
# 1. Consulter le tracker
cat docs/livrable-2025-11-04/SPRINT_TRACKER.md

# 2. Consulter les règles métier
cat docs/livrable-2025-11-04/BUSINESS_RULES_2025-11-04.md

# 3. Commencer par AGN-001
# Voir la section détaillée dans SPRINT_TRACKER.md
```

---

## 📊 Tâches du Sprint 1

### 1. AGN-001 : Référence agence obligatoire
**Durée** : 1-2 jours  
**Complexité** : 🟡 Moyenne  
**Règle** : BR-AGN-001

**À faire** :
- Migration BDD : Ajouter `reference_agence` + table `agency_config`
- Validation backend (Zod)
- Validation frontend (React Hook Form)
- Tests unitaires

**Fichiers** :
- `supabase/migrations/[date]_add_reference_agence.sql`
- `app/api/interventions/route.ts`
- `src/components/modals/NewInterventionModalContent.tsx`

---

### 2. INT-001 : Champs obligatoires
**Durée** : 0.5 jour  
**Complexité** : 🟢 Faible  
**Règle** : BR-INT-001

**À faire** :
- Migration BDD : Contraintes NOT NULL
- Validation Zod + React Hook Form

**Champs obligatoires** :
- Adresse
- Contexte
- Métier
- Statut
- Agence

---

### 3. INT-003 : Droits d'édition Contexte
**Durée** : 0.5 jour  
**Complexité** : 🟢 Faible  
**Règle** : BR-INT-002

**À faire** :
- Logique de permission UI
- Readonly si non-création ET non-admin

---

### 4. DEVI-001 : ID devis pré-requis
**Durée** : 1-2 jours  
**Complexité** : 🟡 Moyenne  
**Règle** : BR-DEVI-001

**À faire** :
- Migration BDD : Ajouter `id_devis` (si nécessaire)
- Validation changement de statut
- Menu contextuel : masquage conditionnel

---

### 5. ARC-001 : Commentaire archivage
**Durée** : 2 jours  
**Complexité** : 🟡 Moyenne  
**Règle** : BR-ARC-001

**À faire** :
- Migration BDD : 3 champs d'archivage
- Composant `ArchiveModal.tsx`
- API endpoints archivage
- Menu contextuel

---

## 📝 Mise à jour du tracker

Après CHAQUE tâche complétée :

```bash
# Ouvrir le tracker
open docs/livrable-2025-11-04/SPRINT_TRACKER.md

# Mettre à jour :
# 1. Statut : ⏸️ → 🟡 → ✅
# 2. Cocher les items de la checklist
# 3. Ajouter des notes si besoin
# 4. Mettre à jour le temps consommé
```

---

## 🎯 Critères de succès

### À la fin du Sprint 1
- ✅ 5 tâches terminées
- ✅ 5 migrations BDD appliquées
- ✅ Toutes les validations fonctionnelles
- ✅ Tests passants
- ✅ `SPRINT_TRACKER.md` à jour
- ✅ Zéro régression

---

## 🔗 Liens rapides

- [SPRINT_TRACKER.md](SPRINT_TRACKER.md) - Suivi détaillé
- [PROMPT_POUR_CODEX.md](PROMPT_POUR_CODEX.md) - Prompt complet pour Codex
- [BUSINESS_RULES_2025-11-04.md](BUSINESS_RULES_2025-11-04.md) - Règles métier
- [README.md](README.md) - Documentation principale

---

## ⚡ One-liner pour démarrer avec Codex

```bash
# Afficher le prompt pour Codex
cat docs/livrable-2025-11-04/PROMPT_POUR_CODEX.md | pbcopy && echo "✅ Prompt copié ! Coller dans Codex maintenant."
```

---

**Prêt à démarrer ?** 🚀  
**Commencez par copier `PROMPT_POUR_CODEX.md` dans Codex !**

