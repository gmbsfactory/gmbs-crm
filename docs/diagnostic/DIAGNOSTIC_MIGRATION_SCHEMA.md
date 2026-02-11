# 🔍 DIAGNOSTIC COMPLET - Migration Schéma BDD

## 📌 PROBLÈME IDENTIFIÉ

**Erreur Frontend:**
```
HTTP 500: {"error":"column interventions.agence does not exist"}
XHRGET http://localhost:54321/functions/v1/interventions/interventions
```

**Cause Racine:** Le schéma de base de données a été migré vers un nouveau format avec des colonnes UUID (`agence_id`, `assigned_user_id`, etc.) mais plusieurs parties du code utilisent encore les anciennes colonnes texte (`agence`, `attribue_a`, etc.).

---

## 🗂️ NOUVEAU SCHÉMA (Cible)

### Table `interventions` - Colonnes Principales
```sql
- agence_id UUID (FK vers agencies.id)        ❌ PAS agence TEXT
- client_id UUID (FK vers clients.id)
- assigned_user_id UUID (FK vers users.id)    ❌ PAS attribue_a TEXT
- statut_id UUID (FK vers intervention_statuses.id) ❌ PAS statut TEXT
- metier_id UUID (FK vers metiers.id)         ❌ PAS type/metier TEXT
```

### Tables de Référence
```sql
users (id UUID, username TEXT, firstname TEXT, lastname TEXT, code_gestionnaire TEXT)
agencies (id UUID, label TEXT, code TEXT)
intervention_statuses (id UUID, code TEXT, label TEXT, color TEXT)
metiers (id UUID, code TEXT, label TEXT)
```

---

## ❌ FICHIERS À CORRIGER

### 1️⃣ **CRITIQUE** - Edge Functions (cause l'erreur 500)

#### `supabase/functions/cache/redis-client.ts`
**Lignes 174, 250:** 
```typescript
// ❌ INCORRECT
.select('id, date, agence, contexte_intervention, ...')

// ✅ CORRECT
.select('id, date, agence_id, contexte_intervention, ...')
```

**Ligne 257:**
```typescript
// ❌ INCORRECT
query = query.eq('agence', params.agence);

// ✅ CORRECT
query = query.eq('agence_id', params.agence);
```

**Ligne 260:**
```typescript
// ❌ INCORRECT
query = query.eq('attribue_a', params.user);

// ✅ CORRECT
query = query.eq('assigned_user_id', params.user);
```

#### `supabase/functions/interventions/index.ts`
**⚠️ ANCIENNE EDGE FUNCTION - À DÉSACTIVER**

Cette fonction utilise l'ancien schéma. Deux options :
- **Option A (Recommandée):** Supprimer complètement ce fichier
- **Option B:** Renommer le dossier en `interventions-v1-deprecated/`

**Lignes problématiques:**
- Ligne 68: `.eq('agence', agence)` → `.eq('agence_id', agence)`
- Ligne 106, 277: `agence: data.agence` (utilise ancien champ)

---

### 2️⃣ **IMPORTANT** - API Backend Next.js

#### `src/lib/api/interventions.ts`
**Lignes 130, 145:**
```typescript
// ❌ INCORRECT
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// ✅ CORRECT
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**Ligne 147:**
```typescript
// ❌ INCORRECT
.eq("agence", agency.trim())

// ✅ CORRECT
.eq("agence_id", agency.trim())
```

---

### 3️⃣ **IMPORTANT** - Hooks Frontend

#### `src/hooks/useInterventionForm.ts`
**Lignes 106, 122:**
```typescript
// ❌ INCORRECT
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// ✅ CORRECT
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**Ligne 124:**
```typescript
// ❌ INCORRECT
.eq("agence", agency)

// ✅ CORRECT
.eq("agence_id", agency)
```

---

### 4️⃣ **MOYEN** - API Routes

#### `app/api/chat/actions/route.ts`
**Lignes 116, 144:**
```typescript
// ❌ INCORRECT
.select('id, statut, agence, contexte_intervention, ...')

// ✅ CORRECT
.select('id, statut_id, agence_id, contexte_intervention, ...')
```

---

## ✅ FICHIERS DÉJÀ CORRECTS

### `src/lib/supabase-api-v2.ts` ✅
- Utilise correctement `agence_id`, `assigned_user_id`, etc.
- Mapping `mapInterventionRecord()` transforme les UUIDs en champs legacy pour la compatibilité UI

### `supabase/functions/interventions-v2/index.ts` ✅
- Utilise le nouveau schéma
- Colonne `agence_id` utilisée correctement

### `src/hooks/useInterventions.ts` ✅
- Appelle `interventionsApiV2.getAll()` qui utilise le bon schéma

---

## 🎯 STRATÉGIE DE CORRECTION

### Phase 1: Corriger les Edge Functions (URGENT - cause l'erreur 500)
1. Corriger `supabase/functions/cache/redis-client.ts`
2. Désactiver/supprimer `supabase/functions/interventions/index.ts`
3. Redéployer les fonctions

### Phase 2: Corriger le Backend Next.js
1. Corriger `src/lib/api/interventions.ts`
2. Corriger `src/hooks/useInterventionForm.ts`
3. Corriger `app/api/chat/actions/route.ts`

### Phase 3: Vérification
1. Tester le fetching des interventions
2. Vérifier que les filtres par agence fonctionnent
3. Vérifier la création/modification d'interventions

---

## 🔄 MAPPING COMPLET DES COLONNES

### Interventions
```
ANCIEN → NOUVEAU
agence → agence_id (UUID)
attribue_a → assigned_user_id (UUID)
statut → statut_id (UUID)
type/metier → metier_id (UUID)
date_intervention → date (conservé)
```

### Artisans
```
ANCIEN → NOUVEAU
gestionnaire → gestionnaire_id (UUID)
statut_artisan → statut_id (UUID)
statut_inactif → is_active (inversé: false = inactif)
```

---

## 📝 NOTES IMPORTANTES

1. **Champs Legacy Conservés:** Le mapping dans `supabase-api-v2.ts` crée des champs legacy (`agence`, `attribueA`, etc.) pour la compatibilité UI, mais ils sont dérivés des UUIDs + tables de référence.

2. **Cache de Référence:** `getReferenceCache()` charge les tables users/agencies/statuses une fois et les met en cache pour éviter les N+1 queries.

3. **Pas de Duplication de Types:** Les types `Intervention` et `Artisan` sont exportés depuis `supabase-api-v2.ts`, ne pas créer de nouveaux types.

4. **Edge Functions V2:** Le frontend doit exclusivement utiliser l'API V2 (`interventionsApiV2`, `artisansApiV2`).

---

## ✅ CHECKLIST DE VALIDATION

- [ ] Les interventions s'affichent dans la liste
- [ ] Le filtre par agence fonctionne
- [ ] Le filtre par utilisateur assigné fonctionne
- [ ] La création d'intervention utilise `agence_id`
- [ ] La modification d'intervention utilise `agence_id`
- [ ] Les champs legacy (agence, attribueA) sont présents dans les objets retournés
- [ ] Pas d'erreur "column does not exist" dans les logs

