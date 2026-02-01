# 🎯 PROMPT DE CORRECTION POUR CODEX

## CONTEXTE

Le schéma de base de données a été migré vers un nouveau format utilisant des UUIDs et des foreign keys. L'ancien schéma utilisait des colonnes texte (`agence`, `attribue_a`, `statut`). Le nouveau schéma utilise des colonnes UUID (`agence_id`, `assigned_user_id`, `statut_id`).

**Problème actuel:** Plusieurs fichiers utilisent encore les anciennes colonnes, causant des erreurs "column does not exist".

---

## OBJECTIF

Mettre à jour tous les fichiers qui font encore référence aux anciennes colonnes pour utiliser le nouveau schéma UUID.

---

## RÈGLES STRICTES

1. **NE PAS** modifier `src/lib/supabase-api-v2.ts` (déjà correct)
2. **NE PAS** modifier `supabase/functions/interventions-v2/index.ts` (déjà correct)
3. **NE PAS** créer de nouveaux types - utiliser ceux de `supabase-api-v2.ts`
4. **TOUJOURS** utiliser les colonnes UUID pour les requêtes BDD
5. **CONSERVER** les champs legacy dans les objets de retour (ils sont créés par le mapping)

---

## MAPPING DES COLONNES

### Table `interventions`
```
❌ ANCIEN (ne plus utiliser)     ✅ NOUVEAU (à utiliser)
agence                     →     agence_id (UUID)
attribue_a                 →     assigned_user_id (UUID)
statut                     →     statut_id (UUID)
type / metier              →     metier_id (UUID)
date_intervention          →     date (conservé tel quel)
prenom_client              →     prenom_client (conservé)
nom_client                 →     nom_client (conservé)
```

### Table `artisans`
```
❌ ANCIEN                   ✅ NOUVEAU
gestionnaire               →     gestionnaire_id (UUID)
statut_artisan             →     statut_id (UUID)
statut_inactif             →     is_active (booléen inversé)
```

---

## TÂCHES À EXÉCUTER

### 🔥 URGENT - Corriger les Edge Functions

#### 1. Fichier: `supabase/functions/cache/redis-client.ts`

**Action:** Remplacer toutes les références aux anciennes colonnes

**Modifications à faire:**

**A. Ligne 174 (fonction warmCache):**
```typescript
// ANCIEN
.select('id, date, agence, contexte_intervention, adresse, ville, type, statut, sous_statut_text, sous_statut_text_color, prenom_client, nom_client, telephone_client, cout_sst, attribue_a, numero_sst, date_intervention')

// NOUVEAU
.select('id, date, agence_id, contexte_intervention, adresse, ville, metier_id, statut_id, prenom_client, nom_client, telephone_client, cout_sst, assigned_user_id, numero_sst')
```

**B. Ligne 250 (fonction getInterventionsList):**
```typescript
// ANCIEN
.select('id, date, agence, contexte_intervention, adresse, ville, type, statut, sous_statut_text, sous_statut_text_color, prenom_client, nom_client, telephone_client, cout_sst, attribue_a, numero_sst, date_intervention')

// NOUVEAU
.select('id, date, agence_id, contexte_intervention, adresse, ville, metier_id, statut_id, prenom_client, nom_client, telephone_client, cout_sst, assigned_user_id, numero_sst')
```

**C. Ligne 253-260 (filtres dans getInterventionsList):**
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

**D. Ligne 222 (fonction warmCache - artisans):**
```typescript
// ANCIEN
.select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_artisan, statut_inactif, commentaire, gestionnaire_id, departement')
.eq('statut_inactif', false)

// NOUVEAU
.select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_id, is_active, suivi_relances_docs, gestionnaire_id')
.eq('is_active', true)
```

**E. Ligne 166 (requête artisans warmCache):**
```typescript
// ANCIEN
const artisansQuery = () => supabase
  .from('artisans')
  .select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_artisan, statut_inactif, commentaire, gestionnaire_id, departement')
  .eq('statut_inactif', false)

// NOUVEAU
const artisansQuery = () => supabase
  .from('artisans')
  .select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_id, is_active, suivi_relances_docs, gestionnaire_id')
  .eq('is_active', true)
```

**F. Ligne 218-226 (fonction getArtisansList):**
```typescript
// ANCIEN
let query = supabase
  .from('artisans')
  .select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_artisan, statut_inactif, commentaire, gestionnaire_id, departement')
  .eq('statut_inactif', false)
  .order('nom', { ascending: true })
  .order('prenom', { ascending: true });

if (params.statut) {
  query = query.eq('statut_artisan', params.statut);
}

// NOUVEAU
let query = supabase
  .from('artisans')
  .select('id, prenom, nom, telephone, email, raison_sociale, statut_dossier, statut_id, is_active, suivi_relances_docs, gestionnaire_id')
  .eq('is_active', true)
  .order('nom', { ascending: true })
  .order('prenom', { ascending: true });

if (params.statut) {
  query = query.eq('statut_id', params.statut);
}
```

**G. Ligne 160 (fonction getCount):**
```typescript
// ANCIEN
await this.getCount(supabase, 'artisans', 'statut_inactif=false');

// NOUVEAU
await this.getCount(supabase, 'artisans', 'is_active=true');
```

**H. Ligne 206 (fonction getArtisansCount):**
```typescript
// ANCIEN
export async function getArtisansCount(supabase: any, activeOnly: boolean = true): Promise<number> {
  const filter = activeOnly ? 'statut_inactif=false' : undefined;
  return await countersCache.getCount(supabase, 'artisans', filter);
}

// NOUVEAU
export async function getArtisansCount(supabase: any, activeOnly: boolean = true): Promise<number> {
  const filter = activeOnly ? 'is_active=true' : undefined;
  return await countersCache.getCount(supabase, 'artisans', filter);
}
```

#### 2. Fichier: `supabase/functions/interventions/index.ts`

**Action:** Renommer le dossier en `interventions-v1-deprecated` pour désactiver cette ancienne fonction

```bash
# Commande à exécuter
mv supabase/functions/interventions supabase/functions/interventions-v1-deprecated
```

**Raison:** Cette fonction utilise l'ancien schéma et n'est plus compatible. Toutes les routes doivent passer par `interventions-v2`.

---

### 🔧 IMPORTANT - Corriger le Backend Next.js

#### 3. Fichier: `src/lib/api/interventions.ts`

**A. Ligne 130:**
```typescript
// ANCIEN
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// NOUVEAU
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**B. Ligne 145:**
```typescript
// ANCIEN
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// NOUVEAU
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**C. Ligne 147:**
```typescript
// ANCIEN
.eq("agence", agency.trim())

// NOUVEAU
.eq("agence_id", agency.trim())
```

#### 4. Fichier: `src/hooks/useInterventionForm.ts`

**A. Ligne 106:**
```typescript
// ANCIEN
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// NOUVEAU
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**B. Ligne 122:**
```typescript
// ANCIEN
.select("id, contexte_intervention, adresse, agence, commentaire_agent")

// NOUVEAU
.select("id, contexte_intervention, adresse, agence_id, commentaire_agent")
```

**C. Ligne 124:**
```typescript
// ANCIEN
.eq("agence", agency)

// NOUVEAU
.eq("agence_id", agency)
```

#### 5. Fichier: `app/api/chat/actions/route.ts`

**A. Ligne 116:**
```typescript
// ANCIEN
.select('id, statut, agence, contexte_intervention, date, date_prevue, cout_intervention, attribue_a, artisan_id')

// NOUVEAU
.select('id, statut_id, agence_id, contexte_intervention, date, date_prevue, assigned_user_id')
```

**B. Ligne 144:**
```typescript
// ANCIEN
.select('id, statut, agence, contexte_intervention, cout_intervention, date, date_prevue, attribue_a')

// NOUVEAU
.select('id, statut_id, agence_id, contexte_intervention, date, date_prevue, assigned_user_id')
```

---

## APRÈS LES MODIFICATIONS

### Redéployer les Edge Functions
```bash
cd supabase
supabase functions deploy cache
```

### Vérifier le Frontend
1. Démarrer le serveur: `npm run dev`
2. Ouvrir http://localhost:3000/interventions
3. Vérifier que les interventions s'affichent
4. Vérifier la console - aucune erreur "column does not exist"

---

## QUESTIONS À RÉPONDRE

1. **Que faire avec `supabase/functions/interventions/` ?**
   - **Réponse:** Renommer en `interventions-v1-deprecated` pour la désactiver

2. **Comment gérer les champs legacy (agence, attribueA) dans l'UI ?**
   - **Réponse:** Le mapping dans `supabase-api-v2.ts` (fonction `mapInterventionRecord`) les crée automatiquement depuis les UUIDs + cache de référence

3. **Faut-il modifier les types TypeScript ?**
   - **Réponse:** NON - utiliser les types existants de `supabase-api-v2.ts`

4. **Les filtres par agence vont-ils encore fonctionner ?**
   - **Réponse:** OUI - mais ils doivent filtrer sur `agence_id` (UUID) au lieu de `agence` (label)

---

## VALIDATION FINALE

Après toutes les modifications, exécuter ces tests :

```typescript
// Test 1: Fetching interventions
const { data } = await interventionsApiV2.getAll();
console.log('✅ Interventions chargées:', data.length);

// Test 2: Vérifier les champs legacy
console.log('✅ Champ agence:', data[0].agence); // Doit afficher le label
console.log('✅ Champ agence_id:', data[0].agence_id); // Doit afficher l'UUID

// Test 3: Filtre par agence
const { data: filtered } = await interventionsApiV2.getAll({ 
  agence: 'uuid-de-l-agence' 
});
console.log('✅ Interventions filtrées:', filtered.length);
```

---

## RÉSUMÉ DES CHANGEMENTS

| Fichier | Lignes modifiées | Type de changement |
|---------|-----------------|-------------------|
| `cache/redis-client.ts` | 160, 166, 174, 218-226, 250, 253-260 | Colonnes UUID |
| `interventions/index.ts` | - | Renommer dossier |
| `api/interventions.ts` | 130, 145, 147 | Colonnes UUID |
| `useInterventionForm.ts` | 106, 122, 124 | Colonnes UUID |
| `chat/actions/route.ts` | 116, 144 | Colonnes UUID |

**Total:** 5 fichiers, ~15 modifications

