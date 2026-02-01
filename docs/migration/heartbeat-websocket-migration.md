# Migration : HTTP Polling → WebSocket Presence

## Comparaison des Solutions

### Solution Actuelle (HTTP Polling)
```typescript
// Envoie une requête HTTP toutes les 30s
setInterval(() => {
  fetch('/api/auth/heartbeat', { method: 'POST' })
}, 30000)
```

**Coût pour 100 utilisateurs** :
- 12,000 requêtes HTTP/heure
- ~6 MB de bande passante/heure
- Charge serveur élevée

### Solution Optimale (WebSocket Presence)
```typescript
// Connexion WebSocket persistante
const channel = supabase.channel('online-users')
  .on('presence', { event: 'sync' }, () => {
    // Automatiquement synchronisé
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        user_id: currentUser.id,
        online_at: new Date().toISOString(),
      })
    }
  })
```

**Coût pour 100 utilisateurs** :
- 0 requêtes HTTP (connexion persistante)
- ~50 KB de bande passante/heure
- Charge serveur minimale
- **Détection instantanée** des déconnexions

## Architecture WebSocket avec Supabase Presence

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
├─────────────────────────────────────────────────────────────┤
│  1. Ouvre connexion WebSocket au chargement de la page      │
│  2. Envoie "track" avec user_id                             │
│  3. La connexion reste ouverte                              │
│  4. Si crash/fermeture → WS se ferme automatiquement        │
└─────────────────────────────────────────────────────────────┘
                           ↕ WebSocket persistant
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE REALTIME                         │
├─────────────────────────────────────────────────────────────┤
│  • Maintient la liste des utilisateurs "présents"           │
│  • Détecte automatiquement les déconnexions (timeout 30s)   │
│  • Broadcast les changements à tous les clients             │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    POSTGRES TRIGGER                          │
├─────────────────────────────────────────────────────────────┤
│  • Écoute les événements presence_sync                       │
│  • Met à jour users.status automatiquement                   │
│  • Pas besoin de cron job !                                  │
└─────────────────────────────────────────────────────────────┘
```

## Implémentation

### Étape 1 : Client (React)

```typescript
// src/providers/PresenceProvider.tsx
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase-client'
import { useCurrentUser } from '@/hooks/useCurrentUser'

export function PresenceProvider({ children }) {
  const { data: currentUser } = useCurrentUser()

  useEffect(() => {
    if (!currentUser?.id) return

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUser.id, // Unique par utilisateur
        },
      },
    })

    // Écouter les changements de présence
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        console.log('Online users:', Object.keys(state))
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Envoyer notre présence
          await channel.track({
            user_id: currentUser.id,
            online_at: new Date().toISOString(),
          })
        }
      })

    // Cleanup
    return () => {
      channel.untrack()
      channel.unsubscribe()
    }
  }, [currentUser?.id])

  return <>{children}</>
}
```

### Étape 2 : Base de Données (Trigger)

```sql
-- Fonction déclenchée par les événements de présence
CREATE OR REPLACE FUNCTION sync_user_presence()
RETURNS trigger AS $$
BEGIN
  -- Quand un utilisateur est présent
  IF TG_OP = 'INSERT' THEN
    UPDATE users
    SET status = 'connected', last_seen_at = NOW()
    WHERE id = NEW.user_id;

  -- Quand un utilisateur se déconnecte
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE users
    SET status = 'offline'
    WHERE id = OLD.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer le trigger (nécessite Supabase Pro pour les triggers sur realtime)
-- Alternative : Utiliser une Edge Function qui écoute les événements presence
```

### Étape 3 : Comparaison des Performances

| Aspect | HTTP Polling | WebSocket Presence |
|--------|--------------|-------------------|
| Connexions/user | 120/h | 1 totale |
| Bande passante | 60 KB/h | 0.5 KB/h |
| Latence détection | 30-90s | <1s |
| Charge CPU serveur | Haute | Basse |
| Scalabilité | Limitée | Excellente |
| Code maintenance | Complexe | Simple |

## Recommandation

**Pour un CRM professionnel, utilisez WebSocket Presence**

✅ Avantages :
- Performance 100x meilleure
- Détection instantanée des crashes
- Moins de charge serveur
- Expérience utilisateur supérieure
- Déjà intégré dans Supabase

❌ HTTP Polling est acceptable pour :
- Prototypes/MVPs
- Très petits nombres d'utilisateurs (<10)
- Quand WebSocket n'est pas disponible

## Migration Progressive

1. **Phase 1** : Garder HTTP polling actuel (fonctionne)
2. **Phase 2** : Implémenter WebSocket Presence en parallèle
3. **Phase 3** : Tester avec quelques utilisateurs
4. **Phase 4** : Basculer tous les utilisateurs
5. **Phase 5** : Supprimer le code HTTP polling

## Ressources

- [Supabase Realtime Presence Docs](https://supabase.com/docs/guides/realtime/presence)
- [WebSocket vs HTTP Polling](https://ably.com/topic/websockets-vs-http)