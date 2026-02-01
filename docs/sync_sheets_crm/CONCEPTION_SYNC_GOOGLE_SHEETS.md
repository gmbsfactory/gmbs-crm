# 🔄 Conception : Synchronisation Bidirectionnelle CRM ↔ Google Sheets

**Date** : 30 octobre 2025  
**Version** : 1.0  
**Statut** : Document de conception

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture globale](#architecture-globale)
3. [Composants techniques](#composants-techniques)
4. [Flux de données](#flux-de-données)
5. [Implémentation détaillée](#implémentation-détaillée)
6. [Gestion des conflits](#gestion-des-conflits)
7. [Sécurité](#sécurité)
8. [Plan de développement](#plan-de-développement)
9. [Tests et validation](#tests-et-validation)

---

## 🎯 Vue d'ensemble

### Objectif

Créer une synchronisation bidirectionnelle automatique entre le CRM GMBS et Google Sheets, permettant :
- Une interface utilisateur pour connecter et configurer Google Sheets
- Import automatique depuis Google Sheets vers Supabase
- Export automatique depuis Supabase vers Google Sheets
- Google Sheets comme backup automatique du CRM

### Bénéfices

✅ **Backup automatique** : Toutes les données du CRM sont automatiquement sauvegardées dans Google Sheets  
✅ **Accessibilité** : Les utilisateurs peuvent consulter/modifier les données dans Google Sheets  
✅ **Flexibilité** : Possibilité de travailler offline dans Sheets puis synchroniser  
✅ **Familiarité** : Interface Google Sheets familière pour l'édition de données en masse  

---

## 🏗️ Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                          INTERFACE CRM                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Settings > Google Sheets Integration                    │   │
│  │  - Connexion OAuth Google                                │   │
│  │  - Sélection du Spreadsheet                              │   │
│  │  - Mapping des colonnes                                  │   │
│  │  - Configuration de la synchronisation                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       SUPABASE (PostgreSQL)                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Tables principales :                                    │   │
│  │  - artisans                                              │   │
│  │  - interventions                                         │   │
│  │  - clients                                               │   │
│  │                                                          │   │
│  │  Tables de synchronisation :                            │   │
│  │  - google_sheets_configs                                │   │
│  │  - sync_logs                                            │   │
│  │  - sync_queue                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Edge Functions :                                        │   │
│  │  - sync-from-sheets (Import)                            │   │
│  │  - sync-to-sheets (Export)                              │   │
│  │  - sheets-webhook (Webhook handler)                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Database Triggers :                                     │   │
│  │  - on_artisan_change → sync_queue                       │   │
│  │  - on_intervention_change → sync_queue                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                        GOOGLE SHEETS API                         │
│  - OAuth 2.0 Authentication                                     │
│  - Read/Write Spreadsheet data                                  │
│  - Watch notifications (optional)                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Composants techniques

### 1. Tables de base de données

#### `google_sheets_configs`
```sql
CREATE TABLE google_sheets_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Google OAuth
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT NOT NULL,
  google_token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Spreadsheet configuration
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_name TEXT,
  
  -- Sheet mapping
  artisans_sheet_name TEXT,
  artisans_header_row INTEGER DEFAULT 1,
  artisans_column_mapping JSONB, -- Mapping colonnes Google → colonnes DB
  
  interventions_sheet_name TEXT,
  interventions_header_row INTEGER DEFAULT 1,
  interventions_column_mapping JSONB,
  
  -- Sync settings
  sync_enabled BOOLEAN DEFAULT true,
  sync_direction TEXT CHECK (sync_direction IN ('bidirectional', 'import_only', 'export_only')) DEFAULT 'bidirectional',
  sync_frequency_minutes INTEGER DEFAULT 5,
  last_sync_from_sheets TIMESTAMPTZ,
  last_sync_to_sheets TIMESTAMPTZ,
  
  -- Conflict resolution
  conflict_strategy TEXT CHECK (conflict_strategy IN ('crm_wins', 'sheets_wins', 'newest_wins')) DEFAULT 'crm_wins',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_google_sheets_configs_user ON google_sheets_configs(user_id);
CREATE INDEX idx_google_sheets_configs_sync ON google_sheets_configs(sync_enabled, sync_frequency_minutes);
```

#### `sync_logs`
```sql
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES google_sheets_configs(id) ON DELETE CASCADE,
  
  -- Sync metadata
  direction TEXT CHECK (direction IN ('import', 'export')) NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('artisan', 'intervention', 'client')) NOT NULL,
  entity_id UUID,
  
  -- Status
  status TEXT CHECK (status IN ('pending', 'success', 'error', 'conflict')) NOT NULL,
  error_message TEXT,
  
  -- Data
  before_data JSONB,
  after_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_logs_config ON sync_logs(config_id);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at DESC);
```

#### `sync_queue`
```sql
CREATE TABLE sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES google_sheets_configs(id) ON DELETE CASCADE,
  
  -- Entity info
  entity_type TEXT CHECK (entity_type IN ('artisan', 'intervention', 'client')) NOT NULL,
  entity_id UUID NOT NULL,
  operation TEXT CHECK (operation IN ('create', 'update', 'delete')) NOT NULL,
  
  -- Payload
  entity_data JSONB NOT NULL,
  
  -- Status
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_queue_pending ON sync_queue(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_sync_queue_config ON sync_queue(config_id);
```

### 2. Interface utilisateur

#### Page de configuration : `app/settings/google-sheets/page.tsx`

```typescript
interface GoogleSheetsSettingsPage {
  sections: [
    // 1. OAuth Connection
    {
      title: "Connexion Google"
      components: [
        - GoogleOAuthButton (Connect/Disconnect)
        - ConnectionStatus
        - UserInfo (email, name)
      ]
    },
    
    // 2. Spreadsheet Selection
    {
      title: "Sélection du tableur"
      components: [
        - SpreadsheetPicker (Liste des spreadsheets)
        - SheetSelector (Artisans)
        - SheetSelector (Interventions)
        - PreviewTable (Aperçu des données)
      ]
    },
    
    // 3. Column Mapping
    {
      title: "Mapping des colonnes"
      components: [
        - ColumnMapper (Artisans)
          * Drag & Drop pour associer colonnes Google ↔ Colonnes CRM
          * Auto-detection intelligente
        - ColumnMapper (Interventions)
      ]
    },
    
    // 4. Sync Configuration
    {
      title: "Configuration de la synchronisation"
      components: [
        - SyncDirectionSelector (bidirectional/import/export)
        - SyncFrequencyPicker (temps en minutes)
        - ConflictStrategySelector (crm_wins/sheets_wins/newest_wins)
        - SyncToggle (enable/disable)
      ]
    },
    
    // 5. Monitoring
    {
      title: "Monitoring et logs"
      components: [
        - SyncStatusCard (dernière sync, prochaine sync)
        - SyncHistoryTable (logs récents)
        - ManualSyncButton (Sync maintenant)
        - ErrorAlerts
      ]
    }
  ]
}
```

### 3. API Routes

```
app/api/google-sheets/
├── auth/
│   ├── connect/route.ts          # Initier OAuth flow
│   ├── callback/route.ts         # Callback OAuth
│   └── disconnect/route.ts       # Déconnecter
├── spreadsheets/
│   ├── list/route.ts             # Lister les spreadsheets
│   └── [id]/
│       ├── sheets/route.ts       # Lister les feuilles
│       └── preview/route.ts      # Prévisualiser les données
├── config/
│   ├── route.ts                  # GET/POST config
│   └── [id]/route.ts             # PUT/DELETE config
├── sync/
│   ├── manual/route.ts           # Déclencher sync manuelle
│   ├── status/route.ts           # Status de la sync
│   └── logs/route.ts             # Récupérer les logs
└── mapping/
    └── auto-detect/route.ts      # Auto-détection des colonnes
```

### 4. Supabase Edge Functions

#### `sync-from-sheets`
```typescript
// supabase/functions/sync-from-sheets/index.ts
/**
 * Import les données depuis Google Sheets vers Supabase
 * Déclenchée par :
 * - Cron job (toutes les X minutes)
 * - Webhook Google (si configuré)
 * - Appel manuel
 */
async function syncFromSheets(configId: string) {
  // 1. Récupérer la config
  const config = await getConfig(configId);
  
  // 2. Authentifier avec Google (refresh token si nécessaire)
  const auth = await authenticateGoogle(config);
  
  // 3. Lire les données depuis Google Sheets
  const sheetsData = await readGoogleSheets(auth, config);
  
  // 4. Transformer les données (column mapping)
  const transformedData = transformSheetsToDb(sheetsData, config.column_mapping);
  
  // 5. Détecter les changements
  const changes = await detectChanges(transformedData);
  
  // 6. Appliquer les changements avec résolution de conflits
  const results = await applyChanges(changes, config.conflict_strategy);
  
  // 7. Logger les résultats
  await logSyncResults(configId, 'import', results);
  
  return results;
}
```

#### `sync-to-sheets`
```typescript
// supabase/functions/sync-to-sheets/index.ts
/**
 * Export les données depuis Supabase vers Google Sheets
 * Déclenchée par :
 * - Queue worker (consomme sync_queue)
 * - Cron job
 */
async function syncToSheets(queueItems: SyncQueueItem[]) {
  // 1. Grouper par config_id
  const byConfig = groupByConfig(queueItems);
  
  for (const [configId, items] of byConfig) {
    // 2. Récupérer la config
    const config = await getConfig(configId);
    
    // 3. Authentifier avec Google
    const auth = await authenticateGoogle(config);
    
    // 4. Transformer les données (DB → Google Sheets format)
    const sheetsData = transformDbToSheets(items, config.column_mapping);
    
    // 5. Écrire dans Google Sheets (batch update)
    const results = await writeToGoogleSheets(auth, config, sheetsData);
    
    // 6. Marquer comme traité dans la queue
    await markQueueItemsProcessed(items, results);
    
    // 7. Logger
    await logSyncResults(configId, 'export', results);
  }
}
```

#### `sheets-webhook`
```typescript
// supabase/functions/sheets-webhook/index.ts
/**
 * Réceptionne les notifications de changement depuis Google Sheets
 * (Optionnel - nécessite Google Sheets Watch API)
 */
async function handleSheetsWebhook(notification: GoogleSheetsNotification) {
  // 1. Valider la notification
  if (!validateNotification(notification)) {
    return new Response('Invalid notification', { status: 401 });
  }
  
  // 2. Déclencher une sync immédiate
  const configId = getConfigIdFromResourceId(notification.resourceId);
  await triggerSync(configId, 'import');
  
  return new Response('OK', { status: 200 });
}
```

### 5. Database Triggers

```sql
-- Trigger pour ajouter à la queue de sync quand un artisan change
CREATE OR REPLACE FUNCTION queue_artisan_sync()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sync_queue (config_id, entity_type, entity_id, operation, entity_data)
  SELECT 
    id,
    'artisan',
    NEW.id,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN TG_OP = 'UPDATE' THEN 'update'
      WHEN TG_OP = 'DELETE' THEN 'delete'
    END,
    to_jsonb(NEW)
  FROM google_sheets_configs
  WHERE sync_enabled = true
    AND (sync_direction = 'bidirectional' OR sync_direction = 'export_only');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER artisan_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON artisans
FOR EACH ROW
EXECUTE FUNCTION queue_artisan_sync();

-- Trigger similaire pour interventions
CREATE OR REPLACE FUNCTION queue_intervention_sync()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sync_queue (config_id, entity_type, entity_id, operation, entity_data)
  SELECT 
    id,
    'intervention',
    NEW.id,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN TG_OP = 'UPDATE' THEN 'update'
      WHEN TG_OP = 'DELETE' THEN 'delete'
    END,
    to_jsonb(NEW)
  FROM google_sheets_configs
  WHERE sync_enabled = true
    AND (sync_direction = 'bidirectional' OR sync_direction = 'export_only');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER intervention_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON interventions
FOR EACH ROW
EXECUTE FUNCTION queue_intervention_sync();
```

---

## 🔄 Flux de données

### Flux 1 : Configuration initiale

```
1. Utilisateur clique "Connecter Google Sheets"
   ↓
2. Redirection vers Google OAuth consent screen
   ↓
3. Utilisateur autorise l'accès
   ↓
4. Callback reçoit le code d'autorisation
   ↓
5. Échange du code contre access_token + refresh_token
   ↓
6. Stockage des tokens dans google_sheets_configs
   ↓
7. Chargement de la liste des spreadsheets de l'utilisateur
   ↓
8. Utilisateur sélectionne un spreadsheet et les feuilles
   ↓
9. Auto-détection du mapping des colonnes
   ↓
10. Utilisateur valide/ajuste le mapping
    ↓
11. Configuration de la fréquence de sync
    ↓
12. Activation de la synchronisation
```

### Flux 2 : Synchronisation CRM → Google Sheets

```
1. Modification dans le CRM (ex: mise à jour d'un artisan)
   ↓
2. Trigger PostgreSQL capte le changement
   ↓
3. Insertion dans sync_queue avec status='pending'
   ↓
4. Cron job ou worker traite la queue
   ↓
5. Récupération de la config et des données à synchroniser
   ↓
6. Transformation des données (DB format → Sheets format)
   ↓
7. Authentification Google (refresh token si nécessaire)
   ↓
8. Recherche de la ligne correspondante dans Google Sheets
   ↓
9. Mise à jour de la ligne (ou création si nouvelle)
   ↓
10. Marquage de la queue item comme 'completed'
    ↓
11. Création d'un log dans sync_logs
```

### Flux 3 : Synchronisation Google Sheets → CRM

```
1. Cron job déclenche sync-from-sheets
   ↓
2. Récupération de la config de synchronisation
   ↓
3. Authentification Google
   ↓
4. Lecture des données depuis Google Sheets
   ↓
5. Transformation des données (Sheets format → DB format)
   ↓
6. Pour chaque ligne :
   a. Recherche de l'entité existante (par email, numero, etc.)
   b. Comparaison des timestamps/versions
   c. Détection de conflit potentiel
   d. Application de la stratégie de résolution
   e. Mise à jour ou création en base
   ↓
7. Collecte des résultats
   ↓
8. Création de logs dans sync_logs
   ↓
9. Envoi de notification si erreurs
```

---

## 🛠️ Implémentation détaillée

### Phase 1 : Authentification OAuth Google

#### 1.1 Configuration Google Cloud Console

```typescript
// Configuration OAuth 2.0
const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google-sheets/auth/callback`,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
  ]
};
```

#### 1.2 Route de connexion

```typescript
// app/api/google-sheets/auth/connect/route.ts
import { google } from 'googleapis';

export async function GET(request: Request) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: GOOGLE_OAUTH_CONFIG.scopes,
    prompt: 'consent' // Force refresh token
  });

  return NextResponse.redirect(authUrl);
}
```

#### 1.3 Route de callback

```typescript
// app/api/google-sheets/auth/callback/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.redirect('/settings/google-sheets?error=no_code');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );

  // Échanger le code contre les tokens
  const { tokens } = await oauth2Client.getToken(code);
  
  // Récupérer l'utilisateur actuel
  const user = await getCurrentUser(request);
  
  // Stocker les tokens en base
  await supabase.from('google_sheets_configs').upsert({
    user_id: user.id,
    google_access_token: tokens.access_token,
    google_refresh_token: tokens.refresh_token,
    google_token_expires_at: new Date(tokens.expiry_date),
    updated_at: new Date()
  });

  return NextResponse.redirect('/settings/google-sheets?success=true');
}
```

### Phase 2 : Sélection et prévisualisation

#### 2.1 Lister les spreadsheets

```typescript
// app/api/google-sheets/spreadsheets/list/route.ts
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  const config = await getGoogleSheetsConfig(user.id);
  
  const auth = await refreshTokenIfNeeded(config);
  const drive = google.drive({ version: 'v3', auth });
  
  // Lister les spreadsheets de l'utilisateur
  const response = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet'",
    fields: 'files(id, name, createdTime, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 50
  });

  return NextResponse.json(response.data.files);
}
```

#### 2.2 Lister les feuilles d'un spreadsheet

```typescript
// app/api/google-sheets/spreadsheets/[id]/sheets/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser(request);
  const config = await getGoogleSheetsConfig(user.id);
  const auth = await refreshTokenIfNeeded(config);
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  const response = await sheets.spreadsheets.get({
    spreadsheetId: params.id,
    fields: 'sheets(properties(sheetId,title,gridProperties))'
  });

  const sheetsList = response.data.sheets?.map(sheet => ({
    id: sheet.properties?.sheetId,
    title: sheet.properties?.title,
    rows: sheet.properties?.gridProperties?.rowCount,
    columns: sheet.properties?.gridProperties?.columnCount
  }));

  return NextResponse.json(sheetsList);
}
```

#### 2.3 Prévisualiser les données

```typescript
// app/api/google-sheets/spreadsheets/[id]/preview/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(request.url);
  const sheetName = searchParams.get('sheet');
  const limit = parseInt(searchParams.get('limit') || '10');
  
  const user = await getCurrentUser(request);
  const config = await getGoogleSheetsConfig(user.id);
  const auth = await refreshTokenIfNeeded(config);
  
  const sheets = google.sheets({ version: 'v4', auth });
  
  // Lire les headers (première ligne)
  const headersResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: params.id,
    range: `${sheetName}!1:1`
  });
  
  const headers = headersResponse.data.values?.[0] || [];
  
  // Lire les premières lignes de données
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: params.id,
    range: `${sheetName}!2:${limit + 1}`
  });
  
  const rows = dataResponse.data.values || [];
  
  return NextResponse.json({
    headers,
    rows,
    totalRows: rows.length
  });
}
```

### Phase 3 : Mapping des colonnes

#### 3.1 Auto-détection intelligente

```typescript
// app/api/google-sheets/mapping/auto-detect/route.ts
export async function POST(request: Request) {
  const { headers, entityType } = await request.json();
  
  // Définir les colonnes attendues selon le type
  const expectedColumns = entityType === 'artisan' 
    ? ARTISAN_COLUMNS 
    : INTERVENTION_COLUMNS;
  
  const mapping: Record<string, string> = {};
  
  // Algorithme de matching
  for (const expectedCol of expectedColumns) {
    const match = findBestMatch(expectedCol, headers);
    if (match.confidence > 0.6) {
      mapping[match.header] = expectedCol;
    }
  }
  
  return NextResponse.json({ mapping, confidence: calculateOverallConfidence(mapping) });
}

function findBestMatch(expectedCol: string, headers: string[]) {
  let bestMatch = { header: '', confidence: 0 };
  
  for (const header of headers) {
    const confidence = calculateSimilarity(expectedCol, header);
    if (confidence > bestMatch.confidence) {
      bestMatch = { header, confidence };
    }
  }
  
  return bestMatch;
}

function calculateSimilarity(str1: string, str2: string): number {
  // Normalisation
  const norm1 = normalize(str1);
  const norm2 = normalize(str2);
  
  // Matching exact
  if (norm1 === norm2) return 1.0;
  
  // Synonymes
  if (SYNONYMS[norm1]?.includes(norm2)) return 0.9;
  
  // Similarité Levenshtein
  return 1 - (levenshteinDistance(norm1, norm2) / Math.max(norm1.length, norm2.length));
}

const SYNONYMS = {
  'nom_prenom': ['nom', 'prenom', 'nom et prenom', 'artisan', 'nom_artisan'],
  'email': ['mail', 'courriel', 'e-mail'],
  'telephone': ['tel', 'phone', 'numero', 'numero_telephone'],
  'siret': ['siren', 'numero_siret', 'n_siret'],
  // ...
};
```

### Phase 4 : Synchronisation

#### 4.1 Worker de synchronisation (Export)

```typescript
// supabase/functions/sync-to-sheets/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Récupérer les items en attente dans la queue
    const { data: queueItems, error } = await supabase
      .from('sync_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('scheduled_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ message: 'No items to sync' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // 2. Grouper par config_id
    const byConfig = groupBy(queueItems, 'config_id');
    const results = [];

    for (const [configId, items] of Object.entries(byConfig)) {
      try {
        // 3. Récupérer la configuration
        const { data: config } = await supabase
          .from('google_sheets_configs')
          .select('*')
          .eq('id', configId)
          .single();

        if (!config || !config.sync_enabled) {
          await markItemsAsSkipped(supabase, items);
          continue;
        }

        // 4. Authentifier avec Google
        const auth = await authenticateGoogle(config);

        // 5. Traiter les items par type d'entité
        const artisanItems = items.filter(i => i.entity_type === 'artisan');
        const interventionItems = items.filter(i => i.entity_type === 'intervention');

        if (artisanItems.length > 0) {
          await syncArtisansToSheets(auth, config, artisanItems, supabase);
        }

        if (interventionItems.length > 0) {
          await syncInterventionsToSheets(auth, config, interventionItems, supabase);
        }

        results.push({ configId, synced: items.length });
      } catch (error) {
        console.error(`Error syncing config ${configId}:`, error);
        await markItemsAsFailed(supabase, items, error.message);
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

async function syncArtisansToSheets(auth, config, items, supabase) {
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetName = config.artisans_sheet_name;
  const mapping = config.artisans_column_mapping;

  // Lire les données existantes pour trouver les lignes à mettre à jour
  const existingData = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheet_id,
    range: `${sheetName}!A:ZZ`
  });

  const rows = existingData.data.values || [];
  const headers = rows[0] || [];

  // Pour chaque item de la queue
  for (const item of items) {
    try {
      const artisanData = item.entity_data;
      
      // Transformer les données selon le mapping
      const sheetRow = transformDataToSheetRow(artisanData, mapping, headers);
      
      // Trouver la ligne existante (par email ou numero_associe)
      const existingRowIndex = findRowByIdentifier(
        rows,
        headers,
        artisanData,
        mapping
      );

      if (existingRowIndex !== -1) {
        // Mise à jour de la ligne existante
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheet_id,
          range: `${sheetName}!A${existingRowIndex + 1}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [sheetRow]
          }
        });
      } else {
        // Ajout d'une nouvelle ligne
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.spreadsheet_id,
          range: `${sheetName}!A:A`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [sheetRow]
          }
        });
      }

      // Marquer comme traité
      await supabase
        .from('sync_queue')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('id', item.id);

      // Logger
      await supabase.from('sync_logs').insert({
        config_id: config.id,
        direction: 'export',
        entity_type: 'artisan',
        entity_id: item.entity_id,
        status: 'success',
        after_data: artisanData
      });

    } catch (error) {
      console.error(`Error syncing artisan ${item.entity_id}:`, error);
      
      await supabase
        .from('sync_queue')
        .update({ 
          status: 'failed', 
          error_message: error.message,
          attempts: item.attempts + 1
        })
        .eq('id', item.id);

      await supabase.from('sync_logs').insert({
        config_id: config.id,
        direction: 'export',
        entity_type: 'artisan',
        entity_id: item.entity_id,
        status: 'error',
        error_message: error.message
      });
    }
  }
}
```

#### 4.2 Synchronisation Import

```typescript
// supabase/functions/sync-from-sheets/index.ts
serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // 1. Récupérer toutes les configs actives
  const { data: configs } = await supabase
    .from('google_sheets_configs')
    .select('*')
    .eq('sync_enabled', true)
    .in('sync_direction', ['bidirectional', 'import_only']);

  if (!configs || configs.length === 0) {
    return new Response(JSON.stringify({ message: 'No configs to sync' }), {
      status: 200
    });
  }

  const results = [];

  for (const config of configs) {
    try {
      // 2. Vérifier si c'est le moment de sync (selon fréquence)
      if (!shouldSync(config)) {
        continue;
      }

      // 3. Authentifier avec Google
      const auth = await authenticateGoogle(config);
      const sheets = google.sheets({ version: 'v4', auth });

      // 4. Lire les données depuis Google Sheets
      let syncedCount = 0;

      // 4a. Sync artisans
      if (config.artisans_sheet_name) {
        const artisansCount = await syncArtisansFromSheets(
          sheets,
          config,
          supabase
        );
        syncedCount += artisansCount;
      }

      // 4b. Sync interventions
      if (config.interventions_sheet_name) {
        const interventionsCount = await syncInterventionsFromSheets(
          sheets,
          config,
          supabase
        );
        syncedCount += interventionsCount;
      }

      // 5. Mettre à jour le timestamp de dernière sync
      await supabase
        .from('google_sheets_configs')
        .update({ last_sync_from_sheets: new Date().toISOString() })
        .eq('id', config.id);

      results.push({ configId: config.id, synced: syncedCount });
    } catch (error) {
      console.error(`Error syncing config ${config.id}:`, error);
      results.push({ configId: config.id, error: error.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  });
});

async function syncArtisansFromSheets(sheets, config, supabase) {
  const sheetName = config.artisans_sheet_name;
  const mapping = config.artisans_column_mapping;

  // Lire toutes les données
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheet_id,
    range: `${sheetName}!A:ZZ`
  });

  const rows = response.data.values || [];
  if (rows.length === 0) return 0;

  const headers = rows[0];
  const dataRows = rows.slice(1);

  let syncedCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    try {
      const row = dataRows[i];
      
      // Transformer la ligne Google Sheets en objet artisan
      const artisanData = transformSheetRowToData(row, headers, mapping);
      
      if (!artisanData || !isValidArtisan(artisanData)) {
        continue;
      }

      // Trouver l'artisan existant
      const { data: existingArtisan } = await supabase
        .from('artisans')
        .select('*')
        .or(`email.eq.${artisanData.email},numero_associe.eq.${artisanData.numero_associe}`)
        .maybeSingle();

      if (existingArtisan) {
        // Vérifier les conflits
        const hasConflict = detectConflict(existingArtisan, artisanData);
        
        if (hasConflict) {
          const resolvedData = resolveConflict(
            existingArtisan,
            artisanData,
            config.conflict_strategy
          );
          
          if (resolvedData !== existingArtisan) {
            // Mise à jour nécessaire
            await supabase
              .from('artisans')
              .update(resolvedData)
              .eq('id', existingArtisan.id);

            await supabase.from('sync_logs').insert({
              config_id: config.id,
              direction: 'import',
              entity_type: 'artisan',
              entity_id: existingArtisan.id,
              status: hasConflict ? 'conflict' : 'success',
              before_data: existingArtisan,
              after_data: resolvedData
            });

            syncedCount++;
          }
        }
      } else {
        // Créer un nouvel artisan
        const { data: newArtisan, error } = await supabase
          .from('artisans')
          .insert(artisanData)
          .select()
          .single();

        if (!error && newArtisan) {
          await supabase.from('sync_logs').insert({
            config_id: config.id,
            direction: 'import',
            entity_type: 'artisan',
            entity_id: newArtisan.id,
            status: 'success',
            after_data: newArtisan
          });

          syncedCount++;
        }
      }
    } catch (error) {
      console.error(`Error processing row ${i + 2}:`, error);
      
      await supabase.from('sync_logs').insert({
        config_id: config.id,
        direction: 'import',
        entity_type: 'artisan',
        status: 'error',
        error_message: `Row ${i + 2}: ${error.message}`
      });
    }
  }

  return syncedCount;
}
```

---

## ⚔️ Gestion des conflits

### Stratégies de résolution

#### 1. **CRM Wins** (Par défaut)
Les modifications dans le CRM sont prioritaires. Les données de Google Sheets sont écrasées.

```typescript
function resolveConflict_CrmWins(crmData, sheetsData) {
  // Le CRM a toujours raison
  return crmData;
}
```

#### 2. **Sheets Wins**
Les modifications dans Google Sheets sont prioritaires.

```typescript
function resolveConflict_SheetsWins(crmData, sheetsData) {
  // Google Sheets a toujours raison
  return sheetsData;
}
```

#### 3. **Newest Wins** (Recommandé)
La donnée la plus récente gagne (basé sur `updated_at`).

```typescript
function resolveConflict_NewestWins(crmData, sheetsData) {
  const crmTimestamp = new Date(crmData.updated_at).getTime();
  const sheetsTimestamp = new Date(sheetsData.updated_at).getTime();
  
  if (sheetsTimestamp > crmTimestamp) {
    return sheetsData;
  } else {
    return crmData;
  }
}
```

#### 4. **Field-level merge** (Avancé - Phase 2)
Merge intelligent champ par champ.

```typescript
function resolveConflict_FieldMerge(crmData, sheetsData) {
  const merged = { ...crmData };
  
  for (const [key, value] of Object.entries(sheetsData)) {
    // Si le champ CRM est vide mais Sheets a une valeur
    if (!crmData[key] && value) {
      merged[key] = value;
    }
    // Si Sheets a une valeur plus récente
    else if (sheetsData[`${key}_updated_at`] > crmData[`${key}_updated_at`]) {
      merged[key] = value;
    }
  }
  
  return merged;
}
```

### Détection de conflits

```typescript
function detectConflict(crmData, sheetsData) {
  // Liste des champs critiques à vérifier
  const criticalFields = [
    'nom_prenom',
    'email',
    'telephone',
    'siret',
    'adresse_siege_social'
  ];
  
  for (const field of criticalFields) {
    if (crmData[field] !== sheetsData[field]) {
      // Vérifier si ce n'est pas juste une différence de format
      if (normalize(crmData[field]) !== normalize(sheetsData[field])) {
        return true; // Conflit détecté
      }
    }
  }
  
  return false; // Pas de conflit
}

function normalize(value: any): string {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}
```

### Interface de gestion des conflits

```typescript
// Composant React pour résoudre les conflits manuellement
interface ConflictResolverProps {
  conflicts: Conflict[];
  onResolve: (resolutions: Resolution[]) => void;
}

function ConflictResolver({ conflicts, onResolve }: ConflictResolverProps) {
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  
  return (
    <div className="conflict-resolver">
      <h2>⚠️ {conflicts.length} conflit(s) détecté(s)</h2>
      
      {conflicts.map((conflict) => (
        <ConflictCard key={conflict.id}>
          <div className="conflict-header">
            <Badge>{conflict.entity_type}</Badge>
            <span>{conflict.entity_id}</span>
          </div>
          
          <div className="conflict-comparison">
            <div className="crm-version">
              <h3>Version CRM</h3>
              <DataPreview data={conflict.crm_data} />
              <Button onClick={() => resolveWithVersion('crm', conflict)}>
                Utiliser cette version
              </Button>
            </div>
            
            <div className="sheets-version">
              <h3>Version Google Sheets</h3>
              <DataPreview data={conflict.sheets_data} />
              <Button onClick={() => resolveWithVersion('sheets', conflict)}>
                Utiliser cette version
              </Button>
            </div>
          </div>
          
          <Button variant="secondary" onClick={() => openMergeEditor(conflict)}>
            Fusionner manuellement
          </Button>
        </ConflictCard>
      ))}
      
      <Button onClick={() => onResolve(resolutions)}>
        Résoudre tous les conflits
      </Button>
    </div>
  );
}
```

---

## 🔐 Sécurité

### 1. Gestion des tokens

```typescript
// Stockage sécurisé des tokens (chiffrés en base)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fonction pour chiffrer
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(pgp_sym_encrypt(token, current_setting('app.encryption_key')), 'base64');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour déchiffrer
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(decode(encrypted_token, 'base64'), current_setting('app.encryption_key'));
END;
$$ LANGUAGE plpgsql;
```

### 2. Permissions Row-Level Security

```sql
-- Activer RLS sur les tables de sync
ALTER TABLE google_sheets_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Politique : L'utilisateur ne peut voir que ses propres configs
CREATE POLICY user_own_configs ON google_sheets_configs
  FOR ALL
  USING (auth.uid() = user_id);

-- Politique : L'utilisateur peut voir les logs de ses configs
CREATE POLICY user_own_logs ON sync_logs
  FOR SELECT
  USING (
    config_id IN (
      SELECT id FROM google_sheets_configs WHERE user_id = auth.uid()
    )
  );
```

### 3. Validation des données

```typescript
// Schéma de validation avec Zod
import { z } from 'zod';

const ArtisanSchema = z.object({
  nom_prenom: z.string().min(1).max(255),
  email: z.string().email().optional(),
  telephone: z.string().optional(),
  siret: z.string().length(14).optional(),
  numero_associe: z.string().optional(),
  // ...
});

function validateAndSanitize(data: unknown, schema: z.ZodSchema) {
  try {
    return schema.parse(data);
  } catch (error) {
    throw new ValidationError('Invalid data format', error);
  }
}
```

### 4. Rate limiting

```typescript
// Limiter les appels API Google Sheets
const rateLimiter = new Map<string, RateLimitInfo>();

function checkRateLimit(userId: string) {
  const limit = rateLimiter.get(userId);
  
  if (!limit) {
    rateLimiter.set(userId, {
      count: 1,
      resetAt: Date.now() + 60000 // 1 minute
    });
    return true;
  }
  
  if (Date.now() > limit.resetAt) {
    rateLimiter.set(userId, {
      count: 1,
      resetAt: Date.now() + 60000
    });
    return true;
  }
  
  if (limit.count >= 100) { // Max 100 requêtes par minute
    throw new Error('Rate limit exceeded');
  }
  
  limit.count++;
  return true;
}
```

---

## 📋 Plan de développement

### Sprint 1 : Fondations (2 semaines)

**Semaine 1 : Base de données et authentification**
- [ ] Créer les migrations pour les nouvelles tables
- [ ] Implémenter les triggers PostgreSQL
- [ ] Configurer Google Cloud Console
- [ ] Implémenter OAuth flow (connect/callback/disconnect)
- [ ] Tests unitaires de l'auth

**Semaine 2 : Interface de base**
- [ ] Créer la page de settings Google Sheets
- [ ] Composant de connexion OAuth
- [ ] Liste des spreadsheets
- [ ] Sélecteur de feuilles
- [ ] Tests d'intégration

### Sprint 2 : Mapping et transformation (2 semaines)

**Semaine 3 : Mapping des colonnes**
- [ ] Algorithme d'auto-détection
- [ ] Interface de mapping (drag & drop)
- [ ] Prévisualisation des données
- [ ] Sauvegarde de la configuration
- [ ] Tests de mapping

**Semaine 4 : Transformation des données**
- [ ] Fonctions de transformation DB → Sheets
- [ ] Fonctions de transformation Sheets → DB
- [ ] Gestion des types de données
- [ ] Tests de transformation

### Sprint 3 : Synchronisation Export (2 semaines)

**Semaine 5 : Queue et triggers**
- [ ] Implémenter les triggers PostgreSQL
- [ ] Système de queue
- [ ] Worker de traitement de la queue
- [ ] Retry logic
- [ ] Tests unitaires

**Semaine 6 : Edge Function Export**
- [ ] Fonction sync-to-sheets
- [ ] Authentification Google
- [ ] Écriture dans Google Sheets
- [ ] Gestion des erreurs
- [ ] Tests d'intégration

### Sprint 4 : Synchronisation Import (2 semaines)

**Semaine 7 : Edge Function Import**
- [ ] Fonction sync-from-sheets
- [ ] Lecture depuis Google Sheets
- [ ] Détection de changements
- [ ] Upsert en base de données
- [ ] Tests d'intégration

**Semaine 8 : Détection de conflits**
- [ ] Algorithme de détection de conflits
- [ ] Stratégies de résolution
- [ ] Interface de résolution manuelle
- [ ] Tests de conflits

### Sprint 5 : Monitoring et polish (1 semaine)

**Semaine 9 : Monitoring**
- [ ] Dashboard de monitoring
- [ ] Logs de synchronisation
- [ ] Statistiques
- [ ] Notifications d'erreurs
- [ ] Tests end-to-end

**Semaine 10 : Polish et documentation**
- [ ] Documentation utilisateur
- [ ] Documentation technique
- [ ] Tests de charge
- [ ] Optimisations
- [ ] Release

---

## 🧪 Tests et validation

### Tests unitaires

```typescript
// tests/google-sheets/mapping.test.ts
describe('Column Mapping', () => {
  it('should auto-detect exact matches', () => {
    const headers = ['nom_prenom', 'email', 'telephone'];
    const mapping = autoDetectMapping(headers, 'artisan');
    
    expect(mapping['nom_prenom']).toBe('nom_prenom');
    expect(mapping['email']).toBe('email');
  });
  
  it('should detect synonyms', () => {
    const headers = ['Nom', 'Mail', 'Téléphone'];
    const mapping = autoDetectMapping(headers, 'artisan');
    
    expect(mapping['Nom']).toBe('nom_prenom');
    expect(mapping['Mail']).toBe('email');
  });
  
  it('should handle fuzzy matching', () => {
    const headers = ['Nom et Prénom', 'Adresse e-mail'];
    const mapping = autoDetectMapping(headers, 'artisan');
    
    expect(mapping['Nom et Prénom']).toBe('nom_prenom');
    expect(mapping['Adresse e-mail']).toBe('email');
  });
});
```

### Tests d'intégration

```typescript
// tests/google-sheets/sync.integration.test.ts
describe('Google Sheets Sync', () => {
  let testConfig: GoogleSheetsConfig;
  let testSpreadsheet: string;
  
  beforeAll(async () => {
    // Créer un spreadsheet de test
    testSpreadsheet = await createTestSpreadsheet();
    testConfig = await createTestConfig(testSpreadsheet);
  });
  
  afterAll(async () => {
    await deleteTestSpreadsheet(testSpreadsheet);
    await deleteTestConfig(testConfig.id);
  });
  
  it('should sync new artisan from CRM to Sheets', async () => {
    // 1. Créer un artisan dans le CRM
    const artisan = await createArtisan({
      nom_prenom: 'Test Artisan',
      email: 'test@example.com'
    });
    
    // 2. Attendre la sync
    await waitForSync(testConfig.id);
    
    // 3. Vérifier dans Google Sheets
    const sheetsData = await readFromSheets(testSpreadsheet, 'Artisans');
    const foundArtisan = sheetsData.find(row => row.email === 'test@example.com');
    
    expect(foundArtisan).toBeDefined();
    expect(foundArtisan.nom_prenom).toBe('Test Artisan');
  });
  
  it('should sync updated artisan from Sheets to CRM', async () => {
    // 1. Créer un artisan
    const artisan = await createArtisan({
      nom_prenom: 'Original Name',
      email: 'update@example.com'
    });
    
    await waitForSync(testConfig.id);
    
    // 2. Modifier dans Google Sheets
    await updateInSheets(testSpreadsheet, 'Artisans', {
      email: 'update@example.com',
      nom_prenom: 'Updated Name'
    });
    
    // 3. Déclencher sync import
    await triggerSyncFromSheets(testConfig.id);
    
    // 4. Vérifier dans le CRM
    const updated = await getArtisan(artisan.id);
    expect(updated.nom_prenom).toBe('Updated Name');
  });
  
  it('should handle conflicts correctly', async () => {
    // 1. Créer un artisan
    const artisan = await createArtisan({
      nom_prenom: 'Conflict Test',
      email: 'conflict@example.com'
    });
    
    await waitForSync(testConfig.id);
    
    // 2. Modifier simultanément dans CRM et Sheets
    const crmUpdate = updateArtisan(artisan.id, { telephone: '0600000000' });
    const sheetsUpdate = updateInSheets(testSpreadsheet, 'Artisans', {
      email: 'conflict@example.com',
      telephone: '0611111111'
    });
    
    await Promise.all([crmUpdate, sheetsUpdate]);
    
    // 3. Déclencher sync
    await triggerBidirectionalSync(testConfig.id);
    
    // 4. Vérifier la résolution (selon stratégie)
    const finalArtisan = await getArtisan(artisan.id);
    const finalSheets = await readFromSheets(testSpreadsheet, 'Artisans');
    const finalRow = finalSheets.find(r => r.email === 'conflict@example.com');
    
    // Avec stratégie "crm_wins"
    expect(finalArtisan.telephone).toBe('0600000000');
    expect(finalRow.telephone).toBe('0600000000');
  });
});
```

### Tests de charge

```typescript
// tests/google-sheets/load.test.ts
describe('Load Tests', () => {
  it('should handle 1000 artisans sync', async () => {
    const artisans = generateTestArtisans(1000);
    
    const startTime = Date.now();
    await bulkCreateArtisans(artisans);
    await waitForSync(testConfig.id);
    const duration = Date.now() - startTime;
    
    // Vérifier que la sync prend moins de 5 minutes
    expect(duration).toBeLessThan(5 * 60 * 1000);
    
    // Vérifier l'intégrité des données
    const sheetsData = await readFromSheets(testSpreadsheet, 'Artisans');
    expect(sheetsData.length).toBe(1000);
  });
  
  it('should handle concurrent updates', async () => {
    const artisan = await createArtisan({
      nom_prenom: 'Concurrent Test',
      email: 'concurrent@example.com'
    });
    
    // 10 mises à jour simultanées
    const updates = Array.from({ length: 10 }, (_, i) => 
      updateArtisan(artisan.id, { telephone: `060000000${i}` })
    );
    
    await Promise.all(updates);
    await waitForSync(testConfig.id);
    
    // Vérifier qu'il n'y a pas de corruption de données
    const finalArtisan = await getArtisan(artisan.id);
    expect(finalArtisan.telephone).toMatch(/^060000000\d$/);
  });
});
```

---

## 📊 Métriques de succès

### KPIs à suivre

1. **Performance**
   - Temps moyen de sync (objectif : < 30s pour 100 entités)
   - Latence CRM → Sheets (objectif : < 2min)
   - Latence Sheets → CRM (objectif : < 5min)

2. **Fiabilité**
   - Taux de succès des syncs (objectif : > 99%)
   - Nombre de conflits (objectif : < 1%)
   - Taux de retry réussi (objectif : > 90%)

3. **Utilisation**
   - Nombre d'utilisateurs actifs
   - Nombre de syncs par jour
   - Nombre de configurations actives

4. **Qualité des données**
   - Taux de corruption (objectif : 0%)
   - Précision du mapping automatique (objectif : > 80%)

---

## 🚀 Améliorations futures (Phase 2)

### Fonctionnalités avancées

1. **Synchronisation sélective**
   - Choisir quelles colonnes synchroniser
   - Filtres conditionnels (ex: seulement les artisans actifs)

2. **Historique et versioning**
   - Garder un historique des changements
   - Possibilité de rollback

3. **Transformations personnalisées**
   - Formules de transformation custom
   - Scripts de pré/post-traitement

4. **Intégrations multiples**
   - Support de plusieurs spreadsheets
   - Synchronisation avec d'autres outils (Airtable, Notion)

5. **Webhooks Google Sheets**
   - Synchronisation en temps réel
   - Notification instantanée des changements

6. **Intelligence artificielle**
   - Détection automatique des anomalies
   - Suggestions de résolution de conflits
   - Prédiction de la qualité des données

---

## 📝 Conclusion

Cette architecture permet une synchronisation bidirectionnelle robuste et scalable entre le CRM et Google Sheets. Elle offre :

✅ **Flexibilité** : Configuration personnalisable par utilisateur  
✅ **Fiabilité** : Gestion des erreurs, retry logic, logs détaillés  
✅ **Performance** : Queue asynchrone, batch processing  
✅ **Sécurité** : OAuth, RLS, encryption des tokens  
✅ **UX** : Interface intuitive, auto-détection, monitoring en temps réel  

Le développement peut être réalisé en **10 semaines** avec une équipe de 2-3 développeurs.

---

**Dernière mise à jour** : 30 octobre 2025  
**Auteur** : Claude AI Assistant  
**Version** : 1.0



