#!/usr/bin/env bash
#
# reset-migrations-production.sh
# Réinitialise la base de production en archivant les migrations distantes
# et en appliquant uniquement les migrations locales (00001-00016)
#
# Usage: bash scripts/reset-migrations-production.sh
# Prérequis: fichier .env.production avec SUPABASE_DB_URL ou URL fournie manuellement

set -euo pipefail

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Répertoire du projet (parent de scripts/)
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RÉINITIALISATION DES MIGRATIONS${NC}"
echo -e "${BLUE}  Base de Production${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# 1. Chargement de l'environnement
# ============================================
echo -e "${YELLOW}[1/7]${NC} Chargement de l'environnement..."

if [ -f .env.production ]; then
  echo "   → Fichier .env.production trouvé"
  set -a
  source .env.production
  set +a
else
  echo -e "${YELLOW}   ⚠️  Fichier .env.production non trouvé${NC}"
fi

# Définir l'URL de la base de données
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  # URL par défaut fournie par l'utilisateur
  SUPABASE_DB_URL="postgresql://postgres:GMBS-crm-123@db.wneiuatqjfhvczvycuqw.supabase.co:5432/postgres"
  echo -e "${YELLOW}   ⚠️  SUPABASE_DB_URL non défini dans .env.production${NC}"
  echo -e "${YELLOW}   → Utilisation de l'URL par défaut${NC}"
fi

echo -e "${GREEN}   ✅ URL de connexion configurée${NC}"
echo ""

# ============================================
# 2. Vérification de la connexion
# ============================================
echo -e "${YELLOW}[2/7]${NC} Vérification de la connexion à la base de données..."

if ! psql "$SUPABASE_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${RED}   ❌ Impossible de se connecter à la base de données${NC}"
  echo -e "${RED}   Vérifiez votre URL de connexion: ${SUPABASE_DB_URL}${NC}"
  exit 1
fi

echo -e "${GREEN}   ✅ Connexion réussie${NC}"
echo ""

# ============================================
# 3. Sauvegarde de l'historique actuel
# ============================================
echo -e "${YELLOW}[3/7]${NC} Sauvegarde de l'historique des migrations distantes..."

ARCHIVE_DIR="$ROOT_DIR/supabase/migrations_archive"
mkdir -p "$ARCHIVE_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$ARCHIVE_DIR/migrations_history_backup_${TIMESTAMP}.txt"

if psql "$SUPABASE_DB_URL" -t -c "
  SELECT COALESCE(
    (SELECT json_agg(json_build_object('version', version, 'name', name, 'inserted_at', inserted_at))
     FROM supabase_migrations.schema_migrations),
    '[]'::json
  );
" > "$BACKUP_FILE" 2>/dev/null; then
  MIGRATION_COUNT=$(psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null || echo "0")
  if [ "${MIGRATION_COUNT// /}" -gt 0 ]; then
    echo -e "${GREEN}   ✅ Historique sauvegardé: ${BACKUP_FILE}${NC}"
    echo -e "${BLUE}   → ${MIGRATION_COUNT// /} migrations trouvées${NC}"
  else
    echo -e "${YELLOW}   ⚠️  Aucune migration dans l'historique (première fois)${NC}"
  fi
else
  echo -e "${YELLOW}   ⚠️  Impossible de sauvegarder l'historique (table n'existe peut-être pas encore)${NC}"
fi
echo ""

# ============================================
# 4. Confirmation de l'utilisateur
# ============================================
echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║  ⚠️  ATTENTION: OPÉRATION DESTRUCTRICE  ⚠️              ║${NC}"
echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Cette opération va:"
echo "  ❌ Supprimer TOUTES les données (DROP SCHEMA public CASCADE)"
echo "  🗑️  Supprimer l'historique des migrations distantes"
echo "  ✅ Réinitialiser avec uniquement les migrations locales (00001-00016)"
echo ""
echo -e "Base de données: ${BLUE}$(echo "$SUPABASE_DB_URL" | sed 's/:[^@]*@/:***@/')${NC}"
echo ""

read -p "Pour confirmer, tapez 'OUI' en majuscules: " confirm
if [ "$confirm" != "OUI" ]; then
  echo -e "${RED}❌ Opération annulée par l'utilisateur${NC}"
  exit 1
fi

echo ""

# ============================================
# 5. Suppression de l'historique des migrations
# ============================================
echo -e "${YELLOW}[4/7]${NC} Suppression de l'historique des migrations distantes..."

psql "$SUPABASE_DB_URL" -c "
  -- Créer le schéma si nécessaire
  CREATE SCHEMA IF NOT EXISTS supabase_migrations;
  
  -- Créer la table si nécessaire
  CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  
  -- Supprimer toutes les migrations
  TRUNCATE TABLE supabase_migrations.schema_migrations;
" 2>&1 || echo -e "${YELLOW}   ⚠️  Table n'existe pas encore (normal si première fois)${NC}"

echo -e "${GREEN}   ✅ Historique des migrations distantes supprimé${NC}"
echo ""

# ============================================
# 6. Remise à zéro du schéma public
# ============================================
echo -e "${YELLOW}[5/7]${NC} Remise à zéro du schéma public..."

psql "$SUPABASE_DB_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" 2>&1

echo -e "${GREEN}   ✅ Schéma public réinitialisé${NC}"
echo ""

# ============================================
# 7. Application des migrations locales
# ============================================
echo -e "${YELLOW}[6/7]${NC} Application des migrations locales (00001-00016)..."

MIGRATIONS_DIR="$ROOT_DIR/supabase/migrations"

# S'assurer que le schéma supabase_migrations existe
psql "$SUPABASE_DB_URL" -c "
  CREATE SCHEMA IF NOT EXISTS supabase_migrations;
  CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
" > /dev/null 2>&1

# Appliquer chaque migration dans l'ordre
TEMP_FILE=$(mktemp)

# Vérification du répertoire des migrations
if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo -e "${RED}   ❌ Répertoire des migrations non trouvé: $MIGRATIONS_DIR${NC}"
  echo -e "${RED}   ROOT_DIR actuel: $ROOT_DIR${NC}"
  exit 1
fi

find "$MIGRATIONS_DIR" -type f -name "*.sql" | sort > "$TEMP_FILE"

MIGRATION_COUNT=0
while IFS= read -r file; do
  migration_name=$(basename "$file" .sql)
  echo -n "   → Application: $migration_name ... "
  
  # Applique la migration
  if psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$file" > /dev/null 2>&1; then
    # Enregistre dans l'historique
    psql "$SUPABASE_DB_URL" -c "
      INSERT INTO supabase_migrations.schema_migrations (version, name)
      VALUES ('$migration_name', '$migration_name')
      ON CONFLICT (version) DO NOTHING;
    " > /dev/null 2>&1
    
    echo -e "${GREEN}✅${NC}"
    MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
  else
    echo -e "${RED}❌${NC}"
    echo -e "${RED}   ❌ Erreur lors de l'application de $migration_name${NC}"
    rm -f "$TEMP_FILE"
    exit 1
  fi
done < "$TEMP_FILE"
rm -f "$TEMP_FILE"

echo -e "${GREEN}   ✅ $MIGRATION_COUNT migrations appliquées avec succès${NC}"
echo ""

# ============================================
# 8. Vérification de l'historique final
# ============================================
echo -e "${YELLOW}[7/7]${NC} Vérification de l'historique final..."

echo ""
echo -e "${BLUE}Historique des migrations après réinitialisation:${NC}"
psql "$SUPABASE_DB_URL" -c "
  SELECT 
    ROW_NUMBER() OVER (ORDER BY version)::text as \"#\",
    version as \"Version\",
    name as \"Nom\"
  FROM supabase_migrations.schema_migrations 
  ORDER BY version;
" 2>/dev/null || psql "$SUPABASE_DB_URL" -c "
  SELECT version, name 
  FROM supabase_migrations.schema_migrations 
  ORDER BY version;
"

FINAL_COUNT=$(psql "$SUPABASE_DB_URL" -t -c "SELECT COUNT(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null | xargs)

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ✅ RÉINITIALISATION TERMINÉE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Résumé:"
echo -e "  📦 Migrations locales appliquées: ${GREEN}$FINAL_COUNT${NC}"
echo -e "  📁 Historique sauvegardé: ${BLUE}${BACKUP_FILE}${NC}"
echo -e "  🗑️  Migrations distantes: ${GREEN}archivées/supprimées${NC}"
echo ""
echo -e "${YELLOW}Prochaine étape:${NC}"
echo -e "  Vous pouvez maintenant importer les données avec:"
echo -e "  ${BLUE}NODE_ENV=production npm run import:all${NC}"
echo ""

