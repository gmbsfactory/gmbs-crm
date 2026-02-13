# Problèmes courants

> Solutions aux problèmes fréquemment rencontrés lors du développement sur GMBS-CRM.

---

## Problèmes de build

### OOM (Out of Memory) lors des tests en CI

**Symptôme :** Le job `test` échoue sur GitHub Actions avec une erreur JavaScript heap out of memory.

**Solution :** Le CI configure déja `NODE_OPTIONS='--max-old-space-size=4096'`. Si le problème persiste localement :

```bash
NODE_OPTIONS='--max-old-space-size=4096' npm run test
```

### Build échoue avec des erreurs de secrets manquants

**Symptôme :** `npm run build` échoue avec des variables d'environnement undefined.

**Cause :** Le build Next.js nécessite les variables Supabase et MapTiler.

**Solution :** Vérifier que le fichier `.env.local` contient :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_MAPTILER_KEY=...
```

En CI, ces valeurs sont fournies via les secrets GitHub.

### Erreur "legacy peer deps" lors de npm install

**Symptôme :** `npm install` échoue avec des conflits de dépendances.

**Solution :** Utiliser le flag `--legacy-peer-deps` :

```bash
npm ci --legacy-peer-deps
```

Le CI utilise déja ce flag. Pour le développement local, ajouter dans `.npmrc` :

```
legacy-peer-deps=true
```

---

## Problèmes de développement

### Le serveur dev est lent au démarrage

**Symptôme :** `npm run dev` prend du temps a démarrer ou les recompilations sont lentes.

**Causes possibles :**
1. Le watch surveille trop de fichiers
2. Node modules non optimisés

**Solutions :**
- Le `next.config.mjs` exclut déja de nombreux dossiers du watch :
  ```javascript
  watchOptions: {
    ignored: [
      '**/node_modules/**', '**/.next/**', '**/scripts/**',
      '**/docs/**', '**/tests/**', '**/supabase/migrations/**',
    ]
  }
  ```
- S'assurer que le dossier `node_modules` n'est pas sur un volume réseau

### Erreurs TypeScript dans l'IDE mais pas en CLI

**Symptôme :** L'IDE (VS Code) affiche des erreurs TypeScript qui ne sont pas reproduites par `npm run typecheck`.

**Solution :** Redémarrer le serveur TypeScript de l'IDE :
- VS Code : Cmd+Shift+P > "TypeScript: Restart TS Server"
- Vérifier que l'IDE utilise la version TypeScript du workspace (`node_modules/typescript`)

### Les types Supabase sont obsolètes

**Symptôme :** Les types ne correspondent plus au schéma de la base.

**Solution :** Régénérer les types :

```bash
npm run types:generate
```

Cela exécute `supabase gen types typescript --local > src/lib/database.types.ts`.

---

## Problèmes de base de données

### La migration échoue sur un reset

**Symptôme :** `supabase db reset` échoue sur une migration.

**Solutions :**
1. Vérifier l'idempotence de la migration (utiliser `IF NOT EXISTS`, `IF EXISTS`)
2. Vérifier l'ordre des migrations (les dépendances entre tables)
3. Regarder les logs : `supabase db reset --debug`

### Les données de seed ne se chargent pas

**Symptôme :** Après un reset, les données de référence manquent.

**Vérification :** Le seed est intégré dans la migration `00001_clean_schema.sql` (rôles, permissions, role_permissions). Les seeds additionnels sont dans `supabase/seeds/`.

### Les policies RLS bloquent les requêtes

**Symptôme :** Les requêtes depuis le frontend retournent des arrays vides ou des erreurs 403.

**Diagnostic :**
1. Vérifier que la table a bien RLS activé : `SELECT * FROM pg_tables WHERE tablename = 'ma_table'`
2. Vérifier les policies : `SELECT * FROM pg_policies WHERE tablename = 'ma_table'`
3. Vérifier le mapping auth : `SELECT * FROM auth_user_mapping WHERE auth_user_id = '<uid>'`

**Note :** La plupart des API routes utilisent le client `service_role` qui bypass les RLS. Les policies affectent principalement les appels directs depuis le client Supabase frontend.

---

## Problèmes Realtime

### Les mises a jour en temps réel ne fonctionnent pas

**Symptôme :** Les modifications faites par d'autres utilisateurs n'apparaissent pas.

**Diagnostic :**
1. Vérifier le `ConnectionStatusIndicator` dans l'UI (point coloré)
2. Ouvrir la console navigateur et chercher les logs `[realtime]`
3. Vérifier que la table `interventions` a le Realtime activé dans le dashboard Supabase

**Fallback :** Le système utilise un polling toutes les 15 secondes comme fallback si le Realtime est indisponible.

### Conflits d'édition simultanée

**Symptôme :** Un badge "Modifié par X" apparaît puis les données semblent incohérentes.

**Explication :** Le système de détection de conflits (fenêtre de 5 secondes) a détecté une modification distante plus récente que la modification locale. Le badge disparaît automatiquement après 20 secondes. Les données se synchronisent au prochain refresh.

---

## Problèmes d'authentification

### Redirect en boucle entre login et dashboard

**Symptôme :** L'utilisateur est redirigé en boucle entre `/login` et `/dashboard`.

**Causes possibles :**
1. Cookies de session expirés ou corrompus
2. Le `auth_user_mapping` n'existe pas pour cet utilisateur

**Solution :**
1. Supprimer les cookies `sb-access-token` et `sb-refresh-token`
2. Se reconnecter

### Le heartbeat échoue et l'utilisateur passe offline

**Symptôme :** Le statut de l'utilisateur bascule en "offline" malgré une activité.

**Cause :** Le heartbeat POST `/api/auth/heartbeat` toutes les 30s échoue (réseau, serveur).

**Vérification :** Le cron `check-inactive-users` marque les utilisateurs offline après 90 secondes sans heartbeat.

---

## Problèmes d'import

### L'import Google Sheets échoue

**Symptôme :** `npm run import:all` échoue.

**Vérifications :**
1. Les credentials Google API sont valides
2. La spreadsheet est accessible
3. Les colonnes correspondent au mapping attendu

### Artisan statuts incohérents après import

**Symptôme :** Les statuts artisans ne correspondent pas aux interventions liées.

**Solution :** Exécuter le recalcul :

```bash
npm run recalculate:artisan-statuses

# Pour un seul artisan
npm run recalculate:single-artisan -- <artisan-id>
```

---

## Problèmes de performance (développement)

### Le composant re-render excessivement

**Diagnostic :** Utiliser React DevTools Profiler pour identifier les re-renders.

**Solutions courantes :**
1. Vérifier les dépendances des `useEffect` et `useMemo`
2. Utiliser `React.memo` sur les composants enfants coûteux
3. Vérifier que les query keys ne changent pas a chaque render

### La mémoire augmente avec le temps

**Cause probable :** Listeners non nettoyés, channels Supabase non fermés.

**Vérification :** Les hooks de realtime doivent retourner un cleanup dans `useEffect` :

```typescript
useEffect(() => {
  const channel = createInterventionsChannel(onEvent)
  return () => { supabase.removeChannel(channel) }
}, [])
```
