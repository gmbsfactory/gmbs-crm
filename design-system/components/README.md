# Composants UI - Guide d'usage

## Structure des composants

```
src/components/
├── ui/              # Composants shadcn/ui (primitives)
├── forms/           # Composants de formulaires métier
├── layout/          # Header, Sidebar, Page containers
└── features/        # Composants spécifiques aux features
```

---

## Composants de base (shadcn/ui)

### Button

```tsx
import { Button } from '@/components/ui/button'

// Variants
<Button variant="default">Action principale</Button>
<Button variant="secondary">Action secondaire</Button>
<Button variant="outline">Alternative</Button>
<Button variant="ghost">Subtile</Button>
<Button variant="destructive">Danger</Button>

// Avec icône
<Button>
  <Plus className="w-4 h-4 mr-2" />
  Ajouter
</Button>

// Icon-only
<Button variant="ghost" size="icon" aria-label="Supprimer">
  <Trash2 className="w-4 h-4" />
</Button>

// Loading
<Button disabled>
  <Loader2 className="w-4 h-4 animate-spin mr-2" />
  Chargement...
</Button>
```

### Card

```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'

<Card>
  <CardHeader>
    <CardTitle>Intervention #1234</CardTitle>
    <CardDescription>Client: Jean Dupont</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Contenu principal */}
  </CardContent>
  <CardFooter className="flex justify-between">
    <Button variant="outline">Annuler</Button>
    <Button>Valider</Button>
  </CardFooter>
</Card>
```

### Input & Form

```tsx
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

<div className="space-y-2">
  <Label htmlFor="email">
    Email <span className="text-destructive">*</span>
  </Label>
  <Input
    id="email"
    type="email"
    placeholder="exemple@email.com"
    autoComplete="email"
  />
  {error && (
    <p className="text-sm text-destructive">{error}</p>
  )}
</div>
```

### Select

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

<Select value={status} onValueChange={setStatus}>
  <SelectTrigger className="w-48">
    <SelectValue placeholder="Sélectionner un statut" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="demanded">Demandé</SelectItem>
    <SelectItem value="inprogress">En cours</SelectItem>
    <SelectItem value="done">Terminé</SelectItem>
  </SelectContent>
</Select>
```

### Table

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

<div className="overflow-x-auto rounded-lg border">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>ID</TableHead>
        <TableHead>Client</TableHead>
        <TableHead>Statut</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {interventions.map((item) => (
        <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
          <TableCell className="font-medium">{item.id}</TableCell>
          <TableCell>{item.client}</TableCell>
          <TableCell>
            <StatusBadge status={item.status} />
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### Dialog (Modal)

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Ouvrir</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Confirmer l'action</DialogTitle>
      <DialogDescription>
        Cette action ne peut pas être annulée.
      </DialogDescription>
    </DialogHeader>
    {/* Contenu */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Annuler
      </Button>
      <Button onClick={handleConfirm}>Confirmer</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Badge & Status

```tsx
import { Badge } from '@/components/ui/badge'

// Badge standard
<Badge variant="default">Nouveau</Badge>
<Badge variant="secondary">Brouillon</Badge>
<Badge variant="destructive">Urgent</Badge>
<Badge variant="outline">Info</Badge>

// Status chip (custom)
<span className="status-chip status-En_cours">En cours</span>
```

### Tooltip

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <Info className="w-4 h-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Information supplémentaire</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Patterns de composition

### Card avec actions

```tsx
<Card className="group hover:shadow-md transition-shadow cursor-pointer">
  <CardHeader className="flex flex-row items-center justify-between pb-2">
    <CardTitle className="text-base font-medium">
      {title}
    </CardTitle>
    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon">
        <MoreHorizontal className="w-4 h-4" />
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    {/* ... */}
  </CardContent>
</Card>
```

### Liste avec empty state

```tsx
{items.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
    <Inbox className="w-12 h-12 mb-4 opacity-50" />
    <p className="text-lg font-medium">Aucun élément</p>
    <p className="text-sm">Commencez par en créer un</p>
    <Button className="mt-4">
      <Plus className="w-4 h-4 mr-2" />
      Créer
    </Button>
  </div>
) : (
  <div className="grid gap-4">
    {items.map(item => <ItemCard key={item.id} {...item} />)}
  </div>
)}
```

### Skeleton loading

```tsx
import { Skeleton } from '@/components/ui/skeleton'

// Card skeleton
<Card>
  <CardHeader>
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-4 w-48" />
  </CardHeader>
  <CardContent className="space-y-2">
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </CardContent>
</Card>

// Table skeleton
<TableRow>
  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
  <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
</TableRow>
```

---

## Composants métier

### StatusBadge

```tsx
// src/components/ui/status-badge.tsx
interface StatusBadgeProps {
  status: InterventionStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusClass = `status-${status.replace(/ /g, '_')}`
  return (
    <span className={`status-chip ${statusClass}`}>
      {status}
    </span>
  )
}
```

### ArtisanRankBadge

```tsx
// src/components/ui/rank-badge.tsx
type Rank = 'gold' | 'silver' | 'bronze' | 'cold'

export function RankBadge({ rank }: { rank: Rank }) {
  return (
    <span
      className={`
        px-2 py-1 rounded-full text-xs font-medium
        bg-${rank}/15 text-${rank}
        shadow-[0_0_8px_hsl(var(--${rank}-glow)/0.3)]
      `}
    >
      {rank.charAt(0).toUpperCase() + rank.slice(1)}
    </span>
  )
}
```

### InterventionCard

```tsx
// src/components/features/intervention-card.tsx
export function InterventionCard({ intervention }: Props) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">#{intervention.id}</CardTitle>
          <StatusBadge status={intervention.status} />
        </div>
        <CardDescription>{intervention.client_name}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          {format(intervention.date, 'dd/MM/yyyy')}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
          <MapPin className="w-4 h-4" />
          {intervention.address}
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Bonnes pratiques

### Toujours faire

1. **`cursor-pointer`** sur les éléments cliquables
2. **`aria-label`** sur les boutons icon-only
3. **Transitions smooth** (150-300ms)
4. **Feedback visuel** sur hover/focus
5. **Labels** sur tous les inputs

### Ne jamais faire

1. Utiliser des emojis comme icônes
2. `scale` sur hover qui cause des layout shifts
3. Oublier les états loading/error/empty
4. Input sans label associé
5. Boutons sans indication de l'action
