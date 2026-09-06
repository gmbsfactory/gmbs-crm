#!/usr/bin/env bash
# Démarre le CRM en mode DÉMO LOCALE **compilé** (production Next.js).
#
# Pourquoi : en mode développement, Next.js compile chaque page à la première
# visite — mesuré sur ce CRM le 2026-09-05 : 6 600 modules pour l'écran de
# connexion, 7 300 pour les interventions, soit 2,7 s à 8 s d'attente par page,
# contre 90 ms une fois chaude. En mode compilé, tout est prêt d'avance : plus
# aucune compilation à la volée, et une empreinte mémoire nettement plus faible
# — ce qui compte sur une machine à court de RAM.
#
# Mêmes garde-fous que start-crm.sh : Supabase locale uniquement, schéma à jour,
# aucun lien vers la production.
#
# Usage :
#   scripts/demo/start-crm-prod.sh              compile si nécessaire, puis démarre
#   DEMO_REBUILD=1 scripts/demo/start-crm-prod.sh   force la recompilation
#
# La compilation prend plusieurs minutes sur une machine chargée. Relancer ce
# script après un changement de code : sans DEMO_REBUILD, il repart du .next
# existant, qui serait alors périmé.
set -euo pipefail
cd "$(dirname "$0")/../.."

ENV_FILE=".env.demo.local"
[ -f "$ENV_FILE" ] || { echo "❌ $ENV_FILE introuvable (voir scripts/demo/README.md)"; exit 1; }
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a

# .env.demo.local force NODE_ENV=development pour le mode dev. « next build »
# refuse cette valeur : la génération des pages d'erreur échoue avec
# « <Html> should not be imported outside of pages/_document ». On impose donc
# la valeur de production pour la compilation ET pour le service.
export NODE_ENV=production

# --- Garde-fous anti-production (identiques à start-crm.sh) ---
case "${NEXT_PUBLIC_SUPABASE_URL:-}" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "❌ NEXT_PUBLIC_SUPABASE_URL n'est pas locale (${NEXT_PUBLIC_SUPABASE_URL:-vide}) — refus de démarrer"; exit 1 ;;
esac
case "${SUPABASE_URL:-}" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "❌ SUPABASE_URL n'est pas locale — refus de démarrer"; exit 1 ;;
esac
[ -e supabase/.temp/project-ref ] && { echo "❌ supabase/.temp/project-ref présent : lien vers la production actif, retirez-le avant la démo"; exit 1; }

# --- Contrôle de fraîcheur du schéma (repris de start-crm.sh) ---
if [ "${DEMO_SKIP_MIGRATION_CHECK:-0}" != "1" ]; then
  DB_URL=$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\(.*\)"/\1/p' || true)
  case "$DB_URL" in
    postgresql://*@127.0.0.1:54322/*|postgresql://*@localhost:54322/*)
      FICHIERS=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
      APPLIQUEES=$(psql "$DB_URL" -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null | tr -d ' ' || echo 0)
      if [ "$FICHIERS" != "$APPLIQUEES" ]; then
        echo "❌ Schéma en retard sur le dépôt : $APPLIQUEES migrations en base pour $FICHIERS fichiers."
        echo "   Reprise : supabase db reset, puis scripts/demo/load-seed.sh."
        exit 1
      fi
      echo "✅ Schéma à jour : $APPLIQUEES migrations appliquées"
      ;;
    *) echo "⚠️  Base locale injoignable : contrôle de schéma ignoré" ;;
  esac
fi

# --- Compilation ---
# On compile si le .next de production est absent, ou si on force la reprise.
# Repère de production : le manifeste que « next build » écrit et que
# « next dev » n'écrit pas.
BUILD_MARKER=".next/BUILD_ID"
if [ "${DEMO_REBUILD:-0}" = "1" ] || [ ! -f "$BUILD_MARKER" ]; then
  echo "🛠  Compilation du CRM (plusieurs minutes)…"
  # .next peut contenir un état de mode développement : on repart propre pour
  # éviter un mélange des deux modes, source d'erreurs de manifeste au démarrage.
  rm -rf .next
  npm run build
  echo "✅ Compilation terminée"
else
  echo "ℹ️  Compilation existante réutilisée (DEMO_REBUILD=1 pour recompiler)"
fi

echo "✅ Démo locale compilée : Supabase=$NEXT_PUBLIC_SUPABASE_URL  portail=${PORTAL_BASE_URL:-?}"
exec npx next start -p "${PORT:-3000}"
