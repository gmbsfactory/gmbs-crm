'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { documentsApi } from '@/lib/api';
import type { DocumentUploaderInfo } from '@/hooks/useDocumentUpload';
import {
  MAX_EMAIL_ATTACHMENTS,
  MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES,
  MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL,
  defaultUploadKind,
  formatFileSize,
  toEmailAttachmentOptions,
  totalAttachmentsSize,
  type EmailAttachmentOption,
  type RawInterventionAttachment,
} from '@/lib/interventions/email-attachments';

/**
 * Sélection des pièces jointes de l'e-mail artisan (lot L7, spec §5.6).
 *
 * Le gestionnaire ne joint plus des fichiers de son disque : il coche des lignes
 * d'`intervention_attachments`. C'est la seule façon que l'artisan retrouve DANS SON
 * APPLICATION exactement ce que l'e-mail lui a envoyé — l'application ne sait lire que la
 * base, pas le disque du gestionnaire.
 *
 * L'ajout d'un fichier du disque reste possible : il est d'abord déposé comme pièce de
 * l'intervention (même chemin que l'onglet Documents), puis coché comme les autres.
 */

/** Taille maximale d'un fichier déposé depuis le disque, alignée sur `useDocumentUpload`. */
const MAX_UPLOAD_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Le dépôt passe par `documentsApi.upload` et non par `useDocumentUpload` : ce dernier ne
 * renvoie que l'URL du fichier (`Promise<string | null>`) et avale les erreurs, alors qu'on a
 * besoin de l'IDENTIFIANT de la ligne créée pour la cocher aussitôt. `documentsApi.upload`
 * renvoie la ligne complète et laisse remonter l'erreur.
 */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result.includes(',') ? result.split(',')[1] : result);
      } else {
        reject(new Error('Impossible de lire le fichier'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Lecture du fichier échouée'));
    reader.readAsDataURL(file);
  });
}

export interface UseEmailAttachmentsOptions {
  interventionId: string;
  emailType: 'devis' | 'intervention';
  /** La modale est ouverte : inutile d'interroger l'API quand elle ne l'est pas. */
  isOpen: boolean;
  uploader?: DocumentUploaderInfo;
}

export interface UseEmailAttachmentsReturn {
  options: EmailAttachmentOption[];
  selectedIds: string[];
  selectedOptions: EmailAttachmentOption[];
  selectedSize: number;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
  uploadKind: string;
  setUploadKind: (kind: string) => void;
  canSelectMore: boolean;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  reload: () => Promise<void>;
  addFilesFromDisk: (files: FileList | File[]) => Promise<void>;
}

export function useEmailAttachments({
  interventionId,
  emailType,
  isOpen,
  uploader,
}: UseEmailAttachmentsOptions): UseEmailAttachmentsReturn {
  const [options, setOptions] = useState<EmailAttachmentOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadKind, setUploadKind] = useState<string>(() => defaultUploadKind(emailType));
  const wasOpenRef = useRef(false);

  const reload = useCallback(async () => {
    if (!interventionId) {
      setOptions([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await documentsApi.getAll({
        entity_type: 'intervention',
        entity_id: interventionId,
      });
      const rows = (response?.data ?? []) as RawInterventionAttachment[];
      setOptions(toEmailAttachmentOptions(rows));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(`Impossible de charger les pièces de l'intervention : ${message}`);
      setOptions([]);
    } finally {
      setIsLoading(false);
    }
  }, [interventionId]);

  // Chargement à l'ouverture, remise à zéro à la fermeture : la sélection ne doit pas
  // survivre d'un envoi à l'autre.
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      setSelectedIds([]);
      setUploadKind(defaultUploadKind(emailType));
      void reload();
    }
    if (!isOpen && wasOpenRef.current) {
      wasOpenRef.current = false;
    }
  }, [isOpen, emailType, reload]);

  const isSelected = useCallback((id: string) => selectedIds.includes(id), [selectedIds]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((previous) => {
      if (previous.includes(id)) {
        return previous.filter((value) => value !== id);
      }
      if (previous.length >= MAX_EMAIL_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_EMAIL_ATTACHMENTS} pièces jointes par e-mail`);
        return previous;
      }
      return [...previous, id];
    });
  }, []);

  const addFilesFromDisk = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      if (selectedIds.length + list.length > MAX_EMAIL_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_EMAIL_ATTACHMENTS} pièces jointes par e-mail`);
        return;
      }

      setIsUploading(true);
      const uploadedIds: string[] = [];
      try {
        for (const file of list) {
          if (file.size > MAX_UPLOAD_FILE_SIZE) {
            toast.error(
              `Le fichier « ${file.name} » dépasse ${formatFileSize(MAX_UPLOAD_FILE_SIZE)}`,
            );
            continue;
          }

          try {
            // Le fichier devient une pièce de l'intervention AVANT d'être joint : sans cette
            // ligne, l'artisan recevrait un document que son application ne connaît pas.
            const content = await readFileAsBase64(file);
            const created = await documentsApi.upload({
              entity_id: interventionId,
              entity_type: 'intervention',
              kind: uploadKind,
              filename: file.name,
              mime_type: file.type || 'application/octet-stream',
              file_size: file.size,
              content,
              created_by: uploader?.id,
              created_by_display: uploader?.displayName,
              created_by_code: uploader?.code ?? undefined,
              created_by_color: uploader?.color ?? undefined,
            });

            const createdId = extractAttachmentId(created);
            if (createdId) {
              uploadedIds.push(createdId);
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Erreur inconnue';
            toast.error(`Échec du dépôt de « ${file.name} » : ${message}`);
          }
        }

        await reload();

        if (uploadedIds.length > 0) {
          setSelectedIds((previous) => {
            const next = [...previous];
            for (const id of uploadedIds) {
              if (!next.includes(id) && next.length < MAX_EMAIL_ATTACHMENTS) {
                next.push(id);
              }
            }
            return next;
          });
          toast.success(
            uploadedIds.length > 1
              ? `${uploadedIds.length} pièces ajoutées à l'intervention et jointes`
              : "Pièce ajoutée à l'intervention et jointe à l'e-mail",
          );
        }
      } finally {
        setIsUploading(false);
      }
    },
    [interventionId, reload, selectedIds.length, uploadKind, uploader],
  );

  const selectedOptions = useMemo(
    () => selectedIds
      .map((id) => options.find((option) => option.id === id))
      .filter((option): option is EmailAttachmentOption => Boolean(option)),
    [options, selectedIds],
  );

  const selectedSize = useMemo(() => totalAttachmentsSize(selectedOptions), [selectedOptions]);

  return {
    options,
    selectedIds,
    selectedOptions,
    selectedSize,
    isLoading,
    isUploading,
    error,
    uploadKind,
    setUploadKind,
    canSelectMore: selectedIds.length < MAX_EMAIL_ATTACHMENTS,
    isSelected,
    toggle,
    reload,
    addFilesFromDisk,
  };
}

/**
 * Identifiant de la ligne créée. Tolérant : si l'API ne renvoie pas de ligne exploitable, la
 * pièce apparaît quand même dans la liste après rechargement — elle n'est simplement pas
 * cochée automatiquement.
 */
function extractAttachmentId(created: unknown): string | null {
  if (!created) return null;
  if (typeof created === 'string') return null;
  if (typeof created === 'object' && 'id' in created) {
    const id = (created as { id?: unknown }).id;
    return typeof id === 'string' && id.length > 0 ? id : null;
  }
  return null;
}

export { MAX_EMAIL_ATTACHMENTS, MAX_EMAIL_ATTACHMENTS_TOTAL_BYTES, MAX_EMAIL_ATTACHMENTS_TOTAL_LABEL };
