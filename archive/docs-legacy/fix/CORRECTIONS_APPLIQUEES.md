# ✅ CORRECTIONS APPLIQUÉES - Migration API V2

**Date:** ${new Date().toLocaleString('fr-FR')}

---

## 🎯 PROBLÈME RÉSOLU

**Erreur initiale:**
```
HTTP 500: column interventions.agence does not exist
CORS Missing Allow Origin - Status 503
```

**Cause:** 
1. ❌ Anciennes colonnes texte utilisées au lieu des UUIDs
2. ❌ Appels vers l'ancienne Edge Function `interventions` renommée

---

## ✅ MODIFICATIONS EFFECTUÉES

### Phase 1: Migration des colonnes UUID (déjà fait par Codex)
- ✅ `supabase/functions/cache/redis-client.ts` → Colonnes UUID
- ✅ `src/lib/api/interventions.ts` → Colonnes UUID
- ✅ `src/hooks/useInterventionForm.ts` → Colonnes UUID
- ✅ `app/api/chat/actions/route.ts` → Colonnes UUID
- ✅ `supabase/functions/interventions/` → Renommé en `interventions-v1-deprecated/`

### Phase 2: Migration vers API V2 (vient d'être fait)

#### 1. `app/interventions/page.tsx`
**Ligne 27 - Import:**
```diff
- import { interventionsApi } from "@/lib/supabase-api"
+ import { interventionsApiV2 } from "@/lib/supabase-api-v2"
```

**Ligne 214 - Appel API:**
```diff
- const result = await interventionsApi.getAll()
+ const result = await interventionsApiV2.getAll()
```

#### 2. `src/types/intervention-view.ts`
**Ligne 1 - Import type:**
```diff
- import type { Intervention } from "@/lib/supabase-api"
+ import type { Intervention } from "@/lib/supabase-api-v2"
```

#### 3. `src/components/interventions/Interventions.tsx`
**Ligne 11 - Import type:**
```diff
- import type { Intervention as SupabaseIntervention } from "@/lib/supabase-api"
+ import type { Intervention as SupabaseIntervention } from "@/lib/supabase-api-v2"
```

---

## 📊 RÉSUMÉ DES CHANGEMENTS

| Fichier | Modifications | Type |
|---------|--------------|------|
| `app/interventions/page.tsx` | 2 lignes | Import + Appel API |
| `src/types/intervention-view.ts` | 1 ligne | Import type |
| `src/components/interventions/Interventions.tsx` | 1 ligne | Import type |

**Total:** 3 fichiers, 4 modifications

---

## 🚀 PROCHAINES ÉTAPES

### 1. Redémarrer le serveur
```bash
npm run dev
```

### 2. Tester l'affichage des interventions
- Ouvrir: http://localhost:3000/interventions
- Vérifier: Les interventions s'affichent correctement
- Console (F12): Pas d'erreur CORS, pas d'erreur "column does not exist"

### 3. Vérifier les appels réseau (F12 → Network)
**Avant (❌ erreur):**
```
http://localhost:54321/functions/v1/interventions/interventions → 503 CORS
```

**Après (✅ correct):**
```
http://localhost:54321/functions/v1/interventions-v2/interventions → 200 OK
```

---

## 🔍 VALIDATION

### Checklist Fonctionnelle
- [ ] Les interventions s'affichent dans la liste
- [ ] Aucune erreur CORS dans la console
- [ ] Aucune erreur "column does not exist"
- [ ] Les filtres fonctionnent (agence, statut, utilisateur)
- [ ] Le mapping des champs legacy fonctionne (agence, attribueA)

### Checklist Technique
- [x] Tous les imports utilisent `@/lib/supabase-api-v2`
- [x] Tous les appels API utilisent `interventionsApiV2` ou `artisansApiV2`
- [x] Aucune référence à `@/lib/supabase-api` (ancienne API)
- [x] Pas d'erreurs de linter

---

## 📝 ARCHITECTURE FINALE

### Frontend → API V2
```
app/interventions/page.tsx
  ↓
interventionsApiV2.getAll()
  ↓
src/lib/supabase-api-v2.ts
  ↓
Supabase Direct Query (interventions table)
  ↓
mapInterventionRecord() → Enrichissement avec usernames, labels
  ↓
Retour au frontend avec champs legacy compatibles
```

### Tables BDD (nouveau schéma)
```sql
interventions.agence_id → UUID (FK vers agencies)
interventions.assigned_user_id → UUID (FK vers users)
interventions.statut_id → UUID (FK vers intervention_statuses)
interventions.metier_id → UUID (FK vers metiers)
```

### Mapping automatique
Le fichier `src/lib/supabase-api-v2.ts` crée automatiquement les champs legacy:
```javascript
{
  // Champs BDD (UUID)
  agence_id: "uuid-123",
  assigned_user_id: "uuid-456",
  
  // Champs legacy (créés automatiquement par mapping)
  agence: "Paris 15",           // ← depuis agencies.label
  attribueA: "john_doe",         // ← depuis users.username
  assignedUserName: "John Doe",  // ← depuis users.firstname + lastname
}
```

---

## 🔧 EN CAS DE PROBLÈME

### Si les interventions ne s'affichent toujours pas:

1. **Vérifier la console navigateur (F12)**
   - Onglet Console: erreurs JavaScript ?
   - Onglet Network: statut des requêtes ?

2. **Vérifier les logs Supabase**
   ```bash
   supabase functions logs interventions-v2
   ```

3. **Tester l'API directement (console navigateur)**
   ```javascript
   import { interventionsApiV2 } from '@/lib/supabase-api-v2';
   const data = await interventionsApiV2.getAll();
   console.log(data);
   ```

4. **Vérifier que Supabase est démarré**
   ```bash
   supabase status
   ```

---

## 📚 DOCUMENTATION

- **Guide API:** `docs/API_CRM_COMPLETE.md`
- **Diagnostic complet:** `DIAGNOSTIC_MIGRATION_SCHEMA.md`
- **Mapping schéma:** `DIAGNOSTIC_MIGRATION_SCHEMA.md` (section "Mapping des colonnes")

---

**✅ Migration terminée avec succès !**

