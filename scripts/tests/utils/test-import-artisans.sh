#!/bin/bash
# scripts/test-import-artisans.sh
# Script de test pour importer seulement les 5 premiers artisans avec logs détaillés

set -e  # Arrêter en cas d'erreur

echo "🧪 Mode TEST - Import de 5 artisans"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# Vérifier que le fichier .env.production existe
if [ ! -f .env.production ]; then
  echo "❌ Fichier .env.production non trouvé!"
  echo "💡 Utilisation de .env.local à la place..."
  
  if [ ! -f .env.local ]; then
    echo "❌ Fichier .env.local non trouvé non plus!"
    exit 1
  fi
  
  # Charger .env.local
  set -a
  source .env.local
  set +a
else
  # Charger les variables de production
  echo "📝 Chargement de .env.production..."
  export NODE_ENV=production
  
  set -a
  source .env.production
  set +a
fi

# Vérifier les variables essentielles
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -z "$SUPABASE_URL" ]; then
  echo "❌ Variable SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_URL manquante"
  exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Variable SUPABASE_SERVICE_ROLE_KEY manquante"
  exit 1
fi

# Exporter NEXT_PUBLIC_* si nécessaire
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -n "$SUPABASE_URL" ]; then
  export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
fi

echo "✅ Configuration chargée"
echo "📍 NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL"
echo ""

echo "🚀 Démarrage de l'import TEST (5 artisans uniquement)..."
echo ""

# Exécuter l'import avec limite de 5 artisans et mode verbose
NODE_ENV=production npx tsx scripts/imports/google-sheets-import-clean-v2.js \
  --artisans-only \
  --limit=5 \
  --verbose

echo ""
echo "✅ Test terminé!"






