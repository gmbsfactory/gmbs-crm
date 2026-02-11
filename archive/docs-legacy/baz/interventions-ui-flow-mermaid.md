# Diagramme Mermaid - Interactions UI Page Interventions

## Diagramme complet des interactions UI

```mermaid
graph TB
    %% Page principale Interventions
    A[Page /interventions] --> B{Mode d'affichage}
    B -->|Cards| C[Interventions.tsx]
    B -->|Kanban| D[InterventionsKanban.tsx]
    
    %% Vue Cards
    C --> E[FiltersBar]
    C --> F[Liste des cartes]
    F --> G[InterventionCard]
    
    %% Vue Kanban
    D --> H[Filtres Kanban]
    D --> I[KanbanBoard]
    I --> J[KanbanCard]
    
    %% Actions principales
    G --> K[Actions rapides]
    K --> L[Email - Mail]
    K --> M[Appel - Phone]
    K --> N[Document - FilePlus]
    K --> O[Créer tâche]
    
    %% Navigation
    G --> P[Navigation]
    P --> Q[Page détail /interventions/[id]]
    P --> R[Page création /interventions/new]
    
    %% Page détail
    Q --> S[InterventionEditor]
    Q --> T[Upload documents]
    Q --> U[Affichage documents]
    
    %% Page création
    R --> V[InterventionForm]
    
    %% Formulaires
    S --> W[useInterventionForm hook]
    V --> W
    
    %% APIs et scripts
    W --> X[API /api/interventions]
    X --> Y[createIntervention]
    X --> Z[listInterventions]
    X --> AA[updateIntervention]
    
    %% Gestion des documents
    T --> BB[API /api/interventions/[id]/documents]
    BB --> CC[Upload file]
    BB --> DD[listInterventionDocuments]
    
    %% Recherche et filtres
    E --> EE[Filtres]
    EE --> FF[Recherche texte]
    EE --> GG[Filtre utilisateur]
    EE --> HH[Filtre statut]
    EE --> II[Filtre date]
    EE --> JJ[Tri]
    
    %% Actions sur les cartes
    G --> KK[Changement statut]
    G --> LL[Changement utilisateur]
    G --> MM[Édition inline]
    MM --> NN[Coûts SST]
    MM --> OO[Coûts matériaux]
    MM --> PP[Coûts intervention]
    
    %% Kanban spécifique
    J --> QQ[Drag & Drop]
    QQ --> RR[Changement statut via drag]
    J --> SS[Sélection multiple]
    SS --> TT[Checkbox/Radio]
    J --> UU[Actions dropdown]
    UU --> VV[Voir détails]
    UU --> WW[Modifier]
    UU --> XX[Supprimer]
    
    %% Navigation clavier
    C --> YY[Navigation clavier]
    YY --> ZZ[Flèches directionnelles]
    YY --> AAA[Espace pour expand]
    YY --> BBB[Échap pour reset]
    
    %% Animations et états
    G --> CCC[États visuels]
    CCC --> DDD[Hover effects]
    CCC --> EEE[Expanded state]
    CCC --> FFF[Keyboard focus]
    CCC --> GGG[Status colors]
    
    %% Recherche d'artisans
    V --> HHH[Recherche artisan]
    HHH --> III[API /api/interventions/artisans/search]
    III --> JJJ[Google Maps integration]
    III --> KKK[Base locale]
    
    %% Vérification doublons
    V --> LLL[Vérification doublons]
    LLL --> MMM[API /api/interventions/duplicates]
    
    %% Preview Invoice2go
    V --> NNN[Preview Invoice2go]
    NNN --> OOO[API /api/interventions/invoice]
    
    %% Gestion des statuts
    KK --> PPP[Status change]
    PPP --> QQQ[API /api/interventions/[id]/status]
    
    %% Styles et couleurs
    GGG --> RRR[Status configuration]
    RRR --> SSS[Pin/Unpin status]
    RRR --> TTT[Color picker]
    
    %% Hooks et état
    W --> UUU[useStatusGuard]
    UUU --> VVV[Validation statut]
    
    %% Données
    Z --> WWW[Supabase API]
    WWW --> XXX[Table interventions]
    WWW --> YYY[Table users]
    WWW --> ZZZ[Table artisans]
    WWW --> AAAA[Table documents]
    
    %% Scripts de données
    WWW --> BBBB[Scripts d'import]
    BBBB --> CCCC[import-google-sheets-complete.js]
    BBBB --> DDDD[create-auth-users.js]
    BBBB --> EEEE[restore-auth-users.js]
    
    %% Styles et classes CSS
    CCC --> FFFF[Tailwind classes]
    FFFF --> GGGG[hover:bg-muted/50]
    FFFF --> HHHH[transition-all duration-300]
    FFFF --> IIII[shadow-lg scale-[1.01]]
    
    %% Composants UI
    E --> JJJJ[Composants UI]
    JJJJ --> KKKK[Input]
    JJJJ --> LLLL[Select]
    JJJJ --> MMMM[Button]
    JJJJ --> NNNN[Card]
    JJJJ --> OOOO[Badge]
    JJJJ --> PPPP[DropdownMenu]
    JJJJ --> QQQQ[Popover]
    
    %% Gestion des erreurs
    W --> RRRR[Gestion erreurs]
    RRRR --> SSSS[serverError]
    RRRR --> TTTT[Validation errors]
    RRRR --> UUUU[Network errors]
    
    %% Performance et optimisation
    C --> VVVV[Optimisations]
    VVVV --> WWWW[React.useMemo]
    VVVV --> XXXX[React.useCallback]
    VVVV --> YYYY[Debounced search]
    VVVV --> ZZZZ[Virtual scrolling]
    
    %% Accessibilité
    YY --> AAAAA[Accessibilité]
    AAAAA --> BBBBB[ARIA labels]
    AAAAA --> CCCCC[Keyboard navigation]
    AAAAA --> DDDDD[Screen reader support]
    AAAAA --> EEEEE[Focus management]
    
    %% Responsive design
    C --> FFFFF[Responsive]
    FFFFF --> GGGGG[Mobile layout]
    FFFFF --> HHHHH[Tablet layout]
    FFFFF --> IIIII[Desktop layout]
    
    %% État global
    C --> JJJJJ[État global]
    JJJJJ --> KKKKK[interventions state]
    JJJJJ --> LLLLL[loading state]
    JJJJJ --> MMMMM[error state]
    JJJJJ --> NNNNN[filter state]
    
    %% Persistance
    NNNNN --> OOOOO[URL params]
    OOOOO --> PPPPP[searchParams]
    OOOOO --> QQQQQ[router.push]
    
    %% Animations avancées
    N --> RRRRR[Document animation]
    RRRRR --> SSSSS[AnimatedCard]
    RRRRR --> TTTTT[Portal rendering]
    RRRRR --> UUUUU[Position tracking]
    
    %% Intégrations externes
    L --> VVVVV[Intégrations]
    VVVVV --> WWWWW[Email client]
    VVVVV --> XXXXX[Phone system]
    VVVVV --> YYYYY[File storage]
    
    %% Analytics et tracking
    C --> ZZZZZ[Analytics]
    ZZZZZ --> AAAAAA[User interactions]
    ZZZZZ --> BBBBBB[Performance metrics]
    ZZZZZ --> CCCCCC[Error tracking]
    
    %% Thèmes et personnalisation
    GGG --> DDDDDD[Thèmes]
    DDDDDD --> EEEEEE[Dark mode]
    DDDDDD --> FFFFFF[Light mode]
    DDDDDD --> GGGGGG[Custom colors]
    
    %% Cache et synchronisation
    WWW --> HHHHHH[Cache]
    HHHHHH --> IIIIII[Local storage]
    HHHHHH --> JJJJJJ[Session storage]
    HHHHHH --> KKKKKK[Real-time sync]
    
    %% Sécurité
    X --> LLLLLL[Sécurité]
    LLLLLL --> MMMMMM[Authentication]
    LLLLLL --> NNNNNN[Authorization]
    LLLLLL --> OOOOOO[CSRF protection]
    LLLLLL --> PPPPPP[Input validation]
    
    %% Tests
    C --> QQQQQQ[Tests]
    QQQQQQ --> RRRRRR[Unit tests]
    QQQQQQ --> SSSSSS[Integration tests]
    QQQQQQ --> TTTTTT[E2E tests]
    QQQQQQ --> UUUUUU[Visual tests]
    
    %% Documentation
    C --> VVVVVV[Documentation]
    VVVVVV --> WWWWWW[Component docs]
    VVVVVV --> XXXXXX[API docs]
    VVVVVV --> YYYYYY[User guide]
    VVVVVV --> ZZZZZZ[Developer guide]
```

## Légende des interactions

### 🎯 **Actions principales**
- **Email** : Envoi d'email au client via intégration email
- **Appel** : Initiation d'appel téléphonique
- **Document** : Ajout/consultation de documents
- **Tâche** : Création de tâche liée à l'intervention

### 🔄 **Navigation**
- **Page détail** : Vue complète d'une intervention
- **Page création** : Formulaire de nouvelle intervention
- **Navigation clavier** : Contrôle complet au clavier

### 📊 **Gestion des données**
- **Filtres** : Recherche, tri, filtrage par statut/utilisateur/date
- **Statuts** : Changement de statut avec validation
- **Édition inline** : Modification directe des coûts

### 🎨 **Interface utilisateur**
- **Modes d'affichage** : Cartes ou Kanban
- **Animations** : Effets visuels et transitions
- **Responsive** : Adaptation mobile/tablet/desktop

### 🔧 **Intégrations techniques**
- **APIs** : Endpoints REST pour CRUD operations
- **Hooks** : Gestion d'état et validation
- **Scripts** : Import/export de données

### 🛡️ **Qualité et sécurité**
- **Validation** : Contrôles de saisie et business rules
- **Sécurité** : Authentification et autorisation
- **Tests** : Couverture complète des fonctionnalités

## Scripts associés

### 📁 **Scripts de données**
- `import-google-sheets-complete.js` : Import depuis Google Sheets
- `create-auth-users.js` : Création d'utilisateurs d'authentification
- `restore-auth-users.js` : Restauration d'utilisateurs

### 🔌 **APIs**
- `/api/interventions` : CRUD des interventions
- `/api/interventions/[id]/documents` : Gestion des documents
- `/api/interventions/artisans/search` : Recherche d'artisans
- `/api/interventions/duplicates` : Détection de doublons
- `/api/interventions/invoice` : Preview Invoice2go

### 🎣 **Hooks personnalisés**
- `useInterventionForm` : Gestion des formulaires
- `useStatusGuard` : Validation des statuts
- `useInterventions` : État global des interventions


