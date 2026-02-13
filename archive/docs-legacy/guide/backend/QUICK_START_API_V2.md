# 🚀 GUIDE RAPIDE - API v2 GMBS CRM

## 📥 Imports Standard

```typescript
// ✅ APIs principales (NOUVEAU chemin recommandé)
import { 
  interventionsApi,
  artisansApi,
  documentsApi, 
  commentsApi,
  type Intervention,
  type Artisan
} from '@/lib/api/v2';

// ✅ Hooks personnalisés
import { useInterventionsQuery } from '@/hooks/useInterventionsQuery';
import { useArtisans } from '@/hooks/useArtisans';

// ✅ Alias V2 (compatibilité)
import { interventionsApiV2, artisansApiV2 } from '@/lib/api/v2';
```

## 🔧 Utilisation Basique

### Créer une intervention
```typescript
const intervention = await interventionsApiV2.create({
  contexte_intervention: 'Réparation urgente',
  adresse: '123 Rue de la Paix',
  ville: 'Paris',
  agence_id: 'agence-uuid',
  statut_id: 'DEMANDE'
});
```

### Récupérer les interventions
```typescript
const { interventions, loading, error } = useInterventionsQuery({
  limit: 50,
  autoLoad: true
});
```

### Mettre à jour une intervention
```typescript
const updated = await interventionsApiV2.update(id, {
  statut_id: 'EN_COURS'
});
```

### Assigner un artisan
```typescript
await interventionsApiV2.assignArtisan(interventionId, artisanId, 'primary');
```

### Uploader un document
```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('entity_id', interventionId);
formData.append('entity_type', 'intervention');
formData.append('kind', 'devis');

const document = await documentsApi.upload(formData);
```

### Ajouter un commentaire
```typescript
const comment = await commentsApi.create({
  entity_id: interventionId,
  entity_type: 'intervention',
  content: 'Commentaire important',
  comment_type: 'internal'
});
```

## 🎣 Hooks Disponibles

### useInterventionsQuery
```typescript
const {
  interventions,      // Liste des interventions
  loading,            // État de chargement
  error,              // Erreur éventuelle
  totalCount,         // Nombre total
  currentPage,         // Page courante
  totalPages,         // Nombre total de pages
  refresh,            // Rafraîchir
  goToPage,           // Aller à une page
  nextPage,           // Page suivante
  previousPage,       // Page précédente
  updateInterventionOptimistic  // Mise à jour optimiste
} = useInterventionsQuery({ 
  limit: 50,
  serverFilters: { statut: 'DEMANDE' }
});
```

### useArtisans
```typescript
const {
  artisans,           // Liste des artisans
  setArtisans,        // Modifier la liste
  loading,            // État de chargement
  error,              // Erreur éventuelle
  hasMore,            // Y a-t-il plus de données ?
  totalCount,         // Nombre total
  loadMore,           // Charger plus
  refresh,            // Rafraîchir
  setFilters          // Appliquer des filtres
} = useArtisans({ limit: 30 });
```

## ⚠️ Gestion d'Erreurs

```typescript
try {
  const result = await interventionsApiV2.create(data);
  return result;
} catch (error) {
  console.error('Erreur API:', error);
  
  if (error.message.includes('HTTP 400')) {
    // Erreur de validation
  } else if (error.message.includes('HTTP 500')) {
    // Erreur serveur
  }
  
  throw error;
}
```

## 🔧 Ajouter un Nouveau Champ

### 1. Mettre à jour les types
```typescript
// Dans src/lib/api/v2/common/types.ts
export interface CreateInterventionData {
  // ... champs existants
  nouveau_champ?: string;
}
```

### 2. Mettre à jour l'Edge Function
```typescript
// Dans supabase/functions/interventions-v2/index.ts
interface CreateInterventionRequest {
  // ... champs existants
  nouveau_champ?: string;
}
```

### 3. Utiliser le nouveau champ
```typescript
const intervention = await interventionsApiV2.create({
  // ... autres champs
  nouveau_champ: 'valeur'
});
```

## 🚀 Commandes

```bash
# Démarrer Supabase
supabase start

# Servir les Edge Functions
supabase functions serve

# Tester l'API
npm run test:api

# Lancer le site
npm run dev
```

## 📚 Documentation Complète

Voir `docs/api/README.md` et `docs/guide/backend/GUIDELINES_API_V2.md` pour la documentation complète avec :
- Architecture détaillée
- Exemples avancés
- Bonnes pratiques
- Extension de l'API
- Patterns de développement

## ⚠️ Migration

Le chemin `@/lib/supabase-api-v2` est déprécié. Utilisez `@/lib/api/v2` pour tous les nouveaux développements.
