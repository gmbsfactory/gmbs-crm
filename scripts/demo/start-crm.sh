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
# ---------------------------------------------------------------------------
# CONTRÔLE DE FRAÎCHEUR DU SCHÉMA (correctif de recette, constat 3).
#
# La base de démo a tourné trois migrations en retard sur le dépôt sans que rien
# ne le signale : les colonnes des lots L1, L6 et L7 (work_started_at,
# payment_status, email_logs.attachment_ids…) étaient absentes, et l'écart n'a
# été vu qu'après coup. On compare donc le nombre de fichiers de migration au
# nombre de migrations enregistrées, et on refuse de démarrer sur un écart.
#
# Échappatoire assumée : DEMO_SKIP_MIGRATION_CHECK=1 (à n'utiliser que hors démo).
# ---------------------------------------------------------------------------
if [ "${DEMO_SKIP_MIGRATION_CHECK:-0}" != "1" ]; then
  DB_URL=$(supabase status -o env 2>/dev/null | sed -n 's/^DB_URL="\(.*\)"/\1/p' || true)
  case "$DB_URL" in
    postgresql://*@127.0.0.1:54322/*|postgresql://*@localhost:54322/*)
      FICHIERS=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l | tr -d ' ')
      APPLIQUEES=$(psql "$DB_URL" -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations;" 2>/dev/null | tr -d ' ' || echo 0)
      if [ "$FICHIERS" != "$APPLIQUEES" ]; then
        echo "❌ Schéma en retard sur le dépôt : $APPLIQUEES migrations en base pour $FICHIERS fichiers."
        echo "   La démo tournerait sur des colonnes absentes (constat 3 de la recette)."
        echo "   Reprise : supabase db reset, puis scripts/demo/load-seed.sh."
        echo "   Passer outre (hors démo) : DEMO_SKIP_MIGRATION_CHECK=1 $0"
        exit 1
      fi
      echo "✅ Schéma à jour : $APPLIQUEES migrations appliquées"
      ;;
    *)
      echo "⚠️  Fraîcheur du schéma non vérifiable (base locale injoignable) — vérifiez à la main"
      ;;
  esac
fi

echo "✅ Démo locale : Supabase=$NEXT_PUBLIC_SUPABASE_URL  portail=${PORTAL_BASE_URL:-?}"
exec npx next dev -p "${PORT:-3000}"
