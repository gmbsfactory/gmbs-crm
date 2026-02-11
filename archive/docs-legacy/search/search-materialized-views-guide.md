# Guide d'utilisation : Vues Matérialisées de Recherche

## 📋 Vue d'ensemble

Ce guide explique comment utiliser les vues matérialisées de recherche créées par la migration `00020_search_materialized_views.sql`.

Ces vues permettent une **recherche full-text ultra-rapide** (150-400ms vs 800-1800ms actuellement) sur :
- ✅ **Interventions** (avec toutes les relations : agence, client, artisan, commentaires)
- ✅ **Artisans** (avec métiers, zones, gestionnaire)
- ✅ **Recherche globale** (interventions + artisans)

---

## 🚀 Déploiement

### 1. Appliquer la migration

```bash
# En local
supabase migration up

# En production
supabase db push
```

**Note :** Le premier rafraîchissement peut prendre 10-30 secondes selon la taille de votre base.

### 2. Vérifier que tout fonctionne

```sql
-- Compter les interventions indexées
SELECT COUNT(*) FROM interventions_search_mv;

-- Compter les artisans indexés
SELECT COUNT(*) FROM artisans_search_mv;

-- Compter les entrées globales
SELECT COUNT(*) FROM global_search_mv;

-- Tester une recherche
SELECT * FROM search_interventions('plomberie');
```

---

## 📖 Utilisation des fonctions RPC

### Recherche Interventions

```typescript
// Client TypeScript
const { data, error } = await supabase.rpc('search_interventions', {
  p_query: 'plomberie paris',
  p_limit: 20,
  p_offset: 0
});

// Résultat
data = [
  {
    id: 'uuid',
    id_inter: 'INT-2024-001',
    contexte_intervention: 'Fuite plomberie cuisine',
    adresse: '15 rue de Paris',
    ville: 'Paris',
    agence_label: 'Agence Paris',
    artisan_plain_nom: 'Dupont Jean',
    statut_label: 'En cours',
    statut_color: '#3b82f6',
    date_formatted: '15/01/2024 10:00',
    rank: 0.95 // Score de pertinence (0-1)
  },
  // ...
];
```

**Syntaxe de recherche avancée :**
```typescript
// Recherche simple
'plomberie'

// Plusieurs mots (AND implicite)
'plomberie paris'

// Opérateur OR
'plomberie OR électricité'

// Opérateur NOT
'plomberie NOT paris'

// Phrase exacte
'"fuite d\'eau"'

// Combinaison
'(plomberie OR électricité) paris NOT "75001"'
```

### Recherche Artisans

```typescript
const { data, error } = await supabase.rpc('search_artisans', {
  p_query: 'dupont plombier',
  p_limit: 10,
  p_offset: 0
});

// Résultat
data = [
  {
    id: 'uuid',
    numero_associe: 'ART-001',
    plain_nom: 'Dupont Jean',
    raison_sociale: 'Plomberie Dupont SARL',
    email: 'dupont@example.com',
    telephone: '0601020304',
    ville_intervention: 'Paris',
    metiers_labels: 'Plomberie, Chauffage',
    statut_label: 'Actif',
    statut_color: '#10b981',
    active_interventions_count: 5,
    rank: 0.89
  },
  // ...
];
```

### Recherche Globale (cmd+k)

```typescript
const { data, error } = await supabase.rpc('search_global', {
  p_query: 'dupont',
  p_limit: 20,
  p_offset: 0,
  p_entity_type: null // 'intervention', 'artisan', ou null pour tout
});

// Résultat
data = [
  {
    entity_type: 'artisan',
    entity_id: 'uuid',
    metadata: {
      numero_associe: 'ART-001',
      plain_nom: 'Dupont Jean',
      raison_sociale: 'Plomberie Dupont SARL',
      email: 'dupont@example.com',
      telephone: '0601020304',
      ville: 'Paris',
      metiers: 'Plomberie, Chauffage',
      statut: 'Actif',
      statut_color: '#10b981',
      interventions_actives: 5
    },
    rank: 0.92
  },
  {
    entity_type: 'intervention',
    entity_id: 'uuid',
    metadata: {
      id_inter: 'INT-2024-001',
      contexte: 'Intervention chez M. Dupont',
      adresse: '15 rue de Paris',
      ville: 'Paris',
      agence: 'Agence Paris',
      artisan: 'Dupont Jean',
      statut: 'En cours',
      statut_color: '#3b82f6',
      date: '15/01/2024 10:00',
      assigned_user: 'jdoe'
    },
    rank: 0.85
  },
  // ...
];
```

---

## 🔧 Intégration dans votre code

### Modifier l'Edge Function `interventions-v2`

Remplacer la logique de recherche actuelle :

```typescript
// AVANT (recherche côté client)
// Lignes 481-492 : Filtrage désactivé
// Lignes 511-770 : Scoring client

// APRÈS (recherche côté serveur)
if (req.method === 'GET' && resource === 'interventions' && url.searchParams.has('search')) {
  const searchQuery = url.searchParams.get('search')?.trim();
  const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  if (searchQuery && searchQuery.length >= 2) {
    // Utiliser la fonction RPC optimisée
    const { data, error } = await supabase.rpc('search_interventions', {
      p_query: searchQuery,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      throw new Error(`Search failed: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        data: data ?? [],
        pagination: {
          total: data?.length ?? 0,
          limit,
          offset,
          hasMore: data?.length === limit
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

### Simplifier le code client

Supprimer le scoring client dans [page.tsx:511-770](app/interventions/page.tsx:511-770) :

```typescript
// AVANT
const scoreInterventionWithRelations = useCallback((intervention, query) => {
  // ... 260 lignes de scoring client
}, [normalizeString, sanitizePhone]);

const filteredWithRelations = useMemo(() => {
  // ... Scoring et filtrage client
}, [filteredInterventions, search, scoreInterventionWithRelations]);

// APRÈS
// Supprimer complètement ces fonctions
// La recherche est maintenant faite côté serveur
// Le composant reçoit directement les résultats triés par pertinence
```

### Mise à jour du hook `useInterventionsQuery`

```typescript
// src/hooks/useInterventionsQuery.ts
export function useInterventionsQuery({ search, ... }) {
  const queryFn = async () => {
    if (search && search.trim().length >= 2) {
      // Utiliser la fonction RPC de recherche
      const { data, error } = await supabase.rpc('search_interventions', {
        p_query: search.trim(),
        p_limit: limit,
        p_offset: (page - 1) * limit
      });

      if (error) throw error;
      return data ?? [];
    }

    // Sinon, requête normale
    // ...
  };

  // ...
}
```

---

## ⚡️ Performance

### Benchmarks attendus

| Opération | Avant | Après | Gain |
|-----------|-------|-------|------|
| Recherche interventions (10k) | 800-1200ms | **150-300ms** | **4x plus rapide** |
| Recherche artisans (5k) | 400-600ms | **100-200ms** | **4x plus rapide** |
| Recherche globale | 1200-1800ms | **200-400ms** | **5x plus rapide** |
| Trafic réseau | ~500KB | **~50KB** | **-90%** |

### Facteurs de performance

✅ **Index GIN** : Recherche full-text en O(log n) au lieu de O(n)
✅ **Dénormalisation** : Pas de jointures à l'exécution
✅ **Tri serveur** : Score de pertinence calculé par PostgreSQL
✅ **Pagination** : Seulement les résultats demandés

---

## 🔄 Rafraîchissement des vues

### Automatique (triggers)

Les vues se rafraîchissent **automatiquement** quand :
- ✅ Une intervention est créée/modifiée/supprimée
- ✅ Un artisan est créé/modifié/supprimé
- ✅ Un commentaire est ajouté à une intervention
- ✅ Une relation change (intervention_artisans, artisan_metiers, etc.)

**Méthode :** Triggers → `pg_notify` → Refresh asynchrone (non-bloquant)

### Manuel (si besoin)

```sql
-- Rafraîchir toutes les vues
SELECT refresh_interventions_search();
SELECT refresh_artisans_search();

-- Ou directement
REFRESH MATERIALIZED VIEW CONCURRENTLY interventions_search_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY artisans_search_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;
```

### Cron job (optionnel)

Pour un refresh périodique (toutes les 5 minutes) :

```sql
-- Si pg_cron est disponible
SELECT cron.schedule(
  'refresh-search-views',
  '*/5 * * * *',
  $$
  SELECT refresh_interventions_search();
  SELECT refresh_artisans_search();
  $$
);
```

---

## 🐛 Dépannage

### Problème : Résultats manquants

**Cause :** Vue pas à jour

**Solution :**
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY interventions_search_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY artisans_search_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;
```

### Problème : Recherche lente (>500ms)

**Cause :** Index GIN manquant ou fragmenté

**Solution :**
```sql
-- Vérifier les index
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid))
FROM pg_indexes
WHERE tablename LIKE '%search_mv';

-- Recréer les index si nécessaire
REINDEX INDEX CONCURRENTLY idx_interventions_search_vector;
REINDEX INDEX CONCURRENTLY idx_artisans_search_vector;
REINDEX INDEX CONCURRENTLY idx_global_search_vector;
```

### Problème : Accents ignorés

**Cause :** Extension `unaccent` non activée

**Solution :**
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### Problème : Erreur "materialized view does not exist"

**Cause :** Migration pas appliquée

**Solution :**
```bash
supabase migration up
# ou
supabase db push
```

---

## 📊 Monitoring

### Taille des vues

```sql
SELECT
  schemaname,
  matviewname,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) AS size
FROM pg_matviews
WHERE matviewname LIKE '%search_mv'
ORDER BY pg_total_relation_size(schemaname||'.'||matviewname) DESC;
```

### Dernière mise à jour

```sql
-- PostgreSQL ne stocke pas la date de refresh par défaut
-- Mais on peut créer une table de tracking

CREATE TABLE IF NOT EXISTS materialized_view_refreshes (
  view_name text PRIMARY KEY,
  last_refresh timestamptz DEFAULT now()
);

-- Modifier les fonctions de refresh pour tracker
CREATE OR REPLACE FUNCTION refresh_interventions_search()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY interventions_search_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY global_search_mv;

  INSERT INTO materialized_view_refreshes (view_name, last_refresh)
  VALUES ('interventions_search_mv', now())
  ON CONFLICT (view_name) DO UPDATE SET last_refresh = now();
END;
$$;
```

### Performance des requêtes

```sql
-- Activer le tracking des requêtes
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Voir les requêtes les plus lentes
SELECT
  query,
  calls,
  mean_exec_time,
  max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%search_%mv%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 🎯 Bonnes pratiques

### 1. Toujours utiliser `websearch_to_tsquery`

```sql
-- ✅ BON
websearch_to_tsquery('french', 'plomberie paris')

-- ❌ MAUVAIS (vulnérable aux erreurs de syntaxe)
to_tsquery('french', 'plomberie & paris')
```

### 2. Limiter le nombre de résultats

```typescript
// ✅ BON
const limit = Math.min(userLimit, 100); // Max 100

// ❌ MAUVAIS (peut surcharger le client)
const limit = 10000;
```

### 3. Utiliser la pagination

```typescript
// ✅ BON
const offset = (page - 1) * limit;

// ❌ MAUVAIS (charge tout d'un coup)
const offset = 0;
const limit = 999999;
```

### 4. Préfixer les recherches de codes

```typescript
// ✅ BON pour rechercher un code artisan
'ART-001'

// ⚠️ Peut retourner trop de résultats
'001'
```

### 5. Surveiller la taille des vues

```sql
-- Si une vue dépasse 1GB, envisager un partitionnement
SELECT pg_size_pretty(pg_total_relation_size('interventions_search_mv'));
```

---

## 🚀 Prochaines étapes (optionnel)

### Recherche phonétique

```sql
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- Ajouter une colonne soundex
ALTER MATERIALIZED VIEW interventions_search_mv
ADD COLUMN artisan_soundex text;

-- Dans la vue, ajouter
soundex(art.plain_nom) as artisan_soundex
```

### Suggestions auto-complétion

```sql
-- Vue pour suggestions rapides
CREATE MATERIALIZED VIEW search_suggestions_mv AS
SELECT DISTINCT
  unnest(tsvector_to_array(search_vector)) as term,
  COUNT(*) as frequency
FROM interventions_search_mv
GROUP BY term
ORDER BY frequency DESC
LIMIT 1000;
```

### Highlighting des résultats

```sql
-- Fonction pour mettre en surbrillance les termes
CREATE FUNCTION highlight_search(
  p_text text,
  p_query text
)
RETURNS text
LANGUAGE sql
AS $$
  SELECT ts_headline('french', p_text, websearch_to_tsquery('french', p_query));
$$;
```

---

## 📚 Ressources

- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Materialized Views](https://www.postgresql.org/docs/current/rules-materializedviews.html)
- [GIN Indexes](https://www.postgresql.org/docs/current/gin-intro.html)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

**Bonne recherche ! 🔍✨**
