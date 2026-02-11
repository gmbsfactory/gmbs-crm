# 🚀 API CRM GMBS - Guide Complet

## Vue d'ensemble

Cette API complète et scalable permet de gérer toutes les opérations du CRM GMBS :
- **Interventions** : CRUD complet avec assignation d'artisans
- **Artisans** : Gestion complète avec métiers et zones
- **Documents** : Upload et gestion des fichiers
- **Commentaires** : Système de commentaires multi-entités
- **Coûts et Paiements** : Gestion financière des interventions

## 🏗️ Architecture

### Edge Functions Supabase
- `interventions-v2/` - API complète pour les interventions
- `artisans-v2/` - API complète pour les artisans  
- `documents/` - Gestion des documents et attachments
- `comments/` - Système de commentaires

### Client API Modulaire V2
- `src/lib/api/v2/` - Structure modulaire complète
- `src/lib/api/v2/index.ts` - Point d'entrée central
- `src/lib/api/v2/common/` - Types et utilitaires communs
- `src/lib/api/v2/usersApi.ts` - API utilisateurs
- `src/lib/api/v2/interventionsApi.ts` - API interventions
- `src/lib/api/v2/artisansApi.ts` - API artisans
- `src/lib/api/v2/clientsApi.ts` - API clients
- `src/lib/api/v2/tenantsApi.ts` - API locataires (tenants)
- `src/lib/api/v2/documentsApi.ts` - API documents
- `src/lib/api/v2/commentsApi.ts` - API commentaires
- `src/lib/api/v2/rolesApi.ts` - API rôles et permissions
- `src/lib/api/v2/utilsApi.ts` - Utilitaires généraux
- Types et interfaces complets
- Gestion d'erreurs robuste
- Pagination optimisée
- Architecture modulaire et maintenable

## 🏗️ Architecture Modulaire V2

### Structure des APIs
```
src/lib/api/v2/
├── index.ts                 # Point d'entrée central
├── common/
│   ├── types.ts            # Types et interfaces communs
│   └── utils.ts            # Utilitaires partagés
├── usersApi.ts             # Gestion des utilisateurs
├── interventionsApi.ts     # Gestion des interventions
├── artisansApi.ts          # Gestion des artisans
├── clientsApi.ts           # Gestion des clients
├── tenantsApi.ts           # Gestion des locataires (tenants)
├── documentsApi.ts         # Gestion des documents
├── commentsApi.ts          # Gestion des commentaires
├── rolesApi.ts             # Gestion des rôles et permissions
└── utilsApi.ts             # Utilitaires généraux
```

### Avantages de l'Architecture Modulaire
- **Maintenabilité** : Code organisé par domaine métier
- **Réutilisabilité** : APIs spécialisées et composables
- **Testabilité** : Tests unitaires plus faciles
- **Performance** : Import sélectif des fonctionnalités
- **Évolutivité** : Ajout de nouvelles APIs sans impact

### Utilisation
```typescript
// Import sélectif
import { usersApi, interventionsApi } from '@/lib/api/v2';

// Import complet
import { usersApi, interventionsApi, artisansApi } from '@/lib/api/v2';

// Import avec alias (compatibilité)
import { usersApiV2, interventionsApiV2 } from '@/lib/api/v2';
```

## 🚀 Démarrage Rapide

### 1. Démarrer Supabase
```bash
# Ou avec Supabase CLI
supabase start
```

### 2. Tester l'API
```bash
# Lancer le test complet
npm run test:api

# Voir l'aide
npm run test:api:help
```

### 3. Utiliser l'API dans votre code
```typescript
import { 
  interventionsApiV2, 
  artisansApiV2, 
  documentsApi, 
  commentsApi 
} from '@/lib/supabase-api-v2';

// Créer une intervention
const intervention = await interventionsApiV2.create({
  date: new Date().toISOString(),
  contexte_intervention: 'Réparation urgente',
  adresse: '123 Rue de la Paix',
  ville: 'Paris'
});

// Assigner un artisan
await interventionsApiV2.assignArtisan(intervention.id, artisanId, 'primary');

// Ajouter un commentaire
await commentsApi.create({
  entity_id: intervention.id,
  entity_type: 'intervention',
  content: 'Intervention prioritaire',
  comment_type: 'urgent'
});
```

## 📋 Fonctionnalités Détaillées

### 🔧 Interventions API

#### Créer une intervention
```typescript
const intervention = await interventionsApiV2.create({
  date: '2024-01-15T10:00:00Z',
  contexte_intervention: 'Réparation plomberie',
  adresse: '123 Rue de la Paix',
  ville: 'Paris',
  code_postal: '75001',
  latitude: 48.8566,
  longitude: 2.3522
});
```

#### Récupérer avec relations
```typescript
const intervention = await interventionsApiV2.getById(interventionId, [
  'agencies',
  'clients', 
  'users',
  'statuses',
  'metiers',
  'artisans',
  'costs',
  'payments',
  'attachments',
  'comments'
]);
```

#### Assigner un artisan
```typescript
await interventionsApiV2.assignArtisan(interventionId, artisanId, 'primary');
```

#### Ajouter des coûts
```typescript
await interventionsApiV2.addCost(interventionId, {
  cost_type: 'intervention',
  label: 'Main d\'œuvre',
  amount: 150.00,
  currency: 'EUR'
});
```

#### Ajouter des paiements
```typescript
await interventionsApiV2.addPayment(interventionId, {
  payment_type: 'acompte',
  amount: 75.00,
  currency: 'EUR',
  is_received: true,
  reference: 'PAY123'
});
```

#### Compter les interventions (pour pastilles/badges)
```typescript
// Compter toutes les interventions
const total = await getInterventionTotalCount();

// Compter avec filtres
const count = await getInterventionTotalCount({
  statut: ['status-uuid-1', 'status-uuid-2'], // Filtrer par statuts
  agence: 'agency-uuid',                       // Filtrer par agence
  user: 'user-uuid',                           // Filtrer par utilisateur assigné
  startDate: '2024-01-01T00:00:00.000Z',      // Date de début
  endDate: '2024-02-01T00:00:00.000Z',        // Date de fin
  search: 'Andrea'                             // Recherche dans contexte_intervention
});

// Obtenir les comptages par statut (pour pastilles de vues)
const statusCounts = await getInterventionCounts({
  user: 'user-uuid',           // Optionnel: filtrer par utilisateur
  agence: 'agency-uuid',       // Optionnel: filtrer par agence
  startDate: '2024-01-01',     // Optionnel: date de début
  endDate: '2024-02-01'        // Optionnel: date de fin
});
// Retourne: { 'status-uuid-1': 42, 'status-uuid-2': 17, ... }
```

**Note** : Ces fonctions optimisées récupèrent uniquement le comptage sans charger les données, idéales pour afficher les totaux réels dans les badges/pastilles des vues.

### 👷 Artisans API

#### Créer un artisan
```typescript
const artisan = await artisansApiV2.create({
  prenom: 'Jean',
  nom: 'Dupont',
  telephone: '0123456789',
  email: 'jean.dupont@example.com',
  raison_sociale: 'SARL Dupont',
  siret: '12345678901234',
  metiers: [metierId1, metierId2],
  zones: [zoneId1]
});
```

#### Assigner des métiers et zones
```typescript
await artisansApiV2.assignMetier(artisanId, metierId, true); // primaire
await artisansApiV2.assignZone(artisanId, zoneId);
```

### 🏠 Tenants API (Locataires)

#### Créer un tenant
```typescript
const tenant = await tenantsApi.create({
  firstname: 'Thomas',
  lastname: 'Germanaud',
  email: 'thomas.germanaud@example.com',
  telephone: '0632148492',
  telephone2: '0642507988',
  adresse: '123 Rue de la République',
  ville: 'Paris',
  code_postal: '75001'
});
```

#### Rechercher des tenants
```typescript
// Par nom
const tenants = await tenantsApi.searchByName('Germanaud');

// Par email
const tenants = await tenantsApi.searchByEmail('thomas.germanaud@example.com');

// Par téléphone
const tenants = await tenantsApi.searchByPhone('0632148492');

// Recherche globale avec pagination
const results = await tenantsApi.getAll({
  search: 'Thomas',
  limit: 20,
  offset: 0,
  sortBy: 'created_at',
  sortOrder: 'desc',
  paginated: true
});
```

#### Récupérer un tenant
```typescript
// Par ID
const tenant = await tenantsApi.getById(tenantId);

// Par référence externe
const tenant = await tenantsApi.getByExternalRef('REF-12345');
```

#### Mettre à jour un tenant
```typescript
const updated = await tenantsApi.update(tenantId, {
  email: 'nouveau.email@example.com',
  telephone: '0612345678'
});
```

#### Créer en masse (bulk)
```typescript
const results = await tenantsApi.createBulk([
  { firstname: 'Jean', lastname: 'Dupont', email: 'jean@example.com' },
  { firstname: 'Marie', lastname: 'Martin', email: 'marie@example.com' }
]);
console.log(`${results.success} tenants créés, ${results.errors} erreurs`);
```

#### Statistiques
```typescript
const stats = await tenantsApi.getStats();
// { total: 150, withEmail: 120, withPhone: 145 }
```

**Note** : Les tenants sont automatiquement extraits et créés lors de l'import des interventions depuis Google Sheets. Le système parse intelligemment les colonnes 'Locataire', 'Em@ail Locataire' et 'TEL LOC' pour extraire les informations (nom, prénom, email, téléphones).

### 📄 Documents API

#### Upload d'un document
```typescript
const document = await documentsApi.upload({
  entity_id: interventionId,
  entity_type: 'intervention',
  kind: 'devis',
  filename: 'devis-2024.pdf',
  mime_type: 'application/pdf',
  file_size: 1024000,
  content: base64Content
});
```

#### Types de documents supportés
- **Interventions** : devis, photos, facture_gmbs, facture_artisan, facture_materiel, rapport_intervention, plan, schema, autre
- **Artisans** : certificat, assurance, siret, kbis, photo_profil, portfolio, autre

### 💬 Commentaires API

#### Créer un commentaire
```typescript
const comment = await commentsApi.create({
  entity_id: interventionId,
  entity_type: 'intervention',
  content: 'Intervention prioritaire - client VIP',
  comment_type: 'urgent',
  is_internal: true,
  author_id: userId
});
```

#### Types de commentaires
- general, technique, commercial, interne, client, artisan, urgent, suivi

## 🧪 Tests

### Test Complet Automatisé
Le script `test-api-complete.js` teste le workflow complet :

1. ✅ **Création d'un artisan**
2. ✅ **Création d'une intervention**  
3. ✅ **Assignation de l'artisan**
4. ✅ **Ajout d'un commentaire**
5. ✅ **Upload d'un document**
6. ✅ **Ajout d'un coût**
7. ✅ **Ajout d'un paiement**
8. ✅ **Modification de l'intervention**
9. ✅ **Suppression (soft delete)**
10. ✅ **Récupération des données**

### Lancer les tests
```bash
# Test complet
npm run test:api

# Aide
npm run test:api:help
```

## 📊 Scripts d'Import

### Google Sheets Import (Version Modulaire V2)
- `scripts/imports/google-sheets-import-clean-v2.js` - Script principal d'import V2
- `scripts/imports/database/database-manager-v2.js` - Gestionnaire de base de données V2
- `scripts/imports/google-sheets/google-sheets-importer.js` - Importateur Google Sheets
- `scripts/imports/processors/data-processor.js` - Processeur de données
- `scripts/imports/validators/data-validator.js` - Validateur de données
- `scripts/imports/mappers/data-mapper.js` - Mappeur de données
- `scripts/imports/utils/error-reporter.js` - Rapporteur d'erreurs
- `scripts/imports/utils/progress-tracker.js` - Suivi de progression
- `scripts/imports/config/config-manager.js` - Gestionnaire de configuration

### Google Sheets Import (Version Legacy)
- `scripts/imports/google-sheets-import-clean.js` - Script principal d'import (legacy)
- `scripts/imports/database/database-manager-clean.js` - Gestionnaire de base de données (legacy)

### Utilisation des Scripts V2
```bash
# Import complet avec API modulaire
node scripts/imports/google-sheets-import-clean-v2.js

# Import avec options
node scripts/imports/google-sheets-import-clean-v2.js --dry-run --verbose

# Import sélectif
node scripts/imports/google-sheets-import-clean-v2.js --artisans-only
node scripts/imports/google-sheets-import-clean-v2.js --interventions-only
node scripts/imports/google-sheets-import-clean-v2.js --clients-only
node scripts/imports/google-sheets-import-clean-v2.js --documents-only

# Tests de connexion et configuration
node scripts/imports/google-sheets-import-clean-v2.js --test-connection
node scripts/imports/google-sheets-import-clean-v2.js --validate-config
```

### Avantages de la Version V2
- **API Modulaire** : Utilise la nouvelle structure `src/lib/api/v2/`
- **Meilleure Gestion d'Erreurs** : Messages d'erreur plus détaillés
- **Performance Améliorée** : Traitement par lots optimisé
- **Maintenabilité** : Code plus organisé et modulaire
- **Compatibilité** : Alias pour la rétrocompatibilité
- **Extraction Automatique des Tenants** : Parse et crée les locataires depuis les interventions

### Import Automatique des Tenants
Le script V2 extrait automatiquement les informations des locataires (tenants) depuis les interventions :

**Colonnes sources** :
- `Locataire` : Nom et prénom du locataire
- `Em@ail Locataire` : Email du locataire
- `TEL LOC` : Téléphone(s) du locataire

**Parsing intelligent** :
- Gère les civilités (M., Monsieur, Madame, Mme, Mlle)
- Détecte les formats mixtes (DUPONT Jean, Jean DUPONT)
- Extrait plusieurs numéros de téléphone
- Normalise les emails
- Gère les données manquantes ou mélangées

**Exemple de parsing** :
```
Input: "M THOMAS GERMANAUD 0632148492 / 06 42 50 79 88 conjointe"
Output:
  - Prénom: Thomas
  - Nom: Germanaud
  - Téléphone 1: 0632148492
  - Téléphone 2: 0642507988
```

**Déduplication** :
- Les tenants sont dédupliqués par email ou téléphone
- Un seul tenant créé par combinaison unique
- Insertion en masse optimisée

## 🔧 Configuration

### Variables d'environnement
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Déploiement des Edge Functions
```bash
# Déployer toutes les fonctions
npm run deploy:all

# Déployer individuellement
npm run deploy:interventions
npm run deploy:artisans
npm run deploy:documents
npm run deploy:comments
```

## 📊 Monitoring et Logs

Toutes les Edge Functions incluent :
- ✅ Logs structurés JSON
- ✅ Métriques de performance
- ✅ Gestion d'erreurs robuste
- ✅ IDs de requête pour le tracing
- ✅ Temps de réponse

## 🔒 Sécurité

- ✅ Validation des données d'entrée
- ✅ Authentification via Supabase
- ✅ Autorisation par rôles
- ✅ Soft delete pour la récupération
- ✅ Validation des types MIME

## 🚀 Performance

- ✅ Pagination optimisée
- ✅ Requêtes sélectives
- ✅ Cache intelligent
- ✅ Compression des réponses
- ✅ Gestion des timeouts

## 📈 Évolutivité

L'API est conçue pour être scalable :
- ✅ Architecture modulaire
- ✅ Edge Functions distribuées
- ✅ Base de données optimisée
- ✅ Gestion des relations efficaces
- ✅ Support des gros volumes

## 🎯 Statuts d'intervention (Mise à jour 2025-10-23)

- `interventionsApi.getAll()` retourne désormais chaque intervention avec la relation `status` jointe (`id`, `code`, `label`, `color`, `sort_order`)
- `interventionsApi.update()` et `interventionsApi.updateStatus()` renvoient l'objet enrichi avec `status`
- `interventionsApi.getAllStatuses()` offre la liste complète des statuts triés par `sort_order`
- `interventionsApi.getStatusByCode()` et `interventionsApi.getStatusByLabel()` simplifient la résolution d'UUID à partir d'un code ou d'un label
- Préférez l'utilisation de `statut_id` (UUID) pour les mises à jour ; les codes restent disponibles pour compatibilité

## 🆘 Support

En cas de problème :
1. Vérifiez les logs des Edge Functions
2. Testez avec `npm run test:api`
3. Vérifiez la connexion Supabase
4. Consultez la documentation Supabase

## 📝 Changelog

### Version 1.0.0
- ✅ API complète pour interventions
- ✅ API complète pour artisans
- ✅ Système de documents
- ✅ Système de commentaires
- ✅ Tests automatisés
- ✅ Documentation complète

---

**🎉 L'API CRM GMBS est prête pour la production !**
