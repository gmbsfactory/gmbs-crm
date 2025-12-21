# 🎯 Prompt pour Codex - DEVI-001 : ID devis pré-requis

**Regarde `docs/livrable-2025-11-04` et sa documentation puis règle la mission DEVI-001.**

---

## ⚠️ IMPORTANT : Mapping du champ

**Le champ en BDD s'appelle `id_inter` (pas `id_devis`) !**
- **Table BDD** : `interventions.id_inter` (TEXT, nullable)
- **Frontend** : Mappé en `idIntervention` dans `LegacyInterventionForm.tsx`
- **Pas besoin de migration** : Le champ existe déjà ✅

---

## 📋 Règle métier complète

**L'ID Intervention définitif doit être renseigné avant le passage au statut « Devis envoyé ».**

### Logique des ID

- **ID provisoire** : `auto-123` (auto-généré si vide à la création)
- **ID définitif** : Saisi par le gestionnaire (ex: `DEV-2024-001`)
- **Règle** : "Devis envoyé" **bloqué** si ID vide OU ID provisoire (`auto-XXX`)

### Comportement

1. **À la création** : Bloquer complètement le statut "Devis envoyé" (pas d'ID définitif disponible)
2. **À l'édition** : Bloquer le changement vers "Devis envoyé" si ID vide ou provisoire (`auto-XXX`)

Pas de clic droit, pas d'automatisation, juste cette validation.

---

## 🎯 Objectif

Implémenter la validation qui :

1. **À la création** : Bloque complètement le statut "Devis envoyé" (pas d'ID définitif à la création)
2. **À l'édition** : Bloque le changement vers "Devis envoyé" si :
   - Le champ **`id_inter`** est vide
   - OU le champ contient un ID provisoire (commence par `auto-`)

---

## 📍 Deux points d'entrée à modifier

### 1. **NewInterventionModalContent** (Création)
- **Fichier** : `src/components/ui/intervention-modal/NewInterventionModalContent.tsx`
- **Utilise** : `LegacyInterventionForm` (via `formRef`)
- **Logique** : Si l'utilisateur sélectionne le statut "Devis envoyé" lors de la création, alors `id_devis` devient obligatoire

### 2. **InterventionModalContent** (Édition)
- **Fichier** : `src/components/ui/intervention-modal/InterventionModalContent.tsx`
- **Utilise** : `InterventionEditForm` (via `formRef`)
- **Logique** : Si l'utilisateur change le statut vers "Devis envoyé", alors `id_devis` devient obligatoire

---

## 🔧 Implémentation (même logique que INT-001)

### Étape 1 : ✅ Le champ existe déjà !

**Pas besoin de migration BDD** : Le champ `id_inter` existe déjà dans `interventions` ✅

**Mapping actuel** :
- **BDD** : `interventions.id_inter` (TEXT, nullable)
- **Frontend** : `formData.idIntervention` dans `LegacyInterventionForm.tsx` (ligne 51)
- **API** : Déjà mappé dans `supabase-api-v2.ts` (ligne 391)

**Champ UI existant** :
```tsx
// LegacyInterventionForm.tsx ligne 442-445
<Label htmlFor="idIntervention" className="legacy-form-label">
  ID Intervention
</Label>
<Input 
  id="idIntervention" 
  value={formData.idIntervention} 
  onChange={(event) => handleInputChange("idIntervention", event.target.value)} 
  placeholder="Auto-généré" 
  className="legacy-form-input" 
  disabled  // ← Actuellement désactivé !
/>
```

### Étape 2 : Ajouter les validations

**Dans `LegacyInterventionForm.tsx` (création)** :
1. ✅ Le champ `idIntervention` reste `disabled` (ligne 419)
2. **Bloquer le statut "Devis envoyé"** dans `handleSubmit` :
```tsx
// Avant setIsSubmitting
const selectedStatus = refData?.interventionStatuses.find(s => s.id === formData.statut_id)
const isDevisEnvoye = selectedStatus?.code === "DEVIS_ENVOYE" || selectedStatus?.label?.toLowerCase() === "devis envoyé"
if (isDevisEnvoye) {
  alert("Impossible de créer une intervention avec le statut 'Devis envoyé'.\nVeuillez d'abord créer l'intervention, puis saisir l'ID définitif avant de passer à ce statut.")
  return
}
```

**Dans `InterventionEditForm.tsx` (édition)** :
1. ✅ Rendre le champ éditable (retirer `disabled`)
2. **Ajouter validation conditionnelle** : Si statut = "Devis envoyé", le champ devient `required`
3. **Bloquer ID provisoire** : Pattern regex `^(?!auto-).*` (refuse les ID commençant par "auto-")
4. **Validation au submit** : Vérifier `idInterValue.startsWith("auto-")`

### Étape 3 : Trouver le statut "Devis envoyé"

Le code du statut est `DEVIS_ENVOYE`. Tu peux le trouver dans :
- `refData?.interventionStatuses` (via `useReferenceData()`)
- Chercher le statut avec `code === "DEVIS_ENVOYE"` ou `label === "Devis envoyé"`

### Étape 4 : Validation dans InterventionEditForm

**Validation HTML5 + Pattern pour bloquer ID provisoire** :

```tsx
// Dans InterventionEditForm.tsx

// 1. Ajouter les memos
const selectedStatus = useMemo(() => {
  if (!formData.statut_id || !refData?.interventionStatuses) return undefined
  return refData.interventionStatuses.find((status) => status.id === formData.statut_id)
}, [formData.statut_id, refData])

const isDevisEnvoye = useMemo(() => {
  if (!selectedStatus) return false
  return selectedStatus.code === "DEVIS_ENVOYE" || selectedStatus.label?.toLowerCase() === "devis envoyé"
}, [selectedStatus])

// 2. Modifier le champ Input
<Input
  id="idIntervention"
  value={formData.id_inter}
  onChange={(e) => handleInputChange("id_inter", e.target.value)}
  placeholder="Auto-généré (provisoire)"
  className="legacy-form-input"
  required={isDevisEnvoye}
  pattern={isDevisEnvoye ? "^(?!auto-).*" : undefined}  // ← Bloque auto-XXX
  title={isDevisEnvoye ? "ID Intervention définitif requis pour 'Devis envoyé' (pas d'ID provisoire auto-XXX)" : undefined}
/>
```

### Étape 5 : Validation au submit

**Dans `LegacyInterventionForm.tsx` (création)** :
```tsx
// Après form.checkValidity(), avant setIsSubmitting
const selectedStatus = refData?.interventionStatuses.find(s => s.id === formData.statut_id)
const isDevisEnvoye = selectedStatus?.code === "DEVIS_ENVOYE" || selectedStatus?.label?.toLowerCase() === "devis envoyé"
if (isDevisEnvoye) {
  alert("Impossible de créer une intervention avec le statut 'Devis envoyé'.\nVeuillez d'abord créer l'intervention, puis saisir l'ID définitif avant de passer à ce statut.")
  return
}
```

**Dans `InterventionEditForm.tsx` (édition)** :
```tsx
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault()
  
  const form = event.currentTarget as HTMLFormElement
  if (!form.checkValidity()) {
    form.reportValidity()
    return
  }
  
  const idInterValue = formData.id_inter?.trim() ?? ""
  // Bloquer si ID vide OU provisoire (auto-XXX)
  if (isDevisEnvoye && (idInterValue.length === 0 || idInterValue.toLowerCase().startsWith("auto-"))) {
    form.reportValidity()
    return
  }
  
  // ... reste du code
}
```

---

## 📝 Fichiers à modifier

1. ✅ **Migration BDD** : Pas nécessaire, le champ `id_inter` existe déjà !

2. **`src/components/interventions/LegacyInterventionForm.tsx`**
   - ✅ Le champ `idIntervention` existe déjà (ligne 51, 442-445)
   - ❌ Retirer `disabled` du champ Input (ligne 445)
   - ❌ Ajouter validation conditionnelle (required si statut = "Devis envoyé")
   - ❌ Ajouter astérisque conditionnel au Label
   - ❌ Ajouter la validation au submit

3. **`src/components/interventions/InterventionEditForm.tsx`**
   - ❌ Chercher le champ `id_inter` ou `idIntervention`
   - ❌ Rendre éditable si désactivé
   - ❌ Ajouter validation conditionnelle (required si statut = "Devis envoyé")
   - ❌ Ajouter astérisque conditionnel au Label
   - ❌ Ajouter la validation au submit

4. ✅ **`src/lib/supabase-api-v2.ts`** : Déjà mappé (ligne 391) !

5. ✅ **`supabase/functions/interventions-v2/index.ts`** : Déjà dans les colonnes !

---

## ✅ Checklist

- [x] Migration BDD : Pas nécessaire, `id_inter` existe déjà ✅
- [x] Mapping API : Déjà fait ✅
- [x] **Création** : Bloquer statut "Devis envoyé" dans `LegacyInterventionForm.tsx` ✅
- [x] **Édition** : Rendre éditable le champ dans `InterventionEditForm.tsx` ✅
- [x] **Édition** : Ajouter validation conditionnelle (required + pattern anti-auto-) ✅
- [x] **Édition** : Ajouter astérisque conditionnel au Label ✅
- [x] **Édition** : Validation au submit (bloquer auto-XXX) ✅
- [ ] Tests manuels : création avec statut "Devis envoyé" → **bloqué avec message** ✅
- [ ] Tests manuels : édition vers "Devis envoyé" avec ID provisoire (auto-123) → **bloqué** ✅
- [ ] Tests manuels : édition vers "Devis envoyé" avec ID vide → **bloqué** ✅
- [ ] Tests manuels : édition vers "Devis envoyé" avec ID définitif (DEV-001) → **OK** ✅

---

## 🎯 Résultat attendu

1. **Création bloquée** : Impossible de créer une intervention avec le statut "Devis envoyé" directement
   - Message : "Impossible de créer une intervention avec le statut 'Devis envoyé'. Veuillez d'abord créer l'intervention, puis saisir l'ID définitif avant de passer à ce statut."

2. **Édition avec ID provisoire bloquée** : Si l'intervention a un ID provisoire (`auto-123`), impossible de passer à "Devis envoyé"
   - Message HTML5 : "ID Intervention définitif requis pour 'Devis envoyé' (pas d'ID provisoire auto-XXX)"

3. **Édition avec ID vide bloquée** : Si le champ ID est vide, impossible de passer à "Devis envoyé"
   - Validation HTML5 native (`required`)

4. **Édition avec ID définitif OK** : Si l'utilisateur saisit un ID définitif (ex: `DEV-2024-001`), il peut passer à "Devis envoyé" ✅

5. **Validation** : Utilise la validation HTML5 native + pattern regex pour bloquer `auto-`

---

## 📚 Référence

- **INT-001** : Même logique de validation HTML5 native avec `required` + `pattern=".+"` + `form.checkValidity()` + `form.reportValidity()`
- **Code statut** : `DEVIS_ENVOYE` (dans `src/config/interventions.ts`)
- **Label statut** : `"Devis envoyé"`
- **Champ BDD** : `interventions.id_inter` (TEXT, nullable)
- **Champ Frontend** : `formData.idIntervention` dans les formulaires
- **Mapping API** : Déjà fait dans `supabase-api-v2.ts` (ligne 391)

---

## ⚠️ RAPPEL IMPORTANT

**Le champ s'appelle `id_inter` en BDD, pas `id_devis` !**
- Ne pas créer de migration
- Ne pas créer de nouveau champ
- Utiliser le champ existant `idIntervention` dans les formulaires

---

**C'est tout ! Pas de clic droit, pas d'automatisation, juste cette validation simple.** 🎯

