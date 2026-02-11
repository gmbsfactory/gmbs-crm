# 🚀 Guide de démarrage rapide - Implémentation Sync Google Sheets

## 📝 Prérequis

Avant de commencer, assurez-vous d'avoir :
- [x] Accès à Google Cloud Console
- [x] Projet Supabase configuré
- [x] Node.js >= 20
- [x] Supabase CLI installé

---

## ⚡ Démarrage en 30 minutes

### Étape 1 : Configuration Google Cloud (10 min)

#### 1.1 Créer un projet

```bash
# Aller sur https://console.cloud.google.com/
# 1. Créer un nouveau projet "CRM-GMBS-Sync"
# 2. Noter le PROJECT_ID
```

#### 1.2 Activer les APIs

```bash
# Dans Google Cloud Console :
# APIs & Services > Enabled APIs & Services > + Enable APIs and Services

# Rechercher et activer :
✅ Google Sheets API
✅ Google Drive API
```

#### 1.3 Créer les identifiants OAuth 2.0

```bash
# APIs & Services > Credentials > + Create Credentials > OAuth client ID

Type: Web application
Nom: CRM GMBS Production

Authorized JavaScript origins:
- http://localhost:3000
- https://votre-domaine.com

Authorized redirect URIs:
- http://localhost:3000/api/google-sheets/auth/callback
- https://votre-domaine.com/api/google-sheets/auth/callback

# Cliquer "Create"
# Télécharger le JSON des credentials
# Noter le CLIENT_ID et CLIENT_SECRET
```

#### 1.4 Configurer l'écran de consentement OAuth

```bash
# OAuth consent screen

User Type: External
App name: CRM GMBS
User support email: votre@email.com
Developer contact: votre@email.com

Scopes:
- https://www.googleapis.com/auth/spreadsheets
- https://www.googleapis.com/auth/drive.readonly

Test users: Ajouter vos emails de test

# Sauvegarder
```

---

### Étape 2 : Configuration des variables d'environnement (2 min)

```bash
# .env.local
GOOGLE_CLIENT_ID="votre_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="votre_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google-sheets/auth/callback"

# Pour la production
# GOOGLE_REDIRECT_URI="https://votre-domaine.com/api/google-sheets/auth/callback"

# Clé de chiffrement pour les tokens (générer une clé forte)
APP_ENCRYPTION_KEY="votre_cle_de_chiffrement_longue_et_securisee"
```

```bash
# Générer une clé de chiffrement sécurisée
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

### Étape 3 : Créer les migrations Supabase (5 min)

```bash
# Créer une nouvelle migration
supabase migration new google_sheets_sync

# Copier le contenu dans le fichier créé
```

```sql
-- supabase/migrations/[timestamp]_google_sheets_sync.sql

-- ========================================
-- GOOGLE SHEETS SYNC TABLES
-- ========================================

-- Table de configuration des synchronisations
CREATE TABLE IF NOT EXISTS public.google_sheets_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Google OAuth tokens (chiffrés)
  google_access_token TEXT NOT NULL,
  google_refresh_token TEXT NOT NULL,
  google_token_expires_at TIMESTAMPTZ NOT NULL,
  
  -- Spreadsheet configuration
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_name TEXT,
  
  -- Sheet mapping
  artisans_sheet_name TEXT,
  artisans_header_row INTEGER DEFAULT 1,
  artisans_column_mapping JSONB DEFAULT '{}'::jsonb,
  
  interventions_sheet_name TEXT,
  interventions_header_row INTEGER DEFAULT 1,
  interventions_column_mapping JSONB DEFAULT '{}'::jsonb,
  
  -- Sync settings
  sync_enabled BOOLEAN DEFAULT true,
  sync_direction TEXT CHECK (sync_direction IN ('bidirectional', 'import_only', 'export_only')) DEFAULT 'bidirectional',
  sync_frequency_minutes INTEGER DEFAULT 5,
  last_sync_from_sheets TIMESTAMPTZ,
  last_sync_to_sheets TIMESTAMPTZ,
  
  -- Conflict resolution
  conflict_strategy TEXT CHECK (conflict_strategy IN ('crm_wins', 'sheets_wins', 'newest_wins')) DEFAULT 'crm_wins',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, spreadsheet_id)
);

-- Table de logs de synchronisation
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES public.google_sheets_configs(id) ON DELETE CASCADE,
  
  direction TEXT CHECK (direction IN ('import', 'export')) NOT NULL,
  entity_type TEXT CHECK (entity_type IN ('artisan', 'intervention', 'client')) NOT NULL,
  entity_id UUID,
  
  status TEXT CHECK (status IN ('pending', 'success', 'error', 'conflict')) NOT NULL,
  error_message TEXT,
  
  before_data JSONB,
  after_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table de queue pour les exports
CREATE TABLE IF NOT EXISTS public.sync_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_id UUID REFERENCES public.google_sheets_configs(id) ON DELETE CASCADE,
  
  entity_type TEXT CHECK (entity_type IN ('artisan', 'intervention', 'client')) NOT NULL,
  entity_id UUID NOT NULL,
  operation TEXT CHECK (operation IN ('create', 'update', 'delete')) NOT NULL,
  
  entity_data JSONB NOT NULL,
  
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la performance
CREATE INDEX idx_google_sheets_configs_user ON google_sheets_configs(user_id);
CREATE INDEX idx_google_sheets_configs_sync ON google_sheets_configs(sync_enabled) WHERE sync_enabled = true;

CREATE INDEX idx_sync_logs_config ON sync_logs(config_id);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at DESC);

CREATE INDEX idx_sync_queue_pending ON sync_queue(status, scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_sync_queue_config ON sync_queue(config_id);
CREATE INDEX idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

-- ========================================
-- TRIGGERS POUR LA SYNCHRONISATION
-- ========================================

-- Fonction pour ajouter à la queue lors d'un changement d'artisan
CREATE OR REPLACE FUNCTION queue_artisan_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Ajouter à la queue pour toutes les configs actives avec export
  INSERT INTO sync_queue (config_id, entity_type, entity_id, operation, entity_data)
  SELECT 
    id,
    'artisan',
    COALESCE(NEW.id, OLD.id),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN TG_OP = 'UPDATE' THEN 'update'
      WHEN TG_OP = 'DELETE' THEN 'delete'
    END,
    CASE 
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  FROM google_sheets_configs
  WHERE sync_enabled = true
    AND (sync_direction = 'bidirectional' OR sync_direction = 'export_only');
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger sur la table artisans
DROP TRIGGER IF EXISTS artisan_sync_trigger ON artisans;
CREATE TRIGGER artisan_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON artisans
FOR EACH ROW
EXECUTE FUNCTION queue_artisan_sync();

-- Fonction pour ajouter à la queue lors d'un changement d'intervention
CREATE OR REPLACE FUNCTION queue_intervention_sync()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO sync_queue (config_id, entity_type, entity_id, operation, entity_data)
  SELECT 
    id,
    'intervention',
    COALESCE(NEW.id, OLD.id),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'create'
      WHEN TG_OP = 'UPDATE' THEN 'update'
      WHEN TG_OP = 'DELETE' THEN 'delete'
    END,
    CASE 
      WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)
      ELSE to_jsonb(NEW)
    END
  FROM google_sheets_configs
  WHERE sync_enabled = true
    AND (sync_direction = 'bidirectional' OR sync_direction = 'export_only');
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger sur la table interventions
DROP TRIGGER IF EXISTS intervention_sync_trigger ON interventions;
CREATE TRIGGER intervention_sync_trigger
AFTER INSERT OR UPDATE OR DELETE ON interventions
FOR EACH ROW
EXECUTE FUNCTION queue_intervention_sync();

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE google_sheets_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Politique : L'utilisateur ne voit que ses propres configurations
CREATE POLICY user_own_configs ON google_sheets_configs
  FOR ALL
  USING (auth.uid() = user_id);

-- Politique : L'utilisateur voit les logs de ses configurations
CREATE POLICY user_own_logs ON sync_logs
  FOR SELECT
  USING (
    config_id IN (
      SELECT id FROM google_sheets_configs WHERE user_id = auth.uid()
    )
  );

-- Politique : L'utilisateur voit la queue de ses configurations
CREATE POLICY user_own_queue ON sync_queue
  FOR SELECT
  USING (
    config_id IN (
      SELECT id FROM google_sheets_configs WHERE user_id = auth.uid()
    )
  );

-- ========================================
-- FONCTIONS UTILITAIRES
-- ========================================

-- Fonction pour nettoyer les vieux logs (optionnel)
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM sync_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Commentaires pour la documentation
COMMENT ON TABLE google_sheets_configs IS 'Configuration de synchronisation Google Sheets par utilisateur';
COMMENT ON TABLE sync_logs IS 'Historique des synchronisations';
COMMENT ON TABLE sync_queue IS 'Queue des changements à exporter vers Google Sheets';
```

```bash
# Appliquer la migration
supabase db push

# Ou si local
supabase db reset
```

---

### Étape 4 : Créer les API Routes (10 min)

#### 4.1 Structure des dossiers

```bash
mkdir -p app/api/google-sheets/{auth,spreadsheets,config,sync,mapping}
```

#### 4.2 Route de connexion OAuth

```typescript
// app/api/google-sheets/auth/connect/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly'
];

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent' // Force pour avoir le refresh token
  });

  return NextResponse.redirect(authUrl);
}
```

#### 4.3 Route de callback OAuth

```typescript
// app/api/google-sheets/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings/google-sheets?error=${error}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/settings/google-sheets?error=no_code', request.url)
    );
  }

  try {
    // Échanger le code contre les tokens
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Récupérer l'utilisateur actuel (à adapter selon votre auth)
    // Pour l'instant, simuler avec un user_id fixe pour le test
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // TODO: Récupérer le vrai user_id depuis la session
    const userId = 'CURRENT_USER_ID'; // À remplacer

    // Stocker les tokens
    const { error: dbError } = await supabase
      .from('google_sheets_configs')
      .upsert({
        user_id: userId,
        google_access_token: tokens.access_token!,
        google_refresh_token: tokens.refresh_token!,
        google_token_expires_at: new Date(tokens.expiry_date!).toISOString(),
        spreadsheet_id: '', // Sera défini plus tard
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,spreadsheet_id'
      });

    if (dbError) throw dbError;

    return NextResponse.redirect(
      new URL('/settings/google-sheets?success=true', request.url)
    );
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      new URL(`/settings/google-sheets?error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
```

#### 4.4 Route de liste des spreadsheets

```typescript
// app/api/google-sheets/spreadsheets/list/route.ts
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // TODO: Récupérer le vrai user_id depuis la session
    const userId = 'CURRENT_USER_ID';

    // Récupérer les tokens
    const { data: config, error } = await supabase
      .from('google_sheets_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !config) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 });
    }

    // Authentifier avec Google
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: config.google_access_token,
      refresh_token: config.google_refresh_token,
      expiry_date: new Date(config.google_token_expires_at).getTime()
    });

    // Lister les spreadsheets
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      fields: 'files(id, name, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 50
    });

    return NextResponse.json(response.data.files || []);
  } catch (error: any) {
    console.error('Error listing spreadsheets:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

---

### Étape 5 : Créer la page de settings (3 min)

```typescript
// app/settings/google-sheets/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function GoogleSheetsSettings() {
  const [isConnected, setIsConnected] = useState(false);
  const [spreadsheets, setSpreadsheets] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    window.location.href = '/api/google-sheets/auth/connect';
  };

  const loadSpreadsheets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/google-sheets/spreadsheets/list');
      if (response.ok) {
        const data = await response.json();
        setSpreadsheets(data);
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error loading spreadsheets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpreadsheets();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Synchronisation Google Sheets</h1>

      {/* Section 1 : Connexion */}
      <Card>
        <CardHeader>
          <CardTitle>Connexion Google</CardTitle>
        </CardHeader>
        <CardContent>
          {!isConnected ? (
            <div>
              <p className="mb-4 text-muted-foreground">
                Connectez votre compte Google pour synchroniser vos données avec Google Sheets.
              </p>
              <Button onClick={handleConnect} size="lg">
                🔗 Connecter à Google
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="font-medium">Connecté</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 : Liste des spreadsheets */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Vos spreadsheets</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Chargement...</p>
            ) : spreadsheets.length === 0 ? (
              <p className="text-muted-foreground">Aucun spreadsheet trouvé.</p>
            ) : (
              <ul className="space-y-2">
                {spreadsheets.map((sheet: any) => (
                  <li key={sheet.id} className="p-3 border rounded hover:bg-accent">
                    <div className="font-medium">{sheet.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Modifié : {new Date(sheet.modifiedTime).toLocaleDateString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* TODO: Ajouter les autres sections (mapping, config, monitoring) */}
    </div>
  );
}
```

---

### Étape 6 : Tester la connexion OAuth (< 1 min)

```bash
# Lancer l'application
npm run dev

# Ouvrir dans le navigateur
# http://localhost:3000/settings/google-sheets

# Cliquer sur "Connecter à Google"
# Autoriser l'accès
# Vérifier que vous êtes redirigé avec success=true
# Vérifier que la liste des spreadsheets s'affiche
```

---

## ✅ Checkpoint : Phase 1 terminée !

À ce stade, vous devriez avoir :
- ✅ Google Cloud configuré
- ✅ Tables Supabase créées
- ✅ Triggers PostgreSQL actifs
- ✅ OAuth fonctionnel
- ✅ Liste des spreadsheets affichée

---

## 🔄 Prochaines étapes (Sprints 3-7)

### Sprint 3-4 : Mapping et transformation
- [ ] Interface de sélection de feuilles
- [ ] Prévisualisation des données
- [ ] Auto-détection des colonnes
- [ ] Interface de mapping drag & drop
- [ ] Sauvegarde de la configuration

### Sprint 5-6 : Synchronisation
- [ ] Edge Function `sync-to-sheets` (Export)
- [ ] Edge Function `sync-from-sheets` (Import)
- [ ] Cron jobs
- [ ] Queue worker
- [ ] Gestion des conflits

### Sprint 7 : Monitoring
- [ ] Dashboard de monitoring
- [ ] Historique des syncs
- [ ] Alertes
- [ ] Tests end-to-end

---

## 🧪 Tests rapides

### Test 1 : OAuth fonctionne

```bash
# 1. Aller sur /settings/google-sheets
# 2. Cliquer "Connecter à Google"
# 3. Accepter les permissions
# 4. Vérifier la redirection avec success=true
# 5. Vérifier dans Supabase Studio que les tokens sont enregistrés

# SQL pour vérifier
SELECT 
  user_id, 
  spreadsheet_name, 
  sync_enabled,
  created_at
FROM google_sheets_configs;
```

### Test 2 : Liste des spreadsheets

```bash
# 1. Après connexion, vérifier que la liste des spreadsheets s'affiche
# 2. Ouvrir DevTools > Network
# 3. Vérifier l'appel à /api/google-sheets/spreadsheets/list
# 4. Vérifier la réponse JSON contient vos spreadsheets
```

### Test 3 : Triggers fonctionnent

```bash
# Créer un artisan de test
INSERT INTO artisans (nom_prenom, email, numero_associe)
VALUES ('Test Artisan', 'test@example.com', '12345');

# Vérifier dans la queue
SELECT * FROM sync_queue ORDER BY created_at DESC LIMIT 5;

# Devrait afficher une ligne avec :
# - entity_type = 'artisan'
# - operation = 'create'
# - status = 'pending'
```

---

## 🐛 Dépannage

### Erreur : "Invalid redirect URI"

```bash
# Vérifier que le redirect_uri dans Google Cloud Console
# correspond exactement à celui dans .env.local

# Dans Google Cloud Console :
Authorized redirect URIs:
http://localhost:3000/api/google-sheets/auth/callback

# Dans .env.local :
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google-sheets/auth/callback"
```

### Erreur : "Insufficient Permission"

```bash
# Vérifier que les scopes sont corrects :
# - https://www.googleapis.com/auth/spreadsheets
# - https://www.googleapis.com/auth/drive.readonly

# Forcer une nouvelle connexion avec prompt='consent'
# pour obtenir les permissions à jour
```

### Erreur : "Refresh token is missing"

```bash
# Le refresh_token n'est fourni que lors de la première connexion
# avec prompt='consent'

# Solution :
# 1. Révoquer l'accès dans Google Account : https://myaccount.google.com/permissions
# 2. Se reconnecter dans le CRM
```

### Tokens expirés

```typescript
// Implémenter le refresh automatique
async function refreshTokenIfNeeded(config: GoogleSheetsConfig) {
  const now = Date.now();
  const expiresAt = new Date(config.google_token_expires_at).getTime();
  
  if (now >= expiresAt - 5 * 60 * 1000) { // 5 min avant expiration
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
      refresh_token: config.google_refresh_token
    });
    
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    // Mettre à jour en base
    await supabase
      .from('google_sheets_configs')
      .update({
        google_access_token: credentials.access_token,
        google_token_expires_at: new Date(credentials.expiry_date!).toISOString()
      })
      .eq('id', config.id);
    
    return credentials.access_token;
  }
  
  return config.google_access_token;
}
```

---

## 📚 Ressources

### Documentation officielle
- [Google Sheets API](https://developers.google.com/sheets/api/guides/concepts)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

### Exemples de code
- [Google Sheets Node.js Samples](https://github.com/googleworkspace/node-samples/tree/main/sheets)
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

---

## ✨ Prochaines fonctionnalités

Une fois la base fonctionnelle, vous pourrez ajouter :

1. **Auto-détection des colonnes** avec IA
2. **Prévisualisation en temps réel** des données
3. **Webhooks** pour sync instantanée
4. **Multi-spreadsheet** support
5. **Historique** et rollback
6. **Notifications** email/Slack
7. **Analytics** et reporting

---

**Temps total estimé** : 30 minutes pour la base + 10 semaines pour le système complet

Bon développement ! 🚀



