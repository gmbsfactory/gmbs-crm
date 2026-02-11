# ✅ Corrections Realtime Appliquées

## 📝 Résumé des Modifications

### 1. Correction du Matching des Query Keys (`src/lib/realtime/cache-sync.ts`)

**Problème identifié :**
- `interventionKeys.invalidateLists()` retourne `["interventions", "list", "light"]`
- Mais les vraies query keys sont `["interventions", "list", params]` ou `["interventions", "light", params]`
- Le pattern ne matchait pas les queries existantes

**Solution appliquée :**
- Utilisation de `interventionKeys.lists()` avec `exact: false` pour matcher toutes les queries `["interventions", "list", ...]`
- Utilisation de `interventionKeys.lightLists()` avec `exact: false` pour matcher toutes les queries `["interventions", "light", ...]`
- Mise à jour séparée des listes complètes et light

**Fichiers modifiés :**
- `src/lib/realtime/cache-sync.ts` : lignes 111-169, 313-352

### 2. Ajout de Logs de Debug

**Logs ajoutés dans `src/lib/realtime/cache-sync.ts` :**
- Log des événements reçus (INSERT/UPDATE/DELETE)
- Log des soft deletes détectés
- Log du nombre de queries mises à jour

**Logs ajoutés dans `src/lib/realtime/realtime-client.ts` :**
- Log du payload reçu
- Log du statut de souscription (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED)

**Logs ajoutés dans `src/hooks/useInterventionsRealtime.ts` :**
- Log d'initialisation
- Log de nettoyage

**Fichiers modifiés :**
- `src/lib/realtime/cache-sync.ts` : lignes 102, 106, 169, 310, 352
- `src/lib/realtime/realtime-client.ts` : lignes 33, 39-49
- `src/hooks/useInterventionsRealtime.ts` : lignes 30, 37, 46

## 🎯 Prochaines Étapes

1. **Vérifier la configuration Supabase** (voir `docs/VERIFICATION_REALTIME.md`)
   - Activer Realtime dans `supabase/config.toml`
   - Vérifier les permissions RLS
   - Vérifier que la table est dans la publication Realtime

2. **Tester dans le navigateur**
   - Ouvrir `/interventions` avec deux navigateurs
   - Vérifier les logs dans la console
   - Tester INSERT/UPDATE/DELETE

3. **Vérifier les logs attendus**
   - `[Realtime] ✅ Channel souscrit avec succès`
   - `[Realtime] Événement reçu: INSERT/UPDATE/DELETE`
   - `[cache-sync] Événement ... pour intervention ...`
   - `[cache-sync] X queries de listes complètes mises à jour`

## 📋 Checklist de Vérification

- [ ] Realtime activé dans `supabase/config.toml`
- [ ] Table `interventions` dans la publication Realtime
- [ ] Permissions RLS correctes
- [ ] Logs `[Realtime] ✅ Channel souscrit` visibles dans la console
- [ ] Événements INSERT/UPDATE/DELETE reçus dans la console
- [ ] Mises à jour visibles dans l'UI sans refresh en < 500ms
- [ ] Soft deletes retirent immédiatement les interventions
- [ ] Synchronisation multi-onglets fonctionne

## 🔍 Dépannage

Si les événements ne sont pas reçus :
1. Vérifier les logs dans la console du navigateur
2. Vérifier la configuration Supabase (voir `docs/VERIFICATION_REALTIME.md`)
3. Vérifier les permissions RLS
4. Vérifier que le channel est bien souscrit (`[Realtime] ✅ Channel souscrit`)

Si les événements sont reçus mais l'UI ne se met pas à jour :
1. Vérifier que `updatedListCount` et `updatedLightCount` sont > 0 dans les logs
2. Vérifier que les query keys matchent (voir logs `[cache-sync]`)
3. Vérifier que `InterventionRealtimeProvider` est monté dans `app/interventions/page.tsx`

## 📚 Documentation

Voir `docs/VERIFICATION_REALTIME.md` pour les instructions détaillées de vérification.

