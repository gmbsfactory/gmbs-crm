# Diagnostic : Incohérences des statuts d'intervention

**Date**: 2025-10-23  
**Auteur**: Agent IA  
**Contexte**: Analyse des statuts d'intervention entre seed, import et frontend

---

## 📊 Situation actuelle

### Base de données

- **Total interventions**: 6 276
- **Avec statut_id**: 1 000 (15.9%)
- **Sans statut_id**: 5 276 (84.1%) ⚠️

### Statuts définis (intervention_statuses)

11 statuts sont définis dans la table `intervention_statuses` :

| Sort | Code | Label | Origine |
|------|------|-------|---------|
| 1 | DEMANDE | Demandé | Seed de base |
| 2 | ACCEPTE | Accepté | Seed de base |
| 3 | DEVIS_ENVOYE | Devis Envoyé | Seed de base |
| 4 | INTER_EN_COURS | Inter en cours | Seed de base |
| 5 | INTER_TERMINEE | Inter terminée | Seed de base |
| 6 | VISITE_TECHNIQUE | Visite Technique | Seed de base |
| 7 | ATT_ACOMPTE | Att Acompte | Seed de base |
| 8 | ANNULE | Annulé | Seed de base |
| 9 | REFUSE | Refusé | Seed de base |
| 10 | STAND_BY | Stand by | Seed de base |
| 999 | SAV | SAV | **Créé par import** ⚠️ |

### Distribution des statuts (1000 interventions avec statut_id)

| Statut | Nombre | % |
|--------|--------|---|
| Annulé | 470 | 47.0% |
| Demandé | 280 | 28.0% |
| Accepté | 159 | 15.9% |
| Inter terminée | 27 | 2.7% |
| Att Acompte | 18 | 1.8% |
| Visite Technique | 13 | 1.3% |
| Inter en cours | 12 | 1.2% |
| Stand by | 9 | 0.9% |
| Devis Envoyé | 8 | 0.8% |
| Refusé | 4 | 0.4% |

---

## 🔍 Analyse du problème

### 1. Structure de la table interventions

**Constatation importante** : La colonne `statut` (texte) **n'existe PAS** dans la base de données.

```sql
-- ✅ Existe
statut_id UUID REFERENCES intervention_statuses(id)

-- ❌ N'existe pas
statut TEXT
```

**Conséquence** : Le système utilise UNIQUEMENT `statut_id` (UUID). Le frontend doit donc mapper les UUIDs vers les labels pour l'affichage.

### 2. Fonctionnement de l'import Google Sheets

Le script `scripts/imports/google-sheets-import-clean-v2.js` utilise :

```javascript
// scripts/data-processing/data-mapper.js:1762
async getInterventionStatusId(statusName) {
  // Utilise l'API V2
  const result = await enumsApi.findOrCreateInterventionStatus(name);
  return result.id;
}
```

La fonction `findOrCreateInterventionStatus` :

```typescript
// src/lib/api/v2/enumsApi.ts:325
export const findOrCreateInterventionStatus = async (name: string) => {
  const normalizedName = name.trim();
  
  // 1️⃣ Chercher par label (case insensitive)
  const existingByLabel = await supabase
    .from('intervention_statuses')
    .select('id')
    .ilike('label', normalizedName)
    .single();
  
  if (existingByLabel) {
    return { id: existingByLabel.id, created: false };
  }
  
  // 2️⃣ Chercher par code
  const code = normalizedName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const existingByCode = await supabase
    .from('intervention_statuses')
    .select('id')
    .eq('code', code)
    .single();
  
  if (existingByCode) {
    return { id: existingByCode.id, created: false };
  }
  
  // 3️⃣ Créer un nouveau statut
  const created = await supabase
    .from('intervention_statuses')
    .insert({ 
      code, 
      label: normalizedName,
      color: '#808080',
      sort_order: 999  // ⚠️ Sort order par défaut
    })
    .select('id')
    .single();
  
  return { id: created.id, created: true };
};
```

**🎯 Point clé** : Cette fonction :
- ✅ Mappe correctement les labels du Google Sheets vers les statuts du seed
- ⚠️ Crée automatiquement de nouveaux statuts si non trouvés (ex: "SAV")
- ⚠️ Assigne un `sort_order` de 999 aux nouveaux statuts

### 3. Fonctionnement du frontend

Le frontend utilise un mapping manuel dans plusieurs endroits :

```typescript
// app/interventions/page.tsx:558
const statusLabel = mapStatusToDb(status)

// Puis appel API
const response = await fetch(`/api/interventions/${id}/status`, {
  method: "POST",
  body: JSON.stringify({ status: statusLabel })
})
```

Le problème est que `mapStatusToDb` mappe probablement vers des **labels** et non vers des **statut_id** (UUID).

---

## ⚠️ Problèmes identifiés

### 1. 84% des interventions sans statut_id

**5 276 interventions n'ont pas de statut_id**.

**Questions** :
- D'où viennent ces interventions ?
- Ont-elles été importées via un autre mécanisme ?
- Sont-elles issues d'un import plus ancien (avant l'implémentation du système de statuts) ?
- Y a-t-il eu une erreur lors de l'import ?

**Impact** :
- Ces interventions ne sont probablement pas affichées correctement dans le frontend
- Les filtres par statut ne fonctionnent pas pour ces interventions
- Les workflows de transition de statut ne peuvent pas s'appliquer

### 2. Statut "SAV" créé automatiquement

Un statut "SAV" a été créé avec `sort_order: 999`, ce qui indique qu'il a été créé par l'import via `findOrCreateInterventionStatus`.

**Problème** :
- Ce statut n'est pas dans le seed de base
- Il n'est probablement pas géré dans le frontend
- Il a un ordre d'affichage (999) qui le place en dernier

### 3. Inconsistance entre seed et import

Le seed utilise des **codes avec underscores** :
- `INTER_EN_COURS`
- `INTER_TERMINEE`
- `ATT_ACOMPTE`

Mais `findOrCreateInterventionStatus` génère des codes **sans underscores** :
```javascript
const code = normalizedName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
// "Inter en cours" → "INTERENCOU"
// "Att Acompte" → "ATTACOMPTE"
```

**Heureusement**, la recherche se fait d'abord par **label** (case insensitive), donc les labels matchent correctement avec le seed.

### 4. Frontend ne respecte pas l'architecture API V2

Le code de mise à jour de statut dans le frontend utilise :

```typescript
// ❌ NON CONFORME à AGENTS.md
await supabase
  .from("interventions")
  .update(updatePayload)
  .eq("id", id)
```

Au lieu de :

```typescript
// ✅ CONFORME à AGENTS.md
import { interventionsApi } from '@/lib/api/v2'
await interventionsApi.update(id, { statut_id: statusId })
```

---

## 💡 Recommandations

### 1. **URGENT** : Assigner un statut par défaut aux 5276 interventions

Créer un script de migration pour assigner un statut par défaut (suggéré : "Demandé" ou "Stand by") aux interventions sans statut_id.

```sql
-- Script de migration suggéré
UPDATE interventions
SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'DEMANDE')
WHERE statut_id IS NULL;
```

### 2. Standardiser le système de statuts

#### Option A : Conserver le système actuel (statut_id uniquement)

**Avantages** :
- ✅ Plus propre (relation FK vers table de référence)
- ✅ Facilite les changements de label sans migration
- ✅ Permet l'ajout de métadonnées aux statuts (couleur, ordre, etc.)

**Actions nécessaires** :
1. Migrer toutes les interventions pour avoir un statut_id
2. S'assurer que le frontend mappe correctement statut_id → label
3. Documenter la liste des statuts disponibles

#### Option B : Ajouter une colonne `statut` (texte) denormalisée

**Avantages** :
- ✅ Performance légèrement meilleure (pas de JOIN)
- ✅ Facilite le debug (valeur directement lisible)

**Inconvénients** :
- ❌ Duplication de données
- ❌ Risque de désynchronisation entre statut et statut_id
- ❌ Migrations plus complexes lors de changements de label

**Non recommandé** selon les principes du projet (AGENTS.md).

### 3. Améliorer `findOrCreateInterventionStatus`

Actuellement, cette fonction crée automatiquement de nouveaux statuts. Cela peut causer des problèmes :

```typescript
// ❌ Problème actuel : création automatique
if (!existingByLabel && !existingByCode) {
  // Crée un nouveau statut
}
```

**Recommandation** : Ajouter un paramètre `autoCreate` :

```typescript
export const findOrCreateInterventionStatus = async (
  name: string,
  options: { autoCreate?: boolean } = { autoCreate: false }
): Promise<FindOrCreateResult> => {
  // ... recherche ...
  
  if (!existingByLabel && !existingByCode) {
    if (!options.autoCreate) {
      throw new Error(`Statut "${name}" non trouvé et autoCreate=false`);
    }
    // Créer seulement si autoCreate=true
  }
};
```

### 4. Nettoyer le statut "SAV"

Si "SAV" n'est pas un statut valide :

```sql
-- 1. Réassigner les interventions SAV à un statut valide
UPDATE interventions
SET statut_id = (SELECT id FROM intervention_statuses WHERE code = 'STAND_BY')
WHERE statut_id = (SELECT id FROM intervention_statuses WHERE code = 'SAV');

-- 2. Supprimer le statut SAV
DELETE FROM intervention_statuses WHERE code = 'SAV';
```

Si "SAV" est un statut valide :
1. L'ajouter au seed de base (`supabase/seeds/seed_mockup.sql`)
2. Lui assigner un `sort_order` approprié (ex: 11)
3. Documenter son usage

### 5. Migrer le code frontend vers l'API V2

Refactoriser `src/lib/api/interventions.ts:transitionStatus` pour utiliser l'API V2 :

```typescript
// ❌ AVANT
const { data, error } = await supabase
  .from("interventions")
  .update(updatePayload)
  .eq("id", id)
  .select("*")
  .single()

// ✅ APRÈS
import { interventionsApi } from '@/lib/api/v2'
const intervention = await interventionsApi.update(id, {
  statut_id: statusId,
  // autres champs...
})
```

### 6. Créer des tests unitaires

Créer des tests pour la logique de mapping des statuts :

```typescript
// tests/unit/status-mapping.test.ts
describe('Status mapping', () => {
  it('should map frontend status to statut_id', async () => {
    const result = await mapStatusToId('DEMANDE');
    expect(result).toBe('44a62df7-bdb6-421d-9985-267811d6fff4');
  });
  
  it('should throw error for unknown status', async () => {
    await expect(mapStatusToId('UNKNOWN')).rejects.toThrow();
  });
});
```

---

## 📋 Plan d'action proposé

### Phase 1 : Correction immédiate (1-2h)

1. ✅ **[FAIT]** Diagnostic complet des statuts
2. 🔲 Créer un script de migration pour les 5276 interventions sans statut
3. 🔲 Exécuter la migration avec un statut par défaut
4. 🔲 Vérifier l'affichage dans le frontend

### Phase 2 : Nettoyage (2-3h)

1. 🔲 Décider du sort du statut "SAV" (garder ou supprimer)
2. 🔲 Ajouter le paramètre `autoCreate` à `findOrCreateInterventionStatus`
3. 🔲 Documenter la liste officielle des statuts dans `docs/`
4. 🔲 Créer des tests unitaires pour le mapping des statuts

### Phase 3 : Refactoring (4-6h)

1. 🔲 Migrer `transitionStatus` vers l'API V2
2. 🔲 Créer un hook React `useInterventionStatuses` pour le frontend
3. 🔲 Centraliser la logique de mapping statut_id ↔ label
4. 🔲 Ajouter des tests e2e pour les transitions de statut

---

## 🔧 Scripts disponibles

Les scripts suivants ont été créés pour le diagnostic :

```bash
# Compter les statut_id différents
node scripts/tests/test-statut-id-count.js

# Analyser la structure de la table
node scripts/tests/test-interventions-schema.js

# Diagnostic complet (à créer)
node scripts/tests/test-status-mapping.js
```

---

## 📚 Références

- `AGENTS.md` : Guide des agents (règles du projet)
- `supabase/seeds/seed_mockup.sql` : Seed de base avec les statuts
- `scripts/imports/google-sheets-import-clean-v2.js` : Script d'import
- `scripts/data-processing/data-mapper.js` : Mapping des données
- `src/lib/api/v2/enumsApi.ts` : API des énumérations (statuts)
- `src/lib/api/interventions.ts` : API interventions (à migrer vers V2)

---

**Conclusion** : Le problème principal est que **84% des interventions n'ont pas de statut_id**. Les statuts eux-mêmes sont bien configurés et le mapping fonctionne correctement pour les interventions qui ont un statut. La priorité est donc de créer un script de migration pour assigner un statut par défaut aux 5276 interventions orphelines.

