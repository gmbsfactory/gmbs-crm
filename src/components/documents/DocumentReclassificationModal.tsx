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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useDocumentReclassification } from "@/hooks/useDocumentReclassification"

interface DocumentReclassificationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: "intervention" | "artisan"
  entityId: string
  documentKinds: Array<{ kind: string; label: string }>
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
  const { documentsToReclassify, isBatchReclassifying, batchReclassifyAsync } =
    useDocumentReclassification({
      entityType,
      entityId,
      enabled: open,
    })

  const [newKinds, setNewKinds] = useState<Record<string, string>>({})

  // Initialiser les nouveau kinds avec la valeur actuelle
  const getNewKind = (documentId: string) => {
    return newKinds[documentId] || "autre"
  }

  const handleKindChange = (documentId: string, kind: string) => {
    setNewKinds((prev) => ({
      ...prev,
      [documentId]: kind,
    }))
  }

  const handleSave = async () => {
    const updates = Object.entries(newKinds)
      .filter(([, newKind]) => newKind !== "a_classe")
      .map(([documentId, newKind]) => ({
        documentId,
        newKind,
      }))

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

  const hasChanges = Object.keys(newKinds).length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Reclassifier les documents
          </DialogTitle>
          <DialogDescription>
            Sélectionnez le type approprié pour chaque document en attente de
            classification
          </DialogDescription>
        </DialogHeader>

        {documentsToReclassify.length === 0 ? (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="pt-6 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm text-emerald-700">
                Tous les documents sont classifiés ! 🎉
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Résumé */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm">
                <strong>{documentsToReclassify.length}</strong> document(s) en
                attente de classification
              </p>
            </div>

            {/* Tableau */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-1/2">Nom du fichier</TableHead>
                    <TableHead>Classification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentsToReclassify.map((doc: any) => (
                    <TableRow key={doc.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <span className="truncate" title={doc.name}>
                            {doc.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-xs"
                          >
                            à classer
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={getNewKind(doc.id)}
                          onValueChange={(value) =>
                            handleKindChange(doc.id, value)
                          }
                        >
                          <SelectTrigger className="w-48 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {documentKinds.map(({ kind, label }) => (
                              <SelectItem
                                key={kind}
                                value={kind}
                                className="text-xs"
                              >
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setNewKinds({})
                  onOpenChange(false)
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isBatchReclassifying}
              >
                {isBatchReclassifying && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Sauvegarder
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
