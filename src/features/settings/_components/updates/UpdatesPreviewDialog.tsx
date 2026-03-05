"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { UpdateEntry } from "@/components/layout/UpdatesModal"
import type { AppUpdateWithViewStatus } from "@/types/app-updates"
import type { UpdateFormData } from "./UpdateForm"

interface UpdatesPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: UpdateFormData | null
}

export function UpdatesPreviewDialog({ open, onOpenChange, formData }: UpdatesPreviewDialogProps) {
  if (!formData) return null

  const mockUpdate: AppUpdateWithViewStatus = {
    id: "preview",
    version: formData.version || "0.00",
    title: formData.title || "Sans titre",
    content: formData.content || "",
    audience: formData.audience,
    target_user_ids: formData.target_user_ids,
    severity: formData.severity,
    status: "published",
    published_at: new Date().toISOString(),
    created_by: null,
    created_at: new Date().toISOString(),
    is_acknowledged: false,
    acknowledged_at: null,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aperçu de la mise à jour</DialogTitle>
          <DialogDescription>
            Voici comment l&apos;update apparaitra aux utilisateurs.
          </DialogDescription>
        </DialogHeader>
        <div className="border rounded-lg p-4">
          <UpdateEntry update={mockUpdate} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
