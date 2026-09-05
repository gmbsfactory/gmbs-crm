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

# Correctif de revue du socle v2 (constat 15) : aligner public.users.auth_user_id sur auth.users.
# Les comptes de démo sont créés par seed_admin_auth.sql APRÈS les migrations, donc le backfill
# de 99031/99081 ne les voit pas et les 13 comptes restent à auth_user_id NULL. Or, dans cet état,
# TOUTE écriture faite par un client authentifié échoue en 0A000 (chaîne d'audit
# resolve_actor_user_id → get_current_user_id). La base de démo doit refléter la production.
psql "$DB_URL" -v ON_ERROR_STOP=1 -q -c "
UPDATE public.users u SET auth_user_id = au.id
  FROM auth.users au
 WHERE lower(u.email) = lower(au.email)
   AND u.auth_user_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.users x WHERE x.auth_user_id = au.id);"
echo "✅ Comptes de démo liés à auth.users (auth_user_id)"
echo "✅ Terminé"
