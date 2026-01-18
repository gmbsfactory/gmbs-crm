# Spécification Complète : Système Photo-to-Report pour Artisans
## GMBS CRM - Module de Rapport d'Intervention

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture système](#architecture-système)
3. [Modèle de données](#modèle-de-données)
4. [API Endpoints](#api-endpoints)
5. [Interface artisan (Application mobile)](#interface-artisan-application-mobile)
6. [Interface CRM (Back-office)](#interface-crm-back-office)
7. [Workflow complet](#workflow-complet)
8. [Implémentation technique](#implémentation-technique)
9. [Sécurité](#sécurité)
10. [Tests et validation](#tests-et-validation)
11. [Roadmap de déploiement](#roadmap-de-déploiement)

---

## 🎯 Vue d'ensemble

### Objectif
Créer un système permettant aux artisans de documenter leurs interventions via une application mobile simple, en capturant des photos horodatées (avant/pendant/après) et en générant automatiquement un rapport d'intervention détaillé, visible en temps réel dans le CRM.

### Fonctionnalités principales

#### Pour l'artisan
- Accès via lien unique sécurisé (pas de compte à créer)
- Prise de photos avec horodatage automatique
- Catégorisation des photos (avant/pendant/après)
- Création de rapport via texte ou dictée vocale
- Upload automatique en temps réel
- Vision du contexte de l'intervention

#### Pour l'équipe CRM
- Suivi en temps réel de l'avancement
- Consultation des photos et rapports
- Export PDF du rapport complet
- Archivage automatique dans les documents
- Notifications en temps réel

### Bénéfices attendus
- ✅ Gain de temps : 70% de réduction du temps de rédaction
- ✅ Qualité : Documentation standardisée et complète
- ✅ Traçabilité : Horodatage certifié des photos
- ✅ Transparence : Visibilité totale pour le client final
- ✅ Professionnalisme : Rapports structurés et illustrés

---

## 🏗️ Architecture système

### Composants principaux

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION ARTISAN                       │
│                  (PWA Mobile-First)                          │
│  - Capture photos                                            │
│  - Dictée vocale / Texte                                     │
│  - Upload temps réel                                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTPS + JWT Token
                 │
┌────────────────▼────────────────────────────────────────────┐
│                      API GATEWAY                             │
│                  (/api/interventions)                        │
│  - Authentification par token                                │
│  - Rate limiting                                             │
│  - Validation des uploads                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼───┐   ┌───▼───┐   ┌───▼────┐
│Supabase│   │Storage│   │ Edge   │
│Database│   │Bucket │   │Function│
│        │   │       │   │(AI STT)│
└───┬────┘   └───┬───┘   └────────┘
    │            │
    └────────────┼─────────────────────┐
                 │                     │
┌────────────────▼─────────────────────▼─────────────────────┐
│                    CRM BACK-OFFICE                          │
│                  (Next.js Frontend)                         │
│  - Tableau de bord interventions                            │
│  - Visualisation photos/rapports                            │
│  - Export PDF                                               │
│  - Notifications temps réel                                 │
└─────────────────────────────────────────────────────────────┘
```

### Technologies utilisées

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| Frontend artisan | Next.js PWA | Progressive Web App, pas d'installation requise |
| Backend API | Next.js API Routes | Intégration native avec le CRM existant |
| Base de données | PostgreSQL (Supabase) | Infrastructure existante, relations complexes |
| Stockage fichiers | Supabase Storage | Bucket documents existant, CDN intégré |
| Horodatage photos | EXIF.js + Canvas | Manipulation côté client avant upload |
| Transcription vocale | Whisper API (OpenAI) | Précision supérieure, multilingue |
| Notifications | Supabase Realtime | Websockets pour temps réel |
| Authentification | JWT + Token unique | Sécurisé, pas de compte artisan requis |

---

## 💾 Modèle de données

### Nouvelles tables à créer

#### 1. `intervention_reports`
Stocke les métadonnées du rapport d'intervention

```sql
CREATE TABLE IF NOT EXISTS public.intervention_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL REFERENCES public.interventions(id) ON DELETE CASCADE,
  
  -- Identifiant artisan
  artisan_id UUID REFERENCES public.artisans(id) ON DELETE SET NULL,
  artisan_name TEXT, -- Nom au moment de la création
  
  -- Token d'accès sécurisé
  access_token TEXT UNIQUE NOT NULL, -- Hash SHA-256
  access_token_expires_at TIMESTAMPTZ,
  
  -- Statut du rapport
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',      -- En cours de rédaction
    'in_progress', -- Photos en cours d'upload
    'completed',  -- Rapport terminé
    'validated'   -- Validé par l'équipe
  )),
  
  -- Métadonnées temporelles
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES public.users(id),
  
  -- Contenu du rapport
  report_text TEXT, -- Rapport textuel
  report_voice_url TEXT, -- URL de l'enregistrement vocal
  report_voice_transcription TEXT, -- Transcription de la voix
  
  -- Statistiques
  total_photos INTEGER DEFAULT 0,
  photos_before INTEGER DEFAULT 0,
  photos_during INTEGER DEFAULT 0,
  photos_after INTEGER DEFAULT 0,
  
  -- Informations contextuelles
  location_latitude NUMERIC(9,6),
  location_longitude NUMERIC(9,6),
  location_accuracy NUMERIC(10,2), -- Précision GPS en mètres
  device_info JSONB, -- {"browser": "Chrome", "os": "Android", "version": "..."}
  
  -- Métadonnées
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_intervention_reports_intervention ON public.intervention_reports(intervention_id);
CREATE INDEX idx_intervention_reports_access_token ON public.intervention_reports(access_token);
CREATE INDEX idx_intervention_reports_status ON public.intervention_reports(status);
CREATE INDEX idx_intervention_reports_artisan ON public.intervention_reports(artisan_id);

-- Trigger pour updated_at
CREATE TRIGGER update_intervention_reports_updated_at
  BEFORE UPDATE ON public.intervention_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.intervention_reports IS 'Rapports d''intervention créés par les artisans via l''application mobile';
COMMENT ON COLUMN public.intervention_reports.access_token IS 'Token sécurisé pour accès sans authentification (hash SHA-256)';
COMMENT ON COLUMN public.intervention_reports.device_info IS 'Informations sur le device utilisé pour traçabilité';
```

#### 2. `intervention_report_photos`
Stocke les photos avec horodatage et métadonnées

```sql
CREATE TABLE IF NOT EXISTS public.intervention_report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.intervention_reports(id) ON DELETE CASCADE,
  
  -- Classification
  photo_type TEXT NOT NULL CHECK (photo_type IN ('before', 'during', 'after')),
  sequence_number INTEGER NOT NULL, -- Ordre de prise de vue
  
  -- Stockage
  storage_url TEXT NOT NULL, -- URL Supabase Storage
  thumbnail_url TEXT, -- Miniature générée
  mime_type TEXT NOT NULL,
  file_size INTEGER,
  
  -- Horodatage
  captured_at TIMESTAMPTZ NOT NULL, -- Date/heure de capture
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Métadonnées EXIF
  exif_data JSONB, -- Données EXIF complètes
  camera_make TEXT,
  camera_model TEXT,
  
  -- Géolocalisation
  latitude NUMERIC(9,6),
  longitude NUMERIC(9,6),
  altitude NUMERIC(10,2),
  location_accuracy NUMERIC(10,2),
  
  -- Horodatage visuel
  has_timestamp_overlay BOOLEAN DEFAULT true,
  timestamp_position TEXT DEFAULT 'bottom-right', -- Position du timecode
  
  -- Annotations optionnelles
  caption TEXT, -- Légende de la photo
  notes TEXT, -- Notes de l'artisan
  
  -- Hash pour déduplication
  content_hash TEXT UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_report_photos_report ON public.intervention_report_photos(report_id);
CREATE INDEX idx_report_photos_type ON public.intervention_report_photos(photo_type);
CREATE INDEX idx_report_photos_captured ON public.intervention_report_photos(captured_at);
CREATE INDEX idx_report_photos_hash ON public.intervention_report_photos(content_hash);

COMMENT ON TABLE public.intervention_report_photos IS 'Photos horodatées des interventions avec métadonnées complètes';
COMMENT ON COLUMN public.intervention_report_photos.content_hash IS 'Hash SHA-256 pour déduplication et intégrité';
COMMENT ON COLUMN public.intervention_report_photos.has_timestamp_overlay IS 'Indique si la photo a un overlay de date/heure brûlé';
```

#### 3. `intervention_report_activities`
Log des activités pour audit trail

```sql
CREATE TABLE IF NOT EXISTS public.intervention_report_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.intervention_reports(id) ON DELETE CASCADE,
  
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'report_created',
    'photo_uploaded',
    'photo_deleted',
    'report_text_updated',
    'voice_recorded',
    'voice_transcribed',
    'report_completed',
    'report_validated',
    'report_exported',
    'access_token_generated',
    'access_token_revoked'
  )),
  
  actor_type TEXT NOT NULL CHECK (actor_type IN ('artisan', 'user', 'system')),
  actor_id UUID, -- artisan_id ou user_id selon actor_type
  actor_name TEXT,
  
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_report_activities_report ON public.intervention_report_activities(report_id);
CREATE INDEX idx_report_activities_type ON public.intervention_report_activities(activity_type);
CREATE INDEX idx_report_activities_created ON public.intervention_report_activities(created_at);

COMMENT ON TABLE public.intervention_report_activities IS 'Audit trail de toutes les actions sur les rapports d''intervention';
```

### Modifications des tables existantes

#### Extension de `intervention_attachments`
Ajout de champs pour les photos de rapport

```sql
-- Ajouter colonne pour lier aux rapports
ALTER TABLE public.intervention_attachments 
ADD COLUMN IF NOT EXISTS report_photo_id UUID REFERENCES public.intervention_report_photos(id) ON DELETE SET NULL;

ALTER TABLE public.intervention_attachments
ADD COLUMN IF NOT EXISTS is_report_photo BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.intervention_attachments.report_photo_id IS 'Lien vers la photo du rapport si applicable';
COMMENT ON COLUMN public.intervention_attachments.is_report_photo IS 'Indique si c''est une photo de rapport d''intervention';
```

---

## 🔌 API Endpoints

### Architecture RESTful

Base URL : `/api/interventions/reports`

### 1. Génération du lien d'accès artisan

**POST** `/api/interventions/:id/reports/generate-link`

Génère un token unique et envoie le lien par SMS/Email à l'artisan

**Request:**
```json
{
  "artisan_id": "uuid",
  "send_via": "sms", // ou "email" ou "both"
  "expires_in_hours": 48 // Durée de validité
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report_id": "uuid",
    "access_token": "sha256_hash",
    "access_url": "https://gmbs.com/intervention/report/sha256_hash",
    "expires_at": "2025-01-18T12:00:00Z",
    "sent_via": ["sms", "email"]
  }
}
```

**Règles métier:**
- Token valide 48h par défaut (configurable)
- Un seul token actif par intervention
- Génération d'un nouveau token révoque l'ancien
- Envoi automatique SMS/Email via providers configurés

---

### 2. Accès au contexte d'intervention

**GET** `/api/interventions/reports/:token`

Récupère les détails de l'intervention pour l'artisan (sans authentification)

**Request Headers:**
```
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report_id": "uuid",
    "intervention": {
      "id": "uuid",
      "id_inter": "INT-2025-0001",
      "date": "2025-01-16T08:00:00Z",
      "adresse": "123 Rue de la Paix",
      "code_postal": "75001",
      "ville": "Paris",
      "contexte_intervention": "Réparation fuite d'eau",
      "consigne_intervention": "Sonnette à gauche, code: 1234",
      "metier": {
        "label": "Plomberie",
        "code": "PLOMB"
      },
      "is_vacant": false
    },
    "artisan": {
      "id": "uuid",
      "prenom": "Jean",
      "nom": "Dupont",
      "telephone": "+33612345678"
    },
    "report": {
      "status": "draft",
      "started_at": "2025-01-16T08:30:00Z",
      "total_photos": 0,
      "report_text": null
    },
    "permissions": {
      "can_upload_photos": true,
      "can_edit_report": true,
      "can_complete_report": true
    }
  }
}
```

---

### 3. Upload de photos

**POST** `/api/interventions/reports/:token/photos`

Upload une photo avec horodatage

**Request (multipart/form-data):**
```
photo: File (max 10MB)
photo_type: "before" | "during" | "after"
captured_at: ISO8601 timestamp
latitude: number (optional)
longitude: number (optional)
caption: string (optional)
exif_data: JSON string (optional)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "photo_id": "uuid",
    "storage_url": "https://...",
    "thumbnail_url": "https://...",
    "captured_at": "2025-01-16T08:45:00Z",
    "sequence_number": 1,
    "has_timestamp_overlay": true
  }
}
```

**Traitement côté serveur:**
1. Validation du token
2. Validation du fichier (type, taille)
3. Génération du hash SHA-256 (déduplication)
4. Extraction des données EXIF
5. Upload vers Supabase Storage
6. Génération de la miniature
7. Insertion en BDD
8. Notification temps réel au CRM
9. Mise à jour des compteurs du rapport

**Règles métier:**
- Max 50 photos par rapport
- Formats acceptés: JPEG, PNG, HEIC, WebP
- Taille max: 10MB par photo
- Compression automatique si > 5MB
- Déduplication par hash de contenu
- Horodatage brûlé dans l'image (watermark permanent)

---

### 4. Liste des photos

**GET** `/api/interventions/reports/:token/photos`

Récupère toutes les photos du rapport

**Query parameters:**
```
photo_type: "before" | "during" | "after" (optional)
page: number (default: 1)
limit: number (default: 50)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "photos": [
      {
        "id": "uuid",
        "photo_type": "before",
        "storage_url": "https://...",
        "thumbnail_url": "https://...",
        "captured_at": "2025-01-16T08:45:00Z",
        "sequence_number": 1,
        "caption": "Vue d'ensemble avant travaux",
        "latitude": 48.8566,
        "longitude": 2.3522,
        "mime_type": "image/jpeg",
        "file_size": 2048576
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 50,
      "total_pages": 1
    },
    "summary": {
      "photos_before": 5,
      "photos_during": 7,
      "photos_after": 3
    }
  }
}
```

---

### 5. Suppression de photo

**DELETE** `/api/interventions/reports/:token/photos/:photo_id`

Supprime une photo du rapport

**Response:**
```json
{
  "success": true,
  "message": "Photo supprimée avec succès"
}
```

**Règles métier:**
- Suppression physique du fichier sur Storage
- Suppression de l'enregistrement BDD
- Mise à jour des compteurs du rapport
- Log de l'activité
- Notification temps réel

---

### 6. Création/Mise à jour du rapport textuel

**PUT** `/api/interventions/reports/:token/report`

Sauvegarde le rapport textuel

**Request:**
```json
{
  "report_text": "Intervention réalisée avec succès...",
  "metadata": {
    "duration_minutes": 90,
    "materials_used": ["Tuyau PVC", "Collier de serrage"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report_id": "uuid",
    "report_text": "...",
    "updated_at": "2025-01-16T10:30:00Z"
  }
}
```

**Règles métier:**
- Autosave toutes les 5 secondes
- Versioning des modifications
- Max 10,000 caractères
- Support Markdown

---

### 7. Upload audio et transcription

**POST** `/api/interventions/reports/:token/voice`

Upload un enregistrement vocal pour transcription

**Request (multipart/form-data):**
```
audio: File (max 50MB)
format: "webm" | "mp3" | "wav" | "m4a"
duration_seconds: number
```

**Response:**
```json
{
  "success": true,
  "data": {
    "voice_url": "https://...",
    "transcription_status": "processing",
    "transcription_id": "uuid"
  }
}
```

**Traitement asynchrone:**
1. Upload vers Supabase Storage
2. Envoi à Whisper API (OpenAI)
3. Récupération de la transcription
4. Sauvegarde dans `report_voice_transcription`
5. Notification de complétion

**Webhook de callback:**
```
POST /api/interventions/reports/voice-callback
{
  "transcription_id": "uuid",
  "report_id": "uuid",
  "text": "Transcription complète...",
  "confidence": 0.95,
  "language": "fr"
}
```

---

### 8. Finalisation du rapport

**POST** `/api/interventions/reports/:token/complete`

Marque le rapport comme terminé

**Request:**
```json
{
  "final_notes": "Intervention terminée sans incident",
  "completion_location": {
    "latitude": 48.8566,
    "longitude": 2.3522
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report_id": "uuid",
    "status": "completed",
    "completed_at": "2025-01-16T11:00:00Z",
    "pdf_url": "https://..." // Généré automatiquement
  }
}
```

**Actions automatiques:**
1. Changement de statut → `completed`
2. Génération du PDF récapitulatif
3. Notification email à l'équipe CRM
4. Mise à jour du statut de l'intervention
5. Révocation du token d'accès
6. Archivage des documents

---

### 9. Endpoints CRM (authentifiés)

#### a. Liste des rapports

**GET** `/api/interventions/:id/reports`

**Response:**
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "uuid",
        "status": "completed",
        "artisan_name": "Jean Dupont",
        "started_at": "2025-01-16T08:30:00Z",
        "completed_at": "2025-01-16T11:00:00Z",
        "total_photos": 15,
        "has_voice_recording": true,
        "pdf_url": "https://..."
      }
    ]
  }
}
```

#### b. Détails d'un rapport

**GET** `/api/interventions/reports/:report_id`

Récupère le rapport complet avec toutes les photos et métadonnées

#### c. Validation d'un rapport

**POST** `/api/interventions/reports/:report_id/validate`

**Request:**
```json
{
  "validated_by": "user_id",
  "validation_notes": "Rapport conforme"
}
```

#### d. Export PDF

**GET** `/api/interventions/reports/:report_id/export-pdf`

Génère et télécharge un PDF du rapport complet

#### e. Régénération du lien

**POST** `/api/interventions/reports/:report_id/regenerate-link`

Génère un nouveau token (révoque l'ancien)

---

## 📱 Interface artisan (Application mobile)

### Architecture PWA

**Stack technique:**
- Next.js avec App Router
- PWA avec Service Worker
- Installation possible (Add to Home Screen)
- Fonctionnement offline partiel
- Géolocalisation native
- Accès caméra natif

### Pages et fonctionnalités

#### 1. Page d'accueil (via lien)
**Route:** `/intervention/report/:token`

**Composants:**
```tsx
// app/intervention/report/[token]/page.tsx
import { InterventionContext } from '@/components/report/InterventionContext'
import { PhotoCapture } from '@/components/report/PhotoCapture'
import { ReportEditor } from '@/components/report/ReportEditor'

export default async function ReportPage({ params }) {
  const { token } = params
  
  // Validation du token et récupération des données
  const reportData = await fetchReportData(token)
  
  if (!reportData) {
    return <InvalidTokenPage />
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <ReportHeader intervention={reportData.intervention} />
      
      <InterventionContext data={reportData.intervention} />
      
      <Tabs defaultValue="photos">
        <TabsList>
          <TabsTrigger value="photos">Photos</TabsTrigger>
          <TabsTrigger value="report">Rapport</TabsTrigger>
        </TabsList>
        
        <TabsContent value="photos">
          <PhotoCapture 
            token={token}
            reportId={reportData.report_id}
          />
        </TabsContent>
        
        <TabsContent value="report">
          <ReportEditor 
            token={token}
            reportId={reportData.report_id}
            initialText={reportData.report.report_text}
          />
        </TabsContent>
      </Tabs>
      
      <CompleteReportButton token={token} />
    </div>
  )
}
```

**Fonctionnalités:**
- Affichage du contexte de l'intervention
- Onglets : Photos / Rapport
- Bouton de finalisation
- Indicateur de progression

---

#### 2. Composant de capture photo

**Fonctionnalités clés:**

```tsx
// components/report/PhotoCapture.tsx
'use client'

import { useState, useRef } from 'react'
import { Camera } from 'lucide-react'
import { addTimestampToImage } from '@/lib/image-processing'

export function PhotoCapture({ token, reportId }) {
  const [photoType, setPhotoType] = useState<'before' | 'during' | 'after'>('before')
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handlePhotoCapture = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    
    setUploading(true)
    
    try {
      // 1. Lire l'image
      const imageBlob = await file.arrayBuffer()
      
      // 2. Ajouter l'horodatage
      const timestampedImage = await addTimestampToImage(
        imageBlob,
        new Date(),
        photoType
      )
      
      // 3. Extraire les données EXIF
      const exifData = await extractExifData(imageBlob)
      
      // 4. Obtenir la géolocalisation
      const location = await getCurrentLocation()
      
      // 5. Upload vers l'API
      const formData = new FormData()
      formData.append('photo', timestampedImage, `photo_${Date.now()}.jpg`)
      formData.append('photo_type', photoType)
      formData.append('captured_at', new Date().toISOString())
      formData.append('latitude', location.latitude.toString())
      formData.append('longitude', location.longitude.toString())
      formData.append('exif_data', JSON.stringify(exifData))
      
      const response = await fetch(`/api/interventions/reports/${token}/photos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      const result = await response.json()
      
      if (result.success) {
        setPhotos(prev => [...prev, result.data])
        toast.success('Photo uploadée avec succès')
      }
    } catch (error) {
      console.error('Erreur upload photo:', error)
      toast.error('Erreur lors de l\'upload')
    } finally {
      setUploading(false)
    }
  }
  
  return (
    <div className="space-y-4">
      {/* Sélecteur de type de photo */}
      <div className="flex gap-2">
        <Button 
          variant={photoType === 'before' ? 'default' : 'outline'}
          onClick={() => setPhotoType('before')}
        >
          Avant
        </Button>
        <Button 
          variant={photoType === 'during' ? 'default' : 'outline'}
          onClick={() => setPhotoType('during')}
        >
          Pendant
        </Button>
        <Button 
          variant={photoType === 'after' ? 'default' : 'outline'}
          onClick={() => setPhotoType('after')}
        >
          Après
        </Button>
      </div>
      
      {/* Bouton de capture */}
      <Button 
        size="lg" 
        className="w-full"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <Camera className="mr-2" />
        {uploading ? 'Upload en cours...' : 'Prendre une photo'}
      </Button>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoCapture}
      />
      
      {/* Galerie des photos */}
      <PhotoGallery photos={photos} onDelete={handleDeletePhoto} />
    </div>
  )
}
```

**Horodatage des photos:**

```tsx
// lib/image-processing.ts
export async function addTimestampToImage(
  imageBlob: ArrayBuffer,
  capturedAt: Date,
  photoType: 'before' | 'during' | 'after'
): Promise<Blob> {
  // 1. Créer un canvas
  const img = await loadImage(imageBlob)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  
  canvas.width = img.width
  canvas.height = img.height
  
  // 2. Dessiner l'image
  ctx.drawImage(img, 0, 0)
  
  // 3. Ajouter l'overlay de date/heure
  const timestamp = formatTimestamp(capturedAt)
  const typeLabel = getTypeLabel(photoType)
  
  // Background semi-transparent
  const padding = 10
  const fontSize = Math.max(24, canvas.width / 30)
  ctx.font = `bold ${fontSize}px Arial`
  const textWidth = ctx.measureText(`${type