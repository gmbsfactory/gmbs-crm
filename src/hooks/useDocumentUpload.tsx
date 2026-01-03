"use client"

// ===== SYSTÈME D'UPLOAD DE DOCUMENTS =====
// Permet d'uploader des documents et de les référencer dans la base

import { useState, useCallback } from 'react';
import { documentsApi } from '@/lib/api/v2';

export interface DocumentUploaderInfo {
  id: string;
  displayName: string;
  code?: string | null;
  color?: string | null;
}

interface DocumentUploadHook {
  uploadDocument: (file: File, entityType: 'intervention' | 'artisan', entityId: string, kind: string, uploader?: DocumentUploaderInfo) => Promise<string | null>;
  loading: boolean;
  error: string | null;
  progress: number;
}

export function useDocumentUpload(): DocumentUploadHook {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const uploadDocument = useCallback(async (
    file: File, 
    entityType: 'intervention' | 'artisan', 
    entityId: string, 
    kind: string,
    uploader?: DocumentUploaderInfo
  ): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      setProgress(0);

      // Vérifier la taille du fichier (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Le fichier est trop volumineux (max 10MB)');
      }

      // Vérifier le type de fichier
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/heic',
        'image/heif',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'video/mp4'
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error('Type de fichier non supporté');
      }

      // Simuler le progrès
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result
          if (typeof result === "string") {
            const base64 = result.includes(",") ? result.split(",")[1] : result
            resolve(base64)
          } else {
            reject(new Error("Impossible de lire le fichier"))
          }
        }
        reader.onerror = () => reject(reader.error ?? new Error("Lecture du fichier échouée"))
        reader.readAsDataURL(file)
      })

      // Upload via l'API
      const result = await documentsApi.upload({
        entity_id: entityId,
        entity_type: entityType,
        kind,
        filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        content,
        created_by: uploader?.id,
        created_by_display: uploader?.displayName,
        created_by_code: uploader?.code ?? undefined,
        created_by_color: uploader?.color ?? undefined,
      })

      clearInterval(progressInterval);
      setProgress(100);

      return result.url;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'upload';
      setError(errorMessage);
      console.error('Erreur lors de l\'upload:', err);
      return null;
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  }, []);

  return {
    uploadDocument,
    loading,
    error,
    progress
  };
}

// ===== COMPOSANT D'UPLOAD =====
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, File, X, CheckCircle, Loader2 } from 'lucide-react';
import { useRef } from 'react';

interface DocumentUploaderProps {
  entityType: 'intervention' | 'artisan';
  entityId: string;
  onUploadComplete?: (url: string) => void;
}

const DOCUMENT_KINDS = {
  intervention: [
    { value: 'devis', label: 'Devis' },
    { value: 'photos', label: 'Photos' },
    { value: 'facturesGMBS', label: 'Facture GMBS' },
    { value: 'facturesArtisans', label: 'Facture Artisan' },
    { value: 'facturesMateriel', label: 'Facture Matériel' },
    { value: 'autre', label: 'Autre' }
  ],
  artisan: [
    { value: 'kbis', label: 'KBIS' },
    { value: 'assurance', label: 'Assurance' },
    { value: 'cni_recto_verso', label: 'CNI recto/verso' },
    { value: 'iban', label: 'IBAN' },
    { value: 'decharge_partenariat', label: 'Décharge partenariat' },
    { value: 'photo_profil', label: 'Photo de profil' },
    { value: 'autre', label: 'Autre' }
  ]
};

export function DocumentUploader({ entityType, entityId, onUploadComplete }: DocumentUploaderProps) {
  const { uploadDocument, loading, error, progress } = useDocumentUpload();
  const [selectedKind, setSelectedKind] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!uploadedFile || !selectedKind) return;

    const url = await uploadDocument(uploadedFile, entityType, entityId, selectedKind);
    if (url) {
      setUploadedFile(null);
      setSelectedKind('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadComplete?.(url);
    }
  }, [uploadedFile, selectedKind, entityType, entityId, uploadDocument, onUploadComplete]);

  const handleRemoveFile = useCallback(() => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Upload de document
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sélection du type de document */}
        <div className="space-y-2">
          <Label htmlFor="document-kind">Type de document</Label>
          <Select value={selectedKind} onValueChange={setSelectedKind}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner le type" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_KINDS[entityType].map((kind) => (
                <SelectItem key={kind.value} value={kind.value}>
                  {kind.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Sélection du fichier */}
        <div className="space-y-2">
          <Label htmlFor="file-input">Fichier</Label>
          <Input
            ref={fileInputRef}
            id="file-input"
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.zip,.mp4"
            disabled={loading}
          />
        </div>

        {/* Aperçu du fichier */}
        {uploadedFile && (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <File className="w-4 h-4" />
              <span className="text-sm">{uploadedFile.name}</span>
              <span className="text-xs text-gray-500">
                ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              disabled={loading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Bouton d'upload */}
        <Button
          onClick={handleUpload}
          disabled={!uploadedFile || !selectedKind || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Upload en cours... {progress}%
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Uploader
            </>
          )}
        </Button>

        {/* Barre de progression */}
        {loading && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Message d'erreur */}
        {error && (
          <div className="text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Message de succès */}
        {progress === 100 && !error && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle className="w-4 h-4" />
            Document uploadé avec succès !
          </div>
        )}
      </CardContent>
    </Card>
  );
}
