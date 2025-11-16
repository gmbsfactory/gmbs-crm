# Guide de Test - Transitions de Statut

Ce guide explique comment tester le système de tracking des transitions de statut pour le Dashboard Administrateur.

## 📋 Prérequis

1. **Migration appliquée** : La migration `20251115000000_create_status_transitions_history.sql` doit être appliquée
2. **Supabase démarré** : `supabase start` ou connexion à la base de production
3. **Données de test** : Au moins quelques interventions dans la base

## 🚀 Méthodes de Test

### Méthode 1 : Tests SQL Directs (Recommandé)

Utilisez le fichier de test SQL fourni :

```bash
# Se connecter à la base Supabase
supabase db connect

# Ou via psql directement
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Exécuter les tests
\i supabase/samples/sql/test_status_transitions.sql
```

**Ou copier-coller les requêtes** dans Supabase Studio (http://localhost:54323)

### Méthode 2 : Test via l'Interface (Test Utilisateur)

1. **Ouvrir l'application** et se connecter
2. **Aller sur la page Interventions**
3. **Changer le statut d'une intervention** (ex: DEMANDE → ACCEPTE)
4. **Vérifier dans la base** que la transition a été enregistrée :

```sql
SELECT 
  ist.*,
  i.id_inter,
  u.username as changed_by
FROM intervention_status_transitions ist
INNER JOIN interventions i ON ist.intervention_id = i.id
LEFT JOIN users u ON ist.changed_by_user_id = u.id
ORDER BY ist.transition_date DESC
LIMIT 10;
```

**Résultat attendu** :
- Une nouvelle ligne avec `source = 'api'`
- `changed_by_user_id` rempli avec votre ID utilisateur
- `transition_date` = maintenant
- `from_status_code` = ancien statut
- `to_status_code` = nouveau statut

### Méthode 3 : Test du Trigger (Filet de Sécurité)

Le trigger doit enregistrer automatiquement les transitions même si l'API ne le fait pas :

```sql
-- 1. Noter le nombre de transitions avant
SELECT COUNT(*) as avant FROM intervention_status_transitions;

-- 2. Modifier directement en base (simule une modification directe)
UPDATE interventions 
SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'DEVIS_ENVOYE')
WHERE id = (SELECT id FROM interventions WHERE is_active = true LIMIT 1);

-- 3. Vérifier qu'une nouvelle transition a été créée
SELECT COUNT(*) as apres FROM intervention_status_transitions;

-- La différence doit être de 1
-- Vérifier que source = 'trigger'
SELECT * FROM intervention_status_transitions 
WHERE source = 'trigger'
ORDER BY transition_date DESC
LIMIT 5;
```

### Méthode 4 : Test de la Fonction SQL

Tester l'enregistrement explicite via la fonction SQL :

```sql
-- Appeler la fonction directement
SELECT log_status_transition_from_api(
  p_intervention_id := (SELECT id FROM interventions WHERE is_active = true LIMIT 1),
  p_from_status_id := (SELECT id FROM intervention_statuses WHERE code = 'DEMANDE'),
  p_to_status_id := (SELECT id FROM intervention_statuses WHERE code = 'ACCEPTE'),
  p_changed_by_user_id := (SELECT id FROM users LIMIT 1),
  p_metadata := '{"test": true}'::jsonb
) as transition_id;

-- Vérifier le résultat
SELECT * FROM intervention_status_transitions 
WHERE source = 'api'
ORDER BY transition_date DESC
LIMIT 1;
```

## ✅ Checklist de Validation

### 1. Structure de la Base
- [ ] Table `intervention_status_transitions` existe
- [ ] Tous les index sont créés
- [ ] Trigger `trg_log_intervention_status_transition_safety` existe
- [ ] Fonction `log_status_transition_from_api()` existe

### 2. Fonctionnement du Trigger
- [ ] Modification directe en DB crée une transition avec `source='trigger'`
- [ ] Le trigger évite les doublons (vérification 2 secondes)
- [ ] Le trigger fonctionne même si l'API échoue

### 3. Fonctionnement de l'API
- [ ] Modification via `interventionsApi.update()` crée une transition avec `source='api'`
- [ ] L'utilisateur est correctement enregistré dans `changed_by_user_id`
- [ ] Les métadonnées sont enregistrées

### 4. Fonctionnement de l'Edge Function
- [ ] Modification via Edge Function crée une transition avec `source='api'`
- [ ] L'utilisateur est récupéré depuis le token JWT

### 5. Cohérence des Données
- [ ] Pas de doublons (même intervention, même statut, même seconde)
- [ ] Toutes les transitions pointent vers des interventions existantes
- [ ] Tous les codes de statut sont valides

### 6. Requêtes du Dashboard
- [ ] Les requêtes utilisent `transition_date` pour filtrer par période
- [ ] Les interventions terminées sont correctement comptées
- [ ] Les statistiques par agence utilisent les transitions

## 🔍 Tests Spécifiques

### Test 1 : Transition Simple
```sql
-- Avant
SELECT id, statut_id FROM interventions WHERE is_active = true LIMIT 1;

-- Modifier via l'API (dans l'interface)

-- Après
SELECT * FROM intervention_status_transitions 
WHERE intervention_id = 'VOTRE_ID'
ORDER BY transition_date DESC;
```

### Test 2 : Plusieurs Transitions
```sql
-- Vérifier l'historique complet d'une intervention
SELECT 
  ist.from_status_code,
  ist.to_status_code,
  ist.transition_date,
  ist.source
FROM intervention_status_transitions ist
WHERE ist.intervention_id = 'VOTRE_ID'
ORDER BY ist.transition_date ASC;
```

### Test 3 : Dashboard Stats
```sql
-- Tester une requête similaire à celle du dashboard
SELECT COUNT(*) as nb_terminees_aujourdhui
FROM intervention_status_transitions ist
WHERE ist.to_status_code = 'INTER_TERMINEE'
  AND ist.transition_date >= CURRENT_DATE
  AND ist.transition_date < CURRENT_DATE + INTERVAL '1 day';
```

## 🐛 Dépannage

### Problème : Aucune transition n'est créée

**Vérifications** :
1. Le trigger existe-t-il ?
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trg_log_intervention_status_transition_safety';
```

2. Le trigger est-il actif ?
```sql
SELECT * FROM pg_trigger 
WHERE tgname = 'trg_log_intervention_status_transition_safety';
```

3. Y a-t-il des erreurs dans les logs ?
```bash
# Vérifier les logs Supabase
supabase logs
```

### Problème : Doublons créés

**Cause** : Le trigger ne détecte pas les transitions récentes

**Solution** : Vérifier que la vérification de doublon fonctionne :
```sql
-- Tester manuellement la détection de doublon
SELECT id
FROM intervention_status_transitions
WHERE intervention_id = 'VOTRE_ID'
  AND to_status_id = (SELECT id FROM intervention_statuses WHERE code = 'ACCEPTE')
  AND transition_date > now() - INTERVAL '2 seconds'
LIMIT 1;
```

### Problème : L'utilisateur n'est pas enregistré

**Vérifications** :
1. L'API récupère-t-elle bien l'utilisateur ?
2. Le token JWT est-il valide dans l'Edge Function ?
3. Vérifier les logs de l'API pour voir si `getUser()` fonctionne

## 📊 Requêtes Utiles pour le Monitoring

### Statistiques Générales
```sql
SELECT 
  source,
  COUNT(*) as nombre,
  COUNT(DISTINCT intervention_id) as interventions_uniques,
  MIN(transition_date) as premiere_transition,
  MAX(transition_date) as derniere_transition
FROM intervention_status_transitions
GROUP BY source;
```

### Transitions Récentes
```sql
SELECT 
  ist.transition_date,
  ist.from_status_code,
  ist.to_status_code,
  ist.source,
  i.id_inter,
  u.username
FROM intervention_status_transitions ist
INNER JOIN interventions i ON ist.intervention_id = i.id
LEFT JOIN users u ON ist.changed_by_user_id = u.id
ORDER BY ist.transition_date DESC
LIMIT 20;
```

### Vérification de Santé
```sql
-- Interventions sans historique
SELECT COUNT(*) as interventions_sans_historique
FROM interventions i
WHERE i.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM intervention_status_transitions ist 
    WHERE ist.intervention_id = i.id
  );
```

## 🎯 Tests Automatisés (Optionnel)

Pour créer des tests automatisés, vous pouvez utiliser :

```typescript
// Exemple de test avec Jest/Vitest
describe('Status Transitions', () => {
  it('should create transition when status changes via API', async () => {
    const intervention = await createTestIntervention();
    const oldStatus = intervention.statut_id;
    
    // Changer le statut
    await interventionsApi.update(intervention.id, {
      statut_id: newStatusId
    });
    
    // Vérifier la transition
    const transitions = await interventionsApi.getStatusTransitions(intervention.id);
    expect(transitions).toHaveLength(1);
    expect(transitions[0].to_status_code).toBe('ACCEPTE');
    expect(transitions[0].source).toBe('api');
  });
});
```

## 📝 Notes

- Les transitions sont créées **avant** la mise à jour de l'intervention
- Le trigger sert de **filet de sécurité** si l'API échoue
- Les doublons sont évités par une vérification temporelle (2 secondes)
- L'historique est **permanent** et ne peut pas être modifié


