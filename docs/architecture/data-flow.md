# Flux de donnees

> Architecture du flux de donnees complet dans GMBS-CRM, de l'interface utilisateur jusqu'a la base de donnees et retour.

---

## Vue d'ensemble

Le flux de donnees dans GMBS-CRM suit un pipeline en couches qui garantit la coherence, la performance et la reactivite en temps reel.

```mermaid
graph TB
    subgraph "Frontend"
        A[Composant React] --> B[Hook Custom]
        B --> C[TanStack Query]
    end

    subgraph "Couche API"
        C --> D[API V2 Facade]
        D --> E{Type de requete}
        E -->|Liste paginee| F[Edge Function]
        E -->|Detail / CRUD| G[Client Supabase Direct]
    end

    subgraph "Backend"
        F --> H[PostgreSQL]
        G --> H
        H -->|Supabase Realtime| I[Postgres Changes]
    end

    subgraph "Retour temps reel"
        I --> J[realtime-client.ts]
        J --> K[cache-sync.ts]
        K --> L[TanStack Query Cache]
        L --> A
        K --> M[BroadcastChannel]
        M --> N[Autres onglets]
    end
```

---

## Flux aller : lecture des donnees

### 1. Composant React

Le composant declare ses besoins en donnees via un hook custom. Il ne connait ni l'API ni le cache.

```tsx
// app/interventions/page.tsx
function InterventionsPage() {
  const { data, isLoading } = useInterventionsQuery({
    page: 1,
    pageSize: 50,
    status: ['DEMANDE', 'DEVIS_ENVOYE'],
    user: currentUser.id,
  });

  return <InterventionsViewRenderer data={data} />;
}
```

### 2. Hook custom (useInterventionsQuery)

Le hook orchestre le fetching avec TanStack Query. Il gere :
- La construction des query keys via la factory `interventionKeys`
- Le `staleTime` adaptatif selon le contexte
- Le prefetch de la page suivante
- Le `placeholderData` pour eviter les flashs de chargement

```mermaid
sequenceDiagram
    participant C as Composant
    participant H as useInterventionsQuery
    participant TQ as TanStack Query
    participant API as interventionsApi
    participant EF as Edge Function
    participant DB as PostgreSQL

    C->>H: useInterventionsQuery(params)
    H->>TQ: useQuery({ queryKey, queryFn })

    alt Cache valide (staleTime)
        TQ-->>H: Donnees depuis le cache
    else Cache expire
        TQ->>API: interventionsApi.getAll(params)
        API->>EF: fetch(SUPABASE_FUNCTIONS_URL/interventions-v2)
        EF->>DB: SELECT avec filtres, pagination, JOINs
        DB-->>EF: Rows PostgreSQL
        EF-->>API: JSON Response
        API->>API: mapInterventionRecord() enrichissement
        API-->>TQ: Interventions enrichies
        TQ-->>H: Donnees fraiches
    end

    H-->>C: { data, isLoading, error }

    Note over H,TQ: Prefetch page suivante en parallele
    H->>TQ: prefetchQuery({ page: page + 1 })
```

### 3. TanStack Query (cache client)

TanStack Query gere le cache cote client avec des query keys structurees :

```typescript
// src/lib/react-query/queryKeys.ts
export const interventionKeys = {
  all: ["interventions"] as const,
  lists: () => [...interventionKeys.all, "list"] as const,
  list: (params) => [...interventionKeys.lists(), params] as const,
  lightLists: () => [...interventionKeys.all, "light"] as const,
  lightList: (params) => [...interventionKeys.lightLists(), params] as const,
  details: () => [...interventionKeys.all, "detail"] as const,
  detail: (id, include?) => [...interventionKeys.details(), id, include] as const,
};
```

La hierarchie de cles permet une invalidation granulaire :
- `interventionKeys.all` invalide tout
- `interventionKeys.lists()` invalide toutes les listes mais pas les details
- `interventionKeys.list(params)` invalide une seule liste avec ses filtres

### 4. API V2 Facade

L'API V2 utilise le pattern Facade a deux niveaux :

```mermaid
graph LR
    subgraph "Facade principale (index.ts)"
        A[apiV2.interventions] --> B[interventionsApi]
        A2[apiV2.artisans] --> B2[artisansApi]
        A3[apiV2.comments] --> B3[commentsApi]
        A4[apiV2.documents] --> B4[documentsApi]
    end

    subgraph "Facade interventions (interventions/index.ts)"
        B --> C1[interventions-crud]
        B --> C2[interventions-status]
        B --> C3[interventions-costs]
        B --> C4[interventions-stats]
        B --> C5[interventions-filters]
    end
```

### 5. Edge Function vs Client Supabase Direct

Le choix du transport depend de l'operation :

| Operation | Transport | Raison |
|-----------|-----------|--------|
| `getAll` (liste paginee) | Edge Function `interventions-v2` | Logique metier complexe, filtres avances, JOINs |
| `getAllLight` (warm-up) | Edge Function `interventions-v2` | Version allegee pour prefetch |
| `getById` (detail) | Client Supabase Direct | JOINs simples, pas besoin de logique serveur |
| `create` / `update` | Client Supabase Direct | CRUD standard + transition automatique |
| `upsert` (import) | Edge Function `interventions-v2` | Logique de deduplication |

### 6. Enrichissement des donnees (mapInterventionRecord)

Chaque enregistrement brut PostgreSQL est transforme en objet metier enrichi par `mapInterventionRecord`. Cette fonction, definie dans `src/lib/api/v2/common/utils.ts`, effectue :

```mermaid
graph TD
    A[Record PostgreSQL brut] --> B[mapInterventionRecord]

    B --> C[Resolution FK via ReferenceCacheManager]
    C --> C1[assigned_user_id -> objet User complet]
    C --> C2[agence_id -> objet Agency complet]
    C --> C3[statut_id -> objet Status complet]
    C --> C4[metier_id -> objet Metier complet]

    B --> D[Extraction relations]
    D --> D1[intervention_artisans -> artisanIds + displayName]
    D --> D2[intervention_costs -> totaux CA/SST/materiel/marge]
    D --> D3[tenants -> prenomClient, nomClient, nomPrenomClient]
    D --> D4[owner -> prenomProprietaire, nomProprietaire, nomPrenomFacturation]

    B --> E[Normalisation champs]
    E --> E1[snake_case -> camelCase aliases]
    E --> E2[Chaines de fallback pour noms]
    E --> E3[Priorite costs_cache > calcule > legacy]
    E --> E4[Priorite objet joint > champ plat > concatenation]

    B --> F[Objet Intervention enrichi - 50+ champs]
```

Le `ReferenceCacheManager` (singleton, TTL 5 minutes) fournit des lookups O(1) via des `Map<string, T>` pour les donnees de reference :
- `usersById`, `allUsersById`
- `agenciesById`
- `interventionStatusesById`
- `artisanStatusesById`
- `metiersById`

---

## Flux aller : ecriture des donnees

### Mutations avec updates optimistes

Les mutations suivent un pattern en 4 etapes pour garantir une experience fluide :

```mermaid
sequenceDiagram
    participant C as Composant
    participant M as useInterventionsMutations
    participant TQ as TanStack Query Cache
    participant API as interventionsApi
    participant DB as PostgreSQL
    participant RT as Supabase Realtime

    C->>M: mutation.mutate(data)

    Note over M,TQ: onMutate (optimiste)
    M->>TQ: cancelQueries() - annuler requetes en vol
    M->>TQ: getQueryData() - sauvegarder etat precedent
    M->>TQ: setQueriesData() - appliquer le changement immediatement

    M->>API: interventionsApi.update(id, data)
    API->>DB: UPDATE interventions SET ...

    alt Succes
        DB-->>API: OK
        API-->>M: Resultat
        Note over M,TQ: onSuccess
        M->>TQ: invalidateQueries() - re-fetch pour coherence
    else Erreur
        DB-->>API: Error
        API-->>M: Error
        Note over M,TQ: onError (rollback)
        M->>TQ: setQueryData(previous) - restaurer l'etat sauvegarde
    end

    Note over DB,RT: En parallele, Realtime notifie les autres clients
    DB->>RT: postgres_changes event
    RT->>TQ: Mise a jour cache via cache-sync
```

### Taches post-mutation (fire-and-forget)

Apres le succes de la mutation principale, certaines donnees secondaires (couts, paiements, artisans) sont sauvegardees en arriere-plan via `runPostMutationTasks()` (`src/lib/interventions/post-mutation-tasks.ts`).

Le pattern est le suivant :

1. **Modal ferme immediatement** apres le `mutateAsync()` pour la fluidite UX
2. **Toast loading** indique que l'enregistrement est en cours
3. **Taches secondaires** (couts, paiements, artisans) s'executent en parallele en arriere-plan
4. **Invalidation du cache** intervention detail apres completion des taches → TanStack Query refetch → l'UI se met a jour automatiquement

```typescript
// Apres le succes de la mutation principale
runPostMutationTasks({
  interventionId: id,
  costs: allCosts,
  payments: payments,
  artisans: { primary, secondary },
  queryClient,  // Pour l'invalidation du cache apres completion
  invalidateDashboard: true,
})
// → fire-and-forget : ne bloque pas le thread
// → invalide ['interventions', 'detail', id] apres completion
```

> **Important :** `runPostMutationTasks` invalide systematiquement le cache du detail intervention (`['interventions', 'detail', interventionId]`) apres la sauvegarde des couts/paiements. Cela garantit que l'UI affiche les donnees a jour sans que l'utilisateur ait besoin de recharger manuellement.

---

## Flux retour : temps reel

### Canal Supabase Realtime (multiplexe)

Le systeme ecoute 3 tables sur un seul canal Supabase Realtime (1 connexion WebSocket) :

```typescript
// src/lib/realtime/realtime-client.ts
const channel = supabase
  .channel('crm-sync')
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'interventions',
    filter: 'is_active=eq.true',  // -50% trafic (soft deletes ignores)
  }, handlers.onInterventionEvent)
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'artisans',
    filter: 'is_active=eq.true',
  }, handlers.onArtisanEvent)
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'intervention_artisans',
  }, handlers.onJunctionEvent)
```

### Leader Election (Web Locks API)

Un seul onglet par navigateur maintient la connexion WebSocket. Les autres onglets (followers)
recoivent les evenements via BroadcastChannel relay (gratuit, local-only) :

```mermaid
graph LR
    subgraph "Navigateur (1 WebSocket)"
        T1["Onglet 1 (Leader)"] -->|WebSocket| SB[Supabase Realtime]
        T1 -->|BroadcastChannel relay| T2["Onglet 2 (Follower)"]
        T1 -->|BroadcastChannel relay| T3["Onglet 3 (Follower)"]
    end
```

| Composant | Connexions/utilisateur | Total (30 users) |
| --------- | ---------------------- | ----------------- |
| Realtime channel (leader uniquement) | 1 | 30 |
| BroadcastChannel (API navigateur) | 0 | 0 |
| Polling fallback (REST, pas WS) | 0 | 0 |
| **Total** | **1** | **30** (15% du plan Free) |

Fichiers cles :

- `src/lib/realtime/leader-election.ts` — Election via Web Locks API
- `src/lib/realtime/realtime-relay.ts` — Relay BroadcastChannel leader→followers
- `src/hooks/useCrmRealtime.ts` — Orchestrateur global (hook principal, monte une fois en racine)
- `src/hooks/useInterventionRealtime.ts` — Hook **scoped** consomme par les formulaires d'intervention pour reagir aux mises a jour distantes du record courant (refacto avril 2026). Ne souscrit pas a un canal supplementaire : il s'abonne aux invalidations cache emises par `useCrmRealtime` et expose un signal "remoteUpdated" aux composants form-sections.

Fallback : si Web Locks n'est pas disponible, chaque onglet souscrit independamment (comportement historique).

### Pipeline de traitement des evenements

```mermaid
graph TD
    A[Evenement Realtime PostgreSQL] --> B[realtime-client.ts]
    B --> C[cache-sync.ts - syncCacheWithRealtimeEvent]

    C --> D{Type d'evenement}

    D -->|INSERT| E[handleInsert]
    D -->|UPDATE| F{Soft delete?}
    D -->|DELETE| G[handleDelete]

    F -->|Oui| H[handleSoftDelete - retrait du cache]
    F -->|Non| I{Acces RLS perdu?}

    I -->|Oui| J[handleAccessRevoked]
    I -->|Non| K[handleUpdate]

    E --> L[enrichRealtimeRecord]
    K --> L

    L --> M[Mise a jour TanStack Query Cache]
    M --> N[invalidateQueries refetchType active]

    C --> O[Detecter conflit si modification simultanee]
    O --> P{Conflit?}
    P -->|Oui| Q[showConflictNotification]
    P -->|Non| R[addIndicator - badge modification distante]

    C --> S[BroadcastChannel vers autres onglets]
    C --> T[debouncedRefreshCounts]
```

### Les 4 cas d'un UPDATE

Lors d'un UPDATE, le systeme determine l'action en fonction de la correspondance avec les filtres actifs :

| Situation | Action |
|-----------|--------|
| Pas dans la liste + ne match pas les filtres | Aucun changement |
| Pas dans la liste + match les filtres maintenant | Ajout a la liste |
| Dans la liste + match toujours les filtres | Mise a jour du record |
| Dans la liste + ne match plus les filtres | Retrait de la liste |

### Synchronisation cross-tab (Leader Election)

Avec la leader election (Web Locks API), un seul onglet maintient la connexion WebSocket.
Le leader relaie les payloads Realtime complets aux followers via un `BroadcastChannel` dedie (`crm-realtime-relay`).
Les followers traitent les evenements a travers le meme pipeline cache-sync (updates optimistes, detection de conflits, indicateurs).

```mermaid
sequenceDiagram
    participant DB as PostgreSQL
    participant L as Onglet Leader
    participant RC as Relay Channel
    participant F1 as Onglet Follower 1
    participant F2 as Onglet Follower 2

    DB->>L: Realtime event (postgres_changes)
    L->>L: syncCacheWithRealtimeEvent()
    L->>RC: relayPayload(table, fullPayload)
    RC->>F1: PayloadMessage
    RC->>F2: PayloadMessage
    F1->>F1: syncCacheWithRealtimeEvent()
    F2->>F2: syncCacheWithRealtimeEvent()

    Note over L: Si WebSocket tombe
    L->>RC: relayStatus('polling')
    RC->>F1: StatusMessage
    F1->>F1: startPolling() autonome
```

Quand le leader ferme son onglet, le Web Lock est automatiquement libere
et le prochain onglet en attente est promu leader (zero configuration, zero race condition).

Fallback sans Web Locks : chaque onglet souscrit independamment et utilise
`broadcast-sync.ts` pour propager les invalidations (comportement historique).

---

## Flux offline : SyncQueue

Quand le reseau est indisponible, les mutations sont mises en file d'attente :

```mermaid
graph TD
    A[Mutation echoue - reseau indisponible] --> B[SyncQueue]
    B --> C[Persistance localStorage]

    C --> D{Reseau disponible?}
    D -->|Non| E[Attendre - check periodique]
    D -->|Oui| F[Traitement par batch de 10]

    F --> G{Succes?}
    G -->|Oui| H[Retirer de la queue]
    G -->|Non| I{Tentatives < 3?}
    I -->|Oui| J[Exponential backoff: 1s -> 2s -> 4s]
    J --> F
    I -->|Non| K[Abandonner - notification erreur]
```

---

## Flux complet : exemple concret

Voici le flux complet lorsqu'un gestionnaire change le statut d'une intervention de DEMANDE a DEVIS_ENVOYE :

```mermaid
sequenceDiagram
    participant U as Gestionnaire
    participant C as StatusDropdown
    participant WE as WorkflowEngine
    participant M as useInterventionsMutations
    participant TQ as TanStack Query
    participant API as interventionsApi
    participant DB as PostgreSQL
    participant RT as Realtime
    participant CS as cache-sync
    participant BC as BroadcastChannel
    participant U2 as Autre gestionnaire (onglet)

    U->>C: Clic "Devis envoye"
    C->>WE: validateTransition(DEMANDE, DEVIS_ENVOYE, context)
    WE-->>C: { canTransition: true }

    C->>M: updateMutation.mutate({ statut_id: devisEnvoyeId })

    Note over M,TQ: Update optimiste
    M->>TQ: Cache mis a jour immediatement
    TQ-->>U: UI rafraichie instantanement

    M->>API: interventionsApi.updateStatus(id, statusId)
    API->>DB: UPDATE + INSERT audit_log
    DB-->>API: OK

    Note over DB,RT: Notification temps reel
    DB->>RT: postgres_changes (UPDATE)
    RT->>CS: syncCacheWithRealtimeEvent()
    CS->>CS: enrichRealtimeRecord()
    CS->>TQ: handleUpdate() + invalidateQueries()
    CS->>BC: broadcastRealtimeEvent()
    BC->>U2: Mise a jour instantanee
```

---

## Resume des couches

| Couche | Fichier(s) | Responsabilite |
|--------|-----------|----------------|
| Composant | `app/**/page.tsx`, `src/components/` | Affichage, interaction utilisateur |
| Hook | `src/hooks/useInterventionsQuery.ts` | Orchestration fetching, prefetch, staleTime |
| Cache client | TanStack Query + `queryKeys.ts` | Cache, invalidation, updates optimistes |
| API Facade | `src/lib/api/v2/index.ts` | Point d'entree unique, routage |
| API Modules | `src/lib/api/v2/interventions/*.ts` | Logique metier par domaine |
| Transport | Edge Functions / Supabase Client | Communication avec la base |
| Base de donnees | PostgreSQL (Supabase) | Stockage, RLS, triggers |
| Realtime | `src/lib/realtime/realtime-client.ts` | Reception evenements (channel multiplex) |
| Leader Election | `src/lib/realtime/leader-election.ts` | 1 WebSocket par navigateur (Web Locks API) |
| Realtime Relay | `src/lib/realtime/realtime-relay.ts` | Relay leader→followers (BroadcastChannel) |
| Cache Sync | `src/lib/realtime/cache-sync.ts` | Orchestration mise a jour cache |
| Cross-tab | `src/lib/realtime/broadcast-sync.ts` | Propagation inter-onglets (fallback) |
| Offline | `src/lib/realtime/sync-queue.ts` | File d'attente mode deconnecte |

---

## Recherche universelle : pattern hybride MV + buffer live

La barre de recherche globale (`search_global` RPC) combine deux sources pour offrir une recherche full-text quasi temps reel sans timeout sur les ecritures.

### Probleme historique

La recherche reposait initialement sur des materialized views (`global_search_mv`, `interventions_search_mv`, `artisans_search_mv`) rafraichies par un job pg_cron toutes les 60s (cf. migration `00035_async_search_views_refresh.sql`). Une intervention creee venait dans la barre de recherche apres un delai de 0 a 60s — frustrant pour le gestionnaire qui cree puis cherche immediatement.

### Solution : pattern Near-Real-Time Search

Inspire du pattern Elasticsearch (segments + translog), `search_global` combine :

1. **Materialized View (bulk)** — `global_search_mv` pre-calcule l'index full-text avec tous les JOINs (agence, tenant, owner, artisan, commentaires). Refresh par cron toutes les 60s.
2. **Buffer live** — scan direct des tables `interventions` et `artisans` pour les lignes modifiees depuis le dernier refresh (`updated_at > last_refresh`). Borne a 500 lignes par type d'entite (garde-fou si le cron prend du retard).
3. **Deduplication** — si une ligne est presente dans les deux sources, la version live gagne (priorite source 0 > 1).

```
search_global(query)
  |
  +--> mv_results (bulk, MV pre-calcule, JOINs riches)
  |    \-- LIMIT p_limit * 3 (sur-fetch pour le merge)
  |
  +--> recent_interventions (buffer live, GIN sur interventions.search_vector)
  |    \-- WHERE updated_at > last_refresh
  |    \-- ORDER BY updated_at DESC LIMIT 500
  |
  +--> recent_artisans (buffer live, GIN sur artisans.search_vector)
  |    \-- WHERE updated_at > last_refresh
  |    \-- ORDER BY updated_at DESC LIMIT 500
  |
  +--> UNION ALL + DISTINCT ON (entity_type, entity_id)
       ORDER BY source_priority ASC  -- live (0) gagne sur MV (1)
       \-- ORDER BY rank DESC LIMIT p_limit OFFSET p_offset
```

### Composants

| Composant | Fichier | Role |
|-----------|---------|------|
| Fonction RPC | `supabase/migrations/99026_fix_search_global_rank_type.sql` | Implementation `search_global` |
| Colonnes generees | `interventions.search_vector`, `artisans.search_vector` (tsvector) | Buffer live, GENERATED ALWAYS AS STORED |
| Indexes GIN | `idx_interventions_search_vector_live`, `idx_artisans_search_vector_live` | Full-text sur tables de base |
| Indexes B-tree partiels | `idx_interventions_updated_at`, `idx_artisans_updated_at` (WHERE is_active = true) | Fenetre temporelle du buffer |
| Wrapper IMMUTABLE | `f_unaccent(text)` | Permet d'utiliser unaccent dans une colonne GENERATED |
| Cron de refresh | Job `refresh_search_views` (toutes les 60s) | Maintient la MV |
| Flags de refresh | Table `search_views_refresh_flags` | Source de verite pour `last_refresh` |

### Limites connues

- Le `search_vector` des tables de base ne contient **que les champs propres** (pas les JOINs). Une intervention fraichement creee sera trouvable par son `id_inter`, son contexte, son adresse, mais **pas par le nom du tenant ou de l'agence** avant le prochain refresh MV. La MV enrichie prend le relais sous 60s.
- Le `metadata` JSONB du buffer live est simplifie (pas d'agence, pas d'artisan lie). Sans impact UI : le frontend re-fetch les donnees completes par ID via `fetchInterventionsByIds` / `fetchArtisansByIds`.
- Pagination profonde instable si un refresh a lieu entre deux pages. Cas d'usage rare en pratique (la recherche universelle affiche peu de resultats par defaut).

### Deploiement

- Sur dev/staging : `99024_hybrid_search_global.sql` peut s'appliquer directement (volumes faibles).
- En prod, en 2 etapes pour eviter les locks long :
  1. `supabase/samples/sql/search/prod_deploy_1_search_columns.sql` — ALTER TABLE ADD COLUMN (transactionnel OK, mais rewrite de table).
  2. `supabase/samples/sql/search/prod_deploy_2_search_indexes_concurrent.sql` — `CREATE INDEX CONCURRENTLY`, **statement par statement** (interdit en transaction).
  
  La migration 99024 devient ensuite no-op grace aux `IF NOT EXISTS`.

### Tests

`supabase/samples/sql/search/test_hybrid_search.sql` contient les tests manuels (buffer live, dedup, type de retour, bornage).

### Spec complete

[docs/specs/hybrid-search-freshness.md](../specs/hybrid-search-freshness.md) — design detaille, alternatives ecartees, evolution future trigger-based.
