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

# ---------------------------------------------------------------------------
# CONTRÔLE BLOQUANT DE FIN (correctif de recette, constat 2).
#
# Un « supabase db reset » a déjà échoué APRÈS avoir supprimé et recréé la base
# mais AVANT d'appliquer la moindre migration, sur le seul message
# « error running container: exit 1 ». La base était vide et muette, et rien
# n'en avertissait : on ne le découvrait que devant le client.
#
# On refuse donc de rendre la main sur un état qui n'est pas l'état attendu.
# ---------------------------------------------------------------------------
NB_MIGRATIONS_PORTAIL=$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM supabase_migrations.schema_migrations WHERE version >= '99078';" 2>/dev/null || echo 0)
NB_INTERVENTIONS=$(psql "$DB_URL" -tAc \
  "SELECT count(*) FROM public.interventions WHERE id_inter LIKE 'DEMO-%';" 2>/dev/null || echo 0)

if [ "$NB_MIGRATIONS_PORTAIL" != "7" ] || [ "$NB_INTERVENTIONS" != "8" ]; then
  echo "❌ ÉTAT DE DÉMO INVALIDE — ne pas démarrer la démo sur cette base."
  echo "   migrations 99078+ appliquées : $NB_MIGRATIONS_PORTAIL (attendu 7)"
  echo "   interventions DEMO-*         : $NB_INTERVENTIONS (attendu 8)"
  echo "   Reprise : relancer « supabase db reset » JUSQU'À voir"
  echo "   « Finished supabase db reset », puis rejouer scripts/demo/load-seed.sh."
  exit 1
fi
echo "✅ État vérifié : $NB_MIGRATIONS_PORTAIL migrations du portail, $NB_INTERVENTIONS interventions de démo"
echo "✅ Terminé"
