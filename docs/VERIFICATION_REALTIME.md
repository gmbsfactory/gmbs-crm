# 🔍 Instructions de Vérification Realtime

## ✅ Corrections Appliquées

1. **Correction du matching des query keys** dans `cache-sync.ts`
   - Utilisation de `interventionKeys.lists()` et `interventionKeys.lightLists()` avec `exact: false`
   - Mise à jour séparée des listes complètes et light

2. **Ajout de logs de debug** dans :
   - `useInterventionsRealtime.ts` : logs d'initialisation et statut de souscription
   - `cache-sync.ts` : logs des événements et mises à jour du cache

## 📋 Checklist de Vérification

### 1. Vérifier la Configuration Supabase Realtime

#### A. Vérifier que Realtime est activé dans `supabase/config.toml`

```bash
# Vérifier le fichier de configuration
cat supabase/config.toml | grep -A 5 "\[realtime\]"
```

Le résultat doit contenir :
```toml
[realtime]
enabled = true
```

Si ce n'est pas le cas, ajoutez/modifiez dans `supabase/config.toml` :
```toml
[realtime]
enabled = true
```

#### B. Vérifier les permissions RLS pour Realtime

Les politiques RLS doivent permettre la lecture des interventions pour que Realtime fonctionne.

Vérifiez dans Supabase Dashboard → Authentication → Policies → `interventions` :
- Il doit y avoir une politique SELECT qui permet aux utilisateurs authentifiés de lire les interventions

Ou exécutez cette requête SQL dans Supabase SQL Editor :

```sql
-- Vérifier les politiques RLS sur la table interventions
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'interventions';
```

#### C. Vérifier que la publication Realtime est activée

Exécutez dans Supabase SQL Editor :

```sql
-- Vérifier les publications Realtime
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';

-- Vérifier que la table interventions est dans la publication
SELECT * FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'interventions';
```

Si la table n'est pas dans la publication, ajoutez-la :

```sql
-- Ajouter la table interventions à la publication Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE interventions;
```

### 2. Tests Manuels dans le Navigateur

#### A. Ouvrir la Console du Navigateur

1. Ouvrez `/interventions` dans votre navigateur
2. Ouvrez la console développeur (F12)
3. Filtrez les logs avec `[Realtime]` ou `[cache-sync]`

#### B. Vérifier l'Initialisation

Vous devriez voir dans la console :
```
[Realtime] Initialisation de la synchronisation Realtime
[Realtime] ✅ Channel souscrit avec succès
```

Si vous voyez une erreur :
- `❌ Erreur de channel` : Vérifiez les permissions RLS
- `⚠️ Timeout de souscription` : Vérifiez la connexion réseau
- `⚠️ Channel fermé` : Vérifiez la configuration Supabase

#### C. Test INSERT

1. **Ouvrir deux navigateurs** (ou deux onglets) sur `/interventions`
2. Dans le premier navigateur, créez une nouvelle intervention
3. **Vérifier dans la console du deuxième navigateur** :
   ```
   [Realtime] Événement reçu: INSERT <id>
   [cache-sync] Événement INSERT pour intervention <id>
   [cache-sync] X queries de listes complètes mises à jour, Y queries de listes light mises à jour
   ```
4. **Vérifier visuellement** : L'intervention doit apparaître dans le deuxième navigateur **sans refresh** en moins de 500ms

#### D. Test UPDATE

1. Dans le premier navigateur, modifiez une intervention (ex: changez le statut)
2. **Vérifier dans la console du deuxième navigateur** :
   ```
   [Realtime] Événement reçu: UPDATE <id>
   [cache-sync] Événement UPDATE pour intervention <id>
   [cache-sync] X queries de listes complètes mises à jour, Y queries de listes light mises à jour
   ```
3. **Vérifier visuellement** : La modification doit apparaître dans le deuxième navigateur **sans refresh** en moins de 500ms

#### E. Test DELETE (Soft Delete)

1. Dans le premier navigateur, supprimez une intervention (soft delete : `is_active = false`)
2. **Vérifier dans la console du deuxième navigateur** :
   ```
   [Realtime] Événement reçu: UPDATE <id>
   [cache-sync] Événement UPDATE pour intervention <id>
   [cache-sync] Soft delete détecté pour intervention <id>
   [cache-sync] Soft delete: X listes complètes et Y listes light mises à jour
   ```
3. **Vérifier visuellement** : L'intervention doit disparaître de toutes les vues dans le deuxième navigateur **sans refresh**

#### F. Test Multi-Onglets (BroadcastChannel)

1. Ouvrez **deux onglets** du même navigateur sur `/interventions`
2. Dans le premier onglet, modifiez une intervention
3. **Vérifier dans la console du deuxième onglet** :
   - Vous devriez voir les logs `[Realtime]` ET les logs `[broadcast-sync]`
   - La modification doit apparaître dans le deuxième onglet **sans refresh**

### 3. Vérifier les Query Keys

Pour vérifier que les query keys sont correctement matchées, ajoutez temporairement ce log dans `cache-sync.ts` :

```typescript
// Dans syncCacheWithRealtimeEvent, après setQueriesData
console.log('[cache-sync] Query keys matchées:', {
  listKey: interventionKeys.lists(),
  lightKey: interventionKeys.lightLists(),
  updatedListCount,
  updatedLightCount
})
```

Dans la console, vous devriez voir :
```
[cache-sync] Query keys matchées: {
  listKey: ["interventions", "list"],
  lightKey: ["interventions", "light"],
  updatedListCount: 1,  // ou plus selon le nombre de vues actives
  updatedLightCount: 0  // ou plus selon le nombre de vues light actives
}
```

### 4. Vérifier les Permissions RLS

Si les événements Realtime ne sont pas reçus, vérifiez les permissions :

```sql
-- Vérifier que l'utilisateur peut lire les interventions
SELECT * FROM interventions LIMIT 1;

-- Si cette requête échoue, les politiques RLS bloquent l'accès
-- Vérifiez les politiques dans Supabase Dashboard
```

### 5. Dépannage

#### Problème : Aucun événement Realtime reçu

**Solutions :**
1. Vérifiez que Realtime est activé dans `supabase/config.toml`
2. Vérifiez que la table est dans la publication Realtime (voir section 1.C)
3. Vérifiez les permissions RLS (voir section 1.B)
4. Vérifiez la console pour les erreurs de connexion

#### Problème : Les événements sont reçus mais l'UI ne se met pas à jour

**Solutions :**
1. Vérifiez dans la console que `updatedListCount` et `updatedLightCount` sont > 0
2. Si `updatedListCount = 0`, les query keys ne matchent pas - vérifiez la structure des query keys dans `useInterventionsQuery`
3. Vérifiez que `InterventionRealtimeProvider` est bien monté dans `app/interventions/page.tsx`

#### Problème : Délai > 500ms

**Solutions :**
1. Vérifiez la latence réseau dans la console (Network tab)
2. Vérifiez que l'invalidation silencieuse (100ms) ne déclenche pas de refetch
3. Vérifiez que `refetchType: 'none'` est bien utilisé dans l'invalidation

## 📊 Logs Attendus

### Initialisation réussie
```
[Realtime] Initialisation de la synchronisation Realtime
[Realtime] ✅ Channel souscrit avec succès
```

### Événement INSERT
```
[Realtime] Événement reçu: INSERT abc-123-def
[cache-sync] Événement INSERT pour intervention abc-123-def
[cache-sync] 1 queries de listes complètes mises à jour, 0 queries de listes light mises à jour
```

### Événement UPDATE
```
[Realtime] Événement reçu: UPDATE abc-123-def
[cache-sync] Événement UPDATE pour intervention abc-123-def
[cache-sync] 1 queries de listes complètes mises à jour, 0 queries de listes light mises à jour
```

### Soft Delete
```
[Realtime] Événement reçu: UPDATE abc-123-def
[cache-sync] Événement UPDATE pour intervention abc-123-def
[cache-sync] Soft delete détecté pour intervention abc-123-def
[cache-sync] Traitement du soft delete pour intervention abc-123-def
[cache-sync] Soft delete: 1 listes complètes et 0 listes light mises à jour
```

## 🎯 Critères de Succès

✅ **Phase 1-2 validée si :**
1. Les logs `[Realtime] ✅ Channel souscrit avec succès` apparaissent
2. Les événements INSERT/UPDATE/DELETE sont reçus dans la console
3. Les mises à jour apparaissent dans l'UI **sans refresh** en **< 500ms**
4. Les soft deletes retirent immédiatement les interventions de toutes les vues
5. La synchronisation multi-onglets fonctionne via BroadcastChannel

## 📝 Notes

- Les logs `[cache-sync]` peuvent être désactivés en production en retirant les `console.log`
- Les logs `[Realtime]` sont utiles pour le debugging mais peuvent être réduits en production
- Si les tests passent, vous pouvez passer aux phases suivantes (US1-US12)

