# Monitoring DEV — Dashboard développeur

> Sources : `app/monitoring-dev/` (page + `_components/` + `_lib/`), `src/lib/monitoring/` (`activity-categories.ts`, `session-smoothing.ts`, `period-presets.ts`)

Page **full-page réservée aux développeurs** (`/monitoring-dev`), pensée comme le cockpit d'observabilité du CRM. Elle **lit des données déjà collectées** et va plus loin que `/monitoring`.

## Distinction avec `/monitoring`

| | `/monitoring` | `/monitoring-dev` |
|---|---|---|
| Cible | Sera **livrée au client** | **Développeurs uniquement** |
| Icône sidebar | `Activity` | `Activity` + badge **dev** (`MonitoringDevIcon`) |
| Accès | admin + dev (gate page) ; lien sidebar `manage_updates` | gate page `hasRole("dev")` ; lien sidebar `manage_updates` |
| Portée | Suivi du jour / semaine | Période **libre** + activité complète |

`/monitoring` reste **fonctionnellement inchangée**. Les composants partagés ont été déplacés vers `src/components/monitoring/` (les deux pages les importent via `@/`) ; les extensions sont rétro-compatibles (props/champs optionnels).

## Accès

- **Page** : `app/monitoring-dev/page.tsx` — gate `if (!hasRole("dev")) → ShieldAlert`.
- **Sidebar** : entrée « Monitoring DEV » dans `src/config/navigation.ts`, gardée par `manage_updates` (réservé au rôle dev). Icône `src/components/layout/MonitoringDevIcon.tsx`.

## Structure (vue unique, split redimensionnable)

Page à **une seule vue**, sans scroll de page (scroll **interne** par colonne). Header (badge dev + **période granularité+navigation** + live + filtre gestionnaires) puis un **split redimensionnable 30–70 %** (poignée centrale ; au-delà du seuil → une vue se **maximise** et l'autre devient une **pastille latérale** cliquable).

- **Gauche — Liste des gestionnaires** (`GestionnaireList`) : en-tête `Gestionnaires` + badge **`tri ↓ <stat>`** (tri actif) + bouton **⚙** + ligne `X en ligne · Y inactifs · Z hors ligne`. En dessous, une **ligne d'en-têtes de colonnes triables** (style tableau) : `Détail / gestionnaire` + **Créées · Devis · Term. · Actions · Retard** (somme sur le scope, **clic = tri décroissant**, re-clic → temps écran) + **Écran ↓**. Chaque carte : avatar (**clic = filtre**, pastille ✓ + point de statut) + nom + statut + **présence live** (gestionnaire **en ligne** → pastille **page actuelle** colorée par page + éventuelle **entité ouverte** intervention/artisan avec bouton **œil → ouverture du modal** ; **hors ligne** → ligne de contexte texte `headLine`), puis les **mêmes colonnes en nombres alignés** (gris si 0) + temps écran, et une **barre de répartition épaisse libellée**. **Clic sur la carte** = déplie (`GestionnaireExpanded`) — **plusieurs cartes ouvrables** simultanément.
- **Carte dépliée** (`GestionnaireExpanded`) : **timeline 1 ligne/jour** (segments colorés par page ; **inactivité** hachurée 45° ; **tics d'action** cliquables → focus du flux ; marqueurs connexion/déconnexion **multiples** + repère « maintenant »), **zoom par glisser** sur les horaires (Échap pour quitter), **tooltip flottant** au survol, et **heatmap horaire** (jour unique). L'**inactivité totale** est affichée dans la gouttière droite (sous actions/écran), pas sur le graphe. Le clic sur une heure / un tic / le compteur d'actions **focalise le flux de droite**.
- **Droite — `RightPanel`** : bascule **Flux d'actions** (`DevActivityFeed`) / **Dossiers actifs** (`TopEntitiesPanel`), avec puce de **focus** retirable.

**Deux gestes de scope, un seul filtre du flux** :
- **Clic sur un avatar** (`selectedIds`) → ajoute/retire du filtre **et filtre la liste de gauche** (n'affiche plus que les sélectionnés ; vide = tous).
- **Clic sur une carte** (`expandedIds`) → ouvre le détail **et restreint le flux** à ce gestionnaire.
- Le **flux & les dossiers** (`RightPanel`) sont scopés via `feedScope` (`page.tsx`) : **la sélection avatars prime** ; à défaut (aucun avatar sélectionné), fallback sur les **cartes ouvertes**. Donc : sélectionner Andrea → flux = Andrea (même si une autre carte est restée dépliée) ; sans sélection, ouvrir DD + Andrea → flux = DD + Andrea. Le **focus** (clic timeline) prime temporairement sur tout. Le bandeau **KPI** reste sur la sélection avatars.

Filtre gestionnaire **multi-sélection** (chips retirables + `ExpandableAvatarGroup`, repris du Dashboard). Données : `get_team_weekly_stats` (roster + barres + stats), `get_team_connections` (timeline + sessions + connexions, par carte ouverte), `get_activity_heatmap` (heatmap), `get_global_activity_feed` (flux), `get_top_entities` (dossiers). **Aucune migration v2** : tout est dérivé côté client des RPC existantes.

## Capacités

1. **Temps réel** — présence et nb « en ligne » via `usePagePresenceContext` (header + pastilles de statut sur les cartes). Pour chaque gestionnaire **en ligne**, la carte affiche sa **page actuelle** (`currentPage`, pastille colorée par page) et, le cas échéant, l'**intervention / artisan ouvert**. Le libellé de la chip est l'**`id_inter`** / le **`numero_associe`** quand il est disponible (sinon « Intervention » / « Artisan ») : ces libellés sont propagés dans le payload de présence (`activeInterventionLabel` / `activeArtisanLabel`) par les modals, tandis que l'**UUID** (`activeInterventionId` / `activeArtisanId`) reste transmis pour rouvrir le **modal** (bouton **œil** → `useInterventionModal` / `useArtisanModal`). Même présence temps réel que la grille de `/monitoring`.
2. **Flux d'activité global** — chaque action (qui / quand / avant→après), via `useGlobalActivityFeed`. **Modes Groupé/Détaillé**, **recherche**, **chips de catégorie** (dont **Connexions**). Les events **Connexion/Déconnexion** sont **dérivés** de `get_team_connections` (`first_seen_at` / `last_seen_at`) + présence — pas dans l'audit log.
3. **Modals réels** — clic sur un dossier = vrai modal `useInterventionModal` / `useArtisanModal` ; aperçu de pièce jointe (⊙ voir) = vrai `DocumentPreview` via `DocPreviewModal` (récupère les documents du dossier). **Pas de maquette.**
4. **Couleurs & avatars réels** — statuts via `useReferenceDataQuery` (couleurs CRM), avatars via `GestionnaireBadge` (`avatar_url`).
5. **Lissage, inactivité & déconnexion timeline** — `src/lib/monitoring/session-smoothing.ts` classe chaque trou entre sessions en **3 catégories** : `trou ≤ seuil` → micro-coupure **fusionnée** (comptée en écran) ; `seuil < trou < 1h` → **inactivité** (hachuré 45°, déduite du temps écran mais **affichée** « X inactif » dans la gouttière droite) ; `trou ≥ 1h` (`BREAK_MS`) → **déconnexion timeline** (session **fermée**, temps retiré : ni écran ni inactivité). La déconnexion n'est **pas** rendue en bande : elle est matérialisée par les **marqueurs** connexion (vert) / déconnexion (gris) et le libellé **« N sessions »**. Le seuil de lissage (Aucun / 3 / 5 / 10 / 15 min) se règle dans ⚙ ; la déconnexion à 1h est indépendante de la session d'**auth** (24 h) — c'est purement l'affichage de la timeline.

## Sélection de période et filtres

- **Période** (`usePeriodRange`) : **granularité** `Jour / Semaine / Mois` (onglets animés) + **navigation d'ancrage** `‹ [📅 picker natif] ›` (date / `week` / `month`), `›` désactivé sur la période courante. Semaine = lundi→dimanche, Mois = 1er→dernier, **plafonnés à aujourd'hui**. État `gran` + `anchor` ; expose un `range:{from,to}` consommé par les hooks.
- **Gestionnaires** : multi-sélection (vide = tous). S'applique aux totaux de colonnes (somme du scope), au flux et aux dossiers. Le focus (clic timeline) restreint temporairement le flux à un gestionnaire / jour / heure.

## Réglages (⚙ popover `DevSettings`)

- **Couleur des barres par page** — **color picker natif** (`<input type="color">`) par page, défaut `pageHex()` ; override stocké dans `pageColors`.
- **Plage horaire de la timeline** — `Fixe` (de/à) ou `Auto` (1ʳᵉ connexion → dernière déconnexion).
- **Lissage des micro-coupures** — seuil au-delà duquel un trou devient une **inactivité hachurée** (déduite du temps écran).

## Tests

- `tests/unit/lib/period-presets.test.ts`
- `tests/unit/lib/session-smoothing.test.ts` — lissage / extraction des pauses.
- `tests/unit/hooks/useGlobalActivityFeed.test.ts`, `tests/unit/hooks/useTeamConnections.test.ts`

Voir aussi [API Monitoring](../api-reference/monitoring.md).
