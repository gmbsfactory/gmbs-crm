"use client";

// ===== Types de base =====

export type EntityType = "intervention" | "artisan";
export type ViewFilter = "all" | "devis" | "factures" | "photos";
export type DocumentVariant = "legacy" | "docs_gmbs";

// ===== Interfaces =====

export interface KindDescriptor {
  kind: string;
  label: string;
}

export interface CurrentUser {
  id: string;
  displayName: string;
  code?: string | null;
  color?: string | null;
  avatarUrl?: string | null;
}

export interface AttachmentRecord {
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

export interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
  filename: string;
  mimeType: string;
  createdAt: string;
}

export interface DocumentRow {
  id: string;
  source: "placeholder" | "staged" | "persisted";
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

export type PreviewState =
  | { open: false; row?: undefined }
  | { open: true; row: DocumentRow };

export type PreviewSize = {
  width: number;
  height: number;
};

// ===== Props des composants =====

export interface DocumentManagerProps {
  entityType: EntityType;
  entityId: string;
  kinds: KindDescriptor[];
  accept?: string;
  multiple?: boolean;
  onChange?: () => void;
  currentUser?: CurrentUser;
  variant?: DocumentVariant;
}

// ===== Constantes partagées =====

export const DEFAULT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.zip,.mp4";
export const DEFAULT_PREVIEW_SIZE: PreviewSize = { width: 720, height: 520 };
export const MIN_PREVIEW_WIDTH = 480;
export const MIN_PREVIEW_HEIGHT = 320;

export const INVOICE_KINDS = new Set([
  "facturesGMBS",
  "facturesArtisans",
  "facturesMateriel",
]);

export const CANONICAL_KIND_MAP: Record<string, string> = {
  facturegmbs: "facturesGMBS",
  facturesgmbs: "facturesGMBS",
  factureartisan: "facturesArtisans",
  facturesartisan: "facturesArtisans",
  facturemateriel: "facturesMateriel",
  facturesmateriel: "facturesMateriel",
};

export const NEEDS_CLASSIFICATION_KINDS = new Set([
  "aclasser",
  "aclassifier",
  "àclasser",
  "àclassifier",
  "aclasse",
  "àclasse",
]);

export const LEGACY_AUTRE_KINDS = new Set([
  "rapportintervention",
  "plan",
  "schema",
  "intervention",
  "cout",
]);

// ===== Fonctions utilitaires partagées =====

export function normalizeKind(rawKind: string): string {
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

export function isInvoiceKind(kind: string): boolean {
  return INVOICE_KINDS.has(normalizeKind(kind));
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "Taille inconnue";
  const megabytes = bytes / (1024 * 1024);
  if (megabytes < 0.1) {
    const kilobytes = bytes / 1024;
    return `${kilobytes.toFixed(1)} KB`;
  }
  return `${megabytes.toFixed(1)} MB`;
}

export function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

export function formatTime(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function hexToRgba(hex: string, alpha: number): string | null {
  const clean = hex.trim().replace("#", "");
  if (clean.length !== 6) return null;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function computeBadgeStyle(color?: string | null) {
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

export function matchesView(row: DocumentRow, view: ViewFilter): boolean {
  if (view === "all") return true;
  if (view === "devis") return row.kind === "devis";
  if (view === "photos") return row.kind === "photos";
  if (view === "factures") return isInvoiceKind(row.kind);
  return true;
}

export function toTimestamp(value?: string): number {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}
