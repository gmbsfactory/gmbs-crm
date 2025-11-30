# 🔧 Appliquer la migration : Chaîne de statut

## ⚠️ Prérequis

La fonction SQL `update_intervention_status_with_chain` doit être créée dans votre base de données.

## 🚀 Méthode 1 : Reset complet (Recommandé en développement)

```bash
npm run db:reset
```

> ⚠️ **ATTENTION :** Cette commande supprime TOUTES les données et réapplique toutes les migrations.

---

## 📝 Méthode 2 : Appliquer la migration manuellement (Production)

### Option A : Via Supabase CLI

```bash
supabase db push
```

ou

```bash
supabase migration up
```

### Option B : Via SQL direct

1. Ouvrez votre éditeur SQL (Supabase Studio, pgAdmin, etc.)
2. Copiez le contenu de `supabase/migrations/00019_status_update_with_chain.sql`
3. Exécutez-le dans votre base de données

**Fichier :** `supabase/migrations/00019_status_update_with_chain.sql`

---

## ✅ Vérifier que la fonction existe

```sql
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'update_intervention_status_with_chain'
  AND n.nspname = 'public';
```

**Résultat attendu :**
```
function_name                          | arguments
---------------------------------------|--------------------------------------
update_intervention_status_with_chain  | p_intervention_id uuid, p_to_status_code text, ...
```

---

## 🧪 Tester après application

```bash
npm run test:status-transition
```

**Résultat attendu :**
```
✅ TEST RÉUSSI - Chaîne complète créée correctement
```

---

## 🐛 Troubleshooting

### Erreur : "Could not find the function"

**Symptôme :**
```
Could not find the function public.update_intervention_status_with_chain
```

**Cause :** La migration n'a pas été appliquée.

**Solution :**
1. Vérifiez que le fichier `supabase/migrations/00019_status_update_with_chain.sql` existe
2. Appliquez la migration avec `supabase db push`
3. Si ça ne marche pas, exécutez manuellement le SQL

### Erreur : "supabase command not found"

**Solution :**
```bash
npm install -g supabase
```

ou utilisez l'option B (SQL direct)

### Reset DB ne fonctionne pas

**Vérification :**
```bash
# Vérifiez que Supabase CLI est installé
supabase --version

# Vérifiez que vous êtes dans le bon dossier
cd c:\Users\bigp_\code\gmbs-crm

# Appliquez les migrations
supabase db reset --local
```

---

## 📋 Script PowerShell pour Windows

Si vous préférez un script PowerShell :

```powershell
# apply_migration.ps1
Write-Host "🔧 Application de la migration..." -ForegroundColor Yellow

# Lire le fichier SQL
$sqlContent = Get-Content "supabase\migrations\00019_status_update_with_chain.sql" -Raw

# Vous devrez adapter cette partie selon votre connexion DB
# Option 1 : Via Supabase CLI
supabase db push

# Option 2 : Afficher le contenu pour copier-coller
Write-Host "`n📝 Copiez et exécutez ce SQL dans Supabase Studio:" -ForegroundColor Cyan
Write-Host $sqlContent

Write-Host "`n✅ Migration prête à être appliquée!" -ForegroundColor Green
```

Sauvegardez ce fichier et exécutez :
```powershell
.\apply_migration.ps1
```

