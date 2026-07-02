# Bilan S1 — dashboard dev-only

Page `/bilan-s1` (sidebar « Bilan S1 », icône jauge + badge dev) : dashboard de la réunion bilan de la semaine 1 du go-live (lun 29/06 → ven 03/07/2026 12h Paris). Trois écrans : adoption réelle (live), signalements WhatsApp & réactivité dev, rapport final (fiabilité & règles métier).

## Accès

- **Sidebar** : entrée déclarée dans `src/config/navigation.ts`, permission `manage_updates` (portée par le seul rôle `dev`).
- **Page** : `app/bilan-s1/page.tsx`, gate client `usePermissions().hasRole("dev")` (même pattern que Monitoring DEV).
- **Route API** : gate serveur via `getAuthenticatedUser()` + vérification du rôle `dev` → 401/403 sinon.

## Route API

### `GET /api/bilan-s1/metrics`

Fichier : `app/api/bilan-s1/metrics/route.ts` (runtime `nodejs`, `force-dynamic`). **Lecture seule** (SELECT/HEAD via `supabaseAdmin`, service role — jamais exposé au client).

Réponse : `BilanMetrics` (`src/types/bilan-s1.ts`) :

| Champ | Contenu |
|---|---|
| `counts` | actions humaines totales (audit interventions + artisans, `actor_user_id` non nul), interventions créées à la main, changements de statut humains, commentaires, documents uploadés (créateur non nul), emails envoyés |
| `perDay` / `perUser` | agrégats des lignes d'audit (jour civil de Paris, `actor_display`) |
| `screen` | temps d'écran actif (algo miroir de `monitoring_active_intervals`, MAX_GAP 90 s) — `null` tant que le calcul (caché 5 min) n'est pas prêt |
| `git` + `gitSource` | stats de commits dédoublonnées par sujet — `live` en dev local, `snapshot` (relevé figé dans `src/lib/bilan-s1/constants.ts`) en prod Vercel où git n'existe pas au runtime |
| `errors` | libellés des requêtes en échec (réponse partielle plutôt que 500) |

Fenêtre de mesure : `WINDOW_START_ISO` → min(maintenant, `WINDOW_CAP_ISO` = vendredi 12h Paris) ; les chiffres se figent d'eux-mêmes au plafond.

Caches serveur (par instance) : payload complet 45 s (la page est pollée toutes les 60 s par chaque dev), temps d'écran 5 min (≈ 10 k événements/jour à re-parcourir).

## Modules

| Fichier | Rôle |
|---|---|
| `src/lib/bilan-s1/metrics-core.ts` | cœur de calcul **pur** (agrégats, temps d'écran, parse git, fenêtre) — testé dans `tests/unit/lib/bilan-s1-metrics-core.test.ts` |
| `src/lib/bilan-s1/constants.ts` | fenêtre, données WhatsApp figées (15 signalements), règles métier (65), instantané git de secours |
| `app/bilan-s1/_lib/useBilanS1Metrics.ts` | hook TanStack Query, `refetchInterval` 60 s, clé `bilanS1Keys.metrics()` |
| `app/bilan-s1/_lib/fallback.ts` | instantané hors-ligne (badge « hors ligne » si la route échoue) |
| `app/bilan-s1/_components/Screen*.tsx` | les trois écrans |
| `app/bilan-s1/bilan-s1.css` | thème sombre autonome, **scopé sous `.bilan-s1`** (import CSS global Next) |

## Données figées vs live

Les chiffres WhatsApp (15 signalements, statuts, temps de réponse) et le décompte des règles métier sont **figés** dans `src/lib/bilan-s1/constants.ts` — à mettre à jour à la main si de nouveaux signalements arrivent. Tout le reste (actions, par jour/utilisateur, temps d'écran, pourcentages de fiabilité de l'écran 3, stats git en local) est **live**.

> Page conçue pour la réunion du 03/07/2026 ; après la réunion, elle peut être retirée ou généralisée (fenêtre paramétrable) selon la décision d'équipe.
