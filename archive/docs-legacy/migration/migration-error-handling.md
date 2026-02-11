# Migration de la Gestion d'Erreurs - Guide

## 📋 Contexte

**Problème identifié:** Pattern répété dans le code :
```typescript
catch (error) {
  console.error(error);
  return null; // Pas de propagation
}
```

**Impact:**
- Erreurs silencieuses
- Pas de traçabilité
- Difficile à déboguer
- Pas de monitoring

## ✅ Solution Implémentée

### Système Centralisé (`src/lib/errors/error-handler.ts`)

Un système de gestion d'erreurs centralisé avec :
- Logging structuré
- Propagation optionnelle
- Valeurs de fallback
- Niveaux de sévérité
- Types d'erreurs applicatives

## 🔄 Comment Migrer

### Avant (Pattern Problématique)

```typescript
async function getIntervention(id: string) {
  try {
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error(error); // ❌ Log uniquement
    return null; // ❌ Pas de propagation
  }
}
```

### Après (Nouveau Système)

```typescript
import { ErrorHandler, Errors } from '@/lib/errors/error-handler';

async function getIntervention(id: string) {
  try {
    const { data, error } = await supabase
      .from('interventions')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    if (!data) throw Errors.notFound('Intervention', id);
    
    return data;
  } catch (error) {
    return ErrorHandler.handle(error, {
      context: 'interventionsApi',
      operation: 'getIntervention',
      fallback: null, // Valeur par défaut
      propagate: false, // Ne pas re-lancer
      metadata: { interventionId: id },
      severity: 'medium'
    });
  }
}
```

## 📚 Exemples d'Utilisation

### 1. Gestion Basique avec Fallback

```typescript
const result = await ErrorHandler.handle(
  someOperation(),
  {
    context: 'myModule',
    operation: 'someOperation',
    fallback: [],
    propagate: false
  }
);
```

### 2. Propagation d'Erreur (pour les API Routes)

```typescript
// Dans une API Route Next.js
export async function GET(req: Request) {
  try {
    const data = await fetchData();
    return NextResponse.json({ data });
  } catch (error) {
    return ErrorHandler.handle(error, {
      context: 'api/interventions',
      operation: 'GET',
      propagate: true, // ✅ Re-lance l'erreur
      severity: 'high'
    });
  }
}
```

### 3. Wrapper de Fonction

```typescript
import { ErrorHandler } from '@/lib/errors/error-handler';

// Wrapper automatique
const safeGetAll = ErrorHandler.wrap(
  interventionsApi.getAll,
  {
    context: 'interventionsApi',
    operation: 'getAll',
    fallback: []
  }
);

// Utilisation
const interventions = await safeGetAll(); // Gère automatiquement les erreurs
```

### 4. Erreurs Typées

```typescript
import { Errors } from '@/lib/errors/error-handler';

// Créer des erreurs typées
throw Errors.notFound('Intervention', '123');
throw Errors.unauthorized('Token invalide');
throw Errors.badRequest('Données invalides');
throw Errors.validation('Champ requis', { field: 'date' });
```

### 5. Niveaux de Sévérité

```typescript
// Erreur critique (log + monitoring)
ErrorHandler.handle(error, {
  context: 'payment',
  operation: 'processPayment',
  severity: 'critical', // ✅ Log + envoi à monitoring
  propagate: true
});

// Erreur mineure (log uniquement)
ErrorHandler.handle(error, {
  context: 'cache',
  operation: 'getCache',
  severity: 'low', // ✅ Log info uniquement
  fallback: null
});
```

## 🎯 Bonnes Pratiques

### 1. Toujours Fournir un Contexte

```typescript
// ✅ Bon
ErrorHandler.handle(error, {
  context: 'interventionsApi',
  operation: 'getById',
  // ...
});

// ❌ Mauvais
ErrorHandler.handle(error, {
  context: 'error', // Trop vague
});
```

### 2. Utiliser les Erreurs Typées

```typescript
// ✅ Bon
if (!intervention) {
  throw Errors.notFound('Intervention', id);
}

// ❌ Mauvais
if (!intervention) {
  throw new Error('Not found'); // Pas de code, pas de status
}
```

### 3. Propagation vs Fallback

```typescript
// ✅ Propagation pour les API Routes
ErrorHandler.handle(error, {
  propagate: true // L'erreur remonte
});

// ✅ Fallback pour les hooks/composants
ErrorHandler.handle(error, {
  fallback: [] // Retourne une valeur par défaut
});
```

## 📝 Checklist de Migration

- [x] Créer `src/lib/errors/error-handler.ts`
- [ ] Identifier tous les patterns `console.error + return null`
- [ ] Migrer les API Routes
- [ ] Migrer les hooks
- [ ] Migrer les composants
- [ ] Ajouter des tests
- [ ] Documenter dans le README

## 🔍 Recherche des Patterns à Migrer

```bash
# Rechercher les patterns problématiques
grep -r "console.error" --include="*.ts" --include="*.tsx" | grep -A 2 "return null"
```

## 🚀 Prochaines Étapes

1. Migrer progressivement tous les fichiers
2. Configurer un service de monitoring (Sentry, etc.)
3. Ajouter des métriques d'erreurs
4. Créer des alertes pour les erreurs critiques

