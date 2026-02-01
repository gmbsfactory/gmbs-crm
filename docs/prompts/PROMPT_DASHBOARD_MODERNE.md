# 🎨 PROMPT: Dashboard Ultra-Moderne - Design Optimisé

## 🎯 Mission
Transformer le dashboard actuel en une interface **moderne, élégante et immersive** avec des effets visuels sophistiqués, des animations fluides et une UX premium.

---

## ✨ TRANSFORMATIONS VISUELLES MAJEURES

### 1. 🌟 **GLASSMORPHISM & DEPTH**

**Remplacer les cartes plates par des cartes glassmorphism:**

```tsx
// Au lieu de simples Cards, utiliser ce style:
<Card className="
  bg-background/40 
  backdrop-blur-xl 
  border border-white/10 
  shadow-2xl 
  hover:border-white/20 
  hover:shadow-primary/20 
  transition-all 
  duration-300
  hover:scale-[1.02]
  hover:-translate-y-1
">
```

**Ajouter des gradients sophistiqués:**
```css
/* Dans globals.css */
.card-gradient-1 {
  background: linear-gradient(
    135deg,
    rgba(59, 130, 246, 0.1) 0%,
    rgba(147, 51, 234, 0.1) 100%
  );
}

.card-gradient-2 {
  background: linear-gradient(
    135deg,
    rgba(16, 185, 129, 0.1) 0%,
    rgba(20, 184, 166, 0.1) 100%
  );
}

.card-gradient-3 {
  background: linear-gradient(
    135deg,
    rgba(245, 158, 11, 0.1) 0%,
    rgba(239, 68, 68, 0.1) 100%
  );
}

/* Effet de lueur animée */
.glow-effect {
  position: relative;
  overflow: hidden;
}

.glow-effect::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(
    circle,
    rgba(59, 130, 246, 0.3) 0%,
    transparent 70%
  );
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.5s ease;
}

.glow-effect:hover::before {
  opacity: 1;
}
```

---

### 2. 📊 **GRAPHIQUES ANIMÉS & INTERACTIFS**

**MesInterventionsWidget - Barres avec animations:**

```tsx
function StatRow({ label, count, color, total }: StatRowProps) {
  const [isVisible, setIsVisible] = useState(false);
  const percentage = (count / total) * 100;

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="space-y-2 group">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          {/* Icône animée */}
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-6"
            style={{ 
              background: `linear-gradient(135deg, ${color}40 0%, ${color}20 100%)`,
              boxShadow: `0 0 20px ${color}40`
            }}
          >
            <TrendingUp className="w-4 h-4" style={{ color }} />
          </div>
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{ color }}>
            {count}
          </span>
          <span className="text-xs text-muted-foreground">/ {total}</span>
        </div>
      </div>
      
      {/* Barre de progression avec animation */}
      <div className="relative h-3 bg-secondary/50 rounded-full overflow-hidden backdrop-blur-sm">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `repeating-linear-gradient(
            90deg,
            transparent,
            transparent 10px,
            ${color}20 10px,
            ${color}20 20px
          )`
        }} />
        
        {/* Progress bar animée */}
        <div
          className="h-full rounded-full relative overflow-hidden transition-all duration-1000 ease-out"
          style={{
            width: isVisible ? `${percentage}%` : '0%',
            background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)`,
            boxShadow: `0 0 20px ${color}80, inset 0 1px 0 rgba(255,255,255,0.2)`,
          }}
        >
          {/* Effet de brillance qui se déplace */}
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </div>
        
        {/* Glow effect */}
        <div
          className="absolute top-0 left-0 h-full rounded-full blur-md transition-all duration-1000 ease-out"
          style={{
            width: isVisible ? `${percentage}%` : '0%',
            background: color,
            opacity: 0.5,
          }}
        />
      </div>
    </div>
  );
}

// Ajouter dans tailwind.config.ts:
animation: {
  shimmer: 'shimmer 2s infinite',
}
keyframes: {
  shimmer: {
    '0%': { transform: 'translateX(-100%)' },
    '100%': { transform: 'translateX(100%)' },
  },
}
```

---

### 3. 🎯 **WIDGETS DE PERFORMANCE PREMIUM**

**MargeWidget - Donut Chart Moderne:**

```tsx
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export function MargeWidget({ percentage }: { percentage: number }) {
  const data = [
    { value: percentage, name: 'Marge' },
    { value: 100 - percentage, name: 'Reste' }
  ];

  return (
    <Card className="relative overflow-hidden group">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Particules flottantes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-primary/30 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.3}s`,
              animationDuration: `${3 + i}s`,
            }}
          />
        ))}
      </div>

      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">% Marge</CardTitle>
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10">
        <div className="relative">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <defs>
                <linearGradient id="margeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={1} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                animationBegin={0}
                animationDuration={1500}
                animationEasing="ease-out"
              >
                <Cell fill="url(#margeGradient)" filter="url(#glow)" />
                <Cell fill="rgba(255,255,255,0.05)" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Valeur centrale avec effet 3D */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center transform transition-transform duration-300 group-hover:scale-110">
              <div className="text-4xl font-bold bg-gradient-to-br from-blue-400 to-purple-600 bg-clip-text text-transparent">
                {percentage}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Target</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Ajouter l'animation float dans tailwind.config:
keyframes: {
  float: {
    '0%, 100%': { transform: 'translateY(0) translateX(0)' },
    '50%': { transform: 'translateY(-20px) translateX(10px)' },
  },
}
```

**ObjectifWidget - Gauge Semi-Circulaire:**

```tsx
export function ObjectifWidget({ current, target }: { current: number; target: number }) {
  const percentage = Math.round((current / target) * 100);
  const [displayPercentage, setDisplayPercentage] = useState(0);

  useEffect(() => {
    // Animation du compteur
    const duration = 2000;
    const steps = 60;
    const increment = percentage / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      setDisplayPercentage(Math.min(Math.round(increment * currentStep), percentage));
      
      if (currentStep >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [percentage]);

  const circumference = 2 * Math.PI * 60;
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  return (
    <Card className="relative overflow-hidden group">
      {/* Gradient background animé */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-amber-500/5 animate-gradient" />
      
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Target className="w-5 h-5 text-orange-500" />
          Objectif
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="relative flex items-center justify-center">
          {/* SVG Gauge */}
          <svg width="200" height="120" viewBox="0 0 200 120" className="overflow-visible">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#F59E0B" stopOpacity={1} />
                <stop offset="100%" stopColor="#EAB308" stopOpacity={1} />
              </linearGradient>
              <filter id="gaugeShadow">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
                <feOffset dx="0" dy="2" result="offsetblur" />
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.5" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Background track */}
            <path
              d="M 30,100 A 70,70 0 0,1 170,100"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="12"
              strokeLinecap="round"
            />
            
            {/* Glow effect */}
            <path
              d="M 30,100 A 70,70 0 0,1 170,100"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              filter="url(#gaugeShadow)"
              className="transition-all duration-1000 ease-out"
              style={{ opacity: 0.3, transform: 'scale(1.1)', transformOrigin: 'center' }}
            />
            
            {/* Main arc */}
            <path
              d="M 30,100 A 70,70 0 0,1 170,100"
              fill="none"
              stroke="url(#gaugeGradient)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
            
            {/* Indicator dot */}
            <circle
              cx={100 + 70 * Math.cos((Math.PI * (displayPercentage / 100) * 180) / 180 + Math.PI)}
              cy={100 - 70 * Math.sin((Math.PI * (displayPercentage / 100) * 180) / 180 + Math.PI)}
              r="6"
              fill="#F59E0B"
              className="drop-shadow-lg"
            >
              <animate
                attributeName="r"
                values="6;8;6"
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </svg>
          
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center translate-y-2">
            <div className="text-5xl font-bold bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent tabular-nums">
              {displayPercentage}%
            </div>
          </div>
        </div>
        
        {/* Values */}
        <div className="mt-4 text-center">
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="font-semibold text-foreground tabular-nums">
              {current.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}€
            </span>
            <span className="text-muted-foreground">/</span>
            <span className="text-muted-foreground tabular-nums">
              {target.toLocaleString('fr-FR')}€
            </span>
          </div>
          
          {/* Progress bar mini */}
          <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-1000"
              style={{ width: `${displayPercentage}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 4. 🚨 **ALERT WIDGETS IMMERSIFS**

```tsx
export function RelanceDossierWidget({ count }: { count: number }) {
  return (
    <Card className="relative overflow-hidden border-none group">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-red-500/10 to-rose-500/20 animate-gradient-xy" />
      
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: `
          linear-gradient(rgba(239, 68, 68, 0.3) 1px, transparent 1px),
          linear-gradient(90deg, rgba(239, 68, 68, 0.3) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
      }} />
      
      {/* Glow effect */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/30 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
      
      <CardContent className="pt-6 relative z-10">
        <div className="text-center">
          {/* Icon avec pulse effect */}
          <div className="relative inline-block mb-3">
            <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl animate-pulse" />
            <div className="relative w-14 h-14 mx-auto bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-300">
              <FileText className="w-7 h-7 text-white" />
            </div>
          </div>
          
          {/* Count avec animation */}
          <div className="text-5xl font-bold text-transparent bg-gradient-to-br from-orange-400 to-red-500 bg-clip-text mb-2 animate-pulse-slow">
            {count}
          </div>
          
          {/* Label */}
          <div className="text-sm font-medium text-muted-foreground">
            dossiers à compléter
          </div>
          
          {/* Action button on hover */}
          <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <Button size="sm" variant="outline" className="border-orange-500/50 hover:bg-orange-500/10">
              Voir les dossiers
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Ajouter les animations:
@keyframes gradient-xy {
  0%, 100% { background-position: 0% 0%; }
  25% { background-position: 100% 0%; }
  50% { background-position: 100% 100%; }
  75% { background-position: 0% 100%; }
}

.animate-gradient-xy {
  background-size: 200% 200%;
  animation: gradient-xy 15s ease infinite;
}

.animate-pulse-slow {
  animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

### 5. 🏆 **PODIUM WIDGET NEXT-LEVEL**

```tsx
export function PodiumWidget({ managers }: { managers: any[] }) {
  return (
    <Card className="relative overflow-hidden">
      {/* Sparkles background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-0.5 h-0.5 bg-yellow-400 rounded-full animate-sparkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500 animate-bounce-slow" />
          PODIUM
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {managers.slice(0, 3).map((manager, index) => {
          const colors = [
            { bg: 'from-yellow-500/20 to-amber-500/20', border: 'border-yellow-500/30', text: 'text-yellow-500' },
            { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', text: 'text-blue-500' },
            { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', text: 'text-purple-500' },
          ];
          const color = colors[index];

          return (
            <div
              key={manager.id}
              className={`
                relative p-4 rounded-xl border backdrop-blur-sm
                bg-gradient-to-br ${color.bg} ${color.border}
                transform transition-all duration-300
                hover:scale-105 hover:-translate-y-1
                group cursor-pointer
              `}
              style={{
                animationDelay: `${index * 0.1}s`,
              }}
            >
              {/* Shine effect on hover */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-full group-hover:translate-x-full" style={{ transition: 'transform 0.6s' }} />
              
              <div className="flex items-center gap-3 relative z-10">
                {/* Emoji badge */}
                <div className="text-3xl animate-bounce-slow" style={{ animationDelay: `${index * 0.2}s` }}>
                  {manager.emoji}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${color.text} text-lg`}>
                      {index + 1}.
                    </span>
                    <span className="font-bold text-foreground truncate">
                      {manager.firstname}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {manager.interventionsCount}
                    </span>
                    {' '}interventions
                  </div>
                </div>
                
                {/* Rank badge */}
                <Badge 
                  className={`
                    ${color.text} font-bold px-3 py-1
                    bg-gradient-to-br ${color.bg}
                    border ${color.border}
                    shadow-lg
                  `}
                >
                  {index === 0 ? '1er' : `${index + 1}ème`}
                </Badge>
              </div>
              
              {/* Progress indicator */}
              <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${color.bg.replace('/20', '')} rounded-full transition-all duration-1000`}
                  style={{ 
                    width: `${(manager.interventionsCount / managers[0].interventionsCount) * 100}%` 
                  }}
                />
              </div>
            </div>
          );
        })}
        
        <div className="my-4 border-t border-white/10" />
        
        {/* Autres managers */}
        <div className="space-y-1">
          {managers.slice(3).map((manager, index) => (
            <div
              key={manager.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-primary group-hover:scale-150 transition-transform" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{manager.firstname}</span>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {manager.interventionsCount}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Animations:
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
}

@keyframes bounce-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}
```

---

### 6. 📋 **STATISTICS TABLE MODERNE**

```tsx
export function StatisticsTable({ stats }: { stats: any }) {
  const [timeFilter, setTimeFilter] = useState('1s');

  return (
    <Card className="relative overflow-hidden">
      {/* Animated grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `
          linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />

      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Statistique
        </CardTitle>
        
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg backdrop-blur-sm">
          {['1s', '1m', '1a', 'Tout'].map((filter) => (
            <Button
              key={filter}
              size="sm"
              variant={timeFilter === filter ? 'default' : 'ghost'}
              onClick={() => setTimeFilter(filter)}
              className={cn(
                'min-w-[50px] transition-all duration-200',
                timeFilter === filter && 'shadow-lg shadow-primary/30'
              )}
            >
              {filter}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="font-semibold"></TableHead>
                {['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'].map((day) => (
                  <TableHead key={day} className="text-center font-semibold text-muted-foreground">
                    {day}
                  </TableHead>
                ))}
                <TableHead className="text-center font-bold text-primary">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { label: 'Devis envoyé', icon: FileText, color: '#3B82F6', values: [5, 5, 0, 0, 0] },
                { label: 'Inter en cours', icon: Loader2, color: '#F59E0B', values: [7, 2, 0, 0, 0] },
                { label: 'Inter Facturées', icon: CheckCircle2, color: '#10B981', values: [12, 0, 0, 0, 0] },
                { label: 'Nouveaux Artisans', icon: UserPlus, color: '#8B5CF6', values: [12, 0, 0, 0, 0] },
              ].map((row, rowIndex) => {
                const Icon = row.icon;
                const total = row.values.reduce((a, b) => a + b, 0);
                
                return (
                  <TableRow 
                    key={row.label}
                    className="border-white/5 hover:bg-white/5 transition-colors group"
                    style={{ animationDelay: `${rowIndex * 0.1}s` }}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                          style={{
                            background: `${row.color}20`,
                            boxShadow: `0 0 20px ${row.color}40`,
                          }}
                        >
                          <Icon className="w-4 h-4" style={{ color: row.color }} />
                        </div>
                        <span className="group-hover:translate-x-1 transition-transform">
                          {row.label}:
                        </span>
                      </div>
                    </TableCell>
                    
                    {row.values.map((value, idx) => (
                      <TableCell key={idx} className="text-center">
                        <div className="inline-flex items-center justify-center min-w-[2rem]">
                          {value > 0 ? (
                            <span
                              className="font-semibold tabular-nums px-2 py-1 rounded-md"
                              style={{
                                background: `${row.color}15`,
                                color: row.color,
                              }}
                            >
                              {value}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </div>
                      </TableCell>
                    ))}
                    
                    <TableCell className="text-center">
                      <div
                        className="inline-flex items-center justify-center font-bold text-lg px-3 py-1 rounded-lg tabular-nums"
                        style={{
                          background: `linear-gradient(135deg, ${row.color}30 0%, ${row.color}15 100%)`,
                          color: row.color,
                          boxShadow: `0 0 20px ${row.color}20`,
                        }}
                      >
                        {total}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### 7. 👤 **GESTIONNAIRE SELECTOR PREMIUM**

```tsx
export function GestionnaireSelector({ managers, selectedId, onSelect, currentUserId }: Props) {
  const selectedManager = managers.find((m) => m.id === selectedId);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="
            flex items-center gap-3 px-4 py-6 
            bg-background/40 backdrop-blur-xl
            border-white/10 hover:border-white/20
            shadow-xl hover:shadow-2xl hover:shadow-primary/20
            transition-all duration-300
            hover:scale-105
            group
          "
        >
          {/* Avatar avec glow */}
          <div
            className="relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6"
            style={{
              background: `linear-gradient(135deg, ${selectedManager?.color || '#3B82F6'} 0%, ${selectedManager?.color || '#3B82F6'}dd 100%)`,
              boxShadow: `0 0 30px ${selectedManager?.color || '#3B82F6'}60`,
            }}
          >
            {selectedManager?.firstname?.[0]}{selectedManager?.lastname?.[0]}
            
            {/* Ring animé */}
            <div
              className="absolute inset-0 rounded-full border-2 animate-ping"
              style={{ borderColor: selectedManager?.color || '#3B82F6' }}
            />
          </div>
          
          {/* Name */}
          <div className="flex flex-col items-start">
            <span className="text-xs text-muted-foreground">Gestionnaire</span>
            <span className="font-semibold">
              {selectedManager?.firstname} {selectedManager?.lastname}
            </span>
          </div>
          
          <ChevronDown className={cn(
            "h-4 w-4 transition-transform duration-300 ml-2",
            isOpen && "rotate-180"
          )} />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        align="end"
        className="w-80 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl p-2"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider px-3 pb-2">
          Choisir un gestionnaire
        </DropdownMenuLabel>
        
        <div className="max-h-[400px] overflow-y-auto space-y-1">
          {managers.map((manager) => (
            <DropdownMenuItem
              key={manager.id}
              onClick={() => {
                onSelect(manager.id);
                setIsOpen(false);
              }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
                selectedId === manager.id && "bg-primary/10 border border-primary/20"
              )}
            >
              {/* Avatar */}
              <div
                className="relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-md"
                style={{
                  background: `linear-gradient(135deg, ${manager.color || '#3B82F6'} 0%, ${manager.color || '#3B82F6'}dd 100%)`,
                }}
              >
                {manager.firstname?.[0]}{manager.lastname?.[0]}
                
                {/* Status indicator */}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-background rounded-full" />
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {manager.firstname} {manager.lastname}
                </div>
                <div className="text-xs text-muted-foreground">
                  {manager.id === currentUserId ? 'Vous' : 'Gestionnaire'}
                </div>
              </div>
              
              {/* Badge */}
              {manager.id === currentUserId && (
                <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                  Moi
                </Badge>
              )}
              
              {/* Selected indicator */}
              {selectedId === manager.id && (
                <Check className="w-5 h-5 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

### 8. 🎊 **WELCOME CARD AVEC EFFET WOW**

```tsx
<Card className="relative overflow-hidden border-none h-32">
  {/* Animated gradient background */}
  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 animate-gradient" />
  
  {/* Mesh grid overlay */}
  <div className="absolute inset-0 opacity-10" style={{
    backgroundImage: `
      radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)
    `,
    backgroundSize: '40px 40px',
  }} />
  
  {/* Floating particles */}
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {[...Array(10)].map((_, i) => (
      <div
        key={i}
        className="absolute w-2 h-2 bg-white/20 rounded-full animate-float-random"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${i * 0.5}s`,
          animationDuration: `${4 + Math.random() * 4}s`,
        }}
      />
    ))}
  </div>
  
  {/* Spotlight effect */}
  <div className="absolute top-0 -left-20 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse-slow" />
  <div className="absolute bottom-0 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
  
  <CardContent className="pt-6 relative z-10 flex items-center justify-center h-full">
    <div className="text-center">
      <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent flex items-center gap-3 justify-center">
        Bonjour {selectedManager?.firstname}
        <span className="inline-block animate-wave text-4xl">👋</span>
      </h2>
      <p className="text-sm text-white/60 mt-2">
        Ravi de vous revoir ! Voici vos statistiques du jour
      </p>
    </div>
  </CardContent>
</Card>

// Wave animation:
@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  10%, 30% { transform: rotate(14deg); }
  20% { transform: rotate(-8deg); }
  40%, 100% { transform: rotate(0deg); }
}
```

---

## 🎨 TAILWIND CONFIG COMPLET

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        'alert-danger': '#F97316',
        'alert-warning': '#F59E0B',
      },
      animation: {
        'gradient': 'gradient 8s ease infinite',
        'shimmer': 'shimmer 2s infinite',
        'float': 'float 3s ease-in-out infinite',
        'float-random': 'float-random 5s ease-in-out infinite',
        'sparkle': 'sparkle 2s ease-in-out infinite',
        'bounce-slow': 'bounce-slow 2s ease-in-out infinite',
        'wave': 'wave 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '50%': { transform: 'translateY(-20px) translateX(10px)' },
        },
        'float-random': {
          '0%, 100%': { 
            transform: 'translate(0, 0) rotate(0deg)',
            opacity: '0',
          },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { 
            transform: 'translate(30px, -100px) rotate(180deg)',
            opacity: '0',
          },
        },
        sparkle: {
          '0%, 100%': { opacity: '0', transform: 'scale(0)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wave: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '10%, 30%': { transform: 'rotate(14deg)' },
          '20%': { transform: 'rotate(-8deg)' },
          '40%, 100%': { transform: 'rotate(0deg)' },
        },
      },
      backgroundSize: {
        '200%': '200% 200%',
      },
    },
  },
}
```

---

## 🚀 PROMPT FINAL OPTIMISÉ

Voici le prompt à donner:

```
Transforme ce dashboard en interface ultra-moderne avec :

1. GLASSMORPHISM & DEPTH
- Cards avec backdrop-blur-xl, bg-background/40, border-white/10
- Hover effects: scale-[1.02], -translate-y-1, shadow-2xl avec shadow-primary/20
- Gradients animés sur les backgrounds

2. ANIMATIONS FLUIDES
- Barres de progression avec effet shimmer qui se déplace
- Compteurs animés qui s'incrémentent (useEffect avec setInterval)
- Icons qui tournent au hover (rotate-6)
- Pulse effects sur les indicateurs

3. GRAPHIQUES PREMIUM
- Donut chart (recharts) avec dégradés SVG et filtres glow
- Gauge semi-circulaire en SVG pur avec animations
- Barres avec glow effects et patterns en background

4. EFFECTS VISUELS
- Particules flottantes (float animation avec random positions)
- Grid patterns animés en background (opacity-[0.03])
- Spotlight effects avec blur-3xl et pulse
- Shine effect au hover (gradient qui traverse)

5. MICRO-INTERACTIONS
- Tous les éléments cliquables avec hover:scale-105
- Badges avec transition-transform duration-300
- Buttons qui révèlent actions au hover du parent
- Smooth transitions partout (transition-all duration-300)

6. TYPOGRAPHIE MODERNE
- Nombres en font-bold text-5xl avec gradients text-transparent bg-gradient-to-br bg-clip-text
- tabular-nums pour alignement des chiffres
- Hierarchie claire avec text-muted-foreground

7. COULEURS & THEMING
- Palette cohérente: primary, orange, amber, purple, emerald
- Chaque widget a sa propre identity color
- Opacity layers (20%, 10%, 5%) pour depth

8. PODIUM PREMIUM
- Top 3 avec backgrounds colorés différents et emojis animés (bounce-slow)
- Shine effect horizontal au hover
- Mini progress bars sous chaque entrée
- Sparkles background avec animation

9. TABLE MODERNE
- Icons colorés dans cellules avec glow
- Values dans badges colorés si > 0
- Total column highlighted avec gradient background
- Hover row avec bg-white/5

10. WELCOME CARD IMMERSIVE
- Gradient animé multi-couleurs
- Mesh grid overlay
- Floating particles
- Wave emoji animé
- Spotlight effects

Utilise:
- All Radix UI components (Card, Button, Badge, etc.)
- recharts pour graphs
- lucide-react pour icons
- Tailwind avec config étendu pour animations custom
- TypeScript strict
- Hooks pour animations (useState, useEffect)

Style:
- Dark theme (#0A0A0A background)
- Glassmorphism everywhere
- Smooth 60fps animations
- Responsive grid
- Professional & modern

Code production-ready avec proper typing et performance optimizations.
```

---

**Ce prompt va transformer ton dashboard en véritable œuvre d'art interactive** ✨🚀

