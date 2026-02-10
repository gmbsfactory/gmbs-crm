"use client";

import React from "react";
import { Eye, Loader2, Plus, Trash2, FilePlus, Pencil, Link, ExternalLink, Check } from "lucide-react";
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
import { ManagerBadge } from "@/components/documents/ManagerBadge";
import { useDocumentManager } from "@/components/documents/useDocumentManager";
import {
  type DocumentManagerProps,
  type ViewFilter,
  type DocumentRow,
  normalizeKind,
  formatFileSize,
  formatDate,
  formatTime,
} from "@/components/documents/types";

export function DocumentManagerLegacy({
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

  const showViewFilters = entityType === "intervention";
  const controlsClassName = showViewFilters
    ? "flex flex-row items-center justify-between gap-1.5 flex-wrap"
    : "flex flex-row items-center justify-end gap-1.5 flex-wrap";

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

        <div className={controlsClassName}>
          {showViewFilters ? (
            <Tabs
              value={manager.view}
              onValueChange={(value) => manager.setView(value as ViewFilter)}
              className="w-full sm:w-auto shrink-0"
            >
              <TabsList className="h-7 grid w-full grid-cols-4 sm:w-auto">
                <TabsTrigger value="all" className="text-xs px-1.5 h-6">Toutes</TabsTrigger>
                <TabsTrigger value="devis" className="text-xs px-1.5 h-6">Devis</TabsTrigger>
                <TabsTrigger value="factures" className="text-xs px-1.5 h-6">Factures</TabsTrigger>
                <TabsTrigger value="photos" className="text-xs px-1.5 h-6">Photos</TabsTrigger>
              </TabsList>
            </Tabs>
          ) : null}
          <Button
            type="button"
            onClick={manager.handleStartAdd}
            className="inline-flex items-center justify-center gap-1 shrink-0 whitespace-nowrap text-xs h-7 px-2"
            disabled={manager.isAddingRow}
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
              {manager.isLoading && manager.filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-3 text-center text-xs">
                    <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Chargement...
                    </div>
                  </TableCell>
                </TableRow>
              ) : manager.filteredRows.length === 0 && !manager.isAddingRow ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-3 text-center text-xs text-muted-foreground">
                    Aucun document
                  </TableCell>
                </TableRow>
              ) : (
                manager.filteredRows.map((row) => (
                  <DocumentRowLegacy
                    key={row.id}
                    row={row}
                    manager={manager}
                    entityType={entityType}
                  />
                ))
              )}
              {manager.isAddingRow && (
                <AddRowLegacy
                  manager={manager}
                  multiple={multiple}
                />
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

// Composant pour une ligne de document
function DocumentRowLegacy({
  row,
  manager,
  entityType,
}: {
  row: DocumentRow;
  manager: ReturnType<typeof useDocumentManager>;
  entityType: string;
}) {
  const isPreviewing = manager.preview.open && manager.preview.row?.id === row.id;
  const previewRow = isPreviewing && manager.preview.row ? manager.preview.row : null;

  return (
    <TableRow className="h-auto">
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
        {normalizeKind(row.kind) === 'a_classe' ? (
          <Badge variant="outline" className="text-[11px] px-1 py-0">
            À classer
          </Badge>
        ) : (
          <span className="text-xs">{manager.labelForKind(row.kind)}</span>
        )}
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
                        {manager.labelForKind(previewRow.kind)} • {formatDate(previewRow.createdAt) ?? "—"}
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

// Composant pour la ligne d'ajout
function AddRowLegacy({
  manager,
  multiple,
}: {
  manager: ReturnType<typeof useDocumentManager>;
  multiple: boolean;
}) {
  return (
    <TableRow className="bg-muted/30">
      <TableCell className="py-1 px-2">
        <div
          className="group relative flex min-h-[50px] w-full cursor-pointer flex-col items-center justify-center rounded border border-dashed border-muted-foreground/40 bg-muted/40 p-1.5 text-center"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            manager.handlePendingFilesChange(event.dataTransfer.files);
          }}
        >
          <input
            key={manager.fileInputKey}
            type="file"
            multiple={multiple}
            accept={manager.getAcceptAttribute(manager.pendingKind)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(event) => manager.handlePendingFilesChange(event.target.files)}
          />
          <div className="flex items-center gap-1.5">
            <FilePlus className="h-4 w-4 text-primary shrink-0" />
            <div className="text-[11px] text-muted-foreground text-left">
              <p className="text-xs font-medium text-foreground">Glissez/cliquez</p>
              <p className="truncate max-w-[80px]">{manager.getAcceptedFormatsText(manager.pendingKind)}</p>
            </div>
          </div>
        </div>
        {manager.pendingFiles.length > 0 && (
          <ul className="mt-0.5 space-y-0 text-[11px] text-muted-foreground max-h-[28px] overflow-y-auto">
            {manager.pendingFiles.map((file) => (
              <li key={file.name} className="truncate">• {file.name}</li>
            ))}
          </ul>
        )}
      </TableCell>
      <TableCell className="py-1 px-2 align-top">
        <Select value={manager.pendingKind} onValueChange={manager.setPendingKind}>
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
        <div className="text-[11px] text-muted-foreground">—</div>
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
        <div className="flex flex-col gap-0.5">
          <Button
            type="button"
            size="sm"
            onClick={manager.handlePendingUpload}
            disabled={!manager.pendingKind || manager.pendingFiles.length === 0}
            className="text-[11px] h-8 px-1.5 whitespace-nowrap"
          >
            Importer
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={manager.handleCancelAdd}
            className="text-[11px] h-8 px-1.5 whitespace-nowrap"
          >
            Annuler
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default DocumentManagerLegacy;
