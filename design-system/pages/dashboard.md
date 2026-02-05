# Dashboard - Design Guidelines

> Surcharges spécifiques pour les pages Dashboard

## Layout

### Structure principale

```
┌─────────────────────────────────────────────────────────┐
│ Header (fixed)                                          │
├────────┬────────────────────────────────────────────────┤
│        │                                                │
│ Side-  │  KPI Cards (grid 4 cols)                       │
│ bar    │                                                │
│        ├────────────────────────────────────────────────┤
│ (240px)│                                                │
│        │  Charts / Graphs (grid 2 cols)                 │
│        │                                                │
│        ├────────────────────────────────────────────────┤
│        │                                                │
│        │  Recent Activity / Tables                      │
│        │                                                │
└────────┴────────────────────────────────────────────────┘
```

### Grid KPI Cards

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <KPICard title="Interventions" value={127} trend={+5.2} />
  <KPICard title="En cours" value={23} trend={-2.1} />
  <KPICard title="Terminées" value={89} trend={+12.3} />
  <KPICard title="Marge moyenne" value="35%" trend={+1.8} />
</div>
```

## Composants spécifiques

### KPI Card

```tsx
interface KPICardProps {
  title: string
  value: number | string
  trend?: number // pourcentage de variation
  icon?: LucideIcon
}

<Card className="p-4">
  <div className="flex items-center justify-between">
    <span className="text-sm text-muted-foreground">{title}</span>
    {icon && <Icon className="w-4 h-4 text-muted-foreground" />}
  </div>
  <div className="mt-2 flex items-baseline gap-2">
    <span className="text-2xl font-bold">{value}</span>
    {trend !== undefined && (
      <span className={cn(
        "text-xs font-medium",
        trend > 0 ? "text-success" : "text-destructive"
      )}>
        {trend > 0 ? '+' : ''}{trend}%
      </span>
    )}
  </div>
</Card>
```

### Mini Chart Card

```tsx
<Card className="p-4">
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-medium">Interventions par mois</h3>
    <Select defaultValue="6m">
      <SelectTrigger className="w-24 h-8">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="1m">1 mois</SelectItem>
        <SelectItem value="3m">3 mois</SelectItem>
        <SelectItem value="6m">6 mois</SelectItem>
        <SelectItem value="1y">1 an</SelectItem>
      </SelectContent>
    </Select>
  </div>
  <div className="h-48">
    <ResponsiveContainer>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
        />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
      </LineChart>
    </ResponsiveContainer>
  </div>
</Card>
```

### Activity Feed

```tsx
<Card>
  <CardHeader className="pb-2">
    <CardTitle className="text-base">Activité récente</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {activities.map((activity) => (
      <div key={activity.id} className="flex gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <activity.icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-medium">{activity.user}</span>
            {' '}{activity.action}{' '}
            <span className="font-medium">{activity.target}</span>
          </p>
          <p className="text-xs text-muted-foreground">{activity.time}</p>
        </div>
      </div>
    ))}
  </CardContent>
</Card>
```

## Charts Guidelines

### Couleurs

Utiliser les tokens `--chart-1` à `--chart-5` dans l'ordre:

```tsx
const COLORS = [
  'hsl(var(--chart-1))', // Violet
  'hsl(var(--chart-2))', // Vert
  'hsl(var(--chart-3))', // Orange
  'hsl(var(--chart-4))', // Bleu
  'hsl(var(--chart-5))', // Jaune
]
```

### Types recommandés

| Métrique | Chart |
|----------|-------|
| Évolution temporelle | Line Chart |
| Comparaison statuts | Bar Chart (horizontal) |
| Répartition | Donut Chart (max 5 segments) |
| Top artisans | Bar Chart (vertical) |

### Responsive

```tsx
// Toujours wrapper dans ResponsiveContainer
<div className="h-64 w-full">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>
      {/* ... */}
    </BarChart>
  </ResponsiveContainer>
</div>
```

## Surcharges Master

| Token | Master | Dashboard Override |
|-------|--------|-------------------|
| Card padding | `p-4` | `p-4` (identique) |
| Gap grilles | `gap-4` | `gap-4` (identique) |
| Titres cards | `text-lg` | `text-base` (plus compact) |

## Skeleton States

```tsx
// KPI Card skeleton
<Card className="p-4">
  <Skeleton className="h-4 w-24" />
  <Skeleton className="h-8 w-16 mt-2" />
</Card>

// Chart skeleton
<Card className="p-4">
  <div className="flex justify-between mb-4">
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-8 w-24" />
  </div>
  <Skeleton className="h-48 w-full" />
</Card>
```
