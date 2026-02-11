# 🚀 Quick Reference : Statuts avec API V2

Guide de référence rapide pour implémenter les statuts correctement.

---

## 📥 1. API V2 - Ajout du JOIN automatique

```typescript
// src/lib/api/v2/interventionsApi.ts

export const interventionsApi = {
  async getAll(params?: InterventionQueryParams) {
    let query = supabase
      .from("interventions")
      .select(`
        *,
        status:intervention_statuses!statut_id (
          id, code, label, color, sort_order
        )
      `, { count: "exact" })
      .order("created_at", { ascending: false });

    // ... filtres et pagination ...
    
    const { data, error, count } = await query;
    if (error) throw error;
    
    return { data: data || [], pagination: { /* ... */ } };
  },

  async getAllStatuses() {
    const { data, error } = await supabase
      .from('intervention_statuses')
      .select('id, code, label, color, sort_order')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async updateStatus(id: string, statusId: string) {
    return this.update(id, { statut_id: statusId });
  },
};
```

---

## 🎣 2. Hook React pour les statuts

```typescript
// src/hooks/useInterventionStatuses.ts

import { useEffect, useState } from 'react'
import { interventionsApi } from '@/lib/api/v2'

export function useInterventionStatuses() {
  const [statuses, setStatuses] = useState([])
  const [statusesById, setStatusesById] = useState(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    interventionsApi.getAllStatuses()
      .then(data => {
        setStatuses(data)
        const byId = new Map(data.map(s => [s.id, s]))
        setStatusesById(byId)
      })
      .finally(() => setLoading(false))
  }, [])

  const getStatusById = (id) => statusesById.get(id)

  return { statuses, getStatusById, loading }
}
```

---

## 🖼️ 3. Usage dans une Page

```typescript
// app/interventions/page.tsx

import { interventionsApi } from '@/lib/api/v2'
import { useInterventionStatuses } from '@/hooks/useInterventionStatuses'

export default function Page() {
  const [interventions, setInterventions] = useState([])
  const { statuses, getStatusById } = useInterventionStatuses()

  // Charger les interventions
  useEffect(() => {
    interventionsApi.getAll().then(result => {
      setInterventions(result.data)
    })
  }, [])

  // Changer le statut
  const handleStatusChange = async (id, newStatusId) => {
    const updated = await interventionsApi.updateStatus(id, newStatusId)
    setInterventions(prev => 
      prev.map(int => int.id === id ? updated : int)
    )
  }

  return (
    <div>
      {interventions.map(intervention => (
        <div key={intervention.id}>
          {/* ✅ Le statut est déjà joint */}
          <Badge style={{ backgroundColor: intervention.status?.color }}>
            {intervention.status?.label || 'Sans statut'}
          </Badge>
          
          <StatusSelector
            currentStatusId={intervention.statut_id}
            statuses={statuses}
            onChange={(statusId) => handleStatusChange(intervention.id, statusId)}
          />
        </div>
      ))}
    </div>
  )
}
```

---

## 🎨 4. Composant StatusSelector

```typescript
// src/components/interventions/StatusSelector.tsx

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'

export function StatusSelector({ currentStatusId, statuses, onChange }) {
  const currentStatus = statuses.find(s => s.id === currentStatusId)

  return (
    <Select value={currentStatusId} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue>
          {currentStatus ? (
            <Badge style={{ backgroundColor: currentStatus.color }}>
              {currentStatus.label}
            </Badge>
          ) : (
            'Sélectionner un statut'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statuses.map(status => (
          <SelectItem key={status.id} value={status.id}>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: status.color }} 
              />
              {status.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

---

## 📊 5. Affichage dans TableView

```typescript
// src/components/interventions/views/TableView.tsx

export default function TableView({ interventions }) {
  return (
    <Table>
      <TableBody>
        {interventions.map(intervention => (
          <TableRow key={intervention.id}>
            <TableCell>
              {/* ✅ Utiliser le statut joint */}
              {intervention.status ? (
                <Badge style={{ backgroundColor: intervention.status.color }}>
                  {intervention.status.label}
                </Badge>
              ) : (
                <Badge variant="outline">Sans statut</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

---

## 🔧 6. Migrer transitionStatus (backend)

```typescript
// src/lib/api/interventions.ts

import { interventionsApi } from '@/lib/api/v2'

export async function transitionStatus(id: string, payload: StatusPayload) {
  assertBusinessRules(payload)
  
  // Convertir le code/label en UUID si nécessaire
  let statusId = payload.status
  
  if (!isUUID(statusId)) {
    const status = await interventionsApi.getStatusByCode(statusId) ||
                   await interventionsApi.getStatusByLabel(statusId)
    if (!status) throw new Error(`Statut "${statusId}" introuvable`)
    statusId = status.id
  }
  
  // ✅ Via l'API V2
  return await interventionsApi.updateStatus(id, statusId)
}

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}
```

---

## ✅ Checklist rapide

### Backend
- [ ] Ajouter JOIN dans `interventionsApi.getAll()`
- [ ] Ajouter `getAllStatuses()`, `getStatusByCode()`, `updateStatus()`
- [ ] Migrer `transitionStatus()` pour utiliser l'API V2

### Frontend
- [ ] Créer `useInterventionStatuses` hook
- [ ] Créer `StatusSelector` composant
- [ ] Migrer pages pour utiliser `interventionsApi.getAll()`
- [ ] Utiliser `intervention.status.label` au lieu de mapper manuellement

### Tests
- [ ] Tests unitaires pour les méthodes API
- [ ] Tests pour le hook
- [ ] Tests e2e pour les transitions

---

## 🎯 Résultat

**Avant** :
```json
{
  "id": "abc-123",
  "statut_id": "44a62df7-...",
  "date": "2024-01-01"
}
```

**Après** :
```json
{
  "id": "abc-123",
  "statut_id": "44a62df7-...",
  "status": {
    "id": "44a62df7-...",
    "code": "DEMANDE",
    "label": "Demandé",
    "color": "#3B82F6",
    "sort_order": 1
  },
  "date": "2024-01-01"
}
```

✅ Plus besoin de mapper manuellement !  
✅ Performance optimale (JOIN côté DB)  
✅ Conforme à l'architecture API V2 (AGENTS.md)

---

**Voir** : `CODEX_MIGRATION_STATUTS_V2.md` pour la documentation complète

