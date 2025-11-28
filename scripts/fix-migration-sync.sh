#!/usr/bin/env bash
#
# fix-migration-sync.sh
# Répare la synchronisation entre les migrations distantes et locales
#
# Usage: bash scripts/fix-migration-sync.sh [--repair|--pull]
# Prérequis: SUPABASE_DB_URL doit être défini dans l'environnement ou .env.production

set -euo pipefail

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Répertoire du script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  RÉPARATION DE LA SYNCHRONISATION${NC}"
echo -e "${BLUE}  DES MIGRATIONS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# 1. Chargement de l'environnement
# ============================================
echo -e "${YELLOW}[1/5]${NC} Chargement de l'environnement..."

if [ -f .env.production ]; then
  echo "   → Fichier .env.production trouvé"
  set -a
  source .env.production
  set +a
else
  echo -e "${YELLOW}   ⚠️  Fichier .env.production non trouvé${NC}"
fi

# Vérifier que SUPABASE_DB_URL est défini
if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo -e "${RED}   ❌ SUPABASE_DB_URL n'est pas défini${NC}"
  echo -e "${YELLOW}   Veuillez définir SUPABASE_DB_URL dans votre environnement ou .env.production${NC}"
  echo -e "${YELLOW}   Format: postgresql://postgres:PASSWORD@HOST:5432/postgres${NC}"
  exit 1
fi

echo -e "${GREEN}   ✓ URL de base de données configurée${NC}"
echo ""

# ============================================
# 2. Vérification de la connexion
# ============================================
echo -e "${YELLOW}[2/5]${NC} Vérification de la connexion à la base de données..."

if ! psql "$SUPABASE_DB_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${RED}   ❌ Impossible de se connecter à la base de données${NC}"
  echo -e "${YELLOW}   Vérifiez votre URL de connexion${NC}"
  exit 1
fi

echo -e "${GREEN}   ✓ Connexion réussie${NC}"
echo ""

# ============================================
# 3. Vérification de l'état actuel
# ============================================
echo -e "${YELLOW}[3/5]${NC} Vérification de l'état des migrations..."

# Lister les migrations locales
LOCAL_MIGRATIONS=$(ls -1 supabase/migrations/*.sql | xargs -n1 basename | sort)
echo -e "${BLUE}   Migrations locales:${NC}"
echo "$LOCAL_MIGRATIONS" | sed 's/^/     - /'

# Vérifier les migrations distantes
echo ""
echo -e "${BLUE}   Migrations distantes:${NC}"
REMOTE_MIGRATIONS=$(psql "$SUPABASE_DB_URL" -t -c "
  SELECT version FROM supabase_migrations.schema_migrations 
  ORDER BY version;
" 2>/dev/null | xargs || echo "")

if [ -z "$REMOTE_MIGRATIONS" ]; then
  echo -e "${YELLOW}     ⚠️  Aucune migration trouvée dans la base distante${NC}"
else
  echo "$REMOTE_MIGRATIONS" | sed 's/^/     - /'
fi

echo ""

# ============================================
# 4. Choix de l'action
# ============================================
ACTION="${1:-}"

if [ -z "$ACTION" ]; then
  echo -e "${YELLOW}[4/5]${NC} Choisissez une action:"
  echo ""
  echo "   1) Réparer l'historique des migrations (recommandé)"
  echo "      → Marque les migrations comme 'reverted' puis les réapplique"
  echo ""
  echo "   2) Synchroniser depuis la base distante (supabase db pull)"
  echo "      → Télécharge les migrations depuis la base distante"
  echo ""
  echo "   3) Annuler"
  echo ""
  read -p "   Votre choix (1/2/3): " choice
  
  case $choice in
    1) ACTION="repair" ;;
    2) ACTION="pull" ;;
    3) 
      echo -e "${YELLOW}   Action annulée${NC}"
      exit 0
      ;;
    *)
      echo -e "${RED}   Choix invalide${NC}"
      exit 1
      ;;
  esac
fi

# ============================================
# 5. Exécution de l'action
# ============================================
echo ""
echo -e "${YELLOW}[5/5]${NC} Exécution de l'action: ${BLUE}$ACTION${NC}"
echo ""

case $ACTION in
  repair)
    echo -e "${BLUE}   Réparation de l'historique des migrations...${NC}"
    echo ""
    
    # Extraire les noms de migrations depuis les fichiers
    MIGRATION_NAMES=$(ls -1 supabase/migrations/*.sql | xargs -n1 basename | sed 's/\.sql$//' | sort | tr '\n' ' ')
    
    echo -e "${YELLOW}   Migrations à réparer:${NC}"
    echo "$MIGRATION_NAMES" | tr ' ' '\n' | sed 's/^/     - /'
    echo ""
    
    # Exécuter la commande de réparation
    echo -e "${BLUE}   Exécution de: supabase migration repair --status reverted $MIGRATION_NAMES${NC}"
    
    if supabase migration repair --status reverted --db-url "$SUPABASE_DB_URL" $MIGRATION_NAMES; then
      echo ""
      echo -e "${GREEN}   ✓ Historique réparé avec succès${NC}"
      echo ""
      echo -e "${YELLOW}   Vous pouvez maintenant exécuter:${NC}"
      echo -e "${BLUE}   supabase migration up --db-url \"\$SUPABASE_DB_URL\"${NC}"
    else
      echo ""
      echo -e "${RED}   ❌ Erreur lors de la réparation${NC}"
      exit 1
    fi
    ;;
    
  pull)
    echo -e "${BLUE}   Synchronisation depuis la base distante...${NC}"
    echo ""
    
    # Créer un backup des migrations locales
    BACKUP_DIR="supabase/migrations_backup_$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}   Création d'un backup des migrations locales dans: $BACKUP_DIR${NC}"
    mkdir -p "$BACKUP_DIR"
    cp -r supabase/migrations/*.sql "$BACKUP_DIR/" 2>/dev/null || true
    
    # Exécuter db pull
    if supabase db pull --db-url "$SUPABASE_DB_URL"; then
      echo ""
      echo -e "${GREEN}   ✓ Synchronisation réussie${NC}"
      echo ""
      echo -e "${YELLOW}   Les migrations locales ont été sauvegardées dans: $BACKUP_DIR${NC}"
    else
      echo ""
      echo -e "${RED}   ❌ Erreur lors de la synchronisation${NC}"
      exit 1
    fi
    ;;
    
  *)
    echo -e "${RED}   Action inconnue: $ACTION${NC}"
    echo -e "${YELLOW}   Actions disponibles: repair, pull${NC}"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  OPÉRATION TERMINÉE${NC}"
echo -e "${GREEN}========================================${NC}"

