#!/usr/bin/env bash
# Démarre le CRM en mode DÉMO LOCALE : Supabase local (Docker) uniquement.
# Les variables de .env.demo.local sont exportées dans le shell : elles PRIMENT sur .env.local
# (ordre Next.js : variables du shell > .env.*.local > .env.local). Aucune connexion à la production.
set -euo pipefail
cd "$(dirname "$0")/../.."
ENV_FILE=".env.demo.local"
[ -f "$ENV_FILE" ] || { echo "❌ $ENV_FILE introuvable (voir scripts/demo/README.md)"; exit 1; }
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a
case "${NEXT_PUBLIC_SUPABASE_URL:-}" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "❌ NEXT_PUBLIC_SUPABASE_URL n'est pas locale (${NEXT_PUBLIC_SUPABASE_URL:-vide}) — refus de démarrer"; exit 1 ;;
esac
case "${SUPABASE_URL:-}" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "❌ SUPABASE_URL n'est pas locale — refus de démarrer"; exit 1 ;;
esac
[ -e supabase/.temp/project-ref ] && { echo "❌ supabase/.temp/project-ref présent : lien vers la production actif, retirez-le avant la démo"; exit 1; }
echo "✅ Démo locale : Supabase=$NEXT_PUBLIC_SUPABASE_URL  portail=${PORTAL_BASE_URL:-?}"
exec npx next dev -p "${PORT:-3000}"
