# 📐 Diagrammes d'Architecture - Synchronisation Google Sheets

## 1. Architecture globale

```mermaid
graph TB
    subgraph "Frontend - Next.js"
        UI[Interface CRM]
        Settings[Page Settings Google Sheets]
        Dashboard[Dashboard Monitoring]
    end
    
    subgraph "API Routes - Next.js"
        AuthAPI[/api/google-sheets/auth]
        ConfigAPI[/api/google-sheets/config]
        SyncAPI[/api/google-sheets/sync]
        SheetsAPI[/api/google-sheets/spreadsheets]
    end
    
    subgraph "Supabase Backend"
        subgraph "PostgreSQL Database"
            Users[(users)]
            Artisans[(artisans)]
            Interventions[(interventions)]
            GSConfigs[(google_sheets_configs)]
            SyncQueue[(sync_queue)]
            SyncLogs[(sync_logs)]
        end
        
        subgraph "Database Triggers"
            ArtisanTrigger[Artisan Change Trigger]
            InterventionTrigger[Intervention Change Trigger]
        end
        
        subgraph "Edge Functions"
            ExportFunc[sync-to-sheets]
            ImportFunc[sync-from-sheets]
            WebhookFunc[sheets-webhook]
        end
        
        subgraph "Cron Jobs"
            ImportCron[Import Cron Every 5min]
            QueueCron[Queue Worker Every 1min]
        end
    end
    
    subgraph "Google Services"
        OAuth[Google OAuth 2.0]
        SheetsAPI_Google[Google Sheets API v4]
        DriveAPI[Google Drive API]
    end
    
    UI --> Settings
    UI --> Dashboard
    Settings --> AuthAPI
    Settings --> ConfigAPI
    Settings --> SheetsAPI
    Dashboard --> SyncAPI
    
    AuthAPI --> OAuth
    ConfigAPI --> GSConfigs
    SheetsAPI --> DriveAPI
    SheetsAPI --> SheetsAPI_Google
    SyncAPI --> SyncLogs
    
    Artisans --> ArtisanTrigger
    Interventions --> InterventionTrigger
    
    ArtisanTrigger --> SyncQueue
    InterventionTrigger --> SyncQueue
    
    SyncQueue --> ExportFunc
    ImportCron --> ImportFunc
    QueueCron --> ExportFunc
    
    ExportFunc --> SheetsAPI_Google
    ImportFunc --> SheetsAPI_Google
    WebhookFunc --> SheetsAPI_Google
    
    ExportFunc --> SyncLogs
    ImportFunc --> SyncLogs
    
    ImportFunc --> Artisans
    ImportFunc --> Interventions
    
    OAuth --> GSConfigs
    
    style UI fill:#e1f5ff
    style Settings fill:#e1f5ff
    style Dashboard fill:#e1f5ff
    style ExportFunc fill:#fff4e6
    style ImportFunc fill:#fff4e6
    style GSConfigs fill:#f3e5f5
    style SyncQueue fill:#f3e5f5
    style SyncLogs fill:#f3e5f5
```

---

## 2. Flux de connexion OAuth

```mermaid
sequenceDiagram
    actor User
    participant CRM as CRM UI
    participant API as Next.js API
    participant Google as Google OAuth
    participant DB as Supabase DB
    
    User->>CRM: Clique "Connecter Google"
    CRM->>API: GET /api/google-sheets/auth/connect
    API->>Google: Redirect to OAuth consent
    Google->>User: Affiche écran de consentement
    User->>Google: Accepte et autorise
    Google->>API: Callback avec authorization code
    API->>Google: Échange code contre tokens
    Google->>API: access_token + refresh_token
    API->>DB: Stocke tokens chiffrés
    DB->>API: OK
    API->>CRM: Redirect /settings/google-sheets?success=true
    CRM->>User: Affiche "Connecté avec succès"
```

---

## 3. Flux de configuration initiale

```mermaid
sequenceDiagram
    actor User
    participant CRM as CRM Settings
    participant API as Next.js API
    participant Google as Google Sheets API
    participant DB as Supabase DB
    
    User->>CRM: Sélectionne "Choisir un spreadsheet"
    CRM->>API: GET /api/google-sheets/spreadsheets/list
    API->>DB: Récupère tokens
    DB->>API: tokens
    API->>Google: Liste spreadsheets (Drive API)
    Google->>API: Liste des spreadsheets
    API->>CRM: Retourne liste
    CRM->>User: Affiche liste
    
    User->>CRM: Sélectionne un spreadsheet
    CRM->>API: GET /api/google-sheets/spreadsheets/{id}/sheets
    API->>Google: Liste les feuilles
    Google->>API: Liste des feuilles
    API->>CRM: Retourne feuilles
    CRM->>User: Affiche feuilles
    
    User->>CRM: Sélectionne feuille "Artisans"
    CRM->>API: GET /api/google-sheets/spreadsheets/{id}/preview?sheet=Artisans
    API->>Google: Lit les headers + 10 premières lignes
    Google->>API: Données
    API->>API: Auto-détection du mapping
    API->>CRM: Headers + mapping suggéré
    CRM->>User: Affiche prévisualisation + mapping
    
    User->>CRM: Valide le mapping
    User->>CRM: Configure fréquence + stratégie
    User->>CRM: Active la synchronisation
    CRM->>API: POST /api/google-sheets/config
    API->>DB: Sauvegarde configuration
    DB->>API: OK
    API->>CRM: Configuration sauvegardée
    CRM->>User: "Synchronisation activée ✓"
```

---

## 4. Flux de synchronisation Export (CRM → Sheets)

```mermaid
sequenceDiagram
    actor User
    participant CRM as CRM UI
    participant DB as PostgreSQL
    participant Trigger as DB Trigger
    participant Queue as sync_queue
    participant Cron as Cron Job
    participant EdgeFn as Edge Function<br/>sync-to-sheets
    participant Google as Google Sheets API
    participant Logs as sync_logs
    
    User->>CRM: Modifie un artisan
    CRM->>DB: UPDATE artisans SET nom='...'
    DB->>Trigger: Déclenche artisan_sync_trigger
    Trigger->>Queue: INSERT INTO sync_queue
    Queue->>Queue: status='pending'
    
    Note over Cron: Toutes les 1 minute
    Cron->>EdgeFn: Invoke sync-to-sheets
    EdgeFn->>Queue: SELECT * WHERE status='pending'
    Queue->>EdgeFn: Liste des items
    
    loop Pour chaque config_id
        EdgeFn->>DB: Récupère google_sheets_config
        DB->>EdgeFn: config + tokens
        EdgeFn->>EdgeFn: Refresh token si nécessaire
        EdgeFn->>EdgeFn: Transform data (DB → Sheets format)
        EdgeFn->>Google: Lit le spreadsheet
        Google->>EdgeFn: Données existantes
        EdgeFn->>EdgeFn: Trouve la ligne correspondante
        EdgeFn->>Google: Update ou Append row
        Google->>EdgeFn: OK
        EdgeFn->>Queue: UPDATE status='completed'
        EdgeFn->>Logs: INSERT sync_log (success)
    end
    
    EdgeFn->>Cron: Retourne résultats
    
    Note over CRM,Google: Délai total: < 2 minutes
```

---

## 5. Flux de synchronisation Import (Sheets → CRM)

```mermaid
sequenceDiagram
    participant Cron as Cron Job<br/>(Toutes les 5 min)
    participant EdgeFn as Edge Function<br/>sync-from-sheets
    participant DB as Supabase DB
    participant Google as Google Sheets API
    participant Logs as sync_logs
    
    Note over Cron: Déclenchement automatique
    Cron->>EdgeFn: Invoke sync-from-sheets
    
    EdgeFn->>DB: SELECT google_sheets_configs<br/>WHERE sync_enabled=true
    DB->>EdgeFn: Liste des configs actives
    
    loop Pour chaque config
        EdgeFn->>DB: Récupère tokens
        DB->>EdgeFn: tokens
        EdgeFn->>EdgeFn: Refresh token si nécessaire
        
        Note over EdgeFn: Sync Artisans
        EdgeFn->>Google: Lit feuille Artisans (A:ZZ)
        Google->>EdgeFn: Toutes les lignes
        EdgeFn->>EdgeFn: Transform (Sheets → DB format)
        
        loop Pour chaque ligne
            EdgeFn->>DB: Cherche artisan existant<br/>(by email or numero)
            DB->>EdgeFn: Artisan existant ou null
            
            alt Artisan existant
                EdgeFn->>EdgeFn: Détecte conflit ?
                alt Conflit détecté
                    EdgeFn->>EdgeFn: Applique stratégie résolution
                    EdgeFn->>DB: UPDATE artisan
                    EdgeFn->>Logs: Log avec status='conflict'
                else Pas de conflit
                    EdgeFn->>DB: UPDATE artisan
                    EdgeFn->>Logs: Log avec status='success'
                end
            else Nouvel artisan
                EdgeFn->>DB: INSERT artisan
                EdgeFn->>Logs: Log avec status='success'
            end
        end
        
        Note over EdgeFn: Sync Interventions (similaire)
        
        EdgeFn->>DB: UPDATE last_sync_from_sheets
    end
    
    EdgeFn->>Cron: Retourne résultats
```

---

## 6. Gestion des conflits

```mermaid
flowchart TD
    Start[Changement détecté] --> Compare[Comparer CRM vs Sheets]
    Compare --> Conflict{Conflit<br/>détecté ?}
    
    Conflict -->|Non| NoConflict[Pas de conflit]
    NoConflict --> Apply[Appliquer le changement]
    Apply --> Log[Logger success]
    Log --> End[Fin]
    
    Conflict -->|Oui| Strategy{Quelle<br/>stratégie ?}
    
    Strategy -->|CRM Wins| CRMWins[Garder version CRM]
    Strategy -->|Sheets Wins| SheetsWins[Garder version Sheets]
    Strategy -->|Newest Wins| NewestWins[Comparer timestamps]
    
    CRMWins --> ApplyConflict[Appliquer résolution]
    SheetsWins --> ApplyConflict
    NewestWins --> Compare2{Sheets plus<br/>récent ?}
    
    Compare2 -->|Oui| UseSheets[Utiliser Sheets]
    Compare2 -->|Non| UseCRM[Utiliser CRM]
    
    UseSheets --> ApplyConflict
    UseCRM --> ApplyConflict
    
    ApplyConflict --> Update[Mettre à jour les 2 sources]
    Update --> LogConflict[Logger avec status='conflict']
    LogConflict --> Notify[Notifier l'utilisateur]
    Notify --> End
    
    style Conflict fill:#ffe6e6
    style Strategy fill:#fff4e6
    style ApplyConflict fill:#e6f7ff
    style LogConflict fill:#f9f0ff
```

---

## 7. Structure des données

```mermaid
erDiagram
    users ||--o{ google_sheets_configs : "configure"
    google_sheets_configs ||--o{ sync_queue : "queues"
    google_sheets_configs ||--o{ sync_logs : "logs"
    artisans ||--o{ sync_queue : "triggers"
    interventions ||--o{ sync_queue : "triggers"
    
    users {
        uuid id PK
        text username
        text email
        text code_gestionnaire
        timestamptz created_at
    }
    
    google_sheets_configs {
        uuid id PK
        uuid user_id FK
        text google_access_token
        text google_refresh_token
        timestamptz google_token_expires_at
        text spreadsheet_id
        text spreadsheet_name
        text artisans_sheet_name
        jsonb artisans_column_mapping
        text interventions_sheet_name
        jsonb interventions_column_mapping
        boolean sync_enabled
        text sync_direction
        integer sync_frequency_minutes
        text conflict_strategy
        timestamptz last_sync_from_sheets
        timestamptz last_sync_to_sheets
        timestamptz created_at
        timestamptz updated_at
    }
    
    sync_queue {
        uuid id PK
        uuid config_id FK
        text entity_type
        uuid entity_id
        text operation
        jsonb entity_data
        text status
        integer attempts
        integer max_attempts
        text error_message
        timestamptz scheduled_at
        timestamptz processed_at
        timestamptz created_at
    }
    
    sync_logs {
        uuid id PK
        uuid config_id FK
        text direction
        text entity_type
        uuid entity_id
        text status
        text error_message
        jsonb before_data
        jsonb after_data
        timestamptz created_at
    }
    
    artisans {
        uuid id PK
        text nom_prenom
        text email
        text telephone
        text numero_associe
        text siret
        uuid gestionnaire_id
        timestamptz created_at
        timestamptz updated_at
    }
    
    interventions {
        uuid id PK
        text id_inter
        date date
        text agence
        text adresse
        text statut
        uuid attribue_a
        uuid artisan_id
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## 8. Mapping des colonnes

```mermaid
flowchart LR
    subgraph "Google Sheets"
        GS1[Nom et Prénom]
        GS2[Email]
        GS3[Téléphone]
        GS4[N° SIRET]
        GS5[Gestionnaire]
    end
    
    subgraph "Algorithme de Mapping"
        AM[Auto-détection]
        AM --> Exact[Matching exact]
        AM --> Syn[Synonymes]
        AM --> Fuzzy[Fuzzy matching]
    end
    
    subgraph "Base de données CRM"
        DB1[nom_prenom]
        DB2[email]
        DB3[telephone]
        DB4[siret]
        DB5[gestionnaire_code]
    end
    
    GS1 --> AM
    GS2 --> AM
    GS3 --> AM
    GS4 --> AM
    GS5 --> AM
    
    AM --> DB1
    AM --> DB2
    AM --> DB3
    AM --> DB4
    AM --> DB5
    
    style AM fill:#fff4e6
    style Exact fill:#e6f7ff
    style Syn fill:#e6f7ff
    style Fuzzy fill:#e6f7ff
```

### Exemples de mapping

| Google Sheets | Algorithme | Base de données | Confiance |
|---------------|------------|-----------------|-----------|
| Nom et Prénom | Fuzzy | nom_prenom | 85% |
| Email | Exact | email | 100% |
| Tél. | Synonyme | telephone | 90% |
| N° SIRET | Fuzzy | siret | 85% |
| Gestionnaire | Synonyme | gestionnaire_code | 90% |

---

## 9. Timeline de synchronisation

```mermaid
gantt
    title Timeline typique d'une synchronisation
    dateFormat ss
    axisFormat %S sec
    
    section Changement CRM
    Utilisateur modifie un artisan :done, crm1, 00, 1s
    Sauvegarde en DB :done, crm2, 01, 1s
    Trigger capte changement :done, crm3, 02, 1s
    Ajout à la queue :done, crm4, 03, 1s
    
    section Attente
    En attente dans la queue :active, wait1, 04, 56s
    
    section Export vers Sheets
    Cron démarre worker :crit, export1, 60, 2s
    Lecture de la queue :export2, 62, 3s
    Transformation données :export3, 65, 5s
    Authentification Google :export4, 70, 3s
    Lecture Sheets existant :export5, 73, 5s
    Écriture dans Sheets :export6, 78, 10s
    Marquage completed :export7, 88, 2s
    
    section Total
    Délai total (CRM → Sheets) :milestone, 00, 90s
```

**Délai moyen** : 60-90 secondes (selon fréquence du cron)

---

## 10. Composants de l'interface utilisateur

```mermaid
graph TB
    subgraph "Page /settings/google-sheets"
        Main[Container Principal]
        
        subgraph "Section 1 : Connexion"
            S1[OAuth Connection Card]
            S1A[Connect Button]
            S1B[Disconnect Button]
            S1C[User Info Display]
        end
        
        subgraph "Section 2 : Configuration"
            S2[Spreadsheet Selection]
            S2A[Spreadsheet Picker]
            S2B[Sheet Selector Artisans]
            S2C[Sheet Selector Interventions]
            S2D[Preview Table]
        end
        
        subgraph "Section 3 : Mapping"
            S3[Column Mapping]
            S3A[Artisan Column Mapper]
            S3B[Intervention Column Mapper]
            S3C[Auto-detect Button]
            S3D[Reset Button]
        end
        
        subgraph "Section 4 : Paramètres"
            S4[Sync Settings]
            S4A[Direction Selector]
            S4B[Frequency Picker]
            S4C[Conflict Strategy]
            S4D[Enable/Disable Toggle]
        end
        
        subgraph "Section 5 : Monitoring"
            S5[Monitoring Dashboard]
            S5A[Status Card]
            S5B[History Table]
            S5C[Manual Sync Button]
            S5D[Error Alerts]
        end
    end
    
    Main --> S1
    Main --> S2
    Main --> S3
    Main --> S4
    Main --> S5
    
    S1 --> S1A
    S1 --> S1B
    S1 --> S1C
    
    S2 --> S2A
    S2 --> S2B
    S2 --> S2C
    S2 --> S2D
    
    S3 --> S3A
    S3 --> S3B
    S3 --> S3C
    S3 --> S3D
    
    S4 --> S4A
    S4 --> S4B
    S4 --> S4C
    S4 --> S4D
    
    S5 --> S5A
    S5 --> S5B
    S5 --> S5C
    S5 --> S5D
    
    style S1 fill:#e1f5ff
    style S2 fill:#e8f5e9
    style S3 fill:#fff3e0
    style S4 fill:#f3e5f5
    style S5 fill:#fce4ec
```

---

## 11. Schéma de sécurité

```mermaid
flowchart TD
    User[Utilisateur] --> OAuth[Google OAuth 2.0]
    OAuth --> Consent[Écran de consentement]
    Consent --> Tokens[Access + Refresh Tokens]
    
    Tokens --> Encrypt[Chiffrement pgcrypto]
    Encrypt --> DB[(Supabase DB)]
    
    DB --> RLS[Row Level Security]
    RLS --> Policy1[user_own_configs]
    RLS --> Policy2[user_own_logs]
    
    subgraph "Sécurité des appels API"
        API[API Routes]
        API --> Auth[Vérif auth user]
        Auth --> Validate[Validation Zod]
        Validate --> RateLimit[Rate Limiting]
        RateLimit --> Execute[Exécution]
    end
    
    User --> API
    
    subgraph "Edge Functions"
        EdgeFn[Edge Function]
        EdgeFn --> ServiceRole[Service Role Key]
        ServiceRole --> Decrypt[Déchiffrement tokens]
        Decrypt --> Refresh[Refresh si nécessaire]
        Refresh --> GoogleAPI[Google Sheets API]
    end
    
    DB --> EdgeFn
    
    style Encrypt fill:#ffebee
    style RLS fill:#ffebee
    style Auth fill:#ffebee
    style Validate fill:#ffebee
    style RateLimit fill:#ffebee
    style Decrypt fill:#ffebee
```

---

## 12. Monitoring et alertes

```mermaid
flowchart TD
    subgraph "Sources de données"
        SyncLogs[sync_logs table]
        Queue[sync_queue table]
        Configs[google_sheets_configs]
    end
    
    subgraph "Métriques"
        M1[Taux de succès]
        M2[Temps de sync moyen]
        M3[Nombre de conflits]
        M4[Taux d'erreur]
        M5[Items en queue]
    end
    
    SyncLogs --> M1
    SyncLogs --> M2
    SyncLogs --> M3
    SyncLogs --> M4
    Queue --> M5
    
    subgraph "Dashboard Monitoring"
        D1[Status Cards]
        D2[Charts temps réel]
        D3[Table historique]
        D4[Alertes visuelles]
    end
    
    M1 --> D1
    M2 --> D2
    M3 --> D2
    M4 --> D4
    M5 --> D1
    
    subgraph "Notifications"
        N1{Erreur<br/>détectée ?}
        N2[Email notification]
        N3[Toast UI]
        N4[Badge rouge]
    end
    
    D4 --> N1
    N1 -->|Oui| N2
    N1 -->|Oui| N3
    N1 -->|Oui| N4
    
    style M1 fill:#e8f5e9
    style M2 fill:#e8f5e9
    style M3 fill:#fff3e0
    style M4 fill:#ffebee
    style M5 fill:#e1f5ff
    style N1 fill:#ffebee
    style N2 fill:#ffebee
    style N3 fill:#ffebee
    style N4 fill:#ffebee
```

---

Ces diagrammes fournissent une vue complète et visuelle de l'architecture de synchronisation. Ils peuvent être utilisés pour :

1. **Présenter** la solution aux stakeholders
2. **Guider** l'implémentation technique
3. **Former** les nouveaux développeurs
4. **Documenter** le système pour la maintenance

Pour afficher ces diagrammes :
- Utilisez un éditeur Markdown compatible Mermaid (VS Code + extension, GitHub, GitLab)
- Ou copiez le code dans [Mermaid Live Editor](https://mermaid.live/)



