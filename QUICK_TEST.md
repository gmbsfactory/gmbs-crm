# 🚀 Test rapide - Transitions de statut

## ⚡ Test automatique - Logique API (30 secondes) ⭐ RECOMMANDÉ

```bash
npm run test:status-transition
```

**Ce que ce test fait :**
1. ✅ Crée une intervention avec le statut `DEMANDE`
2. ✅ Simule `interventionsApi.update()` :
   - Appelle `AutomaticTransitionService.executeTransition()` (comme l'API)
   - Crée les transitions une par une via `log_status_transition_from_api`
   - Fait un UPDATE de l'intervention
3. ✅ Vérifie que **6 transitions** sont créées automatiquement
4. ✅ Nettoie les données de test

**Résultat attendu :**
```
✅ TEST RÉUSSI - Chaîne complète créée (comme l'API)
```

---

## ⚡ Test automatique - Fonction SQL (30 secondes)

```bash
npm run test:status-transition:sql
```

**Ce que ce test fait :**
1. ✅ Crée une intervention avec le statut `DEMANDE`
2. ✅ Appelle directement la fonction SQL `update_intervention_status_with_chain`
3. ✅ Vérifie que **6 transitions** sont créées automatiquement
4. ✅ Nettoie les données de test

**Résultat attendu :**
```
✅ TEST RÉUSSI - Chaîne complète créée correctement
```

**Note :** Ce test utilise la fonction SQL directement, pas la logique TypeScript de l'API.

---

## 🔍 Test SQL manuel (2 minutes)

### Étape 1 : Créer une intervention
```sql
INSERT INTO interventions (
  id_inter, contexte_intervention, adresse, ville, code_postal,
  statut_id, agence_id, date, is_active
) 
SELECT 
  'TEST_MANUAL_' || now()::text,
  'Test manuel',
  'Test', 'Paris', '75001',
  (SELECT id FROM intervention_statuses WHERE code = 'DEMANDE'),
  (SELECT id FROM agencies WHERE is_active = true LIMIT 1),
  now(), true
RETURNING id, id_inter;
```

📝 **Notez l'`id_inter` retourné** (ex: `TEST_MANUAL_2025-01-29 14:30:22`)

### Étape 2 : Mettre à jour vers INTER_TERMINEE
```sql
SELECT update_intervention_status_with_chain(
  (SELECT id FROM interventions WHERE id_inter = 'VOTRE_ID_INTER'),
  'INTER_TERMINEE',
  NULL,
  '{"test": true}'::jsonb
);
```

### Étape 3 : Vérifier la chaîne
```sql
SELECT 
  STRING_AGG(to_status_code, ' → ' ORDER BY transition_date) as chaine
FROM intervention_status_transitions
WHERE intervention_id = (SELECT id FROM interventions WHERE id_inter = 'VOTRE_ID_INTER');
```

**Résultat attendu :**
```
DEMANDE → DEVIS_ENVOYE → VISITE_TECHNIQUE → ACCEPTE → INTER_EN_COURS → INTER_TERMINEE
```

### Étape 4 : Nettoyer
```sql
DELETE FROM interventions WHERE id_inter = 'VOTRE_ID_INTER';
```

---

## 📊 Voir la chaîne d'une intervention réelle

```sql
-- Remplacez 'H1' par votre id_inter
SELECT 
  i.id_inter,
  STRING_AGG(
    ist.to_status_code, 
    ' → ' 
    ORDER BY ist.transition_date
  ) as chaine_statuts,
  COUNT(*) as nb_transitions
FROM interventions i
LEFT JOIN intervention_status_transitions ist ON ist.intervention_id = i.id
WHERE i.id_inter = 'H1'
GROUP BY i.id_inter;
```

---

## ❓ Aide

### Le test échoue ?

**Erreur : fonction non trouvée**
```bash
npm run db:reset
```

**Chaîne incomplète (1 transition au lieu de 6)**
- Vérifiez que la migration `00019_status_update_with_chain.sql` est appliquée
- N'utilisez PAS `UPDATE interventions SET statut_id = ...` directement
- Utilisez `update_intervention_status_with_chain()`

### Plus d'infos
- 📚 Documentation complète : `docs/fixes/TESTING_STATUS_TRANSITIONS.md`
- 🔧 Guide d'utilisation : `docs/guides/status_transitions_guide.md`
- 🐛 Fix détaillé : `docs/fixes/fix_status_chain_codes.md`

