# Règles de Gestion des Statuts Artisans

**Date de mise à jour:** 2025-12-22
**Version:** 2.0

## Vue d'ensemble

Ce document définit les règles de transition et de gestion des statuts des artisans dans le CRM GMBS.

---

## Statut Initial

**Statut par défaut pour les nouveaux artisans :** `POTENTIEL`

Lorsqu'un nouvel artisan est créé dans le système, il est automatiquement assigné au statut `POTENTIEL`.

---

## Progression Automatique (basée sur le nombre d'interventions terminées)

Les transitions suivantes se font **automatiquement** après la complétion d'interventions :

| De | Vers | Condition |
|---|---|---|
| `POTENTIEL` | `NOVICE` | ≥ 1 intervention terminée |
| `CANDIDAT` | `NOVICE` | ≥ 1 intervention terminée |
| `ONE_SHOT` | `NOVICE` | ≥ 1 intervention terminée |
| `NOVICE` | `FORMATION` | ≥ 3 interventions terminées |
| `FORMATION` | `CONFIRME` | ≥ 6 interventions terminées |
| `CONFIRME` | `EXPERT` | ≥ 10 interventions terminées |

**Notes importantes :**
- Seules les interventions **primaires** (`is_primary = true`) sont comptabilisées
- Seules les interventions avec statut `TERMINE` ou `INTER_TERMINEE` sont prises en compte
- La progression est déclenchée automatiquement après chaque intervention terminée via le script de recalcul

---

## Transitions Manuelles Autorisées

Ces transitions peuvent **uniquement** être effectuées manuellement par un utilisateur :

### 1. Transitions bidirectionnelles

| De | Vers | Description |
|---|---|---|
| `POTENTIEL` | `CANDIDAT` | Évaluation de l'artisan |
| `CANDIDAT` | `POTENTIEL` | Retour à l'état initial |

### 2. Attribution du statut ONE_SHOT

| De | Vers | Description |
|---|---|---|
| `POTENTIEL` | `ONE_SHOT` | Pour une intervention ponctuelle unique |
| `CANDIDAT` | `ONE_SHOT` | Pour une intervention ponctuelle unique |

### 3. Réintégration dans le workflow automatique

| De | Vers | Description |
|---|---|---|
| `ONE_SHOT` | `POTENTIEL` | Réintégration dans le workflow normal |
| `ONE_SHOT` | `CANDIDAT` | Réintégration dans le workflow normal |

**Important :** Après être passé de `ONE_SHOT` à `POTENTIEL` ou `CANDIDAT`, l'artisan peut à nouveau progresser automatiquement selon ses interventions.

### 4. Archivage

| De | Vers | Description |
|---|---|---|
| Tout statut | `ARCHIVE` | Archivage de l'artisan (requiert une raison obligatoire) |

**Notes :**
- L'archivage nécessite de fournir un motif via la modal `StatusReasonModal`
- Un commentaire système est automatiquement créé avec le motif
- Le champ `is_active` est mis à `false`

---

## Statuts Gelés (pas de progression automatique)

### ARCHIVE

**Description :** Artisan archivé définitivement
**Comportement :** Une fois archivé, un artisan ne peut **jamais** progresser automatiquement
**Modification :** Possible uniquement manuellement (désarchivage)

---

## Exemples de Workflows

### Workflow type 1 : Artisan standard
```
POTENTIEL (création)
    ↓ (manuel)
CANDIDAT
    ↓ (1 intervention terminée - auto)
NOVICE
    ↓ (3 interventions terminées - auto)
FORMATION
    ↓ (6 interventions terminées - auto)
CONFIRME
    ↓ (10+ interventions terminées - auto)
EXPERT
```

### Workflow type 2 : Artisan direct
```
POTENTIEL (création)
    ↓ (1 intervention terminée - auto)
NOVICE
    ↓ (3 interventions terminées - auto)
FORMATION
    ... etc
```

### Workflow type 3 : One Shot réintégré
```
POTENTIEL (création)
    ↓ (manuel)
ONE_SHOT
    ↓ (manuel - réintégration)
CANDIDAT
    ↓ (1 intervention terminée - auto)
NOVICE
    ... etc
```

### Workflow type 4 : Archivage
```
CONFIRME (artisan actif)
    ↓ (manuel avec raison)
ARCHIVE
    (gelé définitivement)
```

---

## Implémentation Technique

### Fichiers clés

| Fichier | Description |
|---------|-------------|
| [`src/lib/artisans/statusRules.ts`](../src/lib/artisans/statusRules.ts) | Règles de transition et validation |
| [`src/lib/artisans/statusTransition.ts`](../src/lib/artisans/statusTransition.ts) | Calcul des transitions avec règle ARC-002 |
| [`src/lib/artisans/dossierStatus.ts`](../src/lib/artisans/dossierStatus.ts) | Calcul du statut de dossier |
| [`scripts/recalculate-single-artisan-status.js`](../scripts/recalculate-single-artisan-status.js) | Script de recalcul unitaire |
| [`scripts/recalculate-artisan-statuses.js`](../scripts/recalculate-artisan-statuses.js) | Script de recalcul batch |

### Fonctions principales

#### `calculateNewArtisanStatus(currentStatus, completedInterventionsCount)`
Calcule le nouveau statut d'artisan basé sur le nombre d'interventions terminées.

#### `isTransitionAllowed(fromStatus, toStatus)`
Vérifie si une transition manuelle est autorisée.

#### `getDefaultArtisanStatus()`
Retourne `POTENTIEL` comme statut par défaut.

### APIs

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/artisans/[id]/recalculate-status` | POST | Recalcule le statut d'un artisan |
| `/api/artisans/[id]/archive` | POST | Archive un artisan avec motif |
| `/api/artisans/[id]` | PATCH | Met à jour un artisan (statut manuel) |

### Scripts de maintenance

```bash
# Recalcul d'un artisan spécifique
node scripts/recalculate-single-artisan-status.js <artisan_id>

# Recalcul de tous les artisans
node scripts/recalculate-artisan-statuses.js
```

---

## Règle Métier ARC-002

**Règle :** Si un artisan passe au statut `NOVICE` pour la première fois ET que son statut de dossier est `INCOMPLET`, alors le statut de dossier passe automatiquement à `À compléter`.

**Objectif :** Alerter l'équipe qu'un artisan actif (avec au moins 1 intervention) doit compléter son dossier administratif.

**Implémentation :** [`src/lib/artisans/statusTransition.ts:60-65`](../src/lib/artisans/statusTransition.ts#L60-L65)

---

## Système de Statut de Dossier (Indépendant)

Les artisans ont un **second système de statut** pour leur documentation :

| Statut | Condition |
|--------|-----------|
| `INCOMPLET` | Moins de 5 documents requis présents |
| `À compléter` | Artisan avec ≥1 intervention ET (dossier vide OU 1 seul document manquant) |
| `COMPLET` | Les 5 documents requis sont présents |

**Documents requis (5) :**
1. `kbis` - Extrait Kbis
2. `assurance` - Attestation d'assurance
3. `cni_recto_verso` - CNI recto/verso
4. `iban` - IBAN
5. `decharge_partenariat` - Décharge partenariat

**Note :** Le statut de dossier est recalculé automatiquement lors du recalcul du statut d'artisan.

---

## Configuration des Couleurs

Les couleurs des statuts sont définies dans [`src/config/status-colors.ts`](../src/config/status-colors.ts) :

| Statut | Couleur | Hex Code |
|--------|---------|----------|
| `CANDIDAT` | Violet | `#A855F7` |
| `POTENTIEL` | Jaune | `#FACC15` |
| `NOVICE` | Bleu clair | `#60A5FA` |
| `FORMATION` | Cyan | `#38BDF8` |
| `CONFIRME` | Vert | `#22C55E` |
| `EXPERT` | Indigo | `#6366F1` |
| `ONE_SHOT` | Orange | `#F97316` |
| `INACTIF` | Rouge | `#EF4444` |
| `ARCHIVE` | Gris | `#6B7280` |

---

## Historique des Changements

### Version 2.0 (2025-12-22)
- **Statut initial changé** : `CANDIDAT` → `POTENTIEL`
- **ONE_SHOT n'est plus gelé** : Peut maintenant progresser automatiquement
- **Transitions bidirectionnelles** : `POTENTIEL ↔ CANDIDAT`
- **Réintégration ONE_SHOT** : `ONE_SHOT → POTENTIEL/CANDIDAT` possible
- **ARCHIVE reste le seul statut gelé** : Pas de changement automatique

### Version 1.0 (avant 2025-12-22)
- Statut initial : `CANDIDAT`
- ONE_SHOT et ARCHIVE étaient gelés
- Transitions limitées

---

## Contact et Support

Pour toute question sur les règles de statuts artisans, consulter :
- La documentation technique dans [`src/lib/artisans/`](../src/lib/artisans/)
- Les tests unitaires (à créer)
- L'équipe de développement
