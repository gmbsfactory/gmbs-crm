# Démo locale du portail artisans (CRM + portail PWA)

Tout tourne sur cette machine. **Aucune commande de ce dossier ne parle à la production** : les scripts refusent de démarrer si l'URL Supabase ou l'URL du CRM n'est pas locale, et le lien `supabase/.temp` vers le projet distant a été retiré pendant la démo.

| Composant | Commande | Adresse |
|---|---|---|
| Supabase locale (Docker) | `supabase start` (pile allégée : studio, analytics et inbucket désactivés dans `supabase/config.toml`) puis `supabase db reset` (migrations + seeds locaux) | http://127.0.0.1:54321 |
| Données de démo | `scripts/demo/load-seed.sh` | — |
| CRM (branche `deposedocsv2`) | `scripts/demo/start-crm.sh` (lit `.env.demo.local`) | http://localhost:3000 |
| Portail artisan (dépôt `portal_gmbs`, branche `demo-local`) | `scripts/demo/start-portal.sh` (lit `.env.demo.local` du portail) | http://localhost:3001 |

Comptes locaux (seed `seed_admin_auth.sql`) : `admin@gmbs.fr` / `admin`, `badr@gmbs.fr` / `badr123` (gestionnaire assigné aux interventions de démo).

Le contrat d'API entre les deux applications est décrit dans `docs/architecture/portail-demo-contrat-api.md` ; le contrat implémenté dans `docs/api-reference/portal-external.md` ; le scénario de démonstration, le scénario curl et le dépannage dans `docs/guides/demo-locale-portail.md`.

Objets de base créés par la migration `99076_portal_demo_convergence.sql` (jouée par `supabase db reset`) ; données de démo dans `supabase/seeds/seed_demo_portail.sql` (UUID fixes, rejouable).

Variables de `.env.demo.local` (CRM) — noms seulement, valeurs locales : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL`, `SUPABASE_FUNCTIONS_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ENVIRONMENT`, `GMBS_PORTAL_KEY_ID`, `GMBS_PORTAL_SECRET`, `PORTAL_BASE_URL`, `PORTAL_FALLBACK_USER_ID`. Les clés locales s'obtiennent avec `supabase status -o env`.

## Avant la répétition et avant la démo (consignes de recette, 2026-09-05)

Trois incidents ont interrompu la recette ; aucun n'était un défaut de code, tous peuvent se
reproduire le jour J.

1. **Ne pas lancer `supabase db reset` « par sécurité » avant la démo.** La base est déjà à l'état
   vérifié. Un reset a déjà échoué *après* avoir supprimé la base et *avant* d'appliquer la moindre
   migration, sur le seul message `error running container: exit 1`, laissant une base vide et
   muette. Si un reset est malgré tout indispensable : le relancer jusqu'à voir
   `Finished supabase db reset`, puis rejouer `scripts/demo/load-seed.sh` — le script refuse
   désormais de rendre la main si les 7 migrations `99078+` et les 8 interventions `DEMO-*` ne sont
   pas là.
2. **Vérifier l'état de la base en une commande** :
   `psql "$(supabase status -o env | sed -n 's/^DB_URL="\(.*\)"/\1/p')" -tAc "select max(version) from supabase_migrations.schema_migrations;"`
   doit renvoyer `99085`. `start-crm.sh` fait désormais ce contrôle tout seul et refuse de démarrer
   sur un schéma en retard (échappatoire : `DEMO_SKIP_MIGRATION_CHECK=1`).
3. **Purger `.next` avant le premier démarrage** : `rm -rf .next` puis `scripts/demo/start-crm.sh`.
   Un `.next` de build production laissé dans l'arbre fait répondre 500 à toutes les routes
   (`Cannot find module './5611.js'`, `routes-manifest.json` absent).
4. **Geler la base pendant la démo** : aucune autre session ne lance `supabase db reset`. Deux
   remises à zéro concurrentes ont effacé statuts, rapports et journal en pleine exécution.

### Recette de build et de typecheck dans un arbre partagé

`npm run build` échoue tant qu'un `next dev -p 3000` tourne sur le même arbre : les deux se disputent
`.next`, et l'échec se déguise en routes cassées (`PageNotFoundError: Cannot find module for page:
/_not-found`). Ce n'est pas un défaut de code. Avant de lancer la porte build : vérifier avec
`lsof -nP -iTCP:3000 -sTCP:LISTEN`, ou construire dans un worktree jetable
(`git worktree add --detach`). Côté portail, Turbopack refuse un `node_modules` symbolique
(« Symlink node_modules is invalid ») : il faut une copie réelle.
