"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, Plus, Trash2, FilePlus, Pencil, Link, ExternalLink, Check } from "lucide-react";
import { toast } from "sonner";
import { documentsApi } from "@/lib/api/v2";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge";
import {
  useDocumentUpload,
  DocumentUploaderInfo,
} from "@/hooks/useDocumentUpload";

type EntityType = "intervention" | "artisan";
type ViewFilter = "all" | "devis" | "factures" | "photos";

interface KindDescriptor {
  kind: string;
  label: string;
}

interface CurrentUser {
  id: string;
  displayName: string;
  code?: string | null;
  color?: string | null;
  avatarUrl?: string | null;
}

interface DocumentManagerProps {
  entityType: EntityType;
  entityId: string;
  kinds: KindDescriptor[];
  accept?: string;
  multiple?: boolean;
  onChange?: () => void;
  currentUser?: CurrentUser;
}

interface AttachmentRecord {
  id: string;
  kind: string;
  url: string;
  filename?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  created_at?: string | null;
  created_by?: string | null;
  created_by_display?: string | null;
  created_by_code?: string | null;
  created_by_color?: string | null;
  created_by_avatar_url?: string | null;
  users?: {
    avatar_url?: string | null;
  } | null;
}

interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
  filename: string;
  mimeType: string;
  createdAt: string;
}

interface DocumentRow {
  id: string;
  source: "staged" | "persisted";
  kind: string;
  filename: string;
  mimeType?: string;
  createdAt?: string;
  url: string;
  fileSize?: number | null;
  createdByDisplay?: string | null;
  createdByCode?: string | null;
  createdByColor?: string | null;
  createdByAvatarUrl?: string | null;
  recordId?: string;
  stagedKind?: string;
  stagedId?: string;
}

type PreviewState =
  | { open: false; row?: undefined }
  | { open: true; row: DocumentRow };

const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.zip,.mp4";
const INVOICE_KINDS = new Set([
  "facturesGMBS",
  "facturesArtisans",
  "facturesMateriel",
]);
const CANONICAL_KIND_MAP: Record<string, string> = {
  facturegmbs: "facturesGMBS",
  facturesgmbs: "facturesGMBS",
  factureartisan: "facturesArtisans",
  facturesartisan: "facturesArtisans",
  facturemateriel: "facturesMateriel",
  facturesmateriel: "facturesMateriel",
};
const NEEDS_CLASSIFICATION_KINDS = new Set([
  "aclasser",
  "aclassifier",
  "àclasser",
  "àclassifier",
  "aclasse",
  "àclasse",
]);
const LEGACY_AUTRE_KINDS = new Set([
  "rapportintervention",
  "plan",
  "schema",
  "intervention",
  "cout",
]);

type PreviewSize = {
  width: number;
  height: number;
};

const DEFAULT_PREVIEW_SIZE: PreviewSize = { width: 720, height: 520 };
const MIN_PREVIEW_WIDTH = 480;
const MIN_PREVIEW_HEIGHT = 320;

function normalizeKind(rawKind: string): string {
  if (!rawKind) return rawKind;
  const trimmed = rawKind.trim();
  if (!trimmed) return rawKind;

  const lower = trimmed.toLowerCase();
  const compact = lower.replace(/[_\s-]/g, "");

  if (
    NEEDS_CLASSIFICATION_KINDS.has(compact) ||
    lower === "a classer" ||
    lower === "a classifier" ||
    lower === "à classer" ||
    lower === "à classifier"
  ) {
    return "a_classe";
  }

  if (CANONICAL_KIND_MAP[compact]) {
    return CANONICAL_KIND_MAP[compact];
  }

  if (LEGACY_AUTRE_KINDS.has(compact)) {
    return "autre";
  }

  return trimmed;
}

function isInvoiceKind(kind: string): boolean {
  return INVOICE_KINDS.has(normalizeKind(kind));
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "Taille inconnue";
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 0.1) {
    const kilobytes = bytes / 1024;
    return `${kilobytes.toFixed(1)} KB`;
  }
  return `${megabytes.toFixed(1)} MB`;
}

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

function formatTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function hexToRgba(hex: string, alpha: number): string | null {
  const clean = hex.trim().replace("#", "");
  if (clean.length !== 6) return null;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function computeBadgeStyle(color?: string | null) {
  if (!color) {
    return {
      backgroundColor: "#f1f5f9",
      color: "#0f172a",
      borderColor: "#e2e8f0",
    };
  }
  return {
    backgroundColor: hexToRgba(color, 0.28) ?? "#f1f5f9",
    color,
    borderColor: color,
  };
}

function ManagerBadge({
  code,
  displayName,
  color,
  avatarUrl,
  fallback,
}: {
  code?: string | null;
  displayName?: string | null;
  color?: string | null;
  avatarUrl?: string | null;
  fallback?: string;
} = {}) {
  // Extraire prénom et nom du displayName
  const nameParts = displayName?.split(" ") ?? [];
  const firstname = nameParts[0] || null;
  const lastname = nameParts.slice(1).join(" ") || null;

  // Si aucune info disponible, afficher un tiret
  if (!displayName && !code && !fallback) {
    return <span className="text-[9px] text-muted-foreground">—</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex">
          <GestionnaireBadge
            firstname={firstname}
            lastname={lastname}
            color={color}
            avatarUrl={avatarUrl}
            size="sm"
            showBorder={true}
            className="h-6 w-6"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">
        {displayName || code || fallback || "Inconnu"}
      </TooltipContent>
    </Tooltip>
  );
}

function matchesView(row: DocumentRow, view: ViewFilter): boolean {
  if (view === "all") return true;
  if (view === "devis") return row.kind === "devis";
  if (view === "photos") return row.kind === "photos";
  if (view === "factures") return isInvoiceKind(row.kind);
  return true;
}

function toTimestamp(value?: string): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function DocumentManager({
  entityType,
  entityId,
  kinds,
  accept,
  multiple = true,
  onChange,
  currentUser,
}: DocumentManagerProps) {
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
    } catch (error) {
      console.warn("[DocumentManager] Failed to parse stored preview size", error);
    }
    return DEFAULT_PREVIEW_SIZE;
  });
  const previewSizeRef = useRef(previewSize);
  const [renamingRow, setRenamingRow] = useState<DocumentRow | null>(null);
  const [renamingName, setRenamingName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const stagedRef = useRef<Record<string, StagedFile[]>>({});
  const previousEntityIdRef = useRef<string | null>(entityId || null);

  const {
    uploadDocument,
    progress: currentUploadProgress,
    loading: isUploading,
    error: uploadError,
  } = useDocumentUpload();

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

  const releaseObjectUrls = useCallback((items: StagedFile[]) => {
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);

  useEffect(() => {
    previewSizeRef.current = previewSize;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("documentPreviewSize", JSON.stringify(previewSize));
      } catch (error) {
        console.warn("[DocumentManager] Unable to persist preview size", error);
      }
    }
  }, [previewSize]);

  useEffect(() => {
    return () => {
      Object.values(stagedRef.current).forEach((entries) => {
        releaseObjectUrls(entries);
      });
    };
  }, [releaseObjectUrls]);

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
      
      // Debug: vérifier la structure des données
      if (nextData.length > 0 && process.env.NODE_ENV === 'development') {
        console.log('[DocumentManager] Sample document data:', {
          id: nextData[0].id,
          created_by_avatar_url: nextData[0].created_by_avatar_url,
          users: nextData[0].users,
        });
      }
      
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
      .catch((error) => {
        console.warn(
          "Impossible de récupérer les types de documents supportés:",
          error,
        );
        if (!isCancelled) {
          setAllowedAccept(DEFAULT_ACCEPT);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [accept]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const resetQueueState = useCallback(() => {
    setQueueLength(0);
    setCompletedInQueue(0);
    setIsQueueUploading(false);
  }, []);

  const processUploadQueue = useCallback(
    async (kind: string, files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (!fileArray.length || !entityId) return;

      const normalizedKind = normalizeKind(kind);

      // Validation MIME pour photo_profil (images uniquement)
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

  const syncStagedDocuments = useCallback(async () => {
    if (!entityId || !hasStaged) return;

    const stagedEntries = Object.entries(staged);
    for (const [kind, files] of stagedEntries) {
      if (!files.length) continue;
      try {
        await processUploadQueue(
          kind,
          files.map((file) => file.file),
        );
      } finally {
        clearStagedKind(kind);
      }
    }
  }, [entityId, hasStaged, staged, processUploadQueue, clearStagedKind]);

  useEffect(() => {
    const previousEntityId = previousEntityIdRef.current;
    if (!previousEntityId && entityId && hasStaged) {
      syncStagedDocuments();
    }
    previousEntityIdRef.current = entityId || null;
  }, [entityId, hasStaged, syncStagedDocuments]);

  const rows = useMemo<DocumentRow[]>(() => {
    const persistedRows: DocumentRow[] = documents.map((document) => ({
      id: document.id,
      source: "persisted",
      kind: normalizeKind(document.kind),
      filename: document.filename ?? "Document sans nom",
      mimeType: document.mime_type ?? undefined,
      createdAt: document.created_at ?? undefined,
      url: document.url,
      fileSize: document.file_size ?? null,
      createdByDisplay: document.created_by_display ?? null,
      createdByCode: document.created_by_code ?? null,
      createdByColor: document.created_by_color ?? null,
      createdByAvatarUrl: document.created_by_avatar_url ?? null,
      recordId: document.id,
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

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesView(row, view)),
    [rows, view],
  );

  useEffect(() => {
    if (activePreviewId && !rows.some((row) => row.id === activePreviewId)) {
      setPreview({ open: false });
      setActivePreviewId(null);
    }
  }, [rows, activePreviewId]);

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

  const handleCopyLink = useCallback(async (url: string, filename: string, documentId: string) => {
    try {
      // Utiliser l'API Clipboard si disponible, sinon fallback avec textarea
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback pour les navigateurs sans support clipboard API
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
      console.log(`✅ Lien copié : ${filename}`);
      // Reset après 2 secondes
      setTimeout(() => {
        setCopiedLinkId(null);
      }, 2000);
    } catch (error) {
      console.error("Erreur lors de la copie du lien:", error);
      alert("Impossible de copier le lien");
    }
  }, []);

  const handleOpenInNewTab = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const labelForKind = useCallback(
    (kind: string) => kindLabelMap.get(normalizeKind(kind)) ?? kind,
    [kindLabelMap],
  );

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
    } else {
      cancelRename();
      return;
    }

    cancelRename();
  }, [renamingRow, renamingName, entityType, renameStagedDocument, onChange, cancelRename]);

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
          nextWidth = Math.max(MIN_PREVIEW_WIDTH, initial.width + deltaX);
        }
        if (direction === "vertical" || direction === "both") {
          nextHeight = Math.max(MIN_PREVIEW_HEIGHT, initial.height + deltaY);
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

  useEffect(() => {
    if (!renamingRow) {
      setRenameError(null);
      setRenamingName("");
    }
  }, [renamingRow]);

  // Formats d'image acceptés pour les photos de profil
  const PHOTO_PROFIL_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ];

  // Obtenir le texte des formats acceptés selon le kind sélectionné
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

  // Obtenir la valeur de l'attribut accept selon le kind sélectionné
  const getAcceptAttribute = useCallback((kind: string | null): string => {
    if (!kind) {
      return allowedAccept;
    }

    const normalizedKind = normalizeKind(kind);
    if (normalizedKind === 'photo_profil') {
      // Formats d'image uniquement pour photo_profil
      return 'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif';
    }

    return allowedAccept;
  }, [allowedAccept]);

  // Mettre à jour allowedAccept quand pendingKind change
  useEffect(() => {
    if (pendingKind) {
      const normalizedKind = normalizeKind(pendingKind);
      if (normalizedKind === 'photo_profil') {
        setAllowedAccept('image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif');
      } else {
        // Réinitialiser aux valeurs par défaut si accept n'est pas fourni
        if (!accept) {
          setAllowedAccept(DEFAULT_ACCEPT);
        }
      }
    } else {
      // Réinitialiser aux valeurs par défaut si aucun kind n'est sélectionné
      if (!accept) {
        setAllowedAccept(DEFAULT_ACCEPT);
      }
    }
  }, [pendingKind, accept]);

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

  const showViewFilters = entityType === "intervention";
  const controlsClassName = showViewFilters
    ? "flex flex-row items-center justify-between gap-1.5 flex-wrap"
    : "flex flex-row items-center justify-end gap-1.5 flex-wrap";

  return (
    <TooltipProvider>
    <div className="space-y-2 min-w-0 overflow-hidden">
      {(uploadError || fetchError) && (
        <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
          {uploadError ?? fetchError}
        </div>
      )}

      {isQueueUploading && (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Upload ({completedInQueue}/{queueLength})
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      <div className={controlsClassName}>
        {showViewFilters ? (
          <Tabs
            value={view}
            onValueChange={(value) => setView(value as ViewFilter)}
            className="w-full sm:w-auto shrink-0"
          >
            <TabsList className="h-7 grid w-full grid-cols-4 sm:w-auto">
              <TabsTrigger value="all" className="text-[10px] px-1.5 h-6">Toutes</TabsTrigger>
              <TabsTrigger value="devis" className="text-[10px] px-1.5 h-6">Devis</TabsTrigger>
              <TabsTrigger value="factures" className="text-[10px] px-1.5 h-6">Factures</TabsTrigger>
              <TabsTrigger value="photos" className="text-[10px] px-1.5 h-6">Photos</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : null}
        <Button
          type="button"
          onClick={handleStartAdd}
          className="inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap text-[10px] h-7 px-2"
          disabled={isAddingRow}
        >
          <Plus className="h-3 w-3" />
          Ajouter
        </Button>
      </div>

      <div className="overflow-x-auto rounded border">
        <Table className="min-w-[400px]">
          <TableHeader>
            <TableRow className="h-7">
              <TableHead className="min-w-[100px] text-[10px] py-1 px-2">Nom</TableHead>
              <TableHead className="min-w-[60px] text-[10px] py-1 px-2">Type</TableHead>
              <TableHead className="min-w-[70px] text-[10px] py-1 px-2">Date</TableHead>
              <TableHead className="min-w-[50px] text-[10px] py-1 px-2">Gest.</TableHead>
              <TableHead className="min-w-[80px] text-[10px] py-1 px-2 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-3 text-center text-[10px]">
                  <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Chargement...
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 && !isAddingRow ? (
              <TableRow>
                <TableCell colSpan={5} className="py-3 text-center text-[10px] text-muted-foreground">
                  Aucun document
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => {
                const isPreviewing = preview.open && preview.row?.id === row.id;
                const previewRow = isPreviewing && preview.row ? preview.row : null;

                return (
                  <TableRow key={row.id} className="h-auto">
                    <TableCell className="py-1 px-2">
                      {renamingRow?.id === row.id ? (
                        <div className="space-y-1">
                          <Input
                            value={renamingName}
                            onChange={(event) => setRenamingName(event.target.value)}
                            autoFocus
                            disabled={isRenaming}
                            className="h-6 text-[10px]"
                          />
                          {renameError && (
                            <p className="text-[9px] text-destructive">{renameError}</p>
                          )}
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              size="sm"
                              onClick={saveRename}
                              disabled={isRenaming || renamingName.trim().length === 0}
                              className="h-5 text-[9px] px-1.5"
                            >
                              OK
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={cancelRename}
                              disabled={isRenaming}
                              className="h-5 text-[9px] px-1.5"
                            >
                              ✕
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <div 
                              className="text-[10px] font-medium leading-tight line-clamp-2" 
                              title={row.filename}
                            >
                              {row.filename}
                            </div>
                            <div className="text-[9px] text-muted-foreground">
                              {formatFileSize(row.fileSize)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => startRename(row)}
                            aria-label={`Renommer ${row.filename}`}
                            className="h-5 w-5 shrink-0"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      {normalizeKind(row.kind) === 'a_classe' ? (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          À classer
                        </Badge>
                      ) : (
                        <span className="text-[10px]">{labelForKind(row.kind)}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <div className="text-[9px] text-muted-foreground leading-tight">
                        <div>{formatDate(row.createdAt) ?? "—"}</div>
                        <div className="font-medium text-slate-700">
                          {formatTime(row.createdAt) ?? "—"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <ManagerBadge
                        code={row.createdByCode}
                        displayName={row.createdByDisplay}
                        color={row.createdByColor}
                        avatarUrl={row.createdByAvatarUrl}
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2">
                      <div className="flex justify-end gap-0">
                      <Tooltip>
                      <Popover
                        open={isPreviewing}
                        onOpenChange={(open) => {
                          if (!open) {
                            setPreview({ open: false });
                            setActivePreviewId(null);
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPreview({ open: true, row });
                              setActivePreviewId(row.id);
                            }}
                            aria-label={`Aperçu – ${row.filename}`}
                            className="h-6 w-6 p-0"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          </TooltipTrigger>
                        </PopoverTrigger>
                        <TooltipContent side="top" className="text-[10px]">Aperçu</TooltipContent>
                        {previewRow ? (
                          <PopoverContent className="w-auto p-1.5" side="left" align="center">
                            <div
                              className="relative flex flex-col overflow-hidden rounded border bg-background"
                              style={{ width: `${previewSize.width}px`, height: `${previewSize.height}px` }}
                              onDoubleClick={(event) => event.stopPropagation()}
                            >
                              <div className="flex-none px-3 pt-2">
                                <h4 className="text-xs font-semibold truncate">{previewRow.filename}</h4>
                                <p className="text-[10px] text-muted-foreground">
                                  {labelForKind(previewRow.kind)} • {formatDate(previewRow.createdAt) ?? "—"}
                                </p>
                              </div>
                              <div className="flex-1 overflow-hidden px-3 pb-2 pt-1">
                                <DocumentPreview
                                  url={previewRow.url}
                                  mimeType={previewRow.mimeType}
                                  filename={previewRow.filename}
                                  className="flex h-full w-full items-stretch justify-center overflow-hidden rounded border bg-muted/40"
                                />
                              </div>
                              <div
                                className="absolute right-0 top-1/2 h-10 w-2 -translate-y-1/2 cursor-ew-resize rounded-l bg-transparent"
                                onPointerDown={(event) => startResize("horizontal", event)}
                              />
                              <div
                                className="absolute bottom-0 left-1/2 h-2 w-10 -translate-x-1/2 cursor-ns-resize rounded-t bg-transparent"
                                onPointerDown={(event) => startResize("vertical", event)}
                              />
                              <div
                                className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-tl bg-transparent"
                                onPointerDown={(event) => startResize("both", event)}
                              />
                            </div>
                          </PopoverContent>
                        ) : null}
                      </Popover>
                      </Tooltip>
                      
                      {/* Copier le lien */}
                      {row.source !== "staged" && (
                        <Tooltip>
                        <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyLink(row.url, row.filename, row.id)}
                          aria-label="Copier le lien"
                          className={`h-6 w-6 p-0 ${copiedLinkId === row.id ? "text-green-600" : ""}`}
                        >
                          {copiedLinkId === row.id ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Link className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">
                          {copiedLinkId === row.id ? "Copié !" : "Lien"}
                        </TooltipContent>
                        </Tooltip>
                      )}
                      
                      {/* Ouvrir dans un nouvel onglet */}
                      {row.source !== "staged" && (
                        <Tooltip>
                        <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenInNewTab(row.url)}
                          aria-label="Ouvrir dans un nouvel onglet"
                          className="h-6 w-6 p-0"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">Ouvrir</TooltipContent>
                        </Tooltip>
                      )}
                      
                      {/* Supprimer */}
                      <Tooltip>
                      {row.source === "staged" ? (
                          <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              row.stagedKind &&
                              row.stagedId &&
                              handleRemoveStaged(row.stagedKind, row.stagedId)
                            }
                            aria-label="Retirer le document en attente"
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          </TooltipTrigger>
                        ) : (
                          <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => row.recordId && handleDelete(row.recordId)}
                            disabled={deleteInProgress === row.recordId}
                            aria-label="Supprimer le document"
                            className="h-6 w-6 p-0"
                          >
                            {deleteInProgress === row.recordId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          </TooltipTrigger>
                        )}
                      <TooltipContent side="top" className="text-[10px]">Supprimer</TooltipContent>
                      </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
            {isAddingRow && (
              <TableRow className="bg-muted/30">
                <TableCell className="py-1 px-2">
                  <div
                    className="group relative flex min-h-[50px] w-full cursor-pointer flex-col items-center justify-center rounded border border-dashed border-muted-foreground/40 bg-muted/40 p-1.5 text-center"
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handlePendingFilesChange(event.dataTransfer.files);
                    }}
                  >
                    <input
                      key={fileInputKey}
                      type="file"
                      multiple={multiple}
                      accept={getAcceptAttribute(pendingKind)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      onChange={(event) => handlePendingFilesChange(event.target.files)}
                    />
                    <div className="flex items-center gap-1.5">
                      <FilePlus className="h-4 w-4 text-primary shrink-0" />
                      <div className="text-[9px] text-muted-foreground text-left">
                        <p className="text-[10px] font-medium text-foreground">Glissez/cliquez</p>
                        <p className="truncate max-w-[80px]">{getAcceptedFormatsText(pendingKind)}</p>
                      </div>
                    </div>
                  </div>
                  {pendingFiles.length > 0 && (
                    <ul className="mt-0.5 space-y-0 text-[9px] text-muted-foreground max-h-[28px] overflow-y-auto">
                      {pendingFiles.map((file) => (
                        <li key={file.name} className="truncate">• {file.name}</li>
                      ))}
                    </ul>
                  )}
                </TableCell>
                <TableCell className="py-1 px-2 align-top">
                  <Select value={pendingKind} onValueChange={setPendingKind}>
                    <SelectTrigger className="h-6 text-[10px] min-w-[60px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {kindMetadata.map(({ original, label, normalized }) => (
                        <SelectItem key={normalized} value={original} className="text-[10px]">
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="py-1 px-2 align-top">
                  <div className="text-[9px] text-muted-foreground">—</div>
                </TableCell>
                <TableCell className="py-1 px-2 align-top">
                  <ManagerBadge
                    code={currentUser?.code ?? uploaderInfo?.code ?? null}
                    displayName={currentUser?.displayName ?? uploaderInfo?.displayName ?? null}
                    color={currentUser?.color ?? uploaderInfo?.color ?? null}
                    avatarUrl={currentUser?.avatarUrl ?? null}
                  />
                </TableCell>
                <TableCell className="py-1 px-2 align-top">
                  <div className="flex flex-col gap-0.5">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handlePendingUpload}
                      disabled={!pendingKind || pendingFiles.length === 0}
                      className="text-[9px] h-5 px-1.5 whitespace-nowrap"
                    >
                      Importer
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelAdd}
                      className="text-[9px] h-5 px-1.5 whitespace-nowrap"
                    >
                      Annuler
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

    </div>
    </TooltipProvider>
  );
}
