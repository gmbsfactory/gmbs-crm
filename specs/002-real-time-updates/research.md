# Research: Mise à jour en temps réel de la table vue des interventions

**Date**: 2025-01-27  
**Feature**: 002-real-time-updates  
**Status**: Complete

## Objectif

Documenter les décisions techniques pour l'implémentation de la mise à jour en temps réel des interventions via Supabase Realtime, en intégrant avec le cache TanStack Query existant.

## Décisions Techniques

### 1. Supabase Realtime pour la Synchronisation Multi-Utilisateurs

**Decision**: Utiliser Supabase Realtime (WebSocket) pour synchroniser les modifications d'interventions entre utilisateurs.

**Rationale**:
- Supabase Realtime est déjà activé dans la configuration (`supabase/config.toml`: `realtime.enabled = true`)
- Intégration native avec Supabase Auth et RLS pour la sécurité
- Support natif des événements PostgreSQL (`INSERT`, `UPDATE`, `DELETE`)
- Latence faible (< 2 secondes) pour la synchronisation multi-utilisateurs
- Pas de dépendance externe supplémentaire (déjà dans `@supabase/supabase-js`)

**Alternatives considérées**:
- **Polling simple**: Rejeté car inefficace (surcharge serveur) et latence élevée
- **Server-Sent Events (SSE)**: Rejeté car moins flexible que WebSocket pour les mises à jour bidirectionnelles
- **WebSocket custom**: Rejeté car nécessiterait infrastructure supplémentaire et gestion manuelle de la sécurité

**Implémentation**:
```typescript
// Configuration du channel Realtime
const channel = supabase
  .channel('interventions-changes')
  .on('postgres_changes', {
    event: '*', // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'interventions',
    filter: 'is_active=eq.true' // Filtrer les soft deletes
  }, handleRealtimeEvent)
  .subscribe()
```

### 2. Intégration avec TanStack Query Cache

**Decision**: Mettre à jour le cache TanStack Query via `setQueryData` immédiatement, puis invalider silencieusement en arrière-plan.

**Rationale**:
- `setQueryData` permet une mise à jour optimiste immédiate (< 500ms) pour la réactivité UI
- L'invalidation silencieuse en arrière-plan garantit la cohérence avec le serveur
- Conserve le staleTime 30s existant pour les chargements initiaux
- Évite les rechargements inutiles tout en garantissant la fraîcheur des données

**Alternatives considérées**:
- **Invalidation immédiate uniquement**: Rejeté car provoque des rechargements visibles et dégrade l'UX
- **setQueryData uniquement**: Rejeté car risque d'incohérence si d'autres modifications ont eu lieu entre-temps
- **Refetch immédiat**: Rejeté car latence trop élevée et surcharge serveur

**Implémentation**:
```typescript
// Mise à jour optimiste immédiate
queryClient.setQueryData(queryKey, (oldData) => {
  // Mise à jour optimiste basée sur l'événement Realtime
  return updateInterventionInCache(oldData, event)
})

// Invalidation silencieuse en arrière-plan (après 100ms)
setTimeout(() => {
  queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
}, 100)
```

### 3. Row Level Security (RLS) pour le Filtrage des Événements

**Decision**: Utiliser RLS de Supabase pour filtrer automatiquement les événements Realtime selon les permissions utilisateur.

**Rationale**:
- RLS est déjà activé sur la table `interventions`
- Filtrage automatique côté serveur (sécurité garantie)
- Pas de logique de filtrage supplémentaire côté client nécessaire
- Conforme aux principes de sécurité de la constitution

**Alternatives considérées**:
- **Filtrage côté client**: Rejeté car sécurité insuffisante et surcharge réseau
- **Politiques RLS personnalisées**: Non nécessaire, les politiques existantes suffisent

**Implémentation**:
Les événements Realtime sont automatiquement filtrés par RLS selon les politiques existantes. Aucune configuration supplémentaire nécessaire.

### 4. Gestion des Conflits de Modification Simultanée

**Decision**: Stratégie "dernier écrit gagne" avec notification toast aux utilisateurs concernés.

**Rationale**:
- Stratégie simple et prévisible
- Supabase gère automatiquement les conflits au niveau base de données
- Notification utilisateur pour transparence
- Conforme aux exigences de la spec (FR-012)

**Alternatives considérées**:
- **Merge automatique**: Rejeté car complexité élevée et risque d'incohérence
- **Verrouillage optimiste**: Rejeté car nécessiterait infrastructure supplémentaire

**Implémentation**:
```typescript
// Détection de conflit via timestamp updated_at
if (localUpdate.timestamp < remoteUpdate.timestamp) {
  // Conflit détecté : dernier écrit gagne
  showToast({
    title: "Modification écrasée",
    description: `${remoteUser.name} a modifié ${field} : ${oldValue} → ${newValue}`
  })
  // Restaurer la valeur distante
  queryClient.setQueryData(queryKey, remoteData)
}
```

### 5. Basculement vers Polling si Realtime Indisponible

**Decision**: Basculement automatique vers polling (5s) avec tentative de reconnexion Realtime toutes les 30s.

**Rationale**:
- Résilience réseau garantie
- Expérience utilisateur dégradée mais fonctionnelle
- Reconnexion automatique pour revenir au mode Realtime optimal
- Conforme aux exigences de la spec (Edge Cases)

**Alternatives considérées**:
- **Erreur silencieuse**: Rejeté car mauvaise UX (utilisateur ne sait pas que les données sont obsolètes)
- **Polling continu**: Rejeté car surcharge serveur inutile si Realtime disponible

**Implémentation**:
```typescript
// Détection de déconnexion Realtime
channel.on('error', () => {
  // Basculement vers polling
  startPolling(5000) // 5 secondes
})

// Tentative de reconnexion toutes les 30s
setInterval(() => {
  if (!channel.isConnected()) {
    channel.subscribe()
  }
}, 30000)
```

### 6. Debounce des Appels API de Comptage

**Decision**: Debounce de 500ms pour regrouper les mises à jour de compteurs lors de modifications multiples rapides.

**Rationale**:
- Évite la surcharge serveur lors de modifications multiples rapides
- Réduit le nombre d'appels API inutiles
- Latence acceptable (500ms) pour les compteurs
- Conforme aux exigences de la spec (FR-004)

**Alternatives considérées**:
- **Pas de debounce**: Rejeté car surcharge serveur lors de modifications multiples
- **Throttle**: Rejeté car moins efficace que debounce pour regrouper les mises à jour

**Implémentation**:
```typescript
const debouncedRefreshCounts = debounce(() => {
  queryClient.invalidateQueries({ queryKey: interventionKeys.summaries() })
}, 500)
```

### 7. File d'Attente pour Synchronisation Différée

**Decision**: File FIFO limitée à 50 modifications, traitement par batch toutes les 5 secondes.

**Rationale**:
- Gestion gracieuse des erreurs réseau
- Limite mémoire (50 modifications max)
- Traitement par batch pour efficacité
- Sauvegarde localStorage pour persistance entre sessions
- Conforme aux exigences de la spec (FR-008)

**Alternatives considérées**:
- **Pas de file d'attente**: Rejeté car perte de modifications en cas d'erreur réseau
- **File illimitée**: Rejeté car risque de consommation mémoire excessive

**Implémentation**:
```typescript
class SyncQueue {
  private queue: Modification[] = []
  private maxSize = 50

  enqueue(modification: Modification) {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift() // FIFO : supprimer la plus ancienne
    }
    this.queue.push(modification)
    this.saveToLocalStorage()
  }

  async processBatch() {
    const batch = this.queue.splice(0, 10) // Traiter par batch de 10
    await Promise.all(batch.map(m => this.sync(m)))
  }
}
```

### 8. Indicateurs Visuels de Modification Distante

**Decision**: Badge overlay codé par couleur utilisateur, persiste jusqu'à synchronisation complète.

**Rationale**:
- Feedback visuel clair pour l'utilisateur
- Identification de l'auteur de la modification (couleur utilisateur)
- Persistance jusqu'à synchronisation complète pour transparence
- Conforme aux exigences de la spec (FR-011)

**Alternatives considérées**:
- **Toast uniquement**: Rejeté car pas assez visible pour les modifications importantes
- **Badge permanent**: Rejeté car encombrement UI

**Implémentation**:
```typescript
// Badge overlay avec couleur utilisateur
<Badge 
  className="absolute top-2 right-2"
  style={{ backgroundColor: getUserColor(remoteUserId) }}
>
  {remoteUserName} modifie...
</Badge>
```

## Références Techniques

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [TanStack Query Cache Updates](https://tanstack.com/query/latest/docs/react/guides/updates-from-mutation-responses)
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [WebSocket Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_client_applications)

## Conclusion

Toutes les décisions techniques sont documentées et justifiées. L'implémentation peut commencer avec ces choix architecturaux qui respectent la constitution du projet et les exigences de la spécification.

