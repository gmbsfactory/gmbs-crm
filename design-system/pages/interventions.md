# Interventions - Design Guidelines

> Surcharges spécifiques pour les pages de gestion des interventions

## Layout

### Vue Liste (par défaut)

```
┌─────────────────────────────────────────────────────────┐
│ Header                                                  │
├────────┬────────────────────────────────────────────────┤
│        │ ┌─────────────────────────────────────────────┐│
│ Sidebar│ │ Filters bar (search, status, date range)   ││
│        │ └─────────────────────────────────────────────┘│
│        │ ┌─────────────────────────────────────────────┐│
│        │ │                                             ││
│        │ │          Table / Cards Grid                 ││
│        │ │                                             ││
│        │ └─────────────────────────────────────────────┘│
│        │ ┌─────────────────────────────────────────────┐│
│        │ │ Pagination                                  ││
│        │ └─────────────────────────────────────────────┘│
└────────┴────────────────────────────────────────────────┘
```

### Vue Kanban

```
┌─────────────────────────────────────────────────────────┐
│ Filters                                                 │
├─────────┬─────────┬─────────┬─────────┬─────────┬──────┤
│ Demandé │ Devis   │ Accepté │ En cours│ Terminé │ ...  │
│         │ Envoyé  │         │         │         │      │
│ ┌─────┐ │ ┌─────┐ │ ┌─────┐ │ ┌─────┐ │ ┌─────┐ │      │
│ │Card │ │ │Card │ │ │Card │ │ │Card │ │ │Card │ │      │
│ └─────┘ │ └─────┘ │ └─────┘ │ └─────┘ │ └─────┘ │      │
│ ┌─────┐ │         │ ┌─────┐ │ ┌─────┐ │         │      │
│ │Card │ │         │ │Card │ │ │Card │ │         │      │
│ └─────┘ │         │ └─────┘ │ └─────┘ │         │      │
└─────────┴─────────┴─────────┴─────────┴─────────┴──────┘
```

## Composants

### Filters Bar

```tsx
<div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-lg border">
  {/* Search */}
  <div className="relative flex-1 min-w-[200px]">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
    <Input
      placeholder="Rechercher..."
      className="pl-9"
    />
  </div>

  {/* Status filter */}
  <Select>
    <SelectTrigger className="w-40">
      <SelectValue placeholder="Statut" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">Tous</SelectItem>
      <SelectItem value="demanded">Demandé</SelectItem>
      <SelectItem value="inprogress">En cours</SelectItem>
      <SelectItem value="done">Terminé</SelectItem>
    </SelectContent>
  </Select>

  {/* Date range */}
  <DateRangePicker className="w-56" />

  {/* View toggle */}
  <div className="flex rounded-md border">
    <Button
      variant={view === 'table' ? 'secondary' : 'ghost'}
      size="sm"
      className="rounded-r-none"
    >
      <List className="w-4 h-4" />
    </Button>
    <Button
      variant={view === 'kanban' ? 'secondary' : 'ghost'}
      size="sm"
      className="rounded-l-none"
    >
      <Kanban className="w-4 h-4" />
    </Button>
  </div>

  {/* Create button */}
  <Button>
    <Plus className="w-4 h-4 mr-2" />
    Nouvelle intervention
  </Button>
</div>
```

### Table Row

```tsx
<TableRow className="cursor-pointer hover:bg-muted/50">
  <TableCell className="font-mono text-sm">#{intervention.id}</TableCell>
  <TableCell>
    <div>
      <p className="font-medium">{intervention.client_name}</p>
      <p className="text-xs text-muted-foreground">{intervention.address}</p>
    </div>
  </TableCell>
  <TableCell>
    <StatusBadge status={intervention.status} />
  </TableCell>
  <TableCell>
    <div className="flex items-center gap-2">
      <Avatar className="w-6 h-6">
        <AvatarImage src={intervention.artisan.avatar} />
        <AvatarFallback>{intervention.artisan.initials}</AvatarFallback>
      </Avatar>
      <span className="text-sm">{intervention.artisan.name}</span>
    </div>
  </TableCell>
  <TableCell className="text-sm text-muted-foreground">
    {format(intervention.date, 'dd/MM/yyyy')}
  </TableCell>
  <TableCell className="text-right font-medium">
    {formatCurrency(intervention.amount)}
  </TableCell>
  <TableCell>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Eye className="w-4 h-4 mr-2" />
          Voir détails
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Edit className="w-4 h-4 mr-2" />
          Modifier
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </TableCell>
</TableRow>
```

### Kanban Card

```tsx
<Card className="p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
  <div className="flex items-start justify-between mb-2">
    <span className="font-mono text-xs text-muted-foreground">#{id}</span>
    <StatusBadge status={status} />
  </div>

  <h4 className="font-medium text-sm mb-1 line-clamp-1">{title}</h4>
  <p className="text-xs text-muted-foreground line-clamp-1">{client_name}</p>

  <div className="flex items-center justify-between mt-3 pt-2 border-t">
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Calendar className="w-3 h-3" />
      {format(date, 'dd/MM')}
    </div>
    <Avatar className="w-5 h-5">
      <AvatarImage src={artisan.avatar} />
      <AvatarFallback className="text-[10px]">{artisan.initials}</AvatarFallback>
    </Avatar>
  </div>
</Card>
```

### Kanban Column Header

```tsx
<div className="flex items-center justify-between p-2 bg-muted rounded-t-lg">
  <div className="flex items-center gap-2">
    <StatusBadge status={status} />
    <span className="text-sm font-medium">{count}</span>
  </div>
  <Button variant="ghost" size="icon" className="w-6 h-6">
    <Plus className="w-3 h-3" />
  </Button>
</div>
```

## Detail Panel / Modal

### Structure

```tsx
<Sheet>
  <SheetContent className="w-[500px] sm:max-w-[500px]">
    <SheetHeader>
      <div className="flex items-center gap-3">
        <SheetTitle>Intervention #{id}</SheetTitle>
        <StatusBadge status={status} />
      </div>
      <SheetDescription>
        Créée le {format(created_at, 'dd MMMM yyyy')}
      </SheetDescription>
    </SheetHeader>

    <Tabs defaultValue="details" className="mt-6">
      <TabsList className="w-full">
        <TabsTrigger value="details" className="flex-1">Détails</TabsTrigger>
        <TabsTrigger value="costs" className="flex-1">Coûts</TabsTrigger>
        <TabsTrigger value="history" className="flex-1">Historique</TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="space-y-4 mt-4">
        {/* Client info */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Client</Label>
          <p className="font-medium">{client_name}</p>
          <p className="text-sm text-muted-foreground">{address}</p>
        </div>

        {/* Artisan */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Artisan assigné</Label>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={artisan.avatar} />
              <AvatarFallback>{artisan.initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{artisan.name}</p>
              <p className="text-xs text-muted-foreground">{artisan.specialty}</p>
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="costs">
        {/* Costs breakdown */}
      </TabsContent>

      <TabsContent value="history">
        {/* Status history timeline */}
      </TabsContent>
    </Tabs>

    <SheetFooter className="mt-6">
      <Button variant="outline">Annuler</Button>
      <Button>Enregistrer</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

## Status Colors Reference

| Status | Background | Text | Usage |
|--------|------------|------|-------|
| Demandé | `hsl(210 40% 98%)` | `hsl(215 16% 35%)` | Nouvelle demande |
| Devis Envoyé | `hsl(210 40% 96%)` | `hsl(221 39% 28%)` | En attente client |
| Accepté | `hsl(142 76% 97%)` | `hsl(142 50% 32%)` | Validé |
| En cours | `hsl(48 96% 96%)` | `hsl(32 95% 44%)` | Travaux en cours |
| Visite Technique | `hsl(199 89% 96%)` | `hsl(199 84% 35%)` | Diagnostic |
| Terminé | `hsl(151 81% 95%)` | `hsl(160 84% 24%)` | Clôturé |
| Annulé | `hsl(0 93% 95%)` | `hsl(0 72% 45%)` | Annulé |
| Refusé | `hsl(343 76% 96%)` | `hsl(343 72% 40%)` | Refusé par client |
| Stand By | `hsl(28 100% 96%)` | `hsl(28 85% 45%)` | En pause |
| SAV | `hsl(252 95% 96%)` | `hsl(252 83% 45%)` | Service après-vente |

## Responsive Behavior

### Mobile (< 768px)

- Table se transforme en liste de cards
- Filters collapse en sheet/drawer
- Kanban devient horizontal scrollable

### Tablet (768px - 1024px)

- Table avec colonnes réduites
- Kanban avec 3-4 colonnes visibles

### Desktop (> 1024px)

- Table complète
- Kanban avec toutes les colonnes
- Detail panel en sheet à droite

## Surcharges Master

| Élément | Master | Interventions Override |
|---------|--------|----------------------|
| Table density | Standard | `text-sm`, `py-2` (compact) |
| Card width | Auto | `min-w-[280px]` (kanban) |
| Status display | Badge | Badge avec `status-chip` |
