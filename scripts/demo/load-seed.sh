#!/usr/bin/env bash
# Charge les données de démo du portail dans la base Supabase LOCALE uniquement.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB_URL=$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\(.*\)"/\1/p')
case "$DB_URL" in
  postgresql://*@127.0.0.1:54322/*|postgresql://*@localhost:54322/*) ;;
  *) echo "❌ DB_URL n'est pas la base locale (${DB_URL:-vide}) — refus"; exit 1 ;;
esac
SEED="${1:-supabase/seeds/seed_demo_portail.sql}"
[ -f "$SEED" ] || { echo "❌ $SEED introuvable"; exit 1; }
echo "✅ Chargement de $SEED dans la base locale"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -f "$SEED"
echo "✅ Terminé"
