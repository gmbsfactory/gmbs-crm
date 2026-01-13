"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { documentsApi } from "@/lib/api/v2";
import {
  useDocumentUpload,
  type DocumentUploaderInfo,
} from "@/hooks/useDocumentUpload";
import {
  type EntityType,
  type ViewFilter,
  type KindDescriptor,
  type CurrentUser,
  type AttachmentRecord,
  type StagedFile,
  type DocumentRow,
  type PreviewState,
  type PreviewSize,
  DEFAULT_ACCEPT,
  DEFAULT_PREVIEW_SIZE,
  normalizeKind,
  toTimestamp,
} from "./types";

interface UseDocumentManagerOptions {
  entityType: EntityType;
  entityId: string;
  kinds: KindDescriptor[];
  accept?: string;
  multiple?: boolean;
  onChange?: () => void;
  currentUser?: CurrentUser;
}

export interface UseDocumentManagerReturn {
  // État
  documents: AttachmentRecord[];
  staged: Record<string, StagedFile[]>;
  isLoading: boolean;
  fetchError: string | null;
  rows: DocumentRow[];
  filteredRows: DocumentRow[];
  view: ViewFilter;
  hasStaged: boolean;
  
  // Upload state
  isQueueUploading: boolean;
  queueLength: number;
  completedInQueue: number;
  overallProgress: number;
  isUploading: boolean;
  uploadError: string | null;
  currentUploadProgress: number;
  
  // Delete state
  deleteInProgress: string | null;
  
  // Preview state
  preview: PreviewState;
  activePreviewId: string | null;
  previewSize: PreviewSize;
  
  // Rename state
  renamingRow: DocumentRow | null;
  renamingName: string;
  isRenaming: boolean;
  renameError: string | null;
  
  // Add row state
  isAddingRow: boolean;
  pendingKind: string;
  pendingFiles: File[];
  fileInputKey: number;
  
  // Allowed accept
  allowedAccept: string;
  
  // Métadonnées kinds
  kindMetadata: { original: string; normalized: string; label: string }[];
  kindLabelMap: Map<string, string>;
  
  // Setters
  setView: (view: ViewFilter) => void;
  setPreview: (state: PreviewState) => void;
  setActivePreviewId: (id: string | null) => void;
  setPreviewSize: (size: PreviewSize) => void;
  setRenamingRow: (row: DocumentRow | null) => void;
  setRenamingName: (name: string) => void;
  setRenameError: (error: string | null) => void;
  setIsAddingRow: (value: boolean) => void;
  setPendingKind: (kind: string) => void;
  setPendingFiles: (files: File[]) => void;
  setFileInputKey: (fn: (prev: number) => number) => void;
  
  // Actions
  fetchDocuments: () => Promise<void>;
  stageFiles: (kind: string, files: FileList | File[]) => void;
  clearStagedKind: (kind: string) => void;
  handleRemoveStaged: (kind: string, stagedId: string) => void;
  processUploadQueue: (kind: string, files: FileList | File[]) => Promise<void>;
  syncStagedDocuments: () => Promise<void>;
  handleDelete: (documentId: string) => Promise<void>;
  handleCopyLink: (url: string, filename: string, documentId: string) => Promise<void>;
  handleOpenInNewTab: (url: string) => void;
  labelForKind: (kind: string) => string;
  startRename: (row: DocumentRow) => void;
  cancelRename: () => void;
  saveRename: () => Promise<void>;
  renameStagedDocument: (kind: string, stagedId: string, newName: string) => void;
  handleStartAdd: () => void;
  handleCancelAdd: () => void;
  handlePendingFilesChange: (files: FileList | File[] | null) => void;
  handlePendingUpload: () => Promise<void>;
  startResize: (direction: "horizontal" | "vertical" | "both", event: React.PointerEvent<HTMLDivElement>) => void;
  getAcceptedFormatsText: (kind: string | null) => string;
  getAcceptAttribute: (kind: string | null) => string;
  
  // Références
  uploaderInfo: DocumentUploaderInfo | undefined;
  
  // Computed
  copiedLinkId: string | null;
}

export function useDocumentManager({
  entityType,
  entityId,
  kinds,
  accept,
  multiple = true,
  onChange,
  currentUser,
}: UseDocumentManagerOptions): UseDocumentManagerReturn {
  // Métadonnées kinds
  const kindMetadata = useMemo(
    () =>
      kinds.map(({ kind, label }) => ({
        original: kind,
        normalized: normalizeKind(kind),
        label,
      })),
    [kinds],
  );

  const kindLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    kindMetadata.forEach(({ normalized, label }) => {
      map.set(normalized, label);
    });
    return map;
  }, [kindMetadata]);

  const uploaderInfo: DocumentUploaderInfo | undefined = useMemo(() => {
    if (!currentUser) return undefined;
    return {
      id: currentUser.id,
      displayName: currentUser.displayName,
      code: currentUser.code ?? null,
      color: currentUser.color ?? null,
    };
  }, [currentUser]);

  // États
  const [documents, setDocuments] = useState<AttachmentRecord[]>([]);
  const [staged, setStaged] = useState<Record<string, StagedFile[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [allowedAccept, setAllowedAccept] = useState(accept ?? DEFAULT_ACCEPT);
  const [queueLength, setQueueLength] = useState(0);
  const [completedInQueue, setCompletedInQueue] = useState(0);
  const [isQueueUploading, setIsQueueUploading] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [view, setView] = useState<ViewFilter>("all");
  const [isAddingRow, setIsAddingRow] = useState(false);
  const [pendingKind, setPendingKind] = useState<string>("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [preview, setPreview] = useState<PreviewState>({ open: false });
  const [activePreviewId, setActivePreviewId] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<PreviewSize>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_PREVIEW_SIZE;
    }
    try {
      const stored = window.localStorage.getItem("documentPreviewSize");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed?.width === "number" && typeof parsed?.height === "number") {
          return { width: parsed.width, height: parsed.height };
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_PREVIEW_SIZE;
  });
  const [renamingRow, setRenamingRow] = useState<DocumentRow | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Refs
  const stagedRef = useRef<Record<string, StagedFile[]>>({});
  const previousEntityIdRef = useRef<string | null>(entityId || null);
  const previewSizeRef = useRef(previewSize);

  // Hook d'upload
  const {
    uploadDocument,
    progress: currentUploadProgress,
    loading: isUploading,
    error: uploadError,
  } = useDocumentUpload();

  // Computed
  const overallProgress = useMemo(() => {
    if (!isQueueUploading || queueLength === 0) return 0;
    const base = completedInQueue;
    const normalizedCurrent = currentUploadProgress / 100;
    const value = ((base + normalizedCurrent) / queueLength) * 100;
    return Math.min(100, Math.round(value));
  }, [isQueueUploading, queueLength, completedInQueue, currentUploadProgress]);

  const hasStaged = useMemo(
    () => Object.values(staged).some((entries) => entries.length > 0),
    [staged],
  );

  // Utilitaires
  const releaseObjectUrls = useCallback((items: StagedFile[]) => {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  // Sync refs
  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);

  useEffect(() => {
    previewSizeRef.current = previewSize;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("documentPreviewSize", JSON.stringify(previewSize));
      } catch {
        // ignore
      }
    }
  }, [previewSize]);

  // Cleanup
  useEffect(() => {
    return () => {
      Object.values(stagedRef.current).forEach((entries) => {
        releaseObjectUrls(entries);
      });
    };
  }, [releaseObjectUrls]);

  // Stage files
  const stageFiles = useCallback((kind: string, files: FileList | File[]) => {
    const normalizedKind = normalizeKind(kind);
    const stagedItems: StagedFile[] = Array.from(files).map((file) => ({
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      filename: file.name,
      mimeType: file.type,
      createdAt: new Date().toISOString(),
    }));

    setStaged((prev) => {
      const existing = prev[normalizedKind] ?? [];
      return {
        ...prev,
        [normalizedKind]: [...existing, ...stagedItems],
      };
    });
  }, []);

  const clearStagedKind = useCallback(
    (kind: string) => {
      const normalizedKind = normalizeKind(kind);
      setStaged((prev) => {
        const entries = prev[normalizedKind];
        if (!entries?.length) {
          return prev;
        }
        const next = { ...prev };
        releaseObjectUrls(entries);
        delete next[normalizedKind];
        return next;
      });
    },
    [releaseObjectUrls],
  );

  const handleRemoveStaged = useCallback(
    (kind: string, stagedId: string) => {
      const normalizedKind = normalizeKind(kind);
      setStaged((prev) => {
        const entries = prev[normalizedKind];
        if (!entries?.length) {
          return prev;
        }
        let removed: StagedFile | undefined;
        const remaining = entries.filter((entry) => {
          if (entry.id === stagedId) {
            removed = entry;
            return false;
          }
          return true;
        });

        if (removed) {
          releaseObjectUrls([removed]);
        }

        if (remaining.length === entries.length) {
          return prev;
        }

        const next = { ...prev };
        if (remaining.length) {
          next[normalizedKind] = remaining;
        } else {
          delete next[normalizedKind];
        }
        return next;
      });
    },
    [releaseObjectUrls],
  );

  // Fetch documents
  const fetchDocuments = useCallback(async () => {
    if (!entityId) {
      setDocuments([]);
      return;
    }
    setIsLoading(true);
    setFetchError(null);
    try {
      const response = await documentsApi.getAll({
        entity_type: entityType,
        entity_id: entityId,
      });
      const nextData = (response.data as AttachmentRecord[]) ?? [];
      setDocuments(nextData);
    } catch (error) {
      console.error("Erreur lors du chargement des documents:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de charger les documents.";
      setFetchError(message);
    } finally {
      setIsLoading(false);
    }
  }, [entityId, entityType]);

  // Load accept types
  useEffect(() => {
    if (accept) {
      setAllowedAccept(accept);
      return;
    }

    let isCancelled = false;
    documentsApi
      .getSupportedTypes()
      .then((data) => {
        if (isCancelled) return;
        if (data?.allowed_mime_types?.length) {
          setAllowedAccept(data.allowed_mime_types.join(","));
        } else {
          setAllowedAccept(DEFAULT_ACCEPT);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setAllowedAccept(DEFAULT_ACCEPT);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [accept]);

  // Fetch on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Reset queue state
  const resetQueueState = useCallback(() => {
    setQueueLength(0);
    setCompletedInQueue(0);
    setIsQueueUploading(false);
  }, []);

  // Process upload queue
  const processUploadQueue = useCallback(
    async (kind: string, files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (!fileArray.length || !entityId) return;

      const normalizedKind = normalizeKind(kind);

      // Validation MIME pour photo_profil
      if (normalizedKind === 'photo_profil') {
        const invalidFiles = fileArray.filter(
          file => !file.type.startsWith('image/')
        );
        if (invalidFiles.length > 0) {
          toast.error(
            `Les photos de profil doivent être des images. Fichiers rejetés: ${invalidFiles.map(f => f.name).join(', ')}`
          );
          return;
        }
      }

      setQueueLength(fileArray.length);
      setCompletedInQueue(0);
      setIsQueueUploading(true);

      try {
        for (const file of fileArray) {
          try {
            await uploadDocument(
              file,
              entityType,
              entityId,
              normalizedKind,
              uploaderInfo,
            );
            setCompletedInQueue((count) => count + 1);
          } catch (error) {
            console.error('Erreur lors de l\'upload:', error);
            toast.error(`Erreur lors de l'upload de ${file.name}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
          }
        }
        await fetchDocuments();
        onChange?.();
        toast.success(`${fileArray.length} document(s) importé(s) avec succès`);
      } catch (error) {
        console.error('Erreur lors du traitement de la file d\'upload:', error);
        toast.error('Erreur lors de l\'import des documents');
      } finally {
        resetQueueState();
      }
    },
    [
      uploadDocument,
      entityType,
      entityId,
      uploaderInfo,
      fetchDocuments,
      onChange,
      resetQueueState,
    ],
  );

  // Sync staged documents
  const syncStagedDocuments = useCallback(async () => {
    if (!entityId || !hasStaged) return;

    const stagedEntries = Object.entries(staged);
    for (const [kind, files] of stagedEntries) {
      if (!files.length) continue;
      try {
        await processUploadQueue(
          kind,
          files.map((f) => f.file),
        );
      } finally {
        clearStagedKind(kind);
      }
    }
  }, [entityId, hasStaged, staged, processUploadQueue, clearStagedKind]);

  // Auto sync when entityId becomes available
  useEffect(() => {
    const previousEntityId = previousEntityIdRef.current;
    if (!previousEntityId && entityId && hasStaged) {
      syncStagedDocuments();
    }
    previousEntityIdRef.current = entityId || null;
  }, [entityId, hasStaged, syncStagedDocuments]);

  // Build rows
  const rows = useMemo<DocumentRow[]>(() => {
    const persistedRows: DocumentRow[] = documents.map((doc) => ({
      id: doc.id,
      source: "persisted" as const,
      kind: normalizeKind(doc.kind),
      filename: doc.filename ?? "Document sans nom",
      mimeType: doc.mime_type ?? undefined,
      createdAt: doc.created_at ?? undefined,
      url: doc.url,
      fileSize: doc.file_size ?? null,
      createdByDisplay: doc.created_by_display ?? null,
      createdByCode: doc.created_by_code ?? null,
      createdByColor: doc.created_by_color ?? null,
      createdByAvatarUrl: doc.created_by_avatar_url ?? null,
      recordId: doc.id,
    }));

    const stagedRows: DocumentRow[] = Object.entries(staged).flatMap(
      ([kind, files]) =>
        files.map((file) => ({
          id: `staged-${file.id}`,
          source: "staged" as const,
          kind: normalizeKind(kind),
          filename: file.filename,
          mimeType: file.mimeType,
          createdAt: file.createdAt,
          url: file.previewUrl,
          fileSize: file.file.size,
          createdByDisplay:
            currentUser?.displayName ?? uploaderInfo?.displayName ?? null,
          createdByCode: currentUser?.code ?? uploaderInfo?.code ?? null,
          createdByColor: currentUser?.color ?? uploaderInfo?.color ?? null,
          createdByAvatarUrl: currentUser?.avatarUrl ?? null,
          stagedKind: kind,
          stagedId: file.id,
        })),
    );

    const combined = [...persistedRows, ...stagedRows];
    combined.sort((a, b) => {
      const diff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
      if (diff !== 0) return diff;
      if (a.source === b.source) return 0;
      return a.source === "staged" ? -1 : 1;
    });
    return combined;
  }, [documents, staged, currentUser, uploaderInfo]);

  const filteredRows = useMemo(() => {
    if (view === "all") return rows;
    return rows.filter((row) => {
      if (view === "devis") return row.kind === "devis";
      if (view === "photos") return row.kind === "photos";
      if (view === "factures") {
        const normalized = normalizeKind(row.kind);
        return normalized === "facturesGMBS" || normalized === "facturesArtisans" || normalized === "facturesMateriel";
      }
      return true;
    });
  }, [rows, view]);

  // Sync preview with rows
  useEffect(() => {
    if (activePreviewId && !rows.some((row) => row.id === activePreviewId)) {
      setPreview({ open: false });
      setActivePreviewId(null);
    }
  }, [rows, activePreviewId]);

  // Delete
  const handleDelete = useCallback(
    async (documentId: string) => {
      setDeleteInProgress(documentId);
      try {
        await documentsApi.delete(documentId, entityType);
        await fetchDocuments();
        onChange?.();
        toast.success('Document supprimé avec succès');
      } catch (error) {
        console.error("Erreur lors de la suppression du document:", error);
        toast.error(`Erreur lors de la suppression: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      } finally {
        setDeleteInProgress(null);
      }
    },
    [entityType, fetchDocuments, onChange],
  );

  // Copy link
  const handleCopyLink = useCallback(async (url: string, filename: string, documentId: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLinkId(documentId);
      setTimeout(() => {
        setCopiedLinkId(null);
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de la copie du lien:", error);
      toast.error("Impossible de copier le lien");
    }
  }, []);

  // Open in new tab
  const handleOpenInNewTab = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // Label for kind
  const labelForKind = useCallback(
    (kind: string) => kindLabelMap.get(normalizeKind(kind)) ?? kind,
    [kindLabelMap],
  );

  // Rename functions
  const renameStagedDocument = useCallback((kind: string, stagedId: string, newName: string) => {
    const normalizedKind = normalizeKind(kind);
    setStaged((prev) => {
      const entries = prev[normalizedKind];
      if (!entries?.length) return prev;
      const updated = entries.map((entry) => {
        if (entry.id !== stagedId) return entry;
        const renamedFile = new File([entry.file], newName, {
          type: entry.file.type,
          lastModified: entry.file.lastModified,
        });
        return {
          ...entry,
          file: renamedFile,
          filename: newName,
        };
      });
      return { ...prev, [normalizedKind]: updated };
    });
  }, []);

  const startRename = useCallback((row: DocumentRow) => {
    setRenamingRow(row);
    setRenamingName(row.filename);
    setRenameError(null);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingRow(null);
    setRenamingName("");
    setRenameError(null);
  }, []);

  const saveRename = useCallback(async () => {
    if (!renamingRow) return;
    const trimmed = renamingName.trim();
    if (!trimmed) {
      setRenameError("Le nom du fichier ne peut pas être vide.");
      return;
    }
    if (trimmed === renamingRow.filename) {
      cancelRename();
      return;
    }

    if (renamingRow.source === "staged" && renamingRow.stagedKind && renamingRow.stagedId) {
      renameStagedDocument(renamingRow.stagedKind, renamingRow.stagedId, trimmed);
      setPreview((current) => {
        if (!current.open || !current.row || current.row.id !== renamingRow.id) {
          return current;
        }
        return { open: true, row: { ...current.row, filename: trimmed } };
      });
      setRenamingRow(null);
      setRenamingName("");
      setRenameError(null);
      onChange?.();
      return;
    }

    if (renamingRow.source === "persisted" && renamingRow.recordId) {
      try {
        setIsRenaming(true);
        setRenameError(null);
        const updated = await documentsApi.update(
          renamingRow.recordId,
          { filename: trimmed },
          entityType,
        );
        setDocuments((prev) =>
          prev.map((doc) => (doc.id === updated.id ? (updated as AttachmentRecord) : doc)),
        );
        setPreview((current) => {
          if (!current.open || !current.row || current.row.id !== renamingRow.id) {
            return current;
          }
          return { open: true, row: { ...current.row, filename: trimmed } };
        });
        setRenamingRow(null);
        setRenamingName("");
        onChange?.();
      } catch (error) {
        console.error("Erreur lors du renommage du document:", error);
        setRenameError(
          error instanceof Error
            ? error.message
            : "Impossible de renommer le document.",
        );
        return;
      } finally {
        setIsRenaming(false);
      }
      return;
    }

    cancelRename();
  }, [renamingRow, renamingName, entityType, renameStagedDocument, onChange, cancelRename]);

  // Reset rename error
  useEffect(() => {
    if (!renamingRow) {
      setRenameError(null);
      setRenamingName("");
    }
  }, [renamingRow]);

  // Accept formats
  const getAcceptedFormatsText = useCallback((kind: string | null): string => {
    if (!kind) {
      return 'PDF, DOC, DOCX, JPG, PNG, XLS, XLSX';
    }
    const normalizedKind = normalizeKind(kind);
    if (normalizedKind === 'photo_profil') {
      return 'JPG, JPEG, PNG, WebP, GIF, AVIF';
    }
    return 'PDF, DOC, DOCX, JPG, PNG, XLS, XLSX';
  }, []);

  const getAcceptAttribute = useCallback((kind: string | null): string => {
    if (!kind) {
      return allowedAccept;
    }
    const normalizedKind = normalizeKind(kind);
    if (normalizedKind === 'photo_profil') {
      return 'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif';
    }
    return allowedAccept;
  }, [allowedAccept]);

  // Update allowedAccept when pendingKind changes
  useEffect(() => {
    if (pendingKind) {
      const normalizedKind = normalizeKind(pendingKind);
      if (normalizedKind === 'photo_profil') {
        setAllowedAccept('image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif');
      } else if (!accept) {
        setAllowedAccept(DEFAULT_ACCEPT);
      }
    } else if (!accept) {
      setAllowedAccept(DEFAULT_ACCEPT);
    }
  }, [pendingKind, accept]);

  // Add row handlers
  const handleStartAdd = useCallback(() => {
    if (isAddingRow) return;
    setPendingKind("");
    setPendingFiles([]);
    setIsAddingRow(true);
    setFileInputKey((value) => value + 1);
  }, [isAddingRow]);

  const handleCancelAdd = useCallback(() => {
    setIsAddingRow(false);
    setPendingKind("");
    setPendingFiles([]);
    setFileInputKey((value) => value + 1);
  }, []);

  const handlePendingFilesChange = useCallback(
    (files: FileList | File[] | null) => {
      const array = files ? Array.from(files) : [];
      setPendingFiles(array);
    },
    [],
  );

  const handlePendingUpload = useCallback(async () => {
    if (!pendingKind || pendingFiles.length === 0) return;

    if (!entityId) {
      stageFiles(pendingKind, pendingFiles);
      onChange?.();
      handleCancelAdd();
      return;
    }

    try {
      await processUploadQueue(pendingKind, pendingFiles);
      onChange?.();
    } finally {
      handleCancelAdd();
    }
  }, [
    entityId,
    onChange,
    pendingFiles,
    pendingKind,
    processUploadQueue,
    stageFiles,
    handleCancelAdd,
  ]);

  // Resize
  const startResize = useCallback(
    (direction: "horizontal" | "vertical" | "both", event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const pointerId = event.pointerId;
      event.currentTarget.setPointerCapture?.(pointerId);

      const startX = event.clientX;
      const startY = event.clientY;
      const initial = previewSizeRef.current;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        let nextWidth = initial.width;
        let nextHeight = initial.height;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        if (direction === "horizontal" || direction === "both") {
          nextWidth = Math.max(480, initial.width + deltaX);
        }
        if (direction === "vertical" || direction === "both") {
          nextHeight = Math.max(320, initial.height + deltaY);
        }

        setPreviewSize({ width: nextWidth, height: nextHeight });
      };

      const handlePointerUp = () => {
        event.currentTarget.releasePointerCapture?.(pointerId);
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [],
  );

  return {
    // État
    documents,
    staged,
    isLoading,
    fetchError,
    rows,
    filteredRows,
    view,
    hasStaged,
    
    // Upload state
    isQueueUploading,
    queueLength,
    completedInQueue,
    overallProgress,
    isUploading,
    uploadError,
    currentUploadProgress,
    
    // Delete state
    deleteInProgress,
    
    // Preview state
    preview,
    activePreviewId,
    previewSize,
    
    // Rename state
    renamingRow,
    renamingName,
    isRenaming,
    renameError,
    
    // Add row state
    isAddingRow,
    pendingKind,
    pendingFiles,
    fileInputKey,
    
    // Allowed accept
    allowedAccept,
    
    // Métadonnées kinds
    kindMetadata,
    kindLabelMap,
    
    // Setters
    setView,
    setPreview,
    setActivePreviewId,
    setPreviewSize,
    setRenamingRow,
    setRenamingName,
    setRenameError,
    setIsAddingRow,
    setPendingKind,
    setPendingFiles,
    setFileInputKey,
    
    // Actions
    fetchDocuments,
    stageFiles,
    clearStagedKind,
    handleRemoveStaged,
    processUploadQueue,
    syncStagedDocuments,
    handleDelete,
    handleCopyLink,
    handleOpenInNewTab,
    labelForKind,
    startRename,
    cancelRename,
    saveRename,
    renameStagedDocument,
    handleStartAdd,
    handleCancelAdd,
    handlePendingFilesChange,
    handlePendingUpload,
    startResize,
    getAcceptedFormatsText,
    getAcceptAttribute,
    
    // Références
    uploaderInfo,
    
    // Computed
    copiedLinkId,
  };
}
