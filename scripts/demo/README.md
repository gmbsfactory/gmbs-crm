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
