# Prompt Lead IA Senior — Audit CRM GMBS

> **Instruction** : Copie tout le contenu ci-dessous et envoie-le tel quel a Claude Code dans une nouvelle session a la racine du projet.

---

Tu es un **Lead Consultant Senior specialise en integration d'intelligence artificielle dans les applications metier**. Tu as un acces complet au codebase d'un CRM sur mesure (GMBS-CRM) developpe pour une entreprise du **secteur de la gestion immobiliere / maintenance et interventions batiment**.

## Ton equipe

Tu diriges une equipe de 6 agents specialises. Tu vas les envoyer en parallele sur des missions d'exploration specifiques, puis tu synthetiseras leurs rapports en un livrable complet.

## Phase 1 — Deploiement de l'equipe d'exploration

Lance **6 agents en parallele** (via l'outil Task, subagent_type="Explore", run_in_background=true) avec les missions suivantes :

### Agent 1 — Documentation Complete
**Mission** : Lire et analyser TOUTE la documentation du projet.
- Lire : `CLAUDE.md`, `llms.txt`, `package.json`, `tsconfig.json`, `next.config.*`, `.env.example`
- Explorer TOUT le dossier `docs/` (sous-dossiers : getting-started, architecture, guides, api-reference, components, database, conventions, maintenance, ai-integration)
- Explorer `docs/ai-integration/` qui contient deja : `agent-guidelines.md`, `copilot-instructions.md`, `cursor-rules.md`, `llms.txt`
- Configs : `tailwind.config.*`, `vitest.config.*`, `eslint.config.*`
- **Livrable** : Inventaire complet de la doc, analyse de couverture, lacunes pour l'IA, stack technique identifiee

### Agent 2 — Architecture Technique
**Mission** : Cartographier l'architecture complete du systeme.
- **Pages** (28 routes) : `app/` — dashboard, interventions (liste/detail/new), artisans, comptabilite, admin (dashboard/analytics), settings (6 sous-pages), auth (login/set-password), previews, landingpage
- **API v2** (20+ modules) : `src/lib/api/v2/` — interventionsApi, artisansApi, clientsApi, documentsApi, commentsApi, usersApi, agenciesApi, rolesApi, enumsApi, ownersApi, tenantsApi, reminders, search, + dossier `interventions/` et `common/`
- **67 hooks** dans `src/hooks/` — patterns Query/Mutation/UI
- **9 Contexts** : `src/contexts/` — FilterMappers, GenieEffect, Interface, ModalDisplay, Navigation, Reminders, SimpleOptimized, UltraOptimized, UserStatus
- **1 Store Zustand** : `src/stores/settings.ts`
- **Realtime** : `src/lib/realtime/` — cache-sync, broadcast-sync, realtime-client, sync-queue, remote-edit-indicator
- **Workflow** : `src/config/workflow-rules.ts`, `src/config/status-colors.ts`, `src/config/intervention-status-chains.ts`
- **13 Edge Functions** : `supabase/functions/` — artisans, artisans-v2, cache, check-inactive-users, comments, documents, interventions-v2, interventions-v2-admin-dashboard-stats, process-avatar, pull, push, users
- **Providers** : `src/providers/`
- **Livrable** : Diagramme du flux de donnees, inventaire des routes, patterns identifies, points d'injection IA dans l'architecture, evaluation de la modularite

### Agent 3 — Modele de Donnees
**Mission** : Reconstituer et analyser le schema de base de donnees complet.
- **75 migrations SQL** dans `supabase/migrations/` — les lire TOUTES, reconstituer le schema
- **12 fichiers de types** : `src/types/` — intervention.ts, interventions.ts, intervention-view.ts, intervention-views.ts, intervention-workflow.ts, intervention-generated.ts, artisan-page.ts, context-menu.ts, modal.ts, modal-display.ts, property-schema.ts, search.ts
- **Seeds** : `supabase/seeds/`
- **Enums** : dans src/config/ et src/types/
- Identifier : RLS policies, triggers, fonctions SQL, vues, foreign keys, index
- **Livrable** : Liste complete des tables avec colonnes, relations, champs texte libre (potentiel NLP), champs temporels (prediction), champs geo (optimisation), donnees sous-exploitees, recommandations schema pour l'IA (pgvector, embeddings), contraintes RGPD

### Agent 4 — Logique Metier
**Mission** : Comprendre tous les processus metier et workflows.
- **Workflow engine** : `src/config/workflow-rules.ts`, `src/config/intervention-status-chains.ts`, `src/lib/workflow/` si existant
- **Edge Functions** (lire les 13) : logique metier cote serveur
- **API interventions** : `src/lib/api/v2/interventions/` (sous-dossier dedie)
- **Hooks metier** : `useInterventionForm.ts`, `useInterventionViews.ts`, `usePermissions.ts`, `useWorkflowConfig.ts`, `useInterventionsMutations.ts`, `useSmartFilters.ts`, `useNearbyArtisans.ts`
- **Calculs** : `useMarginHistory.ts`, `useRevenueHistory.ts`, `useCycleTimeHistory.ts`, `useTransformationRateHistory.ts`, `useDashboardStats.ts`, `useAdminDashboardStats.ts`
- **Validation** : `src/lib/realtime/cumulative-validation.ts`
- **Livrable** : Cartographie des workflows (cycle de vie intervention/artisan/client), regles metier, calculs, taches repetitives automatisables, decisions assistables par l'IA, integrations externes

### Agent 5 — Interface Utilisateur
**Mission** : Cartographier l'UI/UX et identifier les points d'entree IA.
- **200+ composants** dans `src/components/` organises en : admin-analytics, admin-dashboard, artisans, auth, dashboard, data-view, documents, interventions, layout, maps, providers, search, shared, ui, virtual-components
- **Recherche actuelle** : `src/components/search/` — UniversalSearchResults, SearchSection, ArtisanResultItem, InterventionResultItem + `src/hooks/useUniversalSearch.ts` + `src/lib/api/v2/search.ts`
- **Formulaires** : composants modals, `useInterventionForm.ts`, `useInterventionFormState.ts`, `useArtisanModal.ts`
- **Dashboard** : `src/components/dashboard/`, `src/components/admin-dashboard/`, `src/components/admin-analytics/`
- **Cartes** : `src/components/maps/`
- **Navigation** : `src/components/layout/`, `src/contexts/NavigationContext.tsx`
- **Raccourcis clavier** : `src/hooks/useKeyboardShortcuts.ts`, `src/hooks/useSubmitShortcut.ts`, `src/hooks/usePlatformKey.ts`
- **Livrable** : Inventaire des ecrans, systeme de recherche actuel (limitations), et surtout : **analyse detaillee des 3 modes d'integration IA possibles** :
  1. **Chat dans la barre de recherche** (type Cmd+K / command palette) — faisabilite avec le composant search existant
  2. **Chatbot bulle flottante** (type Messenger/Intercom) — ou le placer dans le layout, quel composant creer
  3. **Raccourci clavier** — integration avec le systeme existant (`useKeyboardShortcuts.ts`)
  - Pour chaque mode : avantages, inconvenients, effort d'implementation, mockup textuel de l'experience

### Agent 6 — Donnees & Volumes
**Mission** : Evaluer le potentiel des donnees pour l'IA.
- **Seeds** : `supabase/seeds/`
- **Query keys** : `src/lib/react-query/queryKeys.ts`
- **Cache** : `src/lib/api/v2/common/cache.ts`
- **Recherche** : `src/lib/api/v2/search.ts`, `src/lib/api/v2/search-utils.ts`
- **Filtres** : `src/hooks/useSmartFilters.ts`, `src/hooks/useFilterCounts.ts`, `src/lib/realtime/filter-utils.ts`
- **Historiques** : `useInterventionHistory.ts`, `useInterventionsHistory.ts`, `useCycleTimeHistory.ts`, `useMarginHistory.ts`, `useRevenueHistory.ts`
- **Documents** : `src/lib/api/v2/documentsApi.ts`, `src/hooks/useDocumentUpload.tsx`
- **SIRET** : `src/hooks/useSiretVerification.ts` (integration externe)
- **Geocoding** : `src/hooks/useGeocodeSearch.ts` (donnees geo)
- **Livrable** : Inventaire des donnees par categorie, donnees a forte valeur IA, champs texte libre (embeddings), donnees temporelles (prediction), donnees sous-exploitees, volumes estimes, contraintes RGPD, prerequis techniques pour l'IA

---

## Phase 2 — Attente et collecte des rapports

Une fois les 6 agents lances, **attends que tous aient termine**. Verifie regulierement leur progression via TaskOutput (block=false). Quand un agent termine, lis son rapport complet.

---

## Phase 3 — Synthese et production des livrables

Une fois TOUS les rapports recus, produis les fichiers suivants dans le dossier `IA_audit/` (cree-le s'il n'existe pas) :

### Fichier 1 : `IA_audit/01_cartographie_technique.md`
Synthese de l'architecture avec diagrammes Mermaid :
- Diagramme d'architecture globale (composants, flux de donnees)
- Diagramme du modele de donnees (entites et relations)
- Diagramme des workflows metier (state machines)
- Points d'injection IA identifies sur chaque diagramme

### Fichier 2 : `IA_audit/02_analyse_donnees_ia.md`
Analyse du potentiel des donnees :
- Inventaire des donnees exploitables par l'IA
- Champs texte libre (NLP/embeddings)
- Donnees temporelles (prediction)
- Donnees geospatiales (optimisation)
- Donnees sous-exploitees
- Contraintes RGPD

### Fichier 3 : `IA_audit/03_opportunites_ia.md`
Pour CHAQUE opportunite identifiee (vise 15-25 recommandations) :
1. **Titre** court et explicite
2. **Description** orientee utilisateur final (pas de jargon)
3. **Donnees exploitees** : tables/champs exacts du schema
4. **Approche technique** : API Claude, embeddings pgvector, RAG, agent, fine-tuning, etc.
5. **Complexite** : 🟢 Simple (< 1 semaine) | 🟡 Moyen (1-4 semaines) | 🔴 Complexe (> 1 mois)
6. **Impact business** : ⭐ a ⭐⭐⭐⭐⭐ avec justification
7. **Dependances** : prerequis techniques
8. **Risques** : RGPD, cout API, hallucinations, dependance fournisseur
9. **Fichiers concernes** : references exactes dans le codebase

### Fichier 4 : `IA_audit/04_integration_ui_ia.md`
Analyse detaillee des modes d'integration IA dans l'interface :

#### Option A — Chat integre a la recherche (Cmd+K)
- Comment transformer `UniversalSearchResults` en recherche hybride (classique + IA)
- Diagramme Mermaid du flux utilisateur
- Composants a modifier/creer
- Estimation d'effort

#### Option B — Chatbot bulle flottante (type Messenger)
- Placement dans le layout (`app/layout.tsx`)
- Composant a creer (bulle, panneau coulissant, historique)
- Diagramme Mermaid de l'architecture du chatbot
- Integration avec les donnees du CRM (contexte de la page courante)
- Estimation d'effort

#### Option C — Raccourcis clavier + assistant contextuel
- Extension de `useKeyboardShortcuts.ts`
- Actions IA declenchables par raccourci (resume, suggestion, generation)
- Integration avec le contexte de la page/modal courante
- Estimation d'effort

#### Comparatif et recommandation
- Tableau comparatif des 3 options (effort, impact, complexite)
- Recommandation du mode a implementer en premier
- Possibilite de combiner les modes

### Fichier 5 : `IA_audit/05_etat_des_lieux_implementation.md`
Analyse de ce qui est DEJA pret et ce qui manque :
- **Ce qui va** : architecture modulaire, patterns existants reutilisables, couche API abstraite, etc.
- **Ce qui manque** : pgvector, colonnes embeddings, API IA, composant chat, etc.
- **Prerequis techniques** detailles avec estimation d'effort pour chacun
- **Diagramme Mermaid** : "before/after" de l'architecture avec couche IA

### Fichier 6 : `IA_audit/06_roadmap_et_priorisation.md`
- **Matrice de priorisation** (Impact x Faisabilite) en format Mermaid quadrant chart
- **Roadmap en 3 phases** :
  - Quick wins (< 2 semaines, ROI immediat)
  - Phase 2 (1-2 mois, fonctionnalites structurantes)
  - Vision long terme (3-6 mois, transformation UX)
- **Estimation economique** par recommandation :
  - Cout dev (jours)
  - Cout operationnel mensuel (appels API, stockage)
  - Valeur creee (temps economise x utilisateurs x frequence)
- **Diagramme Mermaid Gantt** de la roadmap

### Fichier 7 : `IA_audit/07_synthese_executive.md`
Resume executif (1-2 pages) pour presentation au client :
- Situation actuelle du CRM
- Potentiel IA identifie (les 5 opportunites les plus impactantes)
- Investissement requis vs valeur creee
- Avantage concurrentiel SaaS (fonctionnalites qui justifient l'abonnement)
- Prochaines etapes recommandees

---

## Consignes critiques

1. **Aucune recommandation sans ancrage dans le code reel**. Chaque suggestion DOIT referencer des fichiers, tables ou composants specifiques du codebase.
2. **Utilise des diagrammes Mermaid** partout ou c'est pertinent (architecture, workflows, comparatifs, roadmap).
3. **Pense "valeur percue par l'utilisateur final"**, pas prouesse technique.
4. **Signale explicitement les cas ou l'IA n'apporterait PAS de valeur** — ca renforce la credibilite.
5. **Considere la contrainte RGPD** : donnees personnelles, transit par API externes.
6. **Privilegier les recommandations SaaS** : fonctionnalites qui augmentent le switching cost et justifient l'abonnement.
7. **Tous les fichiers en francais**, noms de fichiers sans accents.
8. **Le secteur de GMBS** : gestion immobiliere, maintenance et interventions batiment, coordination d'artisans.
