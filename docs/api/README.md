# 🚀 API V2 - Documentation Complète

## 📋 Vue d'ensemble

L'API V2 est l'interface principale pour interagir avec le backend GMBS CRM. Elle a été refactorisée en architecture modulaire pour améliorer la maintenabilité et la lisibilité du code.

## 📁 Structure des fichiers

```
src/lib/api/v2/
├── common/
│   ├── types.ts          # Types TypeScript communs
│   ├── constants.ts      # Constantes partagées
│   ├── utils.ts          # Utilitaires partagés
│   └── cache.ts          # Cache centralisé (Singleton)
├── interventionsApi.ts   # Gestion des interventions
├── artisansApi.ts        # Gestion des artisans
├── usersApi.ts           # Gestion des utilisateurs
├── clientsApi.ts         # Gestion des clients
├── tenantsApi.ts         # Gestion des locataires
├── ownersApi.ts          # Gestion des propriétaires
├── documentsApi.ts       # Gestion des documents
├── commentsApi.ts        # Gestion des commentaires
├── rolesApi.ts           # Gestion des rôles et permissions
├── agenciesApi.ts        # Gestion des agences
├── enumsApi.ts           # Gestion des énumérations
├── reminders.ts          # Gestion des rappels
├── utilsApi.ts           # Utilitaires avancés
└── index.ts              # Point d'entrée central
```

## 📥 Imports Recommandés

```typescript
// ✅ Import standard (recommandé)
import { 
  interventionsApi,
  artisansApi,
  documentsApi,
  commentsApi,
  type Intervention,
  type Artisan 
} from '@/lib/api/v2';

// ✅ Import avec alias V2 (compatibilité)
import { 
  interventionsApiV2,
  artisansApiV2
} from '@/lib/api/v2';

// ✅ Import des hooks personnalisés
import { useInterventionsQuery } from '@/hooks/useInterventionsQuery';
import { useArtisans } from '@/hooks/useArtisans';
```

### ⚠️ Import Déprécié

```typescript
// ❌ DÉPRÉCIÉ - Ne plus utiliser ce chemin
import { interventionsApiV2 } from '@/lib/supabase-api-v2';

// ✅ NOUVEAU - Utiliser ce chemin
import { interventionsApiV2 } from '@/lib/api/v2';
```

---

## 📚 APIs Disponibles

### 🔧 Interventions API (`interventionsApi`)

#### Méthodes principales
| Méthode | Description |
|---------|-------------|
| `getAll(params?)` | Récupérer les interventions avec pagination et filtres |
| `getById(id)` | Récupérer une intervention par ID |
| `create(data)` | Créer une intervention |
| `update(id, data)` | Modifier une intervention |
| `delete(id)` | Supprimer une intervention (soft delete) |
| `assignArtisan(id, artisanId, role)` | Assigner un artisan |

#### Méthodes de comptage
| Méthode | Description |
|---------|-------------|
| `getTotalCount()` | Nombre total d'interventions |
| `getTotalCountWithFilters(params?)` | Nombre d'interventions avec filtres |
| `getCountsByStatus(params?)` | Comptages par statut |
| `getDistinctValues(column, params?)` | Valeurs distinctes d'une colonne |

#### Exemple
```typescript
import { interventionsApi, type InterventionQueryParams } from '@/lib/api/v2';

// Récupérer les interventions filtrées
const params: InterventionQueryParams = {
  limit: 50,
  statut: 'DEMANDE',
  startDate: '2025-01-01'
};

const result = await interventionsApi.getAll(params);
console.log(result.data, result.pagination);

// Compter avec filtres
const count = await interventionsApi.getTotalCountWithFilters({
  statuts: ['EN_COURS', 'DEMANDE'],
  user: 'user-uuid'
});
console.log(`${count} interventions trouvées`);

// Comptages par statut
const statusCounts = await interventionsApi.getCountsByStatus({ user: 'user-uuid' });
console.log(statusCounts); // { "status-uuid-1": 45, "status-uuid-2": 12 }
```

---

### 👷 Artisans API (`artisansApi`)

#### Méthodes principales
| Méthode | Description |
|---------|-------------|
| `getAll(params?)` | Récupérer les artisans avec pagination et filtres |
| `getById(id)` | Récupérer un artisan par ID |
| `create(data)` | Créer un artisan |
| `update(id, data)` | Modifier un artisan |
| `delete(id)` | Supprimer un artisan (soft delete) |
| `assignMetier(id, metierId)` | Assigner un métier |
| `assignZone(id, zoneId)` | Assigner une zone |

#### Méthodes de comptage
| Méthode | Description |
|---------|-------------|
| `getTotalCount(params?)` | Nombre total d'artisans (filtres basiques) |
| `getCountWithFilters(params?)` | Nombre d'artisans avec tous les filtres |
| `getStatsByGestionnaire(id)` | Statistiques par gestionnaire |

#### Exemple
```typescript
import { artisansApi } from '@/lib/api/v2';

// Récupérer les artisans d'un gestionnaire
const result = await artisansApi.getAll({
  gestionnaire: 'user-uuid',
  statuts: ['EXPERT', 'CONFIRME'],
  search: 'plom'
});

// Compter avec filtres
const count = await artisansApi.getCountWithFilters({
  gestionnaire: 'user-uuid',
  metiers: ['metier-uuid-1', 'metier-uuid-2'],
  statut_dossier: 'À compléter'
});
```

---

### 📄 Documents API (`documentsApi`)

```typescript
import { documentsApi } from '@/lib/api/v2';

// Uploader un document
const result = await documentsApi.upload({
  entity_id: 'intervention-uuid',
  entity_type: 'intervention',
  kind: 'devis',
  content: base64Content,
  filename: 'devis.pdf',
  mime_type: 'application/pdf'
});

// Récupérer les documents d'une intervention
const docs = await documentsApi.getByEntity('intervention', 'intervention-uuid');
```

---

### 💬 Comments API (`commentsApi`)

```typescript
import { commentsApi } from '@/lib/api/v2';

// Ajouter un commentaire
const comment = await commentsApi.create({
  entity_id: 'intervention-uuid',
  entity_type: 'intervention',
  content: 'Commentaire important',
  comment_type: 'internal',
  is_internal: true
});

// Récupérer les commentaires
const comments = await commentsApi.getByEntity('intervention', 'intervention-uuid');
```

---

## 🎯 Types Principaux

```typescript
import type {
  // Entités
  Intervention,
  Artisan,
  User,
  Comment,
  
  // Paramètres de requête
  InterventionQueryParams,
  ArtisanQueryParams,
  
  // Réponses paginées
  PaginatedResponse,
  
  // Données de création/modification
  CreateInterventionData,
  UpdateInterventionData,
  CreateArtisanData,
  UpdateArtisanData,
} from '@/lib/api/v2';
```

---

## 🔄 Cache et Références

### Cache Centralisé

```typescript
import { 
  getReferenceCache, 
  invalidateReferenceCache,
  referenceCacheManager 
} from '@/lib/api/v2';

// Obtenir les données de référence (utilisateurs, agences, statuts, etc.)
const refs = await getReferenceCache();
console.log(refs.data.users);
console.log(refs.data.agencies);
console.log(refs.data.interventionStatuses);

// Invalider le cache (après modifications)
invalidateReferenceCache();

// Vérifier l'état du cache
console.log(referenceCacheManager.isValid());
console.log(referenceCacheManager.getAge()); // en millisecondes
```

---

## 🎣 Hooks Personnalisés

### useInterventionsQuery

```typescript
import { useInterventionsQuery } from '@/hooks/useInterventionsQuery';

const {
  interventions,      // Liste des interventions
  loading,            // État de chargement
  error,              // Erreur éventuelle
  totalCount,         // Nombre total
  refresh,            // Rafraîchir les données
} = useInterventionsQuery({ 
  limit: 50,
  serverFilters: { statut: 'DEMANDE' }
});
```

### useArtisansQuery

```typescript
import { useArtisansQuery } from '@/hooks/useArtisansQuery';

const {
  artisans,
  loading,
  error,
  totalCount,
  currentPage,
  refresh,
} = useArtisansQuery({
  serverFilters: { gestionnaire: 'user-uuid' }
});
```

---

## ⚠️ Migration depuis l'ancienne API

### Changements d'imports

| Ancien | Nouveau |
|--------|---------|
| `@/lib/supabase-api-v2` | `@/lib/api/v2` |
| `GetAllParams` | `InterventionQueryParams` |
| `getInterventionTotalCount()` | `interventionsApi.getTotalCountWithFilters()` |
| `getInterventionCounts()` | `interventionsApi.getCountsByStatus()` |
| `getDistinctInterventionValues()` | `interventionsApi.getDistinctValues()` |
| `getArtisanTotalCount()` | `artisansApi.getTotalCount()` |
| `getArtisanCountWithFilters()` | `artisansApi.getCountWithFilters()` |

### Exemple de migration

```typescript
// ❌ Ancien code
import { getInterventionTotalCount, type GetAllParams } from '@/lib/supabase-api-v2';
const count = await getInterventionTotalCount({ statut: 'DEMANDE' });

// ✅ Nouveau code
import { interventionsApi, type InterventionQueryParams } from '@/lib/api/v2';
const count = await interventionsApi.getTotalCountWithFilters({ statut: 'DEMANDE' });
```

---

## 🔧 Configuration

### Variables d'environnement

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Côté serveur uniquement
```

### URL des Edge Functions

L'URL des Edge Functions est automatiquement construite à partir de `NEXT_PUBLIC_SUPABASE_URL`.

---

## 📚 Documentation Additionnelle

- [README API V2](../../src/lib/api/v2/README.md) - Documentation technique détaillée
- [Guide Backend](../guide/backend/GUIDELINES_API_V2.md) - Guidelines complètes
- [Quick Start](../guide/backend/QUICK_START_API_V2.md) - Démarrage rapide

