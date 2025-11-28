# Implémentation : Unification des transitions de statut

## Résumé
Implémentation complète de la Solution 1 pour unifier la création de transitions de statut et éliminer les doublons et race conditions.

## Fichiers modifiés

### 1. Migration SQL
**Fichier** : `supabase/migrations/00016_unify_status_transitions.sql`
- Modification de `log_intervention_status_transition_safety()` pour détecter les transitions API
- Vérification des transitions avec `source='api'` dans les 5 dernières secondes
- Ajout de commentaires explicatifs

### 2. AutomaticTransitionService
**Fichier** : `src/lib/interventions/automatic-transition-service.ts`
- Ajout de `created_by: 'AutomaticTransitionService'` dans les metadata
- Ajout de `service_version: '1.0'` dans les metadata
- Appliqué dans `createTransition()` pour toutes les transitions créées via le service

### 3. API transitionStatus()
**Fichier** : `src/lib/api/interventions.ts`
- Import de `automaticTransitionService`
- Récupération du statut actuel AVANT l'UPDATE
- Appel à `AutomaticTransitionService.executeTransition()` AVANT l'UPDATE
- Gestion d'erreur avec try/catch pour ne pas bloquer l'UPDATE

### 4. Edge Function
**Fichier** : `supabase/functions/interventions-v2/index.ts`
- Ajout de commentaires explicatifs sur le fonctionnement
- Ajout de `created_by: 'EdgeFunction'` dans les metadata
- Le trigger détectera automatiquement ces transitions via `source='api'`

### 5. interventionsApi.update()
**Fichier** : `src/lib/api/v2/interventionsApi.ts`
- Déjà conforme (utilise AutomaticTransitionService ligne 362)
- Le fallback utilise aussi `log_status_transition_from_api` avec `source='api'`

## Architecture finale

### Flux de création de transitions

1. **Via API (transitionStatus ou interventionsApi.update)** :
   - `AutomaticTransitionService.executeTransition()` est appelé AVANT l'UPDATE
   - Crée les transitions avec `source='api'` et `metadata->>'created_by' = 'AutomaticTransitionService'`
   - L'UPDATE déclenche le trigger SQL
   - Le trigger détecte la transition API existante (5 secondes) et ne crée pas de doublon

2. **Via Edge Function** :
   - Appelle `log_status_transition_from_api` AVANT l'UPDATE
   - Crée une transition avec `source='api'` et `metadata->>'created_by' = 'EdgeFunction'`
   - L'UPDATE déclenche le trigger SQL
   - Le trigger détecte la transition API existante et ne crée pas de doublon

3. **Modification directe en DB** :
   - L'UPDATE déclenche le trigger SQL
   - Le trigger vérifie s'il existe une transition API récente
   - Si non, crée une transition avec `source='trigger'` (filet de sécurité)

## Points clés

- **Fenêtre de détection** : 5 secondes pour les transitions API, 2 secondes pour les autres
- **Source de vérité** : `AutomaticTransitionService` pour toutes les transitions via API
- **Filet de sécurité** : Le trigger SQL fonctionne toujours pour les modifications directes en DB
- **Metadata** : Toutes les transitions créées via API ont `created_by` dans les metadata

## Tests

Voir `docs/tests/TEST_UNIFY_STATUS_TRANSITIONS.md` pour les tests détaillés.

## Prochaines étapes

1. Appliquer la migration `00016_unify_status_transitions.sql`
2. Exécuter les tests de validation
3. Surveiller les logs pour détecter d'éventuels doublons résiduels
4. Passer à la Solution 2 (Validation côté backend)

