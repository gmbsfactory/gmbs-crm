# Guide : Transitions de statut avec chaîne complète

## 📋 Architecture

### Logique de transition

La logique de création automatique des transitions intermédiaires existe en **DEUX endroits** :

1. **TypeScript** : `AutomaticTransitionService` (pour les appels API)
2. **SQL** : `update_intervention_status_with_chain()` (pour les updates directs)

### Chaîne de statut principale

```
DEMANDE → DEVIS_ENVOYE → VISITE_TECHNIQUE → ACCEPTE → INTER_EN_COURS → INTER_TERMINEE
```

**⚠️ Important :** Utiliser les codes DB (`INTER_EN_COURS`, `INTER_TERMINEE`), pas les codes frontend (`EN_COURS`, `TERMINE`).

## 🔄 Méthode 1 : Via l'API TypeScript (Recommandé)

### Update d'intervention

```typescript
import { interventionsApi } from '@/lib/api/v2/interventionsApi';

await interventionsApi.update(interventionId, {
  statut_id: newStatusId,
  // ... autres champs
});
```

**Ce qui se passe :**
1. L'API récupère le statut actuel
2. Appelle `automaticTransitionService.executeTransition()`
3. Crée toutes les transitions intermédiaires
4. Met à jour l'intervention

### Transition de statut directe

```typescript
import { transitionStatus } from '@/lib/api/interventions';

await transitionStatus(interventionId, {
  status: 'INTER_TERMINEE',
  // ... autres champs
});
```

## 🗄️ Méthode 2 : Via SQL direct

### Avec chaîne complète (✅ Recommandé)

```sql
SELECT update_intervention_status_with_chain(
  'intervention-uuid',
  'INTER_TERMINEE',
  'user-uuid',
  '{"note": "Intervention terminée", "updated_via": "manual"}'::jsonb
) as result;
```

**Paramètres :**
- `p_intervention_id` : UUID de l'intervention
- `p_to_status_code` : Code du statut cible (ex: 'INTER_TERMINEE')
- `p_changed_by_user_id` : UUID de l'utilisateur (optionnel, NULL autorisé)
- `p_metadata` : Métadonnées JSON (optionnel)

**Retour :**
```json
{
  "success": true,
  "transitions_created": 5,
  "from_status": "DEMANDE",
  "to_status": "INTER_TERMINEE",
  "intervention_id": "intervention-uuid"
}
```

### Sans chaîne complète (❌ Non recommandé)

```sql
-- ⚠️ Ne créera qu'UNE transition, pas la chaîne complète
UPDATE interventions 
SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'INTER_TERMINEE')
WHERE id = 'intervention-uuid';
```

Le trigger `log_intervention_status_transition_safety` créera une seule transition :
- `DEMANDE` → `INTER_TERMINEE` (sans les intermédiaires)

## 📊 Vérifier les transitions créées

```sql
SELECT 
  ist.from_status_code as statut_source,
  ist.to_status_code as statut_cible,
  ist.transition_date,
  ist.source,
  ist.metadata->>'created_by' as cree_par,
  ist.metadata->>'is_intermediate' as est_intermediaire
FROM intervention_status_transitions ist
WHERE ist.intervention_id = 'intervention-uuid'
ORDER BY ist.transition_date ASC;
```

**Résultat attendu (chaîne complète) :**
```
statut_source | statut_cible        | source | cree_par
--------------|---------------------|--------|----------
NULL          | DEMANDE             | api    | update_intervention_status_with_chain
DEMANDE       | DEVIS_ENVOYE        | api    | update_intervention_status_with_chain
DEVIS_ENVOYE  | VISITE_TECHNIQUE    | api    | update_intervention_status_with_chain
...           | ...                 | ...    | ...
```

## 🧪 Tests

### Test complet

Utilisez le script de test fourni :

```bash
# Ouvrez le fichier dans votre éditeur SQL
supabase/samples/sql/test_fix_status_chain.sql
```

Ou

```bash
supabase/samples/sql/test_intervention_statut_transition.sql
```

### Étapes du test

1. ✅ Créer une intervention avec `DEMANDE`
2. ✅ Appeler `update_intervention_status_with_chain()` vers `INTER_TERMINEE`
3. ✅ Vérifier que 6 transitions sont créées
4. ✅ Vérifier que la chaîne complète est présente
5. ✅ Nettoyer les données de test

## ⚙️ Configuration

### Chaîne personnalisée

Pour modifier la chaîne de statuts, éditez :

**TypeScript :**
```typescript
// src/config/intervention-status-chains.ts
export const INTERVENTION_STATUS_CHAINS = {
  MAIN_PROGRESSION: [
    'DEMANDE',
    'DEVIS_ENVOYE',
    'VISITE_TECHNIQUE',
    'ACCEPTE',
    'INTER_EN_COURS',
    'INTER_TERMINEE'
  ]
}
```

**SQL :**
```sql
-- supabase/migrations/00019_status_update_with_chain.sql
status_chain text[] := ARRAY[
  'DEMANDE', 
  'DEVIS_ENVOYE', 
  'VISITE_TECHNIQUE', 
  'ACCEPTE', 
  'INTER_EN_COURS', 
  'INTER_TERMINEE'
];
```

⚠️ **Les deux doivent être synchronisés !**

## 🔍 Troubleshooting

### Problème : Transitions manquantes

**Symptôme :** Seulement 1 transition créée au lieu de 6.

**Cause :** Utilisation d'un UPDATE direct au lieu de la fonction.

**Solution :** Utiliser `update_intervention_status_with_chain()`.

### Problème : Statut non trouvé

**Symptôme :** Erreur "Statut cible XXX non trouvé".

**Cause :** Utilisation d'un code frontend (`EN_COURS`) au lieu du code DB (`INTER_EN_COURS`).

**Solution :** Utiliser les codes DB dans la chaîne.

### Problème : Doublon de transitions

**Symptôme :** Plusieurs transitions identiques.

**Cause :** Appel multiple de la fonction ou combinaison UPDATE + fonction.

**Solution :** N'utiliser qu'une seule méthode (API ou fonction SQL).

## 📚 Références

- **Migration** : `supabase/migrations/00019_status_update_with_chain.sql`
- **Service TypeScript** : `src/lib/interventions/automatic-transition-service.ts`
- **Configuration** : `src/config/intervention-status-chains.ts`
- **Tests** : `supabase/samples/sql/test_fix_status_chain.sql`

