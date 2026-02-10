"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Eye, Loader2, Plus, Trash2, FilePlus, Pencil, Link, ExternalLink, Check, Upload } from "lucide-react";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ManagerBadge } from "@/components/documents/ManagerBadge";
import { useDocumentManager } from "@/components/documents/useDocumentManager";
import {
  type DocumentManagerProps,
  type DocumentRow,
  normalizeKind,
  formatFileSize,
  formatDate,
  formatTime,
} from "@/components/documents/types";

// Interface pour une ligne de kind pré-défini
interface KindRowData {
  kind: string;
  label: string;
  documents: DocumentRow[];
}

export function DocumentManagerGmbs({
  entityType,
  entityId,
  kinds,
  accept,
  multiple = true,
  onChange,
  currentUser,
}: Omit<DocumentManagerProps, "variant">) {
  const manager = useDocumentManager({
    entityType,
    entityId,
    kinds,
    accept,
    multiple,
    onChange,
    currentUser,
  });

  // État pour les lignes supplémentaires (ajoutées manuellement)
  const [additionalRows, setAdditionalRows] = useState<{
    id: string;
    pendingKind: string;
    pendingFiles: File[];
  }[]>([]);

  // Grouper les documents par kind
  const documentsByKind = useMemo(() => {
    const grouped = new Map<string, DocumentRow[]>();
    
    // Initialiser avec tous les kinds
    kinds.forEach(({ kind }) => {
      const normalized = normalizeKind(kind);
      grouped.set(normalized, []);
    });
    
    // Ajouter les documents existants
    manager.rows.forEach((row) => {
      const normalized = normalizeKind(row.kind);
      const existing = grouped.get(normalized) ?? [];
      grouped.set(normalized, [...existing, row]);
    });
    
    return grouped;
  }, [kinds, manager.rows]);

  // Construire les données des lignes de kinds
  const kindRows: KindRowData[] = useMemo(() => {
    return kinds.map(({ kind, label }) => {
      const normalized = normalizeKind(kind);
      return {
        kind: normalized,
        label,
        documents: documentsByKind.get(normalized) ?? [],
      };
    });
  }, [kinds, documentsByKind]);

  // Gérer l'ajout d'une ligne supplémentaire
  const handleAddRow = useCallback(() => {
    const newId = crypto.randomUUID();
    setAdditionalRows((prev) => [...prev, { id: newId, pendingKind: "", pendingFiles: [] }]);
  }, []);

  // Supprimer une ligne supplémentaire
  const handleRemoveAdditionalRow = useCallback((id: string) => {
    setAdditionalRows((prev) => prev.filter((row) => row.id !== id));
  }, []);

  // Mettre à jour le kind d'une ligne supplémentaire
  const handleAdditionalKindChange = useCallback((id: string, kind: string) => {
    setAdditionalRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, pendingKind: kind } : row))
    );
  }, []);

  // Mettre à jour les fichiers d'une ligne supplémentaire
  const handleAdditionalFilesChange = useCallback((id: string, files: File[]) => {
    setAdditionalRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, pendingFiles: files } : row))
    );
  }, []);

  // Upload direct pour une ligne supplémentaire (quand kind et fichiers sont sélectionnés)
  const handleAdditionalUpload = useCallback(async (id: string, kind: string, files: File[]) => {
    if (!kind || files.length === 0 || !entityId) return;
    
    await manager.processUploadQueue(kind, files);
    handleRemoveAdditionalRow(id);
  }, [entityId, manager, handleRemoveAdditionalRow]);

  return (
    <TooltipProvider>
      <div className="space-y-2 min-w-0 overflow-hidden">
        {(manager.uploadError || manager.fetchError) && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
            {manager.uploadError ?? manager.fetchError}
          </div>
        )}

        {manager.isQueueUploading && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Upload ({manager.completedInQueue}/{manager.queueLength})
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${manager.overallProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-row items-center justify-end gap-1.5 flex-wrap">
          <Button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap text-xs h-7 px-2"
          >
            <Plus className="h-3 w-3" />
            Ajouter
          </Button>
        </div>

        <div className="overflow-x-auto rounded border">
          <Table className="min-w-[400px]">
            <TableHeader>
              <TableRow className="h-7">
                <TableHead className="min-w-[100px] text-xs py-1 px-2">Nom</TableHead>
                <TableHead className="min-w-[60px] text-xs py-1 px-2">Type</TableHead>
                <TableHead className="min-w-[70px] text-xs py-1 px-2">Date</TableHead>
                <TableHead className="min-w-[50px] text-xs py-1 px-2">Gest.</TableHead>
                <TableHead className="min-w-[80px] text-xs py-1 px-2 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manager.isLoading && kindRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-3 text-center text-xs">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Chargement...
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Lignes pré-définies par kind */}
                  {kindRows.map((kindRow) => (
                    <KindRowGmbs
                      key={kindRow.kind}
                      kindRow={kindRow}
                      manager={manager}
                      entityId={entityId}
                      multiple={multiple}
                    />
                  ))}
                  
                  {/* Lignes supplémentaires ajoutées manuellement */}
                  {additionalRows.map((row) => (
                    <AdditionalRowGmbs
                      key={row.id}
                      id={row.id}
                      pendingKind={row.pendingKind}
                      pendingFiles={row.pendingFiles}
                      manager={manager}
                      entityId={entityId}
                      multiple={multiple}
                      onKindChange={(kind) => handleAdditionalKindChange(row.id, kind)}
                      onFilesChange={(files) => handleAdditionalFilesChange(row.id, files)}
                      onUpload={(kind, files) => handleAdditionalUpload(row.id, kind, files)}
                      onRemove={() => handleRemoveAdditionalRow(row.id)}
                    />
                  ))}
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Composant pour une ligne de kind pré-défini
function KindRowGmbs({
  kindRow,
  manager,
  entityId,
  multiple,
}: {
  kindRow: KindRowData;
  manager: ReturnType<typeof useDocumentManager>;
  entityId: string;
  multiple: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const hasDocuments = kindRow.documents.length > 0;
  const latestDocument = hasDocuments ? kindRow.documents[0] : null;

  // Upload direct pour cette ligne
  const handleDirectUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!entityId) return;
      await manager.processUploadQueue(kindRow.kind, files);
    },
    [entityId, kindRow.kind, manager]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      if (event.dataTransfer.files.length > 0) {
        handleDirectUpload(event.dataTransfer.files);
      }
    },
    [handleDirectUpload]
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        handleDirectUpload(event.target.files);
        event.target.value = "";
      }
    },
    [handleDirectUpload]
  );

  // Si des documents existent, afficher le dernier avec possibilité d'ajouter
  if (hasDocuments && latestDocument) {
    return (
      <>
        {/* Ligne principale avec le document le plus récent */}
        <DocumentRowGmbs
          row={latestDocument}
          manager={manager}
          kindLabel={kindRow.label}
          showAddButton={true}
          onAddClick={() => {}}
          kindRow={kindRow}
          entityId={entityId}
        />
        
        {/* Lignes supplémentaires pour les autres documents de ce kind */}
        {kindRow.documents.slice(1).map((doc) => (
          <DocumentRowGmbs
            key={doc.id}
            row={doc}
            manager={manager}
            kindLabel={kindRow.label}
            showAddButton={false}
            onAddClick={() => {}}
            kindRow={kindRow}
            entityId={entityId}
          />
        ))}
      </>
    );
  }

  // Ligne placeholder pour drop/upload
  return (
    <TableRow
      className={`h-auto transition-colors ${isDragOver ? "bg-primary/10" : "bg-muted/20"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <TableCell className="py-1 px-2">
        <div className="relative">
          <div
            className={`group flex min-h-[48px] w-full cursor-pointer items-center gap-2 rounded border border-dashed ${
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/30 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
            } px-2 py-1.5 transition-colors`}
          >
            <input
              type="file"
              multiple={multiple}
              accept={manager.getAcceptAttribute(kindRow.kind)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              onChange={handleFileInput}
            />
            <Upload className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-primary/70" />
            <span className="text-xs text-muted-foreground group-hover:text-foreground/70">
              Glisser ou cliquer
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-1 px-2">
        <Badge variant="outline" className="text-[11px] px-1.5 py-0.5 bg-muted/50">
          {kindRow.label}
        </Badge>
      </TableCell>
      <TableCell className="py-1 px-2">
        <span className="text-[11px] text-muted-foreground">—</span>
      </TableCell>
      <TableCell className="py-1 px-2">
        <span className="text-[11px] text-muted-foreground">—</span>
      </TableCell>
      <TableCell className="py-1 px-2">
        <span className="text-[11px] text-muted-foreground">—</span>
      </TableCell>
    </TableRow>
  );
}

// Composant pour une ligne de document existant
function DocumentRowGmbs({
  row,
  manager,
  kindLabel,
  showAddButton,
  onAddClick,
  kindRow,
  entityId,
}: {
  row: DocumentRow;
  manager: ReturnType<typeof useDocumentManager>;
  kindLabel: string;
  showAddButton: boolean;
  onAddClick: () => void;
  kindRow: KindRowData;
  entityId: string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const isPreviewing = manager.preview.open && manager.preview.row?.id === row.id;
  const previewRow = isPreviewing && manager.preview.row ? manager.preview.row : null;

  // Upload direct sur cette ligne
  const handleDirectUpload = useCallback(
    async (files: FileList | File[]) => {
      if (!entityId) return;
      await manager.processUploadQueue(row.kind, files);
    },
    [entityId, row.kind, manager]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      if (event.dataTransfer.files.length > 0) {
        handleDirectUpload(event.dataTransfer.files);
      }
    },
    [handleDirectUpload]
  );

  return (
    <TableRow
      className={`h-auto transition-colors ${isDragOver ? "bg-primary/10" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <TableCell className="py-1 px-2">
        {manager.renamingRow?.id === row.id ? (
          <div className="space-y-1">
            <Input
              value={manager.renamingName}
              onChange={(event) => manager.setRenamingName(event.target.value)}
              autoFocus
              disabled={manager.isRenaming}
              className="h-6 text-xs"
            />
            {manager.renameError && (
              <p className="text-[11px] text-destructive">{manager.renameError}</p>
            )}
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                onClick={manager.saveRename}
                disabled={manager.isRenaming || manager.renamingName.trim().length === 0}
                className="h-8 text-[11px] px-1.5"
              >
                OK
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={manager.cancelRename}
                disabled={manager.isRenaming}
                className="h-8 text-[11px] px-1.5"
              >
                ✕
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <div
                className="text-xs font-medium leading-tight line-clamp-2"
                title={row.filename}
              >
                {row.filename}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {formatFileSize(row.fileSize)}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => manager.startRename(row)}
              aria-label={`Renommer ${row.filename}`}
              className="h-8 w-8 shrink-0"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="py-1 px-2">
        <Badge variant="outline" className="text-[11px] px-1.5 py-0.5">
          {kindLabel}
        </Badge>
      </TableCell>
      <TableCell className="py-1 px-2">
        <div className="text-[11px] text-muted-foreground leading-tight">
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
        <div className="flex justify-end gap-1">
          <Tooltip>
            <Popover
              open={isPreviewing}
              onOpenChange={(open) => {
                if (!open) {
                  manager.setPreview({ open: false });
                  manager.setActivePreviewId(null);
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
                      manager.setPreview({ open: true, row });
                      manager.setActivePreviewId(row.id);
                    }}
                    aria-label={`Aperçu – ${row.filename}`}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
              </PopoverTrigger>
              <TooltipContent side="top" className="text-xs">Aperçu</TooltipContent>
              {previewRow ? (
                <PopoverContent className="w-auto p-1.5" side="left" align="center">
                  <div
                    className="relative flex flex-col overflow-hidden rounded border bg-background"
                    style={{ width: `${manager.previewSize.width}px`, height: `${manager.previewSize.height}px` }}
                    onDoubleClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex-none px-3 pt-2">
                      <h4 className="text-xs font-semibold truncate">{previewRow.filename}</h4>
                      <p className="text-xs text-muted-foreground">
                        {kindLabel} • {formatDate(previewRow.createdAt) ?? "—"}
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
                      onPointerDown={(event) => manager.startResize("horizontal", event)}
                    />
                    <div
                      className="absolute bottom-0 left-1/2 h-2 w-10 -translate-x-1/2 cursor-ns-resize rounded-t bg-transparent"
                      onPointerDown={(event) => manager.startResize("vertical", event)}
                    />
                    <div
                      className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-tl bg-transparent"
                      onPointerDown={(event) => manager.startResize("both", event)}
                    />
                  </div>
                </PopoverContent>
              ) : null}
            </Popover>
          </Tooltip>

          {row.source !== "staged" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => manager.handleCopyLink(row.url, row.filename, row.id)}
                  aria-label="Copier le lien"
                  className={`h-8 w-8 p-0 ${manager.copiedLinkId === row.id ? "text-green-600" : ""}`}
                >
                  {manager.copiedLinkId === row.id ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Link className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {manager.copiedLinkId === row.id ? "Copié !" : "Lien"}
              </TooltipContent>
            </Tooltip>
          )}

          {row.source !== "staged" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => manager.handleOpenInNewTab(row.url)}
                  aria-label="Ouvrir dans un nouvel onglet"
                  className="h-8 w-8 p-0"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Ouvrir</TooltipContent>
            </Tooltip>
          )}

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
                    manager.handleRemoveStaged(row.stagedKind, row.stagedId)
                  }
                  aria-label="Retirer le document en attente"
                  className="h-8 w-8 p-0"
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
                  onClick={() => row.recordId && manager.handleDelete(row.recordId)}
                  disabled={manager.deleteInProgress === row.recordId}
                  aria-label="Supprimer le document"
                  className="h-8 w-8 p-0"
                >
                  {manager.deleteInProgress === row.recordId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
            )}
            <TooltipContent side="top" className="text-xs">Supprimer</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
}

// Composant pour une ligne ajoutée manuellement (avec sélection de type)
function AdditionalRowGmbs({
  id,
  pendingKind,
  pendingFiles,
  manager,
  entityId,
  multiple,
  onKindChange,
  onFilesChange,
  onUpload,
  onRemove,
}: {
  id: string;
  pendingKind: string;
  pendingFiles: File[];
  manager: ReturnType<typeof useDocumentManager>;
  entityId: string;
  multiple: boolean;
  onKindChange: (kind: string) => void;
  onFilesChange: (files: File[]) => void;
  onUpload: (kind: string, files: File[]) => void;
  onRemove: () => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragOver(false);
      if (event.dataTransfer.files.length > 0) {
        const files = Array.from(event.dataTransfer.files);
        onFilesChange(files);
        // Si un kind est déjà sélectionné, upload direct
        if (pendingKind) {
          onUpload(pendingKind, files);
        }
      }
    },
    [pendingKind, onFilesChange, onUpload]
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files && event.target.files.length > 0) {
        const files = Array.from(event.target.files);
        onFilesChange(files);
        // Si un kind est déjà sélectionné, upload direct
        if (pendingKind) {
          onUpload(pendingKind, files);
        }
        setFileInputKey((k) => k + 1);
      }
    },
    [pendingKind, onFilesChange, onUpload]
  );

  // Quand on sélectionne un kind et qu'on a déjà des fichiers, upload direct
  const handleKindSelect = useCallback(
    (kind: string) => {
      onKindChange(kind);
      if (pendingFiles.length > 0) {
        onUpload(kind, pendingFiles);
      }
    },
    [pendingFiles, onKindChange, onUpload]
  );

  return (
    <TableRow
      className={`h-auto bg-muted/30 transition-colors ${isDragOver ? "bg-primary/10" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <TableCell className="py-1 px-2">
        <div
          className={`group relative flex min-h-[48px] w-full cursor-pointer items-center gap-2 rounded border border-dashed ${
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 bg-muted/20 hover:border-primary/50"
          } px-2 py-1.5 transition-colors`}
        >
          <input
            key={fileInputKey}
            type="file"
            multiple={multiple}
            accept={manager.getAcceptAttribute(pendingKind)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={handleFileInput}
          />
          <FilePlus className="h-3.5 w-3.5 text-primary/70" />
          <div className="text-[11px] text-muted-foreground">
            {pendingFiles.length > 0 ? (
              <span className="text-xs font-medium text-foreground">
                {pendingFiles.length} fichier(s)
              </span>
            ) : (
              <span>Glisser ou cliquer</span>
            )}
          </div>
        </div>
        {pendingFiles.length > 0 && (
          <ul className="mt-0.5 space-y-0 text-[11px] text-muted-foreground max-h-[28px] overflow-y-auto">
            {pendingFiles.map((file) => (
              <li key={file.name} className="truncate">• {file.name}</li>
            ))}
          </ul>
        )}
      </TableCell>
      <TableCell className="py-1 px-2 align-top">
        <Select value={pendingKind} onValueChange={handleKindSelect}>
          <SelectTrigger className="h-6 text-xs min-w-[60px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {manager.kindMetadata.map(({ original, label, normalized }) => (
              <SelectItem key={normalized} value={original} className="text-xs">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="py-1 px-2 align-top">
        <span className="text-[11px] text-muted-foreground">—</span>
      </TableCell>
      <TableCell className="py-1 px-2 align-top">
        <ManagerBadge
          code={manager.uploaderInfo?.code ?? null}
          displayName={manager.uploaderInfo?.displayName ?? null}
          color={manager.uploaderInfo?.color ?? null}
          avatarUrl={null}
        />
      </TableCell>
      <TableCell className="py-1 px-2 align-top">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label="Supprimer cette ligne"
              className="h-8 w-8 p-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">Supprimer</TooltipContent>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
}

export default DocumentManagerGmbs;
