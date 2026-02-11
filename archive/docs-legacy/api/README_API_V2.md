# 🚀 API v2 GMBS CRM - Guide Complet

## 📋 Résumé

L'API v2 est un système complet et scalable pour le CRM GMBS, basé sur Supabase Edge Functions et TypeScript. Elle fournit toutes les fonctionnalités nécessaires pour gérer les interventions, artisans, documents et commentaires.

## 🏗️ Architecture

```
src/lib/supabase-api-v2.ts          # Client API principal
├── interventionsApiV2              # CRUD interventions
├── artisansApiV2                   # CRUD artisans  
├── documentsApi                    # Gestion documents
├── commentsApi                     # Système commentaires
└── Types & Interfaces              # Types TypeScript

supabase/functions/
├── interventions-v2/               # Edge Function interventions
├── artisans-v2/                   # Edge Function artisans
├── documents/                      # Edge Function documents
└── comments/                       # Edge Function commentaires

src/hooks/
├── useInterventionsQuery.ts        # Hook interventions (TanStack Query)
├── useArtisans.ts                  # Hook artisans
├── useSmartFilters.ts              # Hook filtres intelligents
└── useReferenceData.ts             # Hook données de référence
```

## 🚀 Démarrage Rapide

### 1. Démarrer Supabase
```bash
supabase start
supabase functions serve
```

### 2. Tester l'API
```bash
# Test complet de l'API v2
npm run test:api-v2

# Voir l'aide
npm run test:api-v2:help
```

### 3. Utiliser dans votre code
```typescript
import { interventionsApiV2 } from '@/lib/supabase-api-v2';
import { useInterventionsQuery } from '@/hooks/useInterventionsQuery';

// Avec l'API directe
const intervention = await interventionsApiV2.create({
  contexte_intervention: 'Réparation urgente',
  adresse: '123 Rue de la Paix',
  ville: 'Paris'
});

// Avec TanStack Query
const { interventions, loading, error } = useInterventionsQuery();
```

## 📚 Documentation

- **[Guide Complet](docs/GUIDELINES_API_V2.md)** - Documentation détaillée avec exemples avancés
- **[Guide Rapide](docs/QUICK_START_API_V2.md)** - Démarrage rapide et références
- **[Exemple Pratique](examples/InterventionManager.tsx)** - Composant React complet
- **[Script de Test](scripts/test-api-v2-complete.ts)** - Tests automatisés

## 🔧 Fonctionnalités

### ✅ Interventions
- CRUD complet (Create, Read, Update, Delete)
- Assignation d'artisans
- Gestion des statuts
- Support des coûts et paiements
- Relations avec clients, agences, métiers

### ✅ Artisans
- CRUD complet
- Assignation de métiers et zones
- Gestion par gestionnaire
- Support des documents
- Gestion des absences

### ✅ Documents
- Upload de fichiers
- Types variés (devis, photos, factures, etc.)
- Support pour interventions et artisans
- Validation des types MIME
- Métadonnées complètes

### ✅ Commentaires
- Commentaires sur interventions et artisans
- Types de commentaires (internal, external, system)
- Gestion interne/externe
- Système d'auteurs et timestamps

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

## 🔧 Extension de l'API

### Ajouter un Nouveau Champ
1. Mettre à jour les types dans `src/lib/supabase-api-v2.ts`
2. Mettre à jour l'Edge Function correspondante
3. Utiliser le nouveau champ dans vos composants

### Créer une Nouvelle API
1. Créer l'Edge Function dans `supabase/functions/`
2. Ajouter le client API dans `src/lib/supabase-api-v2.ts`
3. Créer un hook personnalisé dans `src/hooks/`

## ⚠️ Gestion des Erreurs

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

## 🚀 Commandes Utiles

```bash
# Développement
supabase start                    # Démarrer Supabase
supabase functions serve         # Servir les Edge Functions
npm run test:api-v2              # Tester l'API v2
npm run dev                      # Lancer le site

# Déploiement
supabase functions deploy        # Déployer les Edge Functions
npm run build                    # Build du site
npm run start                    # Démarrer en production
```

## 📊 Tests

Le script de test `scripts/test-api-v2-complete.ts` vérifie :
- ✅ Création, lecture, mise à jour, suppression des interventions
- ✅ Création, lecture, mise à jour, suppression des artisans
- ✅ Système de commentaires complet
- ✅ Upload et gestion des documents
- ✅ Workflow complet (créer → assigner → commenter → modifier → supprimer)

## 🎯 Bonnes Pratiques

1. **Utilisez les hooks personnalisés** pour la gestion d'état
2. **Mise à jour optimiste** pour une meilleure UX
3. **Gestion d'erreurs avec rollback** en cas d'échec
4. **Validation des données** avant envoi
5. **États de chargement spécifiques** pour chaque action
6. **Fonctions useCallback** pour les performances

## 🔗 Liens Utiles

- [Documentation Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)
- [React Hooks Patterns](https://reactjs.org/docs/hooks-patterns.html)

---

*Cette API v2 est maintenue à jour avec les dernières pratiques et évolutions du CRM GMBS.*
