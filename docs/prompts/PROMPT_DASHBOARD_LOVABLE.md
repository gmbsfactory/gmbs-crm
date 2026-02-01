# 📋 Cahier des Charges - Dashboard Gestionnaire Multi-Vue

## 🎯 Objectif du Projet

Créer un **dashboard de gestion moderne et interactif** pour une plateforme CRM de coordination d'interventions et d'artisans, avec une **fonctionnalité clé de visualisation inter-gestionnaires** permettant de consulter les statistiques des collègues.

---

## 🏗️ Architecture Technique

### Stack Technologique
- **Framework**: React 18+ avec Next.js 14+ (App Router)
- **Styling**: Tailwind CSS 3.4+ avec design system personnalisé
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: React Context + hooks personnalisés
- **Base de données**: Supabase (PostgreSQL)
- **Authentification**: Supabase Auth
- **TypeScript**: Strictement typé

### Design System
- **Thème**: Dark mode avec fond `bg-[#0A0A0A]` (noir profond)
- **Couleurs primaires**: 
  - Blue: `#3B82F6` (interventions demandées)
  - Emerald: `#10B981` (acceptées/validées)
  - Yellow/Amber: `#F59E0B` (en cours/attention)
  - Purple: `#A855F7` (en cours)
  - Teal: `#14B8A6` (visites techniques)
  - Orange: `#F97316` (SAV/retards)
  - Red: `#EF4444` (refusées/annulées)

---

## 📊 Structure de la Base de Données

### Tables Principales

#### 1. **users** (Gestionnaires)
```typescript
interface User {
  id: string // UUID
  username: string // unique
  email: string // unique
  firstname: string | null
  lastname: string | null
  color: string | null // Couleur personnalisée pour l'avatar
  code_gestionnaire: string | null // Code court (ex: "A", "TH", "DIM")
  status: "connected" | "dnd" | "busy" | "offline"
  last_seen_at: timestamp
  created_at: timestamp
  updated_at: timestamp
}
```

#### 2. **interventions**
```typescript
interface Intervention {
  id: string
  id_inter: string // Numéro d'intervention
  statut_id: string // FK → intervention_statuses
  metier_id: string // FK → metiers
  artisan_id: string | null // FK → artisans
  assigned_user_id: string // FK → users (gestionnaire)
  client_id: string // FK → clients
  agence_id: string // FK → agencies
  date: timestamp // Date de création
  date_termine: timestamp | null
  date_prevue: timestamp | null
  due_date: timestamp | null
  adresse: string
  code_postal: string
  ville: string
  contexte_intervention: text
  consigne_intervention: text
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}
```

#### 3. **intervention_statuses** (Statuts d'intervention)
```typescript
interface InterventionStatus {
  id: string
  code: string // "DEMANDE", "ACCEPTE", "EN_COURS", etc.
  label: string // "Demandé", "Accepté", "En cours", etc.
  color: string // Hex color
  sort_order: number
  is_active: boolean
}

// Statuts disponibles:
const STATUTS = [
  { code: "DEMANDE", label: "Demandé", color: "#3B82F6" },
  { code: "DEVIS_ENVOYE", label: "Devis envoyé", color: "#8B5CF6" },
  { code: "VISITE_TECHNIQUE", label: "Visite technique", color: "#14B8A6" },
  { code: "ACCEPTE", label: "Accepté", color: "#10B981" },
  { code: "EN_COURS", label: "En cours", color: "#F59E0B" },
  { code: "TERMINE", label: "Terminé", color: "#10B981" },
  { code: "SAV", label: "SAV", color: "#F97316" },
  { code: "STAND_BY", label: "Stand-by", color: "#F59E0B" },
  { code: "REFUSE", label: "Refusé", color: "#EF4444" },
  { code: "ANNULE", label: "Annulé", color: "#64748B" },
]
```

#### 4. **artisans**
```typescript
interface Artisan {
  id: string
  prenom: string
  nom: string
  plain_nom: string // Nom normalisé pour recherche
  email: string
  telephone: string
  raison_sociale: string
  siret: string
  statut_id: string // FK → artisan_statuses
  gestionnaire_id: string // FK → users
  date_ajout: date
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}
```

#### 5. **artisan_statuses** (Niveaux d'artisan)
```typescript
interface ArtisanStatus {
  id: string
  code: string
  label: string
  color: string
  sort_order: number
  is_active: boolean
}

// Pour ce projet, créer ces catégories:
const ARTISAN_CATEGORIES = [
  { code: "EXPERT", label: "Expert", color: "#10B981", sort_order: 1 },
  { code: "CONFIRME", label: "Confirmé", color: "#3B82F6", sort_order: 2 },
  { code: "FORMATION", label: "Formation", color: "#F59E0B", sort_order: 3 },
  { code: "NOVICE", label: "Novice", color: "#8B5CF6", sort_order: 4 },
  { code: "POTENTIEL", label: "Potentiel", color: "#14B8A6", sort_order: 5 },
  { code: "INACTIF", label: "Inactif", color: "#EF4444", sort_order: 6 },
  { code: "ONE_SHOT", label: "One shot", color: "#64748B", sort_order: 7 },
]
```

---

## 🎨 Maquette du Dashboard

### Layout Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                         TOPBAR GLOBAL                           │
│ [Logo GMBS] [Search] [Bell Icon] [User Avatar]                 │
└─────────────────────────────────────────────────────────────────┘
┌─────────┬───────────────────────────────────────────────────────┐
│         │                                                       │
│  SIDE   │                MAIN DASHBOARD AREA                   │
│  BAR    │                                                       │
│         │                                                       │
│ [+Int]  │  ┌──────────────────────────────────────────────┐   │
│ [+Art]  │  │  📍 SELECTEUR DE GESTIONNAIRE (DROPDOWN)     │   │
│         │  │  [Thomas ▼] ← Active, shows stats for selected  │
│ Dash    │  └──────────────────────────────────────────────┘   │
│ Inter   │                                                       │
│ Artis   │  [Widgets Grid]                                      │
│ Users   │                                                       │
│         │  [Statistics Table]                                  │
│ ------  │                                                       │
│ [User]  │  [Podium]                                            │
│ Logout  │                                                       │
└─────────┴───────────────────────────────────────────────────────┘
```

---

## 🧩 Composants à Développer

### 1. 🎯 **COMPOSANT CLÉ: GestionnaireSelector**

**Emplacement**: En haut du contenu principal du dashboard

**Fonctionnalité**:
- Dropdown élégant permettant de sélectionner un gestionnaire
- Affiche l'avatar + nom du gestionnaire sélectionné
- Liste déroulante avec tous les gestionnaires actifs
- Option "Moi" pour revenir à ses propres stats
- Changement instantané des données affichées

**Design**:
```jsx
<div className="flex items-center gap-4 mb-6">
  <h1 className="text-3xl font-bold">Dashboard</h1>
  <span className="text-muted-foreground">-</span>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs">
          {selectedManager.firstname?.[0]}{selectedManager.lastname?.[0]}
        </div>
        <span>{selectedManager.firstname} {selectedManager.lastname}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-64">
      <DropdownMenuLabel>Choisir un gestionnaire</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {managers.map(manager => (
        <DropdownMenuItem 
          key={manager.id}
          onClick={() => setSelectedManager(manager)}
          className="flex items-center gap-2"
        >
          <div 
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
            style={{ backgroundColor: manager.color || '#3B82F6' }}
          >
            {manager.firstname?.[0]}{manager.lastname?.[0]}
          </div>
          <span>{manager.firstname} {manager.lastname}</span>
          {manager.id === currentUserId && (
            <Badge variant="outline" className="ml-auto text-xs">Moi</Badge>
          )}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

**Hook personnalisé**:
```typescript
// hooks/useManagerStats.ts
export function useManagerStats(managerId: string | null) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (!managerId) return
    
    async function fetchStats() {
      setLoading(true)
      // Fetch interventions by manager
      const { data: interventions } = await supabase
        .from('interventions')
        .select(`
          *,
          statut:intervention_statuses(code, label, color),
          artisan:artisans(id)
        `)
        .eq('assigned_user_id', managerId)
        .eq('is_active', true)
      
      // Compute statistics
      const stats = computeDashboardStats(interventions)
      setStats(stats)
      setLoading(false)
    }
    
    fetchStats()
  }, [managerId])
  
  return { stats, loading }
}
```

---

### 2. 📊 **Widgets de Statistiques**

#### A. **MesInterventionsWidget**
```jsx
<Card>
  <CardHeader>
    <CardTitle>Mes Interventions</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      <StatRow 
        label="Demandées" 
        count={14} 
        color="#3B82F6"
        total={50}
      />
      <StatRow 
        label="Accepté" 
        count={3} 
        color="#10B981"
        total={50}
      />
      <StatRow 
        label="En cours" 
        count={25} 
        color="#F59E0B"
        total={50}
      />
      <StatRow 
        label="Visite technique" 
        count={8} 
        color="#14B8A6"
        total={50}
      />
    </div>
  </CardContent>
</Card>

// Composant StatRow avec barre de progression
function StatRow({ label, count, color, total }) {
  const percentage = (count / total) * 100
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}:</span>
        <span className="font-semibold">{count}</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all"
          style={{ 
            width: `${percentage}%`,
            backgroundColor: color 
          }}
        />
      </div>
    </div>
  )
}
```

#### B. **MesArtisansWidget**
```jsx
<Card>
  <CardHeader>
    <CardTitle>Mes Artisans</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-3">
      <CategoryBadge label="Expert" count={1} color="#10B981" />
      <CategoryBadge label="Confirmé" count={3} color="#3B82F6" />
      <CategoryBadge label="Formation" count={5} color="#F59E0B" />
      <CategoryBadge label="Novice" count={12} color="#8B5CF6" />
      <CategoryBadge label="Potentiel" count={24} color="#14B8A6" />
      <CategoryBadge label="Inactif" count={5} color="#EF4444" />
      <CategoryBadge label="One shot" count={1} color="#64748B" />
    </div>
  </CardContent>
</Card>

function CategoryBadge({ label, count, color }) {
  return (
    <div className="flex items-center justify-between p-2 bg-secondary rounded-lg">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <Badge 
        variant="secondary"
        style={{ backgroundColor: color + '20', color: color }}
      >
        {count}
      </Badge>
    </div>
  )
}
```

#### C. **RelanceDossierWidget** (Alerte)
```jsx
<Card className="border-orange-500/50 bg-orange-500/5">
  <CardContent className="pt-6">
    <div className="text-center">
      <FileText className="h-8 w-8 text-orange-500 mx-auto mb-2" />
      <div className="text-3xl font-bold text-orange-500">12</div>
      <div className="text-sm text-muted-foreground mt-1">
        dossiers à compléter
      </div>
    </div>
  </CardContent>
</Card>
```

#### D. **RetardWidget** (Alerte)
```jsx
<Card className="border-amber-500/50 bg-amber-500/5">
  <CardContent className="pt-6">
    <div className="text-center">
      <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
      <div className="text-3xl font-bold text-amber-500">8</div>
      <div className="text-sm text-muted-foreground mt-1">
        interventions en retard
      </div>
    </div>
  </CardContent>
</Card>
```

#### E. **MargeWidget** (Graphique Donut)
```jsx
<Card>
  <CardHeader>
    <CardTitle>% Marge</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-center">
      <DonutChart 
        percentage={30} 
        color="#3B82F6"
        size={120}
      />
    </div>
  </CardContent>
</Card>

// Utiliser recharts ou une lib similaire
import { PieChart, Pie, Cell } from 'recharts'

function DonutChart({ percentage, color, size }) {
  const data = [
    { value: percentage },
    { value: 100 - percentage }
  ]
  
  return (
    <div className="relative">
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          cx={size/2}
          cy={size/2}
          innerRadius={size/3}
          outerRadius={size/2}
          startAngle={90}
          endAngle={-270}
          dataKey="value"
        >
          <Cell fill={color} />
          <Cell fill="#1a1a1a" />
        </Pie>
      </PieChart>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold">{percentage}%</span>
      </div>
    </div>
  )
}
```

#### F. **ObjectifWidget** (Gauge)
```jsx
<Card>
  <CardHeader>
    <CardTitle>Objectif</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <GaugeChart 
        current={3489.67} 
        target={4000}
        color="#10B981"
      />
      <div className="text-center text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">3 489,67€</span>
        {' / 4 000€'}
      </div>
    </div>
  </CardContent>
</Card>
```

---

### 3. 📈 **Tableau de Statistiques**

```jsx
<Card>
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle>Statistique</CardTitle>
    <div className="flex gap-2">
      <Button 
        size="sm" 
        variant={timeFilter === '1s' ? 'default' : 'outline'}
        onClick={() => setTimeFilter('1s')}
      >
        1s
      </Button>
      <Button 
        size="sm" 
        variant={timeFilter === '1m' ? 'default' : 'outline'}
        onClick={() => setTimeFilter('1m')}
      >
        1m
      </Button>
      <Button 
        size="sm" 
        variant={timeFilter === '1a' ? 'default' : 'outline'}
        onClick={() => setTimeFilter('1a')}
      >
        1a
      </Button>
      <Button 
        size="sm" 
        variant={timeFilter === 'all' ? 'default' : 'outline'}
        onClick={() => setTimeFilter('all')}
      >
        Tout
      </Button>
    </div>
  </CardHeader>
  <CardContent>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead></TableHead>
          <TableHead>LUNDI</TableHead>
          <TableHead>MARDI</TableHead>
          <TableHead>MERCREDI</TableHead>
          <TableHead>JEUDI</TableHead>
          <TableHead>VENDREDI</TableHead>
          <TableHead className="font-bold">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Devis envoyé:</TableCell>
          <TableCell>5</TableCell>
          <TableCell>5</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell className="font-bold">10</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Inter en cours:</TableCell>
          <TableCell>7</TableCell>
          <TableCell>2</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell className="font-bold">9</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Inter Facturées:</TableCell>
          <TableCell>12</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell className="font-bold">12</TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">Nouveaux Artisans:</TableCell>
          <TableCell>12</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell>0</TableCell>
          <TableCell className="font-bold">12</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </CardContent>
</Card>
```

**Logique de calcul**:
```typescript
function computeWeeklyStats(interventions: Intervention[], timeFilter: string) {
  // Filtrer par période
  const now = new Date()
  let startDate: Date
  
  switch(timeFilter) {
    case '1s': // 1 semaine
      startDate = subWeeks(now, 1)
      break
    case '1m': // 1 mois
      startDate = subMonths(now, 1)
      break
    case '1a': // 1 an
      startDate = subYears(now, 1)
      break
    default:
      startDate = new Date(0) // Tout
  }
  
  const filtered = interventions.filter(i => 
    new Date(i.created_at) >= startDate
  )
  
  // Grouper par jour de la semaine
  const byDay = {
    'LUNDI': [],
    'MARDI': [],
    'MERCREDI': [],
    'JEUDI': [],
    'VENDREDI': []
  }
  
  filtered.forEach(intervention => {
    const day = format(new Date(intervention.created_at), 'EEEE', { locale: fr }).toUpperCase()
    if (byDay[day]) {
      byDay[day].push(intervention)
    }
  })
  
  // Calculer les métriques
  return {
    devisEnvoyes: Object.keys(byDay).map(day => ({
      day,
      count: byDay[day].filter(i => i.statut.code === 'DEVIS_ENVOYE').length
    })),
    interEnCours: Object.keys(byDay).map(day => ({
      day,
      count: byDay[day].filter(i => i.statut.code === 'EN_COURS').length
    })),
    interFacturees: Object.keys(byDay).map(day => ({
      day,
      count: byDay[day].filter(i => i.statut.code === 'TERMINE').length
    })),
    // Pour les nouveaux artisans, requête séparée sur la table artisans
  }
}
```

---

### 4. 🏆 **Podium des Gestionnaires**

```jsx
<Card>
  <CardHeader>
    <CardTitle>PODIUM</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3">
      {/* Top 3 avec emojis */}
      <div className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
        <div className="text-2xl">🚀</div>
        <div className="flex-1">
          <div className="font-bold">1. Andrea</div>
          <div className="text-sm text-muted-foreground">142 interventions</div>
        </div>
        <Badge className="bg-yellow-500">1er</Badge>
      </div>
      
      <div className="flex items-center gap-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
        <div className="text-2xl">💪</div>
        <div className="flex-1">
          <div className="font-bold">2. Clement</div>
          <div className="text-sm text-muted-foreground">128 interventions</div>
        </div>
        <Badge className="bg-blue-500">2ème</Badge>
      </div>
      
      <div className="flex items-center gap-3 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
        <div className="text-2xl">✨</div>
        <div className="flex-1">
          <div className="font-bold">3. Dimitri</div>
          <div className="text-sm text-muted-foreground">115 interventions</div>
        </div>
        <Badge className="bg-purple-500">3ème</Badge>
      </div>
      
      <Separator />
      
      {/* Autres */}
      {otherManagers.map((manager, index) => (
        <div key={manager.id} className="flex items-center gap-3 px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <div className="flex-1">
            <div className="text-sm font-medium">{manager.firstname}</div>
            <div className="text-xs text-muted-foreground">
              {manager.interventionsCount} interventions
            </div>
          </div>
        </div>
      ))}
    </div>
  </CardContent>
</Card>
```

**Calcul du classement**:
```typescript
async function fetchManagersRanking() {
  // Récupérer tous les gestionnaires avec le compte de leurs interventions
  const { data: managers } = await supabase
    .from('users')
    .select(`
      id,
      firstname,
      lastname,
      color,
      interventions:interventions(count)
    `)
    .order('interventions(count)', { ascending: false })
  
  return managers.map((manager, index) => ({
    ...manager,
    rank: index + 1,
    interventionsCount: manager.interventions[0].count,
    emoji: index === 0 ? '🚀' : index === 1 ? '💪' : index === 2 ? '✨' : null
  }))
}
```

---

## 🎨 Layout Grid Complet

```jsx
// app/dashboard/page.tsx
export default function DashboardPage() {
  const { user } = useAuth()
  const [selectedManagerId, setSelectedManagerId] = useState(user.id)
  const { stats, loading } = useManagerStats(selectedManagerId)
  const { managers } = useManagers()
  
  return (
    <div className="p-6 space-y-6">
      {/* Header avec sélecteur */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Bienvenue sur le tableau de bord!
          </p>
        </div>
        <GestionnaireSelector 
          managers={managers}
          selectedId={selectedManagerId}
          onSelect={setSelectedManagerId}
          currentUserId={user.id}
        />
      </div>
      
      {/* Message de bienvenue */}
      <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">
              Bonjour {stats?.manager.firstname} 👋
            </span>
          </div>
        </CardContent>
      </Card>
      
      {/* Grid principal */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Colonne 1 */}
        <div className="lg:col-span-1 space-y-4">
          <MesInterventionsWidget stats={stats?.interventions} />
        </div>
        
        {/* Colonne 2 */}
        <div className="lg:col-span-1 space-y-4">
          <MesArtisansWidget stats={stats?.artisans} />
        </div>
        
        {/* Colonne 3 */}
        <div className="lg:col-span-1 space-y-4">
          <RelanceDossierWidget count={stats?.relances} />
          <RetardWidget count={stats?.retards} />
        </div>
        
        {/* Colonne 4 */}
        <div className="lg:col-span-1 space-y-4">
          <MargeWidget percentage={stats?.marge} />
          <ObjectifWidget 
            current={stats?.ca} 
            target={stats?.objectif} 
          />
        </div>
      </div>
      
      {/* Section statistiques + podium */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <StatisticsTable 
            stats={stats?.weekly}
            timeFilter={timeFilter}
            onFilterChange={setTimeFilter}
          />
        </div>
        
        <div className="lg:col-span-1">
          <PodiumWidget managers={managersRanking} />
        </div>
      </div>
    </div>
  )
}
```

---

## 🔐 Gestion des Permissions

### Règles d'Accès
1. **Tous les gestionnaires** peuvent voir leur propre dashboard
2. **Tous les gestionnaires** peuvent consulter les stats des autres gestionnaires (lecture seule)
3. Seuls les **admins** peuvent modifier les données des autres
4. Les données financières sensibles peuvent être masquées selon le rôle

### Middleware de vérification
```typescript
// middleware/dashboard-access.ts
export async function verifyDashboardAccess(
  requestingUserId: string,
  targetUserId: string
): Promise<{ allowed: boolean; message?: string }> {
  // Accès à son propre dashboard: toujours autorisé
  if (requestingUserId === targetUserId) {
    return { allowed: true }
  }
  
  // Vérifier que l'utilisateur cible existe et est actif
  const { data: targetUser } = await supabase
    .from('users')
    .select('id, status')
    .eq('id', targetUserId)
    .single()
  
  if (!targetUser || targetUser.status === 'offline') {
    return { 
      allowed: false, 
      message: 'Utilisateur non trouvé ou inactif' 
    }
  }
  
  // Tous les gestionnaires actifs peuvent voir les stats des autres
  return { allowed: true }
}
```

---

## 📱 Responsive Design

### Breakpoints
- **Mobile** (< 768px): Stack vertical, widgets pleine largeur
- **Tablet** (768px - 1024px): Grid 2 colonnes
- **Desktop** (> 1024px): Grid 4 colonnes comme dans le design

### Adaptations mobiles
```jsx
// Exemple de responsive pour le sélecteur
<div className="flex flex-col md:flex-row md:items-center gap-4">
  <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
  <GestionnaireSelector className="w-full md:w-auto" />
</div>

// Grid responsive
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Widgets */}
</div>
```

---

## 🚀 Optimisations Performance

### 1. **Mise en cache des statistiques**
```typescript
// Utiliser SWR ou React Query pour le cache
import useSWR from 'swr'

function useManagerStats(managerId: string) {
  const { data, error, isLoading } = useSWR(
    managerId ? `/api/stats/${managerId}` : null,
    fetcher,
    {
      refreshInterval: 30000, // Rafraîchir toutes les 30 secondes
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )
  
  return {
    stats: data,
    loading: isLoading,
    error
  }
}
```

### 2. **Virtualisation pour grandes listes**
```typescript
// Si le podium contient beaucoup de gestionnaires
import { useVirtualizer } from '@tanstack/react-virtual'

function PodiumList({ managers }) {
  const parentRef = useRef(null)
  
  const virtualizer = useVirtualizer({
    count: managers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
  })
  
  return (
    <div ref={parentRef} className="h-[400px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <ManagerRow 
            key={virtualRow.key}
            manager={managers[virtualRow.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

### 3. **Requêtes optimisées**
```typescript
// Utiliser des vues matérialisées pour les stats fréquentes
-- SQL: Créer une vue pour les stats managers
CREATE MATERIALIZED VIEW manager_stats AS
SELECT 
  u.id as manager_id,
  u.firstname,
  u.lastname,
  COUNT(DISTINCT i.id) as total_interventions,
  COUNT(DISTINCT CASE WHEN i.statut_id = 'DEMANDE' THEN i.id END) as demandees,
  COUNT(DISTINCT CASE WHEN i.statut_id = 'ACCEPTE' THEN i.id END) as acceptees,
  COUNT(DISTINCT CASE WHEN i.statut_id = 'EN_COURS' THEN i.id END) as en_cours,
  COUNT(DISTINCT a.id) as total_artisans
FROM users u
LEFT JOIN interventions i ON i.assigned_user_id = u.id AND i.is_active = true
LEFT JOIN artisans a ON a.gestionnaire_id = u.id AND a.is_active = true
GROUP BY u.id, u.firstname, u.lastname;

-- Rafraîchir toutes les 5 minutes (via cron job)
REFRESH MATERIALIZED VIEW CONCURRENTLY manager_stats;
```

---

## 🎯 Fonctionnalités Bonus (Nice to Have)

### 1. **Mode Comparaison**
Afficher côte à côte les stats de 2 gestionnaires
```jsx
<div className="flex gap-4">
  <Button onClick={() => setCompareMode(!compareMode)}>
    {compareMode ? 'Quitter comparaison' : 'Comparer avec...'}
  </Button>
</div>

{compareMode && (
  <div className="grid grid-cols-2 gap-4">
    <DashboardView managerId={selectedManagerId} />
    <DashboardView managerId={comparedManagerId} />
  </div>
)}
```

### 2. **Export des données**
```jsx
<Button onClick={exportToPDF}>
  <Download className="h-4 w-4 mr-2" />
  Exporter en PDF
</Button>
```

### 3. **Notifications temps réel**
```typescript
// WebSocket pour mise à jour live des stats
useEffect(() => {
  const channel = supabase
    .channel('dashboard_updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'interventions',
        filter: `assigned_user_id=eq.${selectedManagerId}`
      },
      (payload) => {
        // Rafraîchir les stats
        mutate(`/api/stats/${selectedManagerId}`)
      }
    )
    .subscribe()
  
  return () => {
    channel.unsubscribe()
  }
}, [selectedManagerId])
```

### 4. **Graphiques avancés**
```typescript
// Courbe d'évolution sur 30 jours
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts'

<Card>
  <CardHeader>
    <CardTitle>Évolution des interventions (30 jours)</CardTitle>
  </CardHeader>
  <CardContent>
    <LineChart width={600} height={300} data={evolutionData}>
      <XAxis dataKey="date" />
      <YAxis />
      <Tooltip />
      <Line 
        type="monotone" 
        dataKey="interventions" 
        stroke="#3B82F6" 
        strokeWidth={2}
      />
    </LineChart>
  </CardContent>
</Card>
```

---

## 📦 Installation et Dépendances

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@supabase/supabase-js": "^2.38.0",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "lucide-react": "^0.294.0",
    "tailwindcss": "^3.4.0",
    "recharts": "^2.10.0",
    "date-fns": "^2.30.0",
    "swr": "^2.2.4",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  }
}
```

---

## 🧪 Tests à Effectuer

### Tests Fonctionnels
- ✅ Changement de gestionnaire dans le dropdown
- ✅ Mise à jour instantanée des statistiques
- ✅ Filtres temporels du tableau (1s, 1m, 1a, Tout)
- ✅ Affichage correct des couleurs par statut
- ✅ Calcul exact des totaux
- ✅ Podium trié correctement
- ✅ Responsive sur mobile/tablet/desktop

### Tests de Performance
- ✅ Chargement < 2s pour un gestionnaire avec 1000+ interventions
- ✅ Changement de vue < 500ms
- ✅ Pas de flicker lors du changement de gestionnaire

### Tests de Sécurité
- ✅ Impossible de voir les stats d'un utilisateur inexistant
- ✅ Logs d'accès aux dashboards des collègues
- ✅ Validation des permissions côté serveur

---

## 🎨 Palette de Couleurs Complète

```css
/* Statuts Interventions */
--color-demande: #3B82F6;      /* Blue */
--color-accepte: #10B981;      /* Emerald */
--color-en-cours: #F59E0B;     /* Amber */
--color-termine: #10B981;      /* Emerald */
--color-visite: #14B8A6;       /* Teal */
--color-sav: #F97316;          /* Orange */
--color-refuse: #EF4444;       /* Red */
--color-annule: #64748B;       /* Slate */
--color-standby: #F59E0B;      /* Amber */

/* Catégories Artisans */
--color-expert: #10B981;       /* Emerald */
--color-confirme: #3B82F6;     /* Blue */
--color-formation: #F59E0B;    /* Amber */
--color-novice: #8B5CF6;       /* Purple */
--color-potentiel: #14B8A6;    /* Teal */
--color-inactif: #EF4444;      /* Red */
--color-oneshot: #64748B;      /* Slate */

/* UI */
--background: #0A0A0A;         /* Noir profond */
--foreground: #FAFAFA;         /* Blanc cassé */
--card: #1A1A1A;               /* Gris très foncé */
--card-foreground: #FAFAFA;
--muted: #262626;              /* Gris moyen */
--muted-foreground: #A3A3A3;   /* Gris clair */
```

---

## 📝 Notes d'Implémentation

### Priorité des Fonctionnalités

**Phase 1 - MVP (Essentiel)** ⭐⭐⭐
1. Layout de base avec sidebar + topbar
2. GestionnaireSelector (dropdown)
3. Widgets de base (Interventions, Artisans)
4. Fetch des données par gestionnaire
5. Design responsive basique

**Phase 2 - Complet** ⭐⭐
6. Alertes (Relance + Retard)
7. Performance financière (Marge + Objectif)
8. Tableau de statistiques avec filtres
9. Podium des gestionnaires
10. Optimisations performance

**Phase 3 - Avancé** ⭐
11. Mode comparaison
12. Export PDF
13. Notifications temps réel
14. Graphiques avancés
15. Analytics détaillées

---

## 🎬 Prompt Final pour Lovable

**Copier-coller ce prompt dans Lovable:**

```
Crée un dashboard moderne et interactif pour un CRM de gestion d'interventions avec les specs suivantes:

STACK:
- Next.js 14 App Router + React 18 + TypeScript
- Tailwind CSS (dark mode, fond #0A0A0A)
- shadcn/ui components (Radix UI)
- Supabase (auth + database)
- Recharts pour les graphiques

FONCTIONNALITÉ CLÉ:
Dropdown en haut du dashboard permettant de sélectionner n'importe quel gestionnaire et voir SES statistiques en temps réel. Le dropdown doit être élégant avec avatars colorés et badge "Moi" pour l'utilisateur connecté.

WIDGETS À CRÉER:
1. MesInterventionsWidget: 4 statuts (Demandées, Accepté, En cours, Visite technique) avec barres de progression horizontales colorées
2. MesArtisansWidget: 7 catégories (Expert, Confirmé, Formation, Novice, Potentiel, Inactif, One shot) en grid 2 colonnes avec badges colorés
3. RelanceDossierWidget: Carte orange avec icône document et nombre de dossiers à compléter
4. RetardWidget: Carte amber avec icône alert et nombre d'interventions en retard
5. MargeWidget: Graphique donut (recharts) affichant un pourcentage
6. ObjectifWidget: Gauge chart (recharts) avec montant actuel vs objectif
7. StatisticsTable: Tableau avec 5 jours de la semaine + total, 4 métriques (devis envoyés, inter en cours, inter facturées, nouveaux artisans), filtres 1s/1m/1a/Tout
8. PodiumWidget: Classement des gestionnaires, top 3 avec emojis (🚀💪✨) et backgrounds colorés, autres avec bullet points

STRUCTURE BASE DE DONNÉES:
- users (id, firstname, lastname, color, code_gestionnaire)
- interventions (id, statut_id, assigned_user_id, date)
- intervention_statuses (code, label, color: DEMANDE/ACCEPTE/EN_COURS/VISITE_TECHNIQUE/TERMINE/SAV/REFUSE/ANNULE/STAND_BY)
- artisans (id, statut_id, gestionnaire_id)
- artisan_statuses (code, label: EXPERT/CONFIRME/FORMATION/NOVICE/POTENTIEL/INACTIF/ONE_SHOT)

LAYOUT:
- Header: Titre "Dashboard" + GestionnaireSelector dropdown + sous-titre "Bienvenue!"
- Carte accueil: "Bonjour {prenom} 👋" avec gradient blue/purple
- Grid 4 colonnes (responsive): col1=Interventions, col2=Artisans, col3=Alertes, col4=Finance
- Section bas: Grid 2/3 (Tableau stats) + 1/3 (Podium)

COULEURS:
- Demandées: #3B82F6 (blue)
- Accepté: #10B981 (emerald)
- En cours: #F59E0B (amber)
- Visite technique: #14B8A6 (teal)
- SAV/Retard: #F97316 (orange)
- Refusé: #EF4444 (red)

COMPORTEMENT:
- Au changement de gestionnaire dans le dropdown, recharger toutes les stats via un hook useManagerStats(managerId)
- Calculer les stats en temps réel depuis Supabase
- Podium trié par nombre d'interventions décroissant
- Tableau stats: filter par période (1s=1 semaine, 1m=1 mois, 1a=1 an, Tout=historique)
- Animations fluides lors des changements

DESIGN:
- Cards avec bordures subtiles, arrière-plans très foncés
- Typographie: titres bold, métriques en large size
- Spacing généreux, hiérarchie visuelle claire
- Badges avec opacity 20% sur backgrounds de couleur
- Hover states sur tous les éléments interactifs

Génère le code complet avec:
1. Page app/dashboard/page.tsx
2. Component components/dashboard/GestionnaireSelector.tsx
3. Tous les widgets dans components/dashboard/widgets/
4. Hook hooks/useManagerStats.ts
5. Types types/dashboard.ts
6. Queries Supabase dans lib/dashboard-queries.ts

Assure-toi que tout est parfaitement typé TypeScript et suit les best practices Next.js 14.
```

---

## ✅ Checklist de Validation

Avant de livrer le dashboard, vérifier:

- [ ] Le dropdown gestionnaire fonctionne et change les stats
- [ ] Toutes les couleurs correspondent à la palette
- [ ] Les widgets affichent des données réelles (pas de mock)
- [ ] Le tableau de stats se filtre correctement
- [ ] Le podium est trié par performance
- [ ] Le design est fidèle à la maquette fournie
- [ ] Responsive sur mobile/tablet/desktop
- [ ] Pas d'erreurs TypeScript
- [ ] Chargement rapide (< 2s)
- [ ] Code propre et bien organisé

---

**Fin du cahier des charges** 🎉

Ce document contient toutes les spécifications nécessaires pour reproduire le dashboard souhaité par le client avec la fonctionnalité critique de visualisation inter-gestionnaires.

