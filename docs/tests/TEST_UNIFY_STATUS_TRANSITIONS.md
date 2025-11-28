# Tests : Unification des transitions de statut

## Objectif
Valider que l'unification de la création de transitions élimine les doublons et race conditions.

## Prérequis
1. Migration `00016_unify_status_transitions.sql` appliquée
2. Base de données avec au moins une intervention de test
3. Accès aux logs de la base de données

## Tests à effectuer

### Test 1 : Transition simple via `transitionStatus()` API
**Objectif** : Vérifier qu'une seule transition est créée

**Étapes** :
1. Récupérer une intervention avec un statut connu (ex: `DEMANDE`)
2. Noter le nombre de transitions existantes pour cette intervention
3. Appeler `transitionStatus(id, { status: 'DEVIS_ENVOYE' })`
4. Vérifier dans la table `intervention_status_transitions` :
   - Une seule nouvelle transition doit être créée
   - `source` doit être `'api'`
   - `metadata->>'created_by'` doit être `'AutomaticTransitionService'`
   - `metadata->>'updated_via'` doit être `'transitionStatus_api'`

**Résultat attendu** : ✅ 1 transition créée, pas de doublon

---

### Test 2 : Transition via `interventionsApi.update()`
**Objectif** : Vérifier qu'une seule transition est créée via l'API V2

**Étapes** :
1. Récupérer une intervention avec un statut connu
2. Noter le nombre de transitions existantes
3. Appeler `interventionsApi.update(id, { statut_id: newStatusId })`
4. Vérifier dans la table `intervention_status_transitions` :
   - Une seule nouvelle transition doit être créée
   - `source` doit être `'api'`
   - `metadata->>'created_by'` doit être `'AutomaticTransitionService'`
   - `metadata->>'updated_via'` doit être `'api_v2'`

**Résultat attendu** : ✅ 1 transition créée, pas de doublon

---

### Test 3 : Transition avec statuts intermédiaires
**Objectif** : Vérifier que toutes les transitions intermédiaires sont créées sans doublons

**Étapes** :
1. Créer une nouvelle intervention avec statut `TERMINE` directement
2. Vérifier dans `intervention_status_transitions` :
   - Toutes les transitions de la chaîne doivent être créées :
     - `DEMANDE` → `DEVIS_ENVOYE`
     - `DEVIS_ENVOYE` → `VISITE_TECHNIQUE`
     - `VISITE_TECHNIQUE` → `ACCEPTE`
     - `ACCEPTE` → `EN_COURS`
     - `EN_COURS` → `TERMINE`
   - Chaque transition doit avoir `source='api'`
   - Chaque transition doit avoir `metadata->>'created_by' = 'AutomaticTransitionService'`
   - Pas de doublons

**Résultat attendu** : ✅ Toutes les transitions créées, pas de doublons

---

### Test 4 : Modification directe en DB (trigger de sécurité)
**Objectif** : Vérifier que le trigger fonctionne toujours pour les modifications directes

**Étapes** :
1. Récupérer une intervention avec un statut connu
2. Noter le nombre de transitions existantes
3. Exécuter directement en SQL :
   ```sql
   UPDATE interventions 
   SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'ACCEPTE')
   WHERE id = '<intervention_id>';
   ```
4. Vérifier dans `intervention_status_transitions` :
   - Une nouvelle transition doit être créée
   - `source` doit être `'trigger'`
   - `metadata->>'safety_net'` doit être `true`
   - `metadata->>'note'` doit contenir "modification directe en DB"

**Résultat attendu** : ✅ 1 transition créée par le trigger

---

### Test 5 : Double transition rapide (race condition)
**Objectif** : Vérifier qu'une seule transition est créée même en cas de double appel rapide

**Étapes** :
1. Récupérer une intervention avec un statut connu
2. Noter le nombre de transitions existantes
3. Appeler rapidement deux fois `transitionStatus()` avec le même nouveau statut :
   ```typescript
   await Promise.all([
     transitionStatus(id, { status: 'DEVIS_ENVOYE' }),
     transitionStatus(id, { status: 'DEVIS_ENVOYE' })
   ])
   ```
4. Vérifier dans `intervention_status_transitions` :
   - Une seule nouvelle transition doit être créée (ou au maximum 2 si timing parfait)
   - Le trigger doit détecter la première transition et ignorer la seconde

**Résultat attendu** : ✅ 1 transition créée (ou 2 max si timing parfait), pas de doublons massifs

---

### Test 6 : Transition via Edge Function
**Objectif** : Vérifier que l'Edge Function ne crée pas de doublons

**Étapes** :
1. Récupérer une intervention avec un statut connu
2. Noter le nombre de transitions existantes
3. Appeler l'Edge Function `interventions-v2` avec un changement de statut
4. Vérifier dans `intervention_status_transitions` :
   - Une seule nouvelle transition doit être créée
   - `source` doit être `'api'`
   - `metadata->>'created_by'` doit être `'EdgeFunction'` ou `'AutomaticTransitionService'`
   - `metadata->>'updated_via'` doit être `'edge_function'`

**Résultat attendu** : ✅ 1 transition créée, pas de doublon

---

## Requêtes SQL utiles pour vérification

### Compter les transitions pour une intervention
```sql
SELECT 
  COUNT(*) as total_transitions,
  COUNT(*) FILTER (WHERE source = 'api') as api_transitions,
  COUNT(*) FILTER (WHERE source = 'trigger') as trigger_transitions
FROM intervention_status_transitions
WHERE intervention_id = '<intervention_id>'
  AND transition_date > NOW() - INTERVAL '1 minute';
```

### Voir les dernières transitions avec metadata
```sql
SELECT 
  id,
  intervention_id,
  from_status_code,
  to_status_code,
  source,
  transition_date,
  metadata->>'created_by' as created_by,
  metadata->>'updated_via' as updated_via,
  metadata->>'safety_net' as safety_net
FROM intervention_status_transitions
WHERE intervention_id = '<intervention_id>'
ORDER BY transition_date DESC
LIMIT 10;
```

### Vérifier les doublons potentiels
```sql
SELECT 
  intervention_id,
  to_status_code,
  COUNT(*) as count,
  array_agg(id ORDER BY transition_date) as transition_ids,
  array_agg(transition_date ORDER BY transition_date) as transition_dates
FROM intervention_status_transitions
WHERE transition_date > NOW() - INTERVAL '1 hour'
GROUP BY intervention_id, to_status_code
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

## Critères de succès

- ✅ Tous les tests passent
- ✅ Aucun doublon détecté dans les requêtes de vérification
- ✅ Le trigger fonctionne toujours pour les modifications directes en DB
- ✅ Les transitions créées via API ont `source='api'`
- ✅ Les transitions créées via trigger ont `source='trigger'`
- ✅ Les metadata sont correctement renseignées

