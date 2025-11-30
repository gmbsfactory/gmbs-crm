# ⚠️ Migration requise : Chaîne de statut

## 🚨 Le test a échoué car la migration n'est pas appliquée

```
Could not find the function public.update_intervention_status_with_chain
```

## ✅ Solution (Choisissez UNE méthode)

### Méthode 1️⃣ : Script PowerShell automatique (Recommandé)

```powershell
npm run migration:apply-status
```

Ce script va :
- ✅ Vérifier que la migration existe
- ✅ Tenter d'appliquer via Supabase CLI
- ✅ Ou afficher le SQL à copier-coller

---

### Méthode 2️⃣ : Supabase CLI directement

```bash
supabase db push
```

---

### Méthode 3️⃣ : SQL manuel dans Supabase Studio

1. Ouvrez Supabase Studio : https://supabase.com/dashboard
2. Allez dans **SQL Editor**
3. Copiez tout le contenu de :
   ```
   supabase/migrations/00019_status_update_with_chain.sql
   ```
4. Collez et exécutez

---

## 🧪 Après application, testez :

```bash
npm run test:status-transition
```

**Résultat attendu :**
```
✅ TEST RÉUSSI - Chaîne complète créée correctement
```

---

## 📚 Plus d'infos

- **Instructions détaillées :** `APPLY_MIGRATION.md`
- **Guide de test :** `QUICK_TEST.md`
- **Documentation complète :** `docs/fixes/TESTING_STATUS_TRANSITIONS.md`

