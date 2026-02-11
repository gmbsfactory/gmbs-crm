# 🔍 DIAGNOSTIC COMPLET - Erreur Interventions

## ❌ PROBLÈME

**Erreur rencontrée:**
```
HTTP 500: {"error":"column interventions.agence does not exist"}
```

**Conséquence:** Les interventions ne s'affichent pas dans le frontend.

---

## 🎯 CAUSE RACINE

Votre schéma de base de données a été migré vers un nouveau format utilisant des **UUIDs** et des **foreign keys**, mais **5 fichiers** utilisent encore les **anciennes colonnes texte**.

### Ancien Schéma (❌ à ne plus utiliser)
```sql
interventions.agence          → TEXT (label de l'agence)
interventions.attribue_a      → TEXT (username)
interventions.statut          → TEXT (code statut)
```

### Nouveau Schéma (✅ à utiliser)
```sql
interventions.agence_id       → UUID (FK vers agencies.id)
interventions.assigned_user_id → UUID (FK vers users.id)
interventions.statut_id       → UUID (FK vers intervention_statuses.id)
```

---

## 📋 FICHIERS À CORRIGER (5 fichiers)

### 🔥 URGENT (cause l'erreur 500)

1. **`supabase/functions/cache/redis-client.ts`**
   - Lignes 174, 250: utilise `.select('agence, ...')` au lieu de `.select('agence_id, ...')`
   - Lignes 253-260: utilise `.eq('agence', ...)` au lieu de `.eq('agence_id', ...)`
   - Aussi problèmes avec `statut_artisan`, `statut_inactif` pour les artisans

2. **`supabase/functions/interventions/index.ts`**
   - **Action:** Renommer ce dossier en `interventions-v1-deprecated/`
   - Cette fonction utilise l'ancien schéma et doit être désactivée

### 🔧 IMPORTANT (cohérence backend)

3. **`src/lib/api/interventions.ts`**
   - Lignes 130, 145, 147: utilise `agence` au lieu de `agence_id`

4. **`src/hooks/useInterventionForm.ts`**
   - Lignes 106, 122, 124: utilise `agence` au lieu de `agence_id`

5. **`app/api/chat/actions/route.ts`**
   - Lignes 116, 144: utilise `agence, statut, attribue_a` au lieu de `agence_id, statut_id, assigned_user_id`

---

## 📖 DOCUMENTS CRÉÉS

J'ai créé 3 documents pour vous aider:

### 1. **DIAGNOSTIC_MIGRATION_SCHEMA.md** (ce fichier)
- Diagnostic complet du problème
- Liste exhaustive des fichiers à corriger
- Mapping complet ancien → nouveau schéma

### 2. **PROMPT_CORRECTION_CODEX.md** ⭐
- **Prompt précis et structuré pour Codex**
- Instructions ligne par ligne pour chaque fichier
- Exemples avant/après pour chaque correction
- Validation finale

### 3. **RESUME_DIAGNOSTIC_FR.md**
- Résumé exécutif en français
- Guideline rapide

---

## 🚀 PROMPT POUR CODEX

**Copiez-collez ce prompt dans Codex:**

```markdown
# MISSION: Corriger les références aux anciennes colonnes de BDD

## CONTEXTE
Le schéma BDD a été migré vers des colonnes UUID (agence_id, assigned_user_id, statut_id) 
mais 5 fichiers utilisent encore les anciennes colonnes texte (agence, attribue_a, statut).

Erreur actuelle: `HTTP 500: column interventions.agence does not exist`

## RÈGLES
1. NE PAS modifier `src/lib/supabase-api-v2.ts` (déjà correct)
2. NE PAS modifier `supabase/functions/interventions-v2/index.ts` (déjà correct)
3. Remplacer TOUTES les références aux colonnes par leurs équivalents UUID

## MAPPING
```
ANCIEN                  →  NOUVEAU
agence                  →  agence_id (UUID)
attribue_a              →  assigned_user_id (UUID)
statut                  →  statut_id (UUID)
type/metier             →  metier_id (UUID)
gestionnaire            →  gestionnaire_id (UUID)
statut_artisan          →  statut_id (UUID)
statut_inactif          →  is_active (inversé: false = inactif)
commentaire             →  suivi_relances_docs
departement             →  (supprimé - utiliser zones[])
```

## TÂCHES (dans cet ordre)

### 1. Renommer l'ancienne Edge Function
```bash
mv supabase/functions/interventions supabase/functions/interventions-v1-deprecated
```

### 2. Corriger `supabase/functions/cache/redis-client.ts`

**Ligne 174** - warmCache interventions:
```typescript
// ANCIEN
.select('id, date, agence, contexte_intervention, adresse, ville, type, statut, sous_statut_text, sous_statut_text_color, prenom_client, nom_client, telephone_client, cout_sst, attribue_a, numero_sst, date_intervention')

// NOUVEAU
.select('id, date, agence_id, contexte_intervention, adresse, ville, metier_id, statut_id, prenom_client, nom_client, telephone_client, cout_sst, assigned_user_id, numero_sst')
```

**Ligne 250** - getInterventionsList select:
```typescript
// ANCIEN
.select('id, date, agence, contexte_intervention, adresse, ville, type, statut, sous_statut_text, sous_statut_text_color, prenom_client, nom_client, telephone_client, cout_sst, attribue_a, numero_sst, date_intervention')

// NOUVEAU
.select('id, date, agence_id, contexte_intervention, adresse, ville, metier_id, statut_id, prenom_client, nom_client, telephone_client, cout_sst, assigned_user_id, numero_sst')
```

**Lignes 253-260** - getInterventionsList filtres:
```typescript
// ANCIEN
if (params.statut) {
  query = query.eq('statut', params.statut);
}
if (params.agence) {
  query = query.eq('agence', params.agence);
}
if (params.user) {
  query = query.eq('attribue_a', params.user);
}

// NOUVEAU
if (params.statut) {
  query = query.eq('statut_id', params.statut);
}
if (params.agence) {
  query = query.eq('agence_id', params.agence);
}
if (params.user) {
  query = query.eq('assigned_user_id', params.user);
}
```

**Ligne 166** - artisansQuery warmCache:
```typescript
// ANCIEN
.select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_artisan, statut_inactif, commentaire, gestionnaire_id, departement')
.eq('statut_inactif', false)

// NOUVEAU
.select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_id, is_active, suivi_relances_docs, gestionnaire_id')
.eq('is_active', true)
```

**Lignes 218-226** - getArtisansList:
```typescript
// ANCIEN
let query = supabase
  .from('artisans')
  .select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_artisan, statut_inactif, commentaire, gestionnaire_id, departement')
  .eq('statut_inactif', false)

if (params.statut) {
  query = query.eq('statut_artisan', params.statut);
}

// NOUVEAU
let query = supabase
  .from('artisans')
  .select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_id, is_active, suivi_relances_docs, gestionnaire_id')
  .eq('is_active', true)

if (params.statut) {
  query = query.eq('statut_id', params.statut);
}
```

**Ligne 160** - getCount artisans:
```typescript
// ANCIEN
await this.getCount(supabase, 'artisans', 'statut_inactif=false');

// NOUVEAU
await this.getCount(supabase, 'artisans', 'is_active=true');
```

**Ligne 206** - getArtisansCount:
```typescript
// ANCIEN
const filter = activeOnly ? 'statut_inactif=false' : undefined;

// NOUVEAU
const filter = activeOnly ? 'is_active=true' : undefined;
```

### 3. Corriger `src/lib/api/interventions.ts`

**Ligne 130:**
```typescript
// ANCIEN
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// NOUVEAU
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**Ligne 145:**
```typescript
// ANCIEN
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// NOUVEAU
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**Ligne 147:**
```typescript
// ANCIEN
.eq("agence", agency.trim())

// NOUVEAU
.eq("agence_id", agency.trim())
```

### 4. Corriger `src/hooks/useInterventionForm.ts`

**Ligne 106:**
```typescript
// ANCIEN
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// NOUVEAU
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**Ligne 122:**
```typescript
// ANCIEN
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// NOUVEAU
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**Ligne 124:**
```typescript
// ANCIEN
.eq("agence", agency)

// NOUVEAU
.eq("agence_id", agency)
```

### 5. Corriger `app/api/chat/actions/route.ts`

**Ligne 116:**
```typescript
// ANCIEN
.select('id, statut, agence, contexte_intervention, date, date_prevue, cout_intervention, attribue_a, artisan_id')

// NOUVEAU
.select('id, statut_id, agence_id, contexte_intervention, date, date_prevue, assigned_user_id')
```

**Ligne 144:**
```typescript
// ANCIEN
.select('id, statut, agence, contexte_intervention, cout_intervention, date, date_prevue, attribue_a')

// NOUVEAU
.select('id, statut_id, agence_id, contexte_intervention, date, date_prevue, assigned_user_id')
```

## VALIDATION

Après les modifications:
1. Redéployer: `supabase functions deploy cache`
2. Démarrer: `npm run dev`
3. Ouvrir: http://localhost:3000/interventions
4. Vérifier: Les interventions s'affichent sans erreur

## QUESTIONS-RÉPONSES

**Q: Les champs legacy (agence, attribueA) vont-ils disparaître ?**
R: NON - ils sont automatiquement créés par le mapping dans `supabase-api-v2.ts`

**Q: Dois-je modifier les types TypeScript ?**
R: NON - utiliser ceux existants dans `supabase-api-v2.ts`

**Q: Pourquoi renommer interventions/ au lieu de le supprimer ?**
R: Par sécurité - on le garde en "deprecated" au cas où

## RÉSUMÉ
- 5 fichiers à corriger
- ~20 modifications (remplacements de colonnes)
- Durée estimée: 10-15 minutes
- Impact: Résout l'erreur 500 et affiche les interventions
```

---

## ✅ PROCHAINES ÉTAPES

1. **Copier le prompt ci-dessus** dans un nouveau chat Codex
2. Codex va effectuer toutes les corrections automatiquement
3. Vérifier que les interventions s'affichent
4. Si besoin, consulter `DIAGNOSTIC_MIGRATION_SCHEMA.md` pour plus de détails

---

## 📊 RÉSUMÉ TECHNIQUE

| Aspect | Détail |
|--------|--------|
| **Cause** | Anciennes colonnes texte encore utilisées |
| **Fichiers** | 5 fichiers backend/frontend |
| **Modifications** | ~20 remplacements de noms de colonnes |
| **Temps estimé** | 10-15 minutes |
| **Complexité** | Faible (chercher-remplacer) |
| **Impact** | Critique (bloque l'affichage) |

---

## 🆘 EN CAS DE PROBLÈME

Si après les corrections, les interventions ne s'affichent toujours pas:

1. Vérifier les logs Supabase:
   ```bash
   supabase functions logs cache
   ```

2. Vérifier la console navigateur (F12)

3. Tester directement l'API:
   ```typescript
   import { interventionsApiV2 } from '@/lib/supabase-api-v2';
   const data = await interventionsApiV2.getAll();
   console.log(data);
   ```

4. Consulter le fichier `DIAGNOSTIC_MIGRATION_SCHEMA.md` pour la checklist complète

---

**Créé le:** ${new Date().toLocaleString('fr-FR')}
**Fichiers générés:** 
- ✅ DIAGNOSTIC_MIGRATION_SCHEMA.md (diagnostic détaillé)
- ✅ PROMPT_CORRECTION_CODEX.md (prompt pour Codex)
- ✅ RESUME_DIAGNOSTIC_FR.md (ce fichier - résumé français)

