# Monitoring DEV — Dashboard développeur

> Sources : `app/monitoring-dev/`, `src/components/monitoring/`, `src/lib/monitoring/period-presets.ts`

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

## Vues (cockpit à 3 onglets)

- **Centre de contrôle** — bandeau 5 KPI + colonne LIVE (présence enrichie) + flux d'activité plat filtrable.
- **Timeline** — gantt « Journée des sessions » (segments par page + traits = actions + repère « maintenant ») + flux compact.
- **Pulse** — rail live, heatmap d'activité (gestionnaire × heure/jour), dossiers les plus actifs.

La colonne **LIVE** s'enrichit via `get_team_weekly_stats(today, today)` (déjà déployée) ; le flux, la timeline et le pulse consomment les RPC de la migration `99033`. Sélecteur de gestionnaire repris **à l'identique du Dashboard** (`ExpandableAvatarGroup`, mono-sélection).

## Capacités

1. **Temps réel** (colonne LIVE toujours visible) — présence et page courante de chacun. `LivePresencePanel` réutilise `OnlineUsersBar`, `PagePresenceGrid`, `RealtimeStatusDot`, le contexte `usePagePresenceContext` et `useCrmRealtime`.
2. **Flux d'activité global** — chaque action de chaque gestionnaire (qui / quand / avant→après). `GlobalActivityFeed` → `useGlobalActivityFeed` + `ActivityTimeline` (mode `showActor`).
3. **Connexions / déconnexions** — horaires et présence par jour. `ConnectionsLog` → `useTeamConnections` (barre de présence 6h–22h).
4. **Stats par période** — totaux par gestionnaire + détail journalier. Réutilise `WeeklyStatsTable` (props de plage) sur `get_team_weekly_stats`.
5. **Drill-down par gestionnaire** — `GestionnaireDetailSheet` (clic → activité + présence du gestionnaire sur la période).

## Sélection de période et filtres

- **Période** (`usePeriodRange` + `period-presets.ts`) : presets (Aujourd'hui, Hier, Cette semaine, 7 j, Ce mois, 30 j) + plage libre (`DateRangePicker`). Persistée dans l'URL (`?preset` / `?from` / `?to`) → partageable. Logique pure dans `src/lib/monitoring/period-presets.ts` (testée).
- **Gestionnaires** (`GestionnaireFilter`) : multi-sélection (vide = tous). S'applique au flux et aux connexions. *Limite V1* : l'onglet « Stats période » reste à l'échelle de toute l'équipe (`get_team_weekly_stats` n'a pas de filtre utilisateur).

## Layout

Full-page sans scroll de page (`h-full` + `min-h-0` + scroll interne par bloc) : header (titre + badge dev + période + filtre), bandeau KPI, puis 2 colonnes — onglets (Activité / Connexions / Stats) à gauche, panneau LIVE à droite. Tokens sémantiques uniquement.

## Tests

- `tests/unit/lib/period-presets.test.ts`
- `tests/unit/hooks/useGlobalActivityFeed.test.ts`
- `tests/unit/hooks/useTeamConnections.test.ts`

Voir aussi [API Monitoring](../api-reference/monitoring.md).
