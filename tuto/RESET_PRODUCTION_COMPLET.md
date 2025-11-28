# 🔄 Reset Complet de la Production - GMBS CRM

Ce guide explique comment réinitialiser complètement la base de données de production, depuis la suppression jusqu'à l'import des données.

---

## ⚠️ ATTENTION

**Cette procédure supprime TOUTES les données de production !**  
À n'utiliser que si vous êtes absolument sûr de vouloir repartir de zéro.

---

## 📋 Prérequis

1. Avoir accès à la base de données production (credentials dans `.env.production`)
2. Avoir `psql` installé
3. Avoir `supabase CLI` installé
4. Être dans le dossier du projet

```bash
cd /Users/andrebertea/Projects/GMBS/gmbs-crm
```

---

## 🚀 Procédure Complète

### Étape 0 : Charger les variables d'environnement

```bash
set -a && source .env.production && set +a
```

Vérifier que la variable est bien chargée :
```bash
echo $SUPABASE_DB_URL
# Doit afficher: postgresql://postgres:GMBS-crm-123@db.wneiuatqjfhvczvycuqw.supabase.co:5432/postgres
```

---

### Étape 1 : Supprimer le schéma public

Cela supprime **toutes les tables** dans le schéma `public` :

```bash
psql "$SUPABASE_DB_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
```

**Note :** Cela ne supprime PAS les utilisateurs dans `auth.users` (géré par Supabase).

---

### Étape 2 : Vider l'historique des migrations

⚠️ **Important !** Sans cette étape, les migrations ne seront pas réappliquées.

```bash
psql "$SUPABASE_DB_URL" -c "DELETE FROM supabase_migrations.schema_migrations;"
```

Vérifier que c'est vide :
```bash
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations;"
# Doit afficher: 0
```

---

### Étape 3 : Réappliquer les migrations

```bash
supabase migration up --db-url "$SUPABASE_DB_URL"
```

Vérifier que les tables sont créées :
```bash
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = 'public';"
# Doit afficher: ~48 tables
```

---

### Étape 4 : Créer les utilisateurs et données de référence

Ce script crée :
- Les utilisateurs dans `auth.users` (si pas déjà existants)
- Les utilisateurs dans `public.users`
- Les métiers, zones, statuts (artisans, interventions, tâches)
- Les rôles et permissions

**Sans suppression des auth.users existants :**
```bash
NODE_ENV=production npm run auth:create-credentials
```

**Avec suppression préalable des auth.users (reset total) :**
```bash
CLEAN_AUTH=true NODE_ENV=production npm run auth:create-credentials
```

Vérifier les données de référence :
```bash
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM intervention_statuses;"
# Doit afficher: 11

psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM metiers;"
# Doit afficher: 21

psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM public.users;"
# Doit afficher: 13
```

---

### Étape 5 : Importer les données (artisans, interventions)

```bash
NODE_ENV=production npm run import:all
```

Ce script :
1. Importe les artisans depuis Google Sheets
2. Importe les interventions depuis Google Sheets
3. Peuple `agency_config`
4. Recalcule les statuts des artisans

**Durée estimée :** 5-10 minutes selon le volume de données.

Vérifier l'import :
```bash
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM artisans;"
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM interventions;"
```

---

### Étape 6 : Géocoder les artisans

Ce script ajoute les coordonnées GPS aux artisans :

```bash
npx tsx scripts/geocode-artisans.ts
```

**Note :** Ce script utilise une API de géocodage et peut prendre du temps selon le nombre d'artisans.

---

## 📝 Commandes en une ligne (copier-coller)

### Reset complet avec CLEAN_AUTH (tout supprimer et recréer)

```bash
cd /Users/andrebertea/Projects/GMBS/gmbs-crm && \
set -a && source .env.production && set +a && \
psql "$SUPABASE_DB_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" && \
psql "$SUPABASE_DB_URL" -c "DELETE FROM supabase_migrations.schema_migrations;" && \
supabase migration up --db-url "$SUPABASE_DB_URL" && \
CLEAN_AUTH=true NODE_ENV=production npm run auth:create-credentials && \
NODE_ENV=production npm run import:all && \
npx tsx scripts/geocode-artisans.ts
```

### Reset sans toucher aux auth.users

```bash
cd /Users/andrebertea/Projects/GMBS/gmbs-crm && \
set -a && source .env.production && set +a && \
psql "$SUPABASE_DB_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" && \
psql "$SUPABASE_DB_URL" -c "DELETE FROM supabase_migrations.schema_migrations;" && \
supabase migration up --db-url "$SUPABASE_DB_URL" && \
NODE_ENV=production npm run auth:create-credentials && \
NODE_ENV=production npm run import:all && \
npx tsx scripts/geocode-artisans.ts
```

---

## 🔍 Vérifications post-reset

```bash
# Nombre de tables
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Utilisateurs
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM public.users;"

# Artisans
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM artisans;"

# Interventions
psql "$SUPABASE_DB_URL" -c "SELECT COUNT(*) FROM interventions;"

# Statuts interventions
psql "$SUPABASE_DB_URL" -c "SELECT code, label FROM intervention_statuses ORDER BY sort_order;"

# Métiers
psql "$SUPABASE_DB_URL" -c "SELECT code, label FROM metiers ORDER BY code;"
```

---

## ❌ Erreurs courantes

### "Could not find the table 'public.xxx' in the schema cache"
**Cause :** Les migrations n'ont pas été appliquées.  
**Solution :** Vérifier que l'historique des migrations a été vidé (étape 2) avant de réappliquer les migrations (étape 3).

### "Champ requis manquant: statut_id" lors de l'import
**Cause :** La table `intervention_statuses` est vide.  
**Solution :** Exécuter `npm run auth:create-credentials` avant l'import.

### "relation 'xxx' does not exist"
**Cause :** Le schéma public est vide.  
**Solution :** Appliquer les migrations avec `supabase migration up`.

### Les migrations disent "already applied" mais les tables n'existent pas
**Cause :** L'historique des migrations n'a pas été vidé après le DROP SCHEMA.  
**Solution :** Exécuter `DELETE FROM supabase_migrations.schema_migrations;` puis réappliquer.

---

## 📊 Ordre des opérations (important !)

```
1. DROP SCHEMA public CASCADE
2. DELETE FROM supabase_migrations.schema_migrations
3. supabase migration up (crée les tables)
4. npm run auth:create-credentials (crée users + données de référence)
5. npm run import:all (importe artisans + interventions)
6. npx tsx scripts/geocode-artisans.ts (géocode les artisans)
```

**Ne pas changer cet ordre !** Chaque étape dépend de la précédente.

---

## 📅 Dernière mise à jour

28 novembre 2025

