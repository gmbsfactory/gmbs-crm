# ✅ Fix : Tracking du gestionnaire lors de l'upload de documents

## 🔍 Problème identifié

Lors de l'upload de documents dans `InterventionEditForm`, les informations du gestionnaire connecté (UUID, nom, code, couleur du badge) **n'étaient pas enregistrées**.

### Symptômes
- Badge du gestionnaire absent dans la liste des documents
- Colonne "Créé par" vide
- Champs `created_by`, `created_by_display`, `created_by_code`, `created_by_color` à `null` dans la base de données

## 🎯 Cause racine

Dans `InterventionEditForm.tsx`, contrairement à `LegacyInterventionForm.tsx` :
1. ❌ `currentUser` n'était **pas chargé**
2. ❌ `currentUser` n'était **pas passé** au composant `DocumentManager`

## ✅ Solution appliquée

### 1. Import de supabase
```tsx
import { supabase } from "@/lib/supabase-client"
```

### 2. Ajout du state `currentUser`
```tsx
const [currentUser, setCurrentUser] = useState<{
  id: string
  displayName: string
  code: string | null
  color: string | null
} | null>(null)
```

### 3. Chargement de l'utilisateur connecté
```tsx
useEffect(() => {
  let isMounted = true

  const loadCurrentUser = async () => {
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const response = await fetch("/api/auth/me", {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      
      if (!response.ok) {
        throw new Error("Une erreur est survenue lors du chargement de l'utilisateur")
      }
      
      const payload = await response.json()
      if (!isMounted) return

      const user = payload?.user
      if (!user) return

      const first = user.firstname ?? user.prenom ?? ""
      const last = user.lastname ?? user.name ?? ""
      const displayNameCandidate = [first, last].filter(Boolean).join(" ").trim()
      const displayName = displayNameCandidate || user.username || user.email || "Vous"

      setCurrentUser({
        id: user.id,
        displayName,
        code: user.code_gestionnaire ?? null,
        color: user.color ?? null,
      })
    } catch (error) {
      console.warn(
        "[InterventionEditForm] Impossible de charger l'utilisateur courant",
        error,
      )
    }
  }

  loadCurrentUser()

  return () => {
    isMounted = false
  }
}, [])
```

### 4. Passage de `currentUser` à `DocumentManager`
```tsx
<DocumentManager
  entityType="intervention"
  entityId={intervention.id}
  kinds={INTERVENTION_DOCUMENT_KINDS}
  currentUser={currentUser ?? undefined}  // ✅ Ajouté
/>
```

## 📊 Flux de données

```
User connecté
    ↓
[InterventionEditForm] loadCurrentUser()
    ↓
currentUser = { id, displayName, code, color }
    ↓
[DocumentManager] uploaderInfo
    ↓
[useDocumentUpload] uploadDocument()
    ↓
[documentsApi.upload()] created_by, created_by_display, created_by_code, created_by_color
    ↓
[Edge Function documents] INSERT dans intervention_attachments
    ↓
✅ Document avec informations du créateur
```

## 🧪 Test

1. **Ouvrez une intervention**
2. **Section Documents** → Uploadez un fichier
3. **Vérification** :
   - ✅ Badge du gestionnaire visible dans la liste
   - ✅ Colonne "Créé par" affiche le nom/code
   - ✅ Badge coloré selon la couleur du gestionnaire

## 📝 Fichiers modifiés

1. ✅ `src/components/interventions/InterventionEditForm.tsx`
   - Import `supabase`
   - State `currentUser`
   - useEffect pour charger l'utilisateur
   - Passage de `currentUser` à `DocumentManager`

## 🎉 Résultat

✅ Les documents uploadés enregistrent maintenant :
- `created_by` : UUID du gestionnaire
- `created_by_display` : Nom complet (ex: "Andrea GAUTRET")
- `created_by_code` : Code gestionnaire (ex: "AG")
- `created_by_color` : Couleur du badge (ex: "#3b82f6")

✅ Le badge du gestionnaire s'affiche correctement dans la liste des documents

---

**Date** : 28 octobre 2025  
**Correction** : Tracking utilisateur lors de l'upload de documents

