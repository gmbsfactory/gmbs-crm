Voici la chaîne complète, du plus bas au plus haut :


┌─ .env.local ──────────────────────────────────────────────────┐
│  NEXT_PUBLIC_SUPABASE_URL = http://127.0.0.1:54321            │
│  NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_...           │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─ src/lib/supabase-client.ts ──────────────────────────────────┐
│  createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)        │
│  → Singleton (1 instance par onglet)                          │
│  → Gère la connexion WebSocket Realtime                       │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─ src/lib/realtime/realtime-client.ts ─────────────────────────┐
│  createInterventionsChannel(onEvent)                           │
│  → supabase.channel('interventions-changes')                  │
│      .on('postgres_changes', {                                │
│         table: 'interventions',                                │
│         filter: 'is_active=eq.true'                           │
│      })                                                        │
│  → channel.subscribe()  ← ⚠️ 1er subscribe ici               │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─ src/hooks/useInterventionsRealtime.ts ───────────────────────┐
│  useEffect:                                                    │
│    channel = createInterventionsChannel(callback)              │
│    channel.subscribe()  ← ⚠️ 2ème subscribe ici !             │
│                                                                │
│  callback = async (payload) => {                               │
│    syncCacheWithRealtimeEvent(queryClient, payload, userId)    │
│  }                                                             │
│                                                                │
│  Fallback: polling 15s si Realtime KO                         │
│  Retourne: { connectionStatus }                               │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─ src/lib/realtime/cache-sync.ts ──────────────────────────────┐
│  syncCacheWithRealtimeEvent(queryClient, payload, userId)      │
│    → enrichRealtimeRecord() (ajoute ref data)                 │
│    → updateInterventionQueries() (met à jour listes)          │
│    → invalidateQueries(detail) (refetch si modal ouvert)      │
│    → broadcastSync (sync entre onglets)                       │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─ src/components/interventions/InterventionRealtimeProvider.tsx┐
│  { connectionStatus } = useInterventionsRealtime()             │
│  → Fournit le contexte React aux enfants                      │
│  → Affiche l'indicateur de connexion (optionnel)              │
└──────────────────────┬────────────────────────────────────────┘
                       │
                       ▼
┌─ app/interventions/page.tsx ──────────────────────────────────┐
│  <InterventionRealtimeProvider>                                │
│    <PageContent />  ← TableView, Modals, etc.                 │
│  </InterventionRealtimeProvider>                               │
└───────────────────────────────────────────────────────────────┘