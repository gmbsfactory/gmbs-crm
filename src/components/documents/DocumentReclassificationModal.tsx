"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle2,
  Loader2,
  Eye,
  ExternalLink,
  FileText,
  FileImage,
  Wand2,
} from "lucide-react"
import { useDocumentReclassification } from "@/hooks/useDocumentReclassification"
import { DocumentPreview } from "@/components/documents/DocumentPreview"

interface DocumentReclassificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: "intervention" | "artisan"
  entityId: string
  documentKinds: Array<{ kind: string; label: string }>
}

function FileIcon({ mimeType }: { mimeType?: string | null }) {
  if (mimeType?.startsWith("image/")) return <FileImage className="h-4 w-4 text-blue-500 shrink-0" />
  return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
}

/**
 * Modal pour reclassifier les documents d'une entité
 * Affiche les documents "a_classe" et permet de changer leur kind
 */
export function DocumentReclassificationModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  documentKinds,
}: DocumentReclassificationModalProps) {
  const { documentsToReclassify, isLoading, isBatchReclassifying, batchReclassifyAsync } =
    useDocumentReclassification({
      entityType,
      entityId,
      enabled: open,
    })

  const [newKinds, setNewKinds] = useState<Record<string, string>>({})
  const [previewDoc, setPreviewDoc] = useState<{
    url: string
    mimeType?: string | null
    name?: string | null
  } | null>(null)

  const getNewKind = (documentId: string) => newKinds[documentId] ?? ""

  const handleKindChange = (documentId: string, kind: string) => {
    setNewKinds((prev) => ({ ...prev, [documentId]: kind }))
  }

  const pendingCount = documentsToReclassify.filter(
    (doc) => !newKinds[doc.id]
  ).length

  const handleSave = async () => {
    const updates = Object.entries(newKinds)
      .filter(([, newKind]) => newKind && newKind !== "a_classe")
      .map(([documentId, newKind]) => ({ documentId, newKind }))

    if (updates.length === 0) {
      onOpenChange(false)
      return
    }

    try {
      await batchReclassifyAsync(updates)
      setNewKinds({})
      onOpenChange(false)
    } catch {
      // L'erreur est déjà gérée par le onError du hook (toast)
    }
  }

  const classifiedCount = Object.values(newKinds).filter((k) => k && k !== "a_classe").length

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl max-h-[85vh] flex flex-col z-[80]"
          overlayStyle={{ zIndex: 75 }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-orange-500" />
              Reclassifier les documents
            </DialogTitle>
            <DialogDescription>
              Attribuez un type à chaque document en attente de classification.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documentsToReclassify.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="text-sm font-medium text-emerald-700">Tous les documents sont classifiés</p>
            </div>
          ) : (
            <>
              {/* Barre de progression */}
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>
                  {classifiedCount} / {documentsToReclassify.length} classifié(s)
                </span>
                {pendingCount > 0 && (
                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
                    {pendingCount} restant{pendingCount > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>

              {/* Liste des documents */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
                {documentsToReclassify.map((doc) => {
                  const currentKind = getNewKind(doc.id)
                  const isClassified = !!currentKind && currentKind !== "a_classe"

                  return (
                    <div
                      key={doc.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                        isClassified
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "border-border bg-card"
                      }`}
                    >
                      {/* Icône fichier */}
                      <FileIcon mimeType={doc.mime_type} />

                      {/* Nom du fichier */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-medium truncate"
                          title={doc.filename ?? undefined}
                        >
                          {doc.filename ?? "Document sans nom"}
                        </p>
                        {isClassified && (
                          <p className="text-xs text-emerald-600 mt-0.5">
                            {documentKinds.find((k) => k.kind === currentKind)?.label}
                          </p>
                        )}
                      </div>

                      {/* Bouton aperçu + ouvrir */}
                      {doc.url && (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                            title="Voir le document"
                            onClick={(e) => {
                              e.stopPropagation()
                              setPreviewDoc({
                                url: doc.url,
                                mimeType: doc.mime_type,
                                name: doc.filename,
                              })
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                            title="Ouvrir dans un nouvel onglet"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(doc.url, "_blank")
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}

                      {/* Dropdown classification */}
                      <Select
                        value={currentKind}
                        onValueChange={(value) => handleKindChange(doc.id, value)}
                      >
                        <SelectTrigger className="w-44 h-8 shrink-0">
                          <SelectValue placeholder="Choisir un type…" />
                        </SelectTrigger>
                        <SelectContent>
                          {documentKinds
                            .filter((k) => k.kind !== "a_classe")
                            .map(({ kind, label }) => (
                              <SelectItem key={kind} value={kind} className="text-sm">
                                {label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>

                      {/* Indicateur état */}
                      {isClassified && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setNewKinds({})
                    onOpenChange(false)
                  }}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={classifiedCount === 0 || isBatchReclassifying}
                >
                  {isBatchReclassifying ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer {classifiedCount > 0 ? `(${classifiedCount})` : ""}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal aperçu document */}
      <Dialog open={!!previewDoc} onOpenChange={(isOpen) => { if (!isOpen) setPreviewDoc(null) }}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] flex flex-col z-[90]"
          overlayStyle={{ zIndex: 85 }}
        >
          <DialogHeader>
            <DialogTitle className="truncate text-sm font-medium pr-8">
              {previewDoc?.name ?? "Aperçu du document"}
            </DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <DocumentPreview
              url={previewDoc.url}
              mimeType={previewDoc.mimeType}
              filename={previewDoc.name ?? undefined}
              className="h-[65vh] w-full"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
