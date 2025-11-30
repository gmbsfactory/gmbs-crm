# Fix : Chaîne de statut - Codes DB vs Frontend

## 🐛 Problème identifié

Le test `test_intervention_statut_transition.sql` échouait à l'étape 4 : le statut cible restait `DEMANDE` alors que l'intervention passait en `INTER_TERMINEE`.

### Cause racine

**Incohérence entre les codes de statut utilisés dans le frontend et ceux dans la base de données :**

- **Base de données** (table `intervention_statuses`) :
  - `INTER_EN_COURS` - "Inter en cours"
  - `INTER_TERMINEE` - "Inter terminée"

- **Frontend** (config TypeScript) :
  - `EN_COURS` - "En cours"
  - `TERMINE` - "Terminé"

### Impact

Le service `AutomaticTransitionService` utilisait la chaîne de statut configurée avec les codes frontend (`EN_COURS`, `TERMINE`), qui ne correspondaient pas aux codes DB (`INTER_EN_COURS`, `INTER_TERMINEE`).

Résultat :
1. Lors d'une transition vers `INTER_TERMINEE` (code DB)
2. Le service cherchait les statuts intermédiaires dans la chaîne `['DEMANDE', 'DEVIS_ENVOYE', 'VISITE_TECHNIQUE', 'ACCEPTE', 'EN_COURS', 'TERMINE']`
3. Le code `INTER_TERMINEE` n'était pas trouvé dans la chaîne (car la chaîne contenait `TERMINE`)
4. Les transitions intermédiaires n'étaient pas créées correctement

## ✅ Solution appliquée

### 1. Mise à jour de la chaîne de statut

**Fichier :** `src/config/intervention-status-chains.ts`

```typescript
export const INTERVENTION_STATUS_CHAINS = {
    MAIN_PROGRESSION: [
        'DEMANDE',
        'DEVIS_ENVOYE',
        'VISITE_TECHNIQUE',
        'ACCEPTE',
        'INTER_EN_COURS',  // ✅ Code DB (au lieu de EN_COURS)
        'INTER_TERMINEE'   // ✅ Code DB (au lieu de TERMINE)
    ] as InterventionStatusKey[],
    
    VISIT_FIRST_PROGRESSION: [
        'DEMANDE',
        'VISITE_TECHNIQUE',
        'ACCEPTE',
        'INTER_EN_COURS',  // ✅ Code DB
        'INTER_TERMINEE'   // ✅ Code DB
    ] as InterventionStatusKey[],
}
```

### 2. Mise à jour des types TypeScript

**Fichier :** `src/config/interventions.ts`

#### Type étendu

```typescript
export type InterventionStatusKey =
  | "DEMANDE"
  | "DEVIS_ENVOYE"
  | "VISITE_TECHNIQUE"
  | "REFUSE"
  | "ANNULE"
  | "STAND_BY"
  | "ACCEPTE"
  | "EN_COURS"
  | "TERMINE"
  | "INTER_EN_COURS"  // ✅ Ajouté (code DB)
  | "INTER_TERMINEE"  // ✅ Ajouté (code DB)
  | "SAV"
  | "ATT_ACOMPTE"
```

#### Configurations ajoutées

```typescript
export const INTERVENTION_STATUS: Record<InterventionStatusKey, InterventionStatusConfig> = {
  // ... autres statuts ...
  
  INTER_EN_COURS: {
    value: "INTER_EN_COURS",
    label: "Inter en cours",
    description: "Intervention en réalisation (code DB)",
    color: "bg-purple-500",
    hexColor: "#A855F7",
    icon: Loader2,
  },
  
  INTER_TERMINEE: {
    value: "INTER_TERMINEE",
    label: "Inter terminée",
    description: "Travaux terminés (code DB)",
    color: "bg-sky-500",
    hexColor: "#0EA5E9",
    icon: ShieldAlert,
  },
}
```

### 3. Mise à jour des listes d'ordre

Les tableaux suivants ont été mis à jour pour inclure les nouveaux codes :
- `INTERVENTION_STATUS_ORDER`
- `STATUS_KEYS`
- `STATUS_POSITIONS`

## 🧪 Test de vérification

Un nouveau fichier de test a été créé : `supabase/samples/sql/test_fix_status_chain.sql`

### Étapes du test

1. ✅ Vérifier que `INTER_EN_COURS` et `INTER_TERMINEE` existent dans la DB
2. ✅ Créer une intervention avec le statut `DEMANDE`
3. ✅ Mettre à jour l'intervention vers `INTER_TERMINEE`
4. ✅ Vérifier que toutes les transitions intermédiaires sont créées
5. ✅ Vérifier que la chaîne complète est présente
6. ✅ Nettoyer les données de test

### Résultat attendu

Lors de la mise à jour d'une intervention de `DEMANDE` vers `INTER_TERMINEE`, les transitions suivantes doivent être créées automatiquement :

1. `NULL` → `DEMANDE` (création initiale)
2. `DEMANDE` → `DEVIS_ENVOYE`
3. `DEVIS_ENVOYE` → `VISITE_TECHNIQUE`
4. `VISITE_TECHNIQUE` → `ACCEPTE`
5. `ACCEPTE` → `INTER_EN_COURS`
6. `INTER_EN_COURS` → `INTER_TERMINEE`

## 📋 Notes importantes

### Codes à utiliser

- **Dans le code frontend/TypeScript** : Utiliser les codes DB `INTER_EN_COURS` et `INTER_TERMINEE`
- **Dans les requêtes SQL** : Utiliser les codes DB `INTER_EN_COURS` et `INTER_TERMINEE`
- **Dans la configuration** : Les codes `EN_COURS` et `TERMINE` restent disponibles pour compatibilité mais ne doivent plus être utilisés dans les nouvelles chaînes de transition

### Migration

Les anciennes références à `EN_COURS` et `TERMINE` dans le code applicatif devront être progressivement migrées vers `INTER_EN_COURS` et `INTER_TERMINEE`.

## 🔍 Fichiers modifiés

1. ✅ `src/config/intervention-status-chains.ts` - Chaînes de statut
2. ✅ `src/config/interventions.ts` - Types et configurations
3. ✅ `supabase/samples/sql/test_fix_status_chain.sql` - Test de vérification (nouveau)
4. ✅ `docs/fixes/fix_status_chain_codes.md` - Documentation (ce fichier)

## ⚡ Fonction SQL pour updates directs

### Problème : Logique dans l'API, pas dans les triggers

La logique de création de la chaîne complète de transitions est dans **`AutomaticTransitionService`** (TypeScript), PAS dans les triggers SQL.

**Impact :**
- ✅ Les updates via l'API créent la chaîne complète
- ❌ Les updates SQL directs (`UPDATE interventions SET statut_id = ...`) ne créent qu'UNE transition

### Solution : Fonction RPC SQL

**Fichier :** `supabase/migrations/00019_status_update_with_chain.sql`

Une nouvelle fonction SQL réplique la logique de `AutomaticTransitionService` :

```sql
SELECT update_intervention_status_with_chain(
  intervention_uuid,
  'INTER_TERMINEE',
  user_uuid,
  '{"note": "Test"}'::jsonb
);
```

Cette fonction :
1. ✅ Récupère le statut actuel
2. ✅ Trouve les positions dans la chaîne
3. ✅ Crée toutes les transitions intermédiaires
4. ✅ Met à jour le statut de l'intervention

### Utilisation dans les tests

Les tests SQL ont été mis à jour pour utiliser cette fonction :

```sql
-- ❌ ANCIEN (ne créait qu'une transition)
UPDATE interventions 
SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'INTER_TERMINEE')
WHERE id_inter = 'YOUR_ID';

-- ✅ NOUVEAU (crée la chaîne complète)
SELECT update_intervention_status_with_chain(
  (SELECT id FROM interventions WHERE id_inter = 'YOUR_ID'),
  'INTER_TERMINEE',
  NULL,
  '{"test": true}'::jsonb
);
```

## 🚀 Prochaines étapes

1. ✅ Appliquer la migration `00019_status_update_with_chain.sql`
2. Tester le fix avec le script SQL `test_fix_status_chain.sql`
3. Vérifier que `test_intervention_statut_transition.sql` passe maintenant
4. Identifier et migrer les références à `EN_COURS` et `TERMINE` dans le code
5. Déployer en production



