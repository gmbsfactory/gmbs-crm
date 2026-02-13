# 🔧 Guide de Réparation des Migrations Supabase

## Problème

L'erreur suivante apparaît lors de l'exécution de `supabase migration up`:

```
Remote migration versions not found in local migrations directory.
```

Cela signifie que les migrations appliquées sur la base distante ne correspondent pas aux fichiers de migration locaux.

## Solutions

### Solution 1 : Réparer l'historique (Recommandé)

Cette solution marque les migrations distantes comme "reverted" puis les réapplique depuis les fichiers locaux.

```bash
# 1. Définir SUPABASE_DB_URL (si pas déjà fait)
export SUPABASE_DB_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"

# 2. Exécuter le script de réparation
bash scripts/fix-migration-sync.sh --repair

# OU directement avec supabase CLI
supabase migration repair --status reverted --db-url "$SUPABASE_DB_URL" \
  00001_clean_schema \
  00002_ai_views \
  00003_user_features \
  00004_documents_bucket \
  00005_attachments_constraints \
  00006_indexes_all \
  00007_triggers_updated_at \
  00008_artisan_triggers \
  00009_gestionnaire_targets \
  00010_status_transitions \
  00011_dashboard_functions \
  00012_rls_policies \
  00013_data_fixes \
  00014_fix_email_smtp_missing \
  00015_refresh_materialized_view_trigger \
  00016_optimize_interventions_ca_cache

# 3. Appliquer les migrations
supabase migration up --db-url "$SUPABASE_DB_URL"
```

### Solution 2 : Synchroniser depuis la base distante

Cette solution télécharge les migrations depuis la base distante et remplace les fichiers locaux.

⚠️ **Attention**: Cette solution remplace vos migrations locales. Un backup est créé automatiquement.

```bash
# 1. Définir SUPABASE_DB_URL
export SUPABASE_DB_URL="postgresql://postgres:PASSWORD@HOST:5432/postgres"

# 2. Exécuter le script de synchronisation
bash scripts/fix-migration-sync.sh --pull

# OU directement avec supabase CLI
supabase db pull --db-url "$SUPABASE_DB_URL"
```

## Configuration de SUPABASE_DB_URL

### Option 1 : Variable d'environnement

```bash
export SUPABASE_DB_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@db.PROJECT_REF.supabase.co:5432/postgres"
```

### Option 2 : Fichier .env.production

Créer un fichier `.env.production` à la racine du projet:

```env
SUPABASE_DB_URL=postgresql://postgres:VOTRE_MOT_DE_PASSE@db.PROJECT_REF.supabase.co:5432/postgres
```

Puis charger l'environnement:

```bash
source .env.production
```

### Option 3 : Récupérer depuis Supabase Dashboard

1. Aller sur https://supabase.com/dashboard
2. Sélectionner votre projet
3. Aller dans **Settings** > **Database**
4. Copier la **Connection string** (URI)
5. Utiliser cette URL comme `SUPABASE_DB_URL`

## Vérification

Après avoir appliqué une solution, vérifier l'état des migrations:

```bash
# Lister les migrations locales
ls -1 supabase/migrations/*.sql

# Vérifier les migrations distantes
psql "$SUPABASE_DB_URL" -c "
  SELECT version, name 
  FROM supabase_migrations.schema_migrations 
  ORDER BY version;
"
```

## Dépannage

### Erreur: "database does not exist"

Vérifier que l'URL de connexion est correcte:
- Format: `postgresql://postgres:PASSWORD@HOST:5432/postgres`
- Le mot de passe ne doit pas contenir de caractères spéciaux non échappés
- L'hôte doit être accessible depuis votre machine

### Erreur: "connection refused"

- Vérifier que la base de données distante est accessible
- Vérifier les restrictions réseau dans Supabase Dashboard
- Vérifier que vous utilisez le bon port (5432)

### Erreur: "authentication failed"

- Vérifier le mot de passe de la base de données
- Réinitialiser le mot de passe depuis Supabase Dashboard si nécessaire

## Scripts Utiles

### Lister les migrations locales et distantes

```bash
# Migrations locales
echo "=== Migrations locales ==="
ls -1 supabase/migrations/*.sql | xargs -n1 basename

# Migrations distantes
echo "=== Migrations distantes ==="
psql "$SUPABASE_DB_URL" -t -c "
  SELECT version FROM supabase_migrations.schema_migrations 
  ORDER BY version;
" | xargs
```

### Comparer les migrations

```bash
# Migrations locales uniquement
LOCAL=$(ls -1 supabase/migrations/*.sql | xargs -n1 basename | sed 's/\.sql$//' | sort)

# Migrations distantes uniquement
REMOTE=$(psql "$SUPABASE_DB_URL" -t -c "
  SELECT version FROM supabase_migrations.schema_migrations 
  ORDER BY version;
" | xargs)

# Différence
echo "Migrations locales manquantes distantes:"
comm -23 <(echo "$LOCAL" | tr ' ' '\n') <(echo "$REMOTE" | tr ' ' '\n')

echo "Migrations distantes manquantes locales:"
comm -13 <(echo "$LOCAL" | tr ' ' '\n') <(echo "$REMOTE" | tr ' ' '\n')
```



