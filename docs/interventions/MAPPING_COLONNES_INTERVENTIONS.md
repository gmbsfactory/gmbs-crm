# Mapping des colonnes Interventions - Référence complète

**Date**: 5 novembre 2025  
**Contexte**: Correction du mapping après migration vers cursor-based pagination  
**Schéma de référence**: `supabase/migrations/20251005_clean_schema.sql`

---

## 📋 Table des matières

1. [Problème identifié](#problème-identifié)
2. [Colonnes réelles de la table interventions](#colonnes-réelles-de-la-table-interventions)
3. [Colonnes obsolètes et leur nouvelle localisation](#colonnes-obsolètes-et-leur-nouvelle-localisation)
4. [Mapping des propriétés de la vue](#mapping-des-propriétés-de-la-vue)
5. [Champs dérivés ignorés lors du SELECT](#champs-dérivés-ignorés-lors-du-select)

---

## 🔴 Problème identifié

### Symptômes

Erreurs HTTP 500 lors du chargement des interventions :
```
Database error: column interventions.artisan does not exist
Database error: column interventions.cout_intervention does not exist
Database error: column interventions.client_id does not exist
```

### Cause racine

Le `PROPERTY_COLUMN_MAP` dans `src/lib/supabase-api-v2.ts` contenait **98 mappings** dont une grande partie pointait vers des colonnes qui **n'existent plus** dans la table `interventions` depuis la refonte du schéma (migration `20251005_clean_schema.sql`).

Lors de l'implémentation du scroll infini avec cursor-pagination, la fonction `resolveSelectColumns` envoyait ces colonnes inexistantes dans la clause SELECT SQL, causant des erreurs 500.

### Solution appliquée

1. ✅ Nettoyage du `PROPERTY_COLUMN_MAP` : conservé uniquement les colonnes réelles
2. ✅ Création de `DERIVED_VIEW_FIELDS` : liste exhaustive des champs calculés à ignorer
3. ✅ Création de `VALID_INTERVENTION_COLUMNS` : whitelist stricte des colonnes autorisées
4. ✅ Sécurisation de `resolveColumn` : triple vérification (dérivé → mapping → whitelist)

---

## ✅ Colonnes réelles de la table `interventions`

**Total : 24 colonnes**

### Identifiants (3 colonnes)
| Colonne SQL | Type | Description |
|-------------|------|-------------|
| `id` | uuid | Identifiant unique (PK) |
| `id_inter` | text | Identifiant métier (UNIQUE) |
| `created_at` | timestamptz | Date de création |
| `updated_at` | timestamptz | Date de dernière modification |

### Relations / Foreign Keys (6 colonnes)
| Colonne SQL | Type | Table liée | Description |
|-------------|------|------------|-------------|
| `agence_id` | uuid | `agencies` | Agence cliente |
| `tenant_id` | uuid | `tenants` | Locataire (anciennement client_id) |
| `owner_id` | uuid | `owner` | Propriétaire |
| `assigned_user_id` | uuid | `users` | Utilisateur assigné (gestionnaire) |
| `statut_id` | uuid | `intervention_statuses` | Statut de l'intervention |
| `metier_id` | uuid | `metiers` | Métier/Trade |

### Dates (4 colonnes)
| Colonne SQL | Type | Description |
|-------------|------|-------------|
| `date` | timestamptz | Date de l'intervention (NOT NULL) |
| `date_termine` | timestamptz | Date de fin |
| `date_prevue` | timestamptz | Date prévue |
| `due_date` | timestamptz | Date d'échéance |

### Informations texte (4 colonnes)
| Colonne SQL | Type | Description |
|-------------|------|-------------|
| `contexte_intervention` | text | Contexte/description |
| `consigne_intervention` | text | Consignes pour l'artisan principal |
| `consigne_second_artisan` | text | Consignes pour le second artisan |
| `commentaire_agent` | text | Commentaire de l'agent |

### Localisation (6 colonnes)
| Colonne SQL | Type | Description |
|-------------|------|-------------|
| `adresse` | text | Adresse complète |
| `code_postal` | text | Code postal |
| `ville` | text | Ville |
| `latitude` | numeric(9,6) | Latitude GPS |
| `longitude` | numeric(9,6) | Longitude GPS |

### État (1 colonne)
| Colonne SQL | Type | Description |
|-------------|------|-------------|
| `is_active` | boolean | Intervention active (soft delete) |

---

## ❌ Colonnes obsolètes et leur nouvelle localisation

Ces colonnes **N'EXISTENT PLUS** dans la table `interventions` depuis la migration `20251005_clean_schema.sql`.

### 🎨 Artisans → Table `intervention_artisans`

| Ancienne colonne | Nouvelle localisation | Accès |
|------------------|----------------------|-------|
| `artisan` | `intervention_artisans.artisan_id` | Jointure + lookup dans `artisans.plain_nom` |
| `deuxieme_artisan` | `intervention_artisans` (role='secondary') | Jointure avec `is_primary=false` |

**Requête exemple** :
```sql
SELECT i.*, 
       ia.artisan_id,
       a.plain_nom as artisan_nom
FROM interventions i
LEFT JOIN intervention_artisans ia ON ia.intervention_id = i.id AND ia.is_primary = true
LEFT JOIN artisans a ON a.id = ia.artisan_id
```

### 💰 Coûts → Table `intervention_costs`

| Ancienne colonne | Nouvelle localisation | Accès |
|------------------|----------------------|-------|
| `cout_intervention` | `intervention_costs` (cost_type='intervention') | Jointure + SUM(amount) |
| `cout_sst` | `intervention_costs` (cost_type='sst') | Jointure + SUM(amount) |
| `cout_materiel` | `intervention_costs` (cost_type='materiel') | Jointure + SUM(amount) |
| `marge` | **Calculé** | `cout_intervention - (cout_sst + cout_materiel)` |

**Requête exemple** :
```sql
SELECT i.*,
       (SELECT amount FROM intervention_costs WHERE intervention_id = i.id AND cost_type = 'intervention') as cout_intervention,
       (SELECT amount FROM intervention_costs WHERE intervention_id = i.id AND cost_type = 'sst') as cout_sst,
       (SELECT amount FROM intervention_costs WHERE intervention_id = i.id AND cost_type = 'materiel') as cout_materiel
FROM interventions i
```

### 👤 Données client → Table `tenants`

| Ancienne colonne | Nouvelle localisation | Accès |
|------------------|----------------------|-------|
| `nom_client` | `tenants.lastname` | Jointure via `tenant_id` |
| `prenom_client` | `tenants.firstname` | Jointure via `tenant_id` |
| `email_client` | `tenants.email` | Jointure via `tenant_id` |
| `telephone_client` | `tenants.telephone` | Jointure via `tenant_id` |
| `telephone2_client` | `tenants.telephone2` | Jointure via `tenant_id` |

**Requête exemple** :
```sql
SELECT i.*, 
       t.firstname as prenom_client,
       t.lastname as nom_client,
       t.email as email_client,
       t.telephone as telephone_client
FROM interventions i
LEFT JOIN tenants t ON t.id = i.tenant_id
```

### 🏠 Données propriétaire → Table `owner`

| Ancienne colonne | Nouvelle localisation | Accès |
|------------------|----------------------|-------|
| `nom_proprietaire` | `owner.owner_lastname` | Jointure via `owner_id` |
| `prenom_proprietaire` | `owner.owner_firstname` | Jointure via `owner_id` |
| `email_proprietaire` | `owner.email` | Jointure via `owner_id` |
| `telephone_proprietaire` | `owner.telephone` | Jointure via `owner_id` |

**Requête exemple** :
```sql
SELECT i.*, 
       o.owner_firstname as prenom_proprietaire,
       o.owner_lastname as nom_proprietaire,
       o.email as email_proprietaire,
       o.telephone as telephone_proprietaire
FROM interventions i
LEFT JOIN owner o ON o.id = i.owner_id
```

### 📎 Pièces jointes → Table `intervention_attachments`

| Ancienne colonne | Nouvelle localisation | Accès |
|------------------|----------------------|-------|
| `piece_jointe_intervention` | `intervention_attachments` (kind='intervention') | Jointure + GROUP |
| `piece_jointe_cout` | `intervention_attachments` (kind='cout') | Jointure + GROUP |
| `piece_jointe_devis` | `intervention_attachments` (kind='devis') | Jointure + GROUP |
| `piece_jointe_photos` | `intervention_attachments` (kind='photos') | Jointure + GROUP |
| `piece_jointe_facture_gmbs` | `intervention_attachments` (kind='factureGMBS') | Jointure + GROUP |
| `piece_jointe_facture_artisan` | `intervention_attachments` (kind='factureArtisan') | Jointure + GROUP |
| `piece_jointe_facture_materiel` | `intervention_attachments` (kind='factureMateriel') | Jointure + GROUP |

**Requête exemple** :
```sql
SELECT i.*,
       ARRAY_AGG(ia.url) FILTER (WHERE ia.kind = 'photos') as photos
FROM interventions i
LEFT JOIN intervention_attachments ia ON ia.intervention_id = i.id
GROUP BY i.id
```

### 🗑️ Colonnes complètement supprimées

Ces colonnes n'existent plus nulle part dans le nouveau schéma :

| Ancienne colonne | Raison de la suppression |
|------------------|--------------------------|
| `date_prevue_deuxieme_artisan` | Modèle simplifié, utiliser `intervention_artisans` |
| `type_deuxieme_artisan` | Modèle simplifié, utiliser `intervention_artisans` |
| `numero_sst` | Fonctionnalité non utilisée |
| `pourcentage_sst` | Fonctionnalité non utilisée |
| `demande_intervention` | Fonctionnalité non utilisée |
| `demande_devis` | Fonctionnalité non utilisée |
| `demande_trust_pilot` | Fonctionnalité non utilisée |
| `tel_loc` | Redondant avec données locataire |
| `locataire` | Redondant avec données locataire |
| `email_locataire` | Redondant avec données locataire |
| `devis_id` | Fonctionnalité non utilisée |
| `numero_associe` | Fonctionnalité non utilisée |
| `type` | Remplacé par `metier_id` |

---

## 🗺️ Mapping des propriétés de la vue

Ce mapping est utilisé dans `src/lib/supabase-api-v2.ts` pour convertir les noms de propriétés de l'interface TypeScript vers les colonnes SQL réelles.

### Identifiants
```typescript
id          → id
id_inter    → id_inter
idInter     → id_inter
```

### Relations
```typescript
// Statut
statusValue → statut_id
statut      → statut_id
statut_id   → statut_id

// User
attribueA         → assigned_user_id
assigned_user_id  → assigned_user_id
assignedUserName  → assigned_user_id
assignedUserId    → assigned_user_id

// Agence
agence       → agence_id
agence_id    → agence_id
agenceLabel  → agence_id

// Métier
metier     → metier_id
metier_id  → metier_id

// Client (⚠️ renommé en tenant)
clientId   → tenant_id
client_id  → tenant_id
tenantId   → tenant_id
tenant_id  → tenant_id

// Propriétaire
ownerId  → owner_id
owner_id → owner_id
```

### Dates
```typescript
date                → date
dateIntervention    → date
date_intervention   → date
dateTermine         → date_termine
date_termine        → date_termine
datePrevue          → date_prevue
date_prevue         → date_prevue
dueDate             → due_date
due_date            → due_date
created_at          → created_at
createdAt           → created_at
updated_at          → updated_at
updatedAt           → updated_at
```

### Champs texte
```typescript
contexteIntervention                 → contexte_intervention
contexte_intervention                → contexte_intervention
consigneIntervention                 → consigne_intervention
consigne_intervention                → consigne_intervention
consigneDeuxiemeArtisanIntervention  → consigne_second_artisan
consigneSecondArtisan                → consigne_second_artisan
consigne_second_artisan              → consigne_second_artisan
commentaireAgent                     → commentaire_agent
commentaire_agent                    → commentaire_agent
commentaire                          → commentaire_agent
```

### Localisation
```typescript
adresse           → adresse
ville             → ville
codePostal        → code_postal
code_postal       → code_postal
latitude          → latitude
longitude         → longitude
latitudeAdresse   → latitude
longitudeAdresse  → longitude
```

### État
```typescript
isActive   → is_active
is_active  → is_active
```

---

## 🚫 Champs dérivés ignorés lors du SELECT

Ces champs sont **automatiquement filtrés** par `resolveSelectColumns()` car ils ne correspondent à aucune colonne SQL. Ils sont calculés/enrichis **après** le fetch, dans la fonction `mapInterventionRecord()`.

### Artisans (depuis `intervention_artisans`)
- `artisan`
- `artisans`
- `primaryArtisan`
- `deuxiemeArtisan`

### Statut enrichi (depuis `intervention_statuses`)
- `status`
- `statusLabel`
- `statusColor`

### User enrichi (depuis `users`)
- `assignedUserColor`
- `assignedUserCode`

### Relations
- `payments`
- `costs`
- `attachments`
- `comments`

### Coûts (depuis `intervention_costs`)
- `coutIntervention` / `cout_intervention`
- `coutSST` / `cout_sst`
- `coutMateriel` / `cout_materiel`
- `marge` (calculé)

### Données client (depuis `tenants`)
- `nomClient` / `nom_client`
- `prenomClient` / `prenom_client`
- `telephoneClient` / `telephone_client`
- `telephone2Client` / `telephone2_client`
- `emailClient` / `email_client`

### Données propriétaire (depuis `owner`)
- `nomProprietaire` / `nom_proprietaire`
- `prenomProprietaire` / `prenom_proprietaire`
- `telephoneProprietaire` / `telephone_proprietaire`
- `emailProprietaire` / `email_proprietaire`

### Pièces jointes (depuis `intervention_attachments`)
- `pieceJointeIntervention` / `piece_jointe_intervention`
- `pieceJointeCout` / `piece_jointe_cout`
- `pieceJointeDevis` / `piece_jointe_devis`
- `pieceJointePhotos` / `piece_jointe_photos`
- `pieceJointeFactureGMBS` / `piece_jointe_facture_gmbs`
- `pieceJointeFactureArtisan` / `piece_jointe_facture_artisan`
- `pieceJointeFactureMateriel` / `piece_jointe_facture_materiel`

### Champs obsolètes/supprimés
- `datePrevueDeuxiemeArtisan` / `date_prevue_deuxieme_artisan`
- `typeDeuxiemeArtisan` / `type_deuxieme_artisan`
- `numeroSST` / `numero_sst`
- `pourcentageSST` / `pourcentage_sst`
- `demandeIntervention` / `demande_intervention`
- `demandeDevis` / `demande_devis`
- `demandeTrustPilot` / `demande_trust_pilot`
- `telLoc` / `tel_loc`
- `locataire`
- `emailLocataire` / `email_locataire`
- `devisId` / `devis_id`
- `numeroAssocie` / `numero_associe`
- `type`

---

## 🔧 Comment enrichir les données

Si vous avez besoin d'afficher des données qui ne sont plus dans la table `interventions` (artisan, coûts, client, etc.), vous avez **deux options** :

### Option 1 : Edge Function avec jointures (recommandé pour les listes)

Modifier `supabase/functions/interventions-v2/index.ts` pour ajouter les jointures nécessaires :

```typescript
const selectClause = `
  ${baseColumns},
  tenants:tenant_id(firstname,lastname,email,telephone),
  intervention_artisans!inner(
    artisan_id,
    is_primary,
    artisans(id,plain_nom,nom,prenom)
  ),
  intervention_costs(cost_type,amount)
`;

const { data, error } = await supabase
  .from('interventions')
  .select(selectClause);
```

### Option 2 : Fetch séparé (pour les vues détail)

```typescript
// 1. Récupérer l'intervention
const intervention = await interventionsApiV2.getById(id);

// 2. Récupérer les données liées si nécessaire
const artisans = await supabase
  .from('intervention_artisans')
  .select('*, artisans(*)')
  .eq('intervention_id', id);

const costs = await supabase
  .from('intervention_costs')
  .select('*')
  .eq('intervention_id', id);
```

---

## 📝 Checklist de migration

Si vous ajoutez une nouvelle colonne à la vue Interventions :

- [ ] La colonne existe-t-elle dans `public.interventions` ?
  - ✅ Oui → Ajouter à `PROPERTY_COLUMN_MAP` et `DEFAULT_INTERVENTION_COLUMNS`
  - ❌ Non → Ajouter à `DERIVED_VIEW_FIELDS` et implémenter l'enrichissement dans `mapInterventionRecord()`

- [ ] Mettre à jour ce document avec la nouvelle colonne

- [ ] Tester que le SELECT SQL ne génère pas d'erreur 500

---

## 🔗 Fichiers concernés

| Fichier | Rôle |
|---------|------|
| `src/lib/supabase-api-v2.ts` | Mapping, filtrage, résolution des colonnes |
| `supabase/functions/interventions-v2/index.ts` | Edge function qui exécute les requêtes SQL |
| `supabase/migrations/20251005_clean_schema.sql` | Schéma de référence de la base de données |
| `src/types/intervention.ts` | Types TypeScript de l'interface |

---

**Dernière mise à jour** : 5 novembre 2025  
**Auteur** : Correction automatique après erreurs 500 cursor-pagination

