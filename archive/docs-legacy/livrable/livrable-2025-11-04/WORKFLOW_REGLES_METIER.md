# 🔄 Workflows & Règles Métier - Diagrammes

**Version** : 1.0  
**Date** : 5 novembre 2025  
**Objectif** : Visualiser les règles métier sous forme de diagrammes

---

## 📊 Workflow 1 : Gestion des Acomptes

```mermaid
graph TD
    A[Intervention créée] --> B{Statut = Accepté?}
    B -->|Non| Z[Continuer workflow normal]
    B -->|Oui| C[Gestionnaire saisit montant acompte réclamé]
    
    C --> D[⚙️ AUTO: Statut → Attente acompte]
    
    D --> E{Acompte reçu?}
    E -->|Non| E
    E -->|Oui| F[Gestionnaire coche Acompte reçu]
    
    F --> G{Date réception saisie?}
    G -->|Non| H[🔒 BLOQUANT: Date obligatoire]
    H --> G
    G -->|Oui| I[⚙️ AUTO: Statut → Accepté $]
    
    I --> J[✅ Workflow terminé]
    
    style D fill:#10b981,color:#fff
    style I fill:#10b981,color:#fff
    style H fill:#ef4444,color:#fff
```

**Règles impliquées** :
- `BR-ACPT-001` : Saisie montant → "Attente acompte"
- `BR-ACPT-002` : Date réception obligatoire
- `BR-ACPT-003` : Date saisie → "Accepté $"

---

## 🕐 Workflow 2 : Gestion Due Date → Check

```mermaid
graph TD
    A[Intervention créée] --> B{Statut VT ou EC?}
    B -->|Non| Z[Pas de vérification due date]
    B -->|Oui| C{Due date renseignée?}
    
    C -->|Non| D[🔒 BLOQUANT: Due date obligatoire]
    D --> C
    C -->|Oui| E[Enregistrement OK]
    
    E --> F[⏰ Job quotidien 00:00]
    
    F --> G{Due date dépassée?}
    G -->|Non| F
    G -->|Oui| H[⚙️ AUTO: Sauvegarder statut dans previous_statut_id]
    H --> I[⚙️ AUTO: Statut → Check]
    
    I --> J{Gestionnaire modifie date_termine?}
    J -->|Non| K[Reste en Check]
    J -->|Oui| L[⚙️ AUTO: Restaurer previous_statut_id]
    
    L --> M[✅ Retour à VT ou EC]
    
    style I fill:#f59e0b,color:#fff
    style D fill:#ef4444,color:#fff
    style L fill:#10b981,color:#fff
```

**Règles impliquées** :
- `BR-STAT-003` : Due date obligatoire pour VT/EC
- `BR-STAT-001` : Due date dépassée → "Check"
- `BR-STAT-002` : Modification date_termine → Retour au statut précédent

---

## 📝 Workflow 3 : Passage à "Devis envoyé"

```mermaid
graph TD
    A[Intervention au statut Demandé] --> B[Gestionnaire saisit ID devis]
    
    B --> C{ID devis renseigné?}
    C -->|Non| D[❌ Option Devis envoyé MASQUÉE dans menu]
    C -->|Oui| E[✅ Option Devis envoyé VISIBLE dans menu]
    
    E --> F[Gestionnaire : Clic droit → Devis envoyé]
    F --> G[✅ Statut → Devis envoyé]
    
    D --> H[🚫 Impossible de passer à Devis envoyé]
    
    style D fill:#ef4444,color:#fff
    style E fill:#10b981,color:#fff
    style G fill:#10b981,color:#fff
```

**Règles impliquées** :
- `BR-DEVI-001` : ID devis obligatoire avant "Devis envoyé"
- `BR-DEVI-002` : Pas d'automatisation

---

## 🔄 Workflow 4 : Duplication "Devis supp"

```mermaid
graph TD
    A[Intervention existante] --> B[Gestionnaire : Clic droit → Devis supp]
    
    B --> C[⚙️ Créer nouvelle intervention]
    
    C --> D[📋 Copier tous les champs]
    D --> E[❌ SAUF: id, id_inter, contexte, consigne]
    
    E --> F[🆕 Générer nouveau UUID]
    F --> G[🆕 Générer nouveau id_inter]
    G --> H[⚙️ Statut → Demandé par défaut]
    
    H --> I[💬 Ajouter commentaire:]
    I --> J[Devis supp avec l'ancien ID [id_inter]]
    
    J --> K[✅ Nouvelle intervention créée]
    
    style C fill:#10b981,color:#fff
    style E fill:#f59e0b,color:#fff
    style K fill:#10b981,color:#fff
```

**Règles impliquées** :
- `BR-DUP-001` : Exclusions et commentaire automatique

---

## 👷 Workflow 5 : Artisan Incomplet → Novice

```mermaid
graph TD
    A[Artisan avec statut dossier Incomplet] --> B[Admin modifie niveau → Novice]
    
    B --> C{Statut actuel = Incomplet?}
    C -->|Non| D[Pas de changement]
    C -->|Oui| E[⚙️ AUTO: Statut → À compléter]
    
    E --> F[✅ Artisan prêt à compléter dossier]
    
    style E fill:#10b981,color:#fff
```

**Règles impliquées** :
- `BR-ART-001` : Statut automatique si Incomplet + Novice

---

## 🏢 Workflow 6 : Référence agence obligatoire

```mermaid
graph TD
    A[Création intervention] --> B{Agence sélectionnée?}
    B -->|Non| C[🔒 BLOQUANT: Agence obligatoire]
    C --> B
    
    B -->|Oui| D{Agence = ImoDirect, AFEDIM ou Locoro?}
    D -->|Non| E[Référence agence optionnelle]
    D -->|Oui| F{Référence agence saisie?}
    
    F -->|Non| G[🔒 BLOQUANT: Référence obligatoire]
    G --> F
    F -->|Oui| H[✅ Enregistrement OK]
    
    E --> H
    
    style C fill:#ef4444,color:#fff
    style G fill:#ef4444,color:#fff
    style H fill:#10b981,color:#fff
```

**Règles impliquées** :
- `BR-AGN-001` : Référence obligatoire pour 3 agences

---

## 🗄️ Workflow 7 : Archivage avec commentaire

```mermaid
graph TD
    A[Artisan ou Intervention] --> B[Admin : Clic droit → Archiver]
    
    B --> C[📝 Pop-up modal s'ouvre]
    C --> D{Commentaire saisi?}
    
    D -->|Non| E[🔒 BLOQUANT: Bouton Valider désactivé]
    E --> D
    
    D -->|Oui| F[✅ Bouton Valider activé]
    F --> G[Clic sur Valider]
    
    G --> H[⚙️ Enregistrer:]
    H --> I[archived_at = NOW]
    I --> J[archived_by = current_user_id]
    J --> K[archived_reason = commentaire]
    K --> L[is_active = false]
    
    L --> M[✅ Entité archivée]
    
    style E fill:#ef4444,color:#fff
    style M fill:#10b981,color:#fff
```

**Règles impliquées** :
- `BR-ARC-001` : Commentaire obligatoire à l'archivage

---

## 🏠 Workflow 8 : Logement vacant - Champs conditionnels

```mermaid
graph TD
    A[Création/Édition intervention] --> B{Case Logement vacant cochée?}
    
    B -->|Non| C[Afficher champs standard:]
    C --> D[✅ Client tenant_id]
    D --> E[✅ Téléphone]
    
    B -->|Oui| F[Afficher champs spécifiques:]
    F --> G[✅ Information clef code]
    G --> H[✅ Étage]
    H --> I[✅ Numéro d'appartement]
    I --> J[✅ Contexte renforcé]
    
    E --> K[Masquer: info_clef, etage, numero_appartement]
    J --> L[Masquer: tenant_id, telephone]
    
    K --> M[✅ Enregistrement]
    L --> M
    
    style F fill:#3b82f6,color:#fff
    style C fill:#3b82f6,color:#fff
```

**Règles impliquées** :
- `BR-INT-003` : Champs conditionnels logement vacant

---

## 🔐 Workflow 9 : Validation IBAN (à cadrer)

```mermaid
graph TD
    A[Gestionnaire ouvre fiche artisan] --> B[Saisit IBAN]
    
    B --> C[⚙️ IBAN sauvegardé]
    C --> D[⚙️ iban_validated = false]
    
    D --> E[❓ Notification admin?]
    E -->|Option A| F[📧 Email admin]
    E -->|Option B| G[🔔 Notification in-app]
    E -->|Option C| H[📋 File d'attente avec badge]
    
    F --> I[Admin ouvre fiche]
    G --> I
    H --> I
    
    I --> J{IBAN valide?}
    J -->|Non| K[Admin refuse + commentaire]
    K --> L[⚠️ Gestionnaire notifié]
    
    J -->|Oui| M[Admin clique Valider IBAN]
    M --> N[⚙️ iban_validated = true]
    N --> O[⚙️ iban_validated_at = NOW]
    O --> P[⚙️ iban_validated_by = admin_id]
    
    P --> Q[✅ IBAN validé]
    
    style E fill:#f59e0b,color:#fff
    style Q fill:#10b981,color:#fff
```

**Règles impliquées** :
- `BR-ART-002` : IBAN - Saisie gestionnaire, validation admin

**⚠️ À CLARIFIER** : Choix du mode de notification (A, B ou C)

---

## 🎯 Workflow 10 : Champs obligatoires création intervention

```mermaid
graph TD
    A[Ouverture formulaire création] --> B[Remplissage formulaire]
    
    B --> C{Tous les champs obligatoires?}
    C -->|Non| D[❌ Afficher erreurs de validation]
    D --> E[🔴 Adresse manquante?]
    E --> F[🔴 Contexte manquant?]
    F --> G[🔴 Métier manquant?]
    G --> H[🔴 Statut manquant?]
    H --> I[🔴 Agence manquante?]
    
    I --> J[🔒 BLOQUANT: Bouton Créer désactivé]
    J --> B
    
    C -->|Oui| K[✅ Bouton Créer activé]
    K --> L[Clic sur Créer]
    L --> M[✅ Intervention créée]
    
    style J fill:#ef4444,color:#fff
    style M fill:#10b981,color:#fff
```

**Règles impliquées** :
- `BR-INT-001` : 5 champs obligatoires à la création

---

## 📊 Matrice de décision : Menus contextuels

### Interventions - Actions disponibles selon statut et données

| Action | Condition | Règle |
|--------|-----------|-------|
| **Ouvrir** | Toujours | - |
| **Ouvrir nouvel onglet** | Toujours | - |
| **Demandé → Devis envoyé** | `id_devis` renseigné ET `statut = Demandé` | BR-DEVI-001 |
| **Devis envoyé → Accepté** | `statut = Devis envoyé` | - |
| **Devis supp** | Toujours | BR-DUP-001 |

### Artisans - Actions disponibles

| Action | Condition | Règle |
|--------|-----------|-------|
| **Ouvrir fiche** | Toujours | - |
| **Modifier fiche** | Permissions suffisantes | - |
| **Archiver** | Pop-up avec motif obligatoire | BR-ARC-001 |

### Market / Carte - Actions disponibles

| Action | Condition | Règle |
|--------|-----------|-------|
| **Je gère** | Intervention non assignée | BR-PERM-001 |

---

## 🧪 Scénarios de test critiques

### Scénario 1 : Workflow acomptes complet
```
ÉTAPE 1 : Créer intervention statut "Accepté"
ÉTAPE 2 : Saisir montant_acompte_reclame = 500€
ATTENDU : Statut → "Attente acompte" ✅

ÉTAPE 3 : Cocher "Acompte reçu" SANS saisir date
ATTENDU : Erreur "Date obligatoire" 🔒

ÉTAPE 4 : Saisir date_reception_acompte = 05/11/2025
ATTENDU : Statut → "Accepté $" ✅
```

### Scénario 2 : Due date dépassée
```
ÉTAPE 1 : Créer intervention statut "VT", due_date = 01/01/2025
ÉTAPE 2 : Exécuter job de vérification
ATTENDU : Statut → "Check" + previous_statut_id = VT ✅

ÉTAPE 3 : Modifier date_termine = 31/12/2025
ATTENDU : Statut → "VT" (restauré) ✅
```

### Scénario 3 : Référence agence obligatoire
```
ÉTAPE 1 : Créer intervention, sélectionner agence "ImoDirect"
ÉTAPE 2 : Laisser référence_agence vide
ATTENDU : Erreur "Référence obligatoire" 🔒

ÉTAPE 3 : Saisir référence_agence = "REF-123"
ATTENDU : Enregistrement OK ✅
```

### Scénario 4 : Devis envoyé sans ID
```
ÉTAPE 1 : Créer intervention statut "Demandé", id_devis vide
ÉTAPE 2 : Clic droit sur intervention
ATTENDU : Option "Devis envoyé" MASQUÉE ❌

ÉTAPE 3 : Saisir id_devis = "DEV-456"
ÉTAPE 4 : Clic droit sur intervention
ATTENDU : Option "Devis envoyé" VISIBLE ✅
```

### Scénario 5 : Duplication devis supp
```
ÉTAPE 1 : Intervention existante avec contexte = "Urgence"
ÉTAPE 2 : Clic droit → "Devis supp"
ATTENDU : 
  - Nouveau id ✅
  - Nouveau id_inter ✅
  - contexte_intervention = NULL ✅
  - Commentaire "Devis supp avec l'ancien ID [xxx]" ✅
```

---

## 📈 Statistiques du livrable

### Règles métier par type
```
🔒 Bloquantes : 8 règles (44%)
⚙️ Automatiques : 9 règles (50%)
ℹ️ Informatives : 1 règle (6%)
━━━━━━━━━━━━━━━━━━━━━━
Total : 18 règles
```

### Tâches par complexité
```
🔴 Haute : 3 tâches (14%)
🟡 Moyenne : 10 tâches (48%)
🟢 Faible/Très faible : 8 tâches (38%)
━━━━━━━━━━━━━━━━━━━━━━
Total : 21 tâches
```

### Modifications BDD
```
Table interventions : +11 champs
Table intervention_payments : +3 champs
Table artisans : +7 champs
Nouveaux statuts : +2
━━━━━━━━━━━━━━━━━━━━━━
Total : 23 modifications
```

---

## 🔗 Navigation rapide

- 📋 [Résumé exécutif](RESUME_EXECUTIF_LIVRABLE_2025-11-04.md)
- 📜 [Règles métier détaillées](BUSINESS_RULES_2025-11-04.md)
- 📊 [Classification des tâches](ANALYSE_CLASSIFICATION_TACHES_2025-11-04.md)
- 📄 [Spécifications HTML source](../livrable-specs-interventions-artisans_2025-11-04.html)

---

**Dernière mise à jour** : 5 novembre 2025  
**Maintenu par** : Équipe Dev GMBS CRM  
**Version** : 1.0

