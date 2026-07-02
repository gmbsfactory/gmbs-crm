# Bilan S1 — dashboard dev-only

Page `/bilan-s1` (sidebar « Bilan S1 », icône jauge + badge dev) : dashboard de la réunion bilan de la semaine 1 du go-live (lun 29/06 → ven 03/07/2026 12h Paris). Trois écrans : adoption réelle (live), signalements WhatsApp & réactivité dev, rapport final (fiabilité & règles métier).

## Accès & visibilité configurable

Par défaut la page est **dev-only**, mais les devs peuvent en ouvrir la visibilité via le bouton « Visibilité » (œil, à droite du badge LIVE) : rôles (`admin`, `manager`, `gestionnaire`) et/ou utilisateurs individuels (sélection par avatars), de façon permanente ou **temporaire** (durée en heures, défaut 4 h, max 168 h). La validation prend effet immédiatement ; passé `expires_at`, l'accès retombe de lui-même en dev-only. Le rôle `dev` a toujours accès.

- **Stockage** : table `page_visibility` (migration 99062) — `page_key` PK, `allowed_roles text[]`, `allowed_user_ids uuid[]`, `expires_at`, RLS SELECT pour `authenticated`, écritures via service role uniquement.
- **Décision** : `src/lib/bilan-s1/visibility-core.ts` (pur, testé) — `canViewBilan(user, config, now)`.
- **Sidebar** : l'entrée « Bilan S1 » est filtrée dans `AppSidebar` via `useBilanS1Visibility()` (poll 60 s : une ouverture ou une expiration se propage sans F5).
- **Page** : gate client `canView` (devs + visibilité configurée), skeleton pendant le chargement.
- **Routes API** : `getAuthenticatedUser()` puis `canViewBilan` (metrics) ou rôle `dev` (écriture visibilité) → 401/403 sinon.

### `GET /api/bilan-s1/visibility`

Tout utilisateur authentifié. Retourne `{ canView, isDev, config? }` — `config` (rôles/utilisateurs/expiration) n'est renvoyée qu'aux devs.

### `PUT /api/bilan-s1/visibility`

Devs uniquement. Body `{ roles: string[], userIds: string[], temporary: boolean, hours?: number }` (rôles whitelist, UUID valides, 1 ≤ hours ≤ 168, défaut 4). Upsert de la ligne `bilan-s1` + retour de la config à jour.

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

### `GET /api/bilan-s1/points` · `POST /api/bilan-s1/points/[pointId]/reply`

Écran 3 : points à traiter en réunion (tables `bilan_points` + `bilan_point_replies`, migration 99064 — RLS SELECT authenticated, écritures service-role). GET renvoie les points ordonnés avec leurs réponses (auteur : prénom/nom/couleur/avatar). POST ajoute une réponse horodatée (auteur = utilisateur connecté, 1-4000 caractères) et passe le point en `repondu` (défaut : `a_qualifier`). Chaque point porte un `reponse_type` (migration 99065) : `decision` = boutons « Valider — devis supp » / « Refuser » sans commentaire ; `texte` = réponse libre. Les deux tables sont dans la publication realtime : les réponses apparaissent en direct chez tous les participants (abonnement Postgres Changes dans `useBilanS1Points`, poll 60 s en filet). Les deux routes appliquent le gate `canViewBilan` : toute personne à qui la visibilité de la page a été ouverte peut répondre.

## Modules

| Fichier | Rôle |
|---|---|
| `src/lib/bilan-s1/metrics-core.ts` | cœur de calcul **pur** (agrégats, temps d'écran, parse git, fenêtre) — testé dans `tests/unit/lib/bilan-s1-metrics-core.test.ts` |
| `src/lib/bilan-s1/visibility-core.ts` | décision de visibilité **pure** (dev bypass, rôles, users, expiration, validation des requêtes) — testée dans `tests/unit/lib/bilan-s1-visibility-core.test.ts` |
| `src/lib/bilan-s1/visibility-server.ts` | lecture serveur de `page_visibility` (service role, repli dev-only si table absente) |
| `src/hooks/useBilanS1Visibility.ts` | hook TanStack partagé sidebar/page/panneau, clé `bilanS1Keys.visibility()` |
| `app/bilan-s1/_components/VisibilityControl.tsx` | bouton œil + panneau (rôles, avatars, durée) |
| `src/lib/bilan-s1/constants.ts` | fenêtre, données WhatsApp figées (15 signalements), règles métier (65), instantané git de secours |
| `app/bilan-s1/_lib/useBilanS1Metrics.ts` | hook TanStack Query, `refetchInterval` 60 s, clé `bilanS1Keys.metrics()` |
| `app/bilan-s1/_lib/fallback.ts` | instantané hors-ligne (badge « hors ligne » si la route échoue) |
| `app/bilan-s1/_components/Screen*.tsx` | les trois écrans |
| `app/bilan-s1/bilan-s1.css` | thème sombre autonome, **scopé sous `.bilan-s1`** (import CSS global Next) |

## Données figées vs live

Les chiffres WhatsApp (15 signalements, statuts, temps de réponse) et le décompte des règles métier sont **figés** dans `src/lib/bilan-s1/constants.ts` — à mettre à jour à la main si de nouveaux signalements arrivent. Tout le reste (actions, par jour/utilisateur, temps d'écran, pourcentages de fiabilité de l'écran 3, stats git en local) est **live**.

> Page conçue pour la réunion du 03/07/2026 ; après la réunion, elle peut être retirée ou généralisée (fenêtre paramétrable) selon la décision d'équipe.
