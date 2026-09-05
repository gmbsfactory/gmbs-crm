"use client"

import { Camera, CheckCircle2, ClipboardList, History, Loader2, MessageSquareWarning, XCircle } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import type { PortalReport, PortalReportPhoto, PortalReportStatus } from "@/hooks/usePortalReport"
import { PORTAL_REPORT_REVIEW_COLOR, PORTAL_REPORT_REVIEW_LABEL } from "@/lib/interventions/portal-report-status"
import { cn } from "@/lib/utils"

/**
 * Briques partagées du rapport d'artisan.
 *
 * Déplacées depuis `form-sections/PortalReportSection.tsx` pour être réutilisées
 * telles quelles par le panneau « Rapport » du modal (`ReportsPanel`) : on
 * déplace, on ne réécrit pas — les badges, les six champs métier et la boîte de
 * « demande de correction » restent strictement identiques.
 */

export const STATUS_COPY: Record<PortalReportStatus, { label: string; className: string; icon: React.ReactNode }> = {
  submitted: {
    label: PORTAL_REPORT_REVIEW_LABEL,
    className: "text-white border-transparent",
    icon: <ClipboardList className="h-3 w-3" />,
  },
  approved: {
    label: "Validé",
    className: "bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  rejected: {
    label: "Correction demandée",
    className: "bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-200",
    icon: <XCircle className="h-3 w-3" />,
  },
  superseded: {
    label: "Remplacée",
    className: "bg-muted text-muted-foreground border-border",
    icon: <History className="h-3 w-3" />,
  },
}

export function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return format(date, "d MMM yyyy 'à' HH:mm", { locale: fr })
}

/** Date courte sans l'année : « 12 sept. 08:40 » (colonne de 250 px). */
export function formatShortDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return format(date, "d MMM HH:mm", { locale: fr })
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—"
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m.toString().padStart(2, "0")}`
}

/**
 * Durée écoulée entre deux instants, en « 5 h 22 ».
 * `to` non fourni = maintenant (compteur vivant du chantier en cours).
 */
export function formatElapsed(from: string | null | undefined, to?: string | null): string | null {
  if (!from) return null
  const start = new Date(from).getTime()
  const end = to ? new Date(to).getTime() : Date.now()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null
  return formatDuration(Math.floor((end - start) / 60000))
}

export function yesNo(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "—"
  return value ? "Oui" : "Non"
}

export function artisanDisplayName(artisan: { prenom: string | null; nom: string | null } | null): string | null {
  if (!artisan) return null
  const name = `${artisan.prenom ?? ""} ${artisan.nom ?? ""}`.trim()
  return name || null
}

/** « Karim B. » — la colonne descend à 250 px, le nom complet n'y tient pas. */
export function artisanShortName(artisan: { prenom: string | null; nom: string | null } | null): string {
  if (!artisan) return "Artisan"
  const prenom = (artisan.prenom ?? "").trim()
  const nom = (artisan.nom ?? "").trim()
  if (prenom && nom) return `${prenom} ${nom.charAt(0).toUpperCase()}.`
  return prenom || nom || "Artisan"
}

export function formatAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—"
  return `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`
}

export function ReportStatusBadge({ status }: { status: PortalReportStatus }) {
  const copy = STATUS_COPY[status] ?? STATUS_COPY.submitted
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[10px] px-1.5 py-0", copy.className)}
      style={status === "submitted" ? { backgroundColor: PORTAL_REPORT_REVIEW_COLOR } : undefined}
    >
      {copy.icon}
      {copy.label}
    </Badge>
  )
}

export function ReportField({
  label,
  value,
  fullWidth,
}: {
  label: string
  value: React.ReactNode
  fullWidth?: boolean
}) {
  return (
    <div className={cn("space-y-0.5 min-w-0", fullWidth && "sm:col-span-2")}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-xs text-foreground whitespace-pre-wrap break-words">{value ?? "—"}</div>
    </div>
  )
}

export function PhotoGrid({
  title,
  photos,
  onOpen,
}: {
  title: string
  photos: PortalReportPhoto[]
  onOpen: (photo: PortalReportPhoto) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <Camera className="h-3 w-3" />
        {title} ({photos.length})
      </p>
      {photos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune photo</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onOpen(photo)}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted hover:ring-2 hover:ring-primary/60 focus:outline-none focus:ring-2 focus:ring-primary"
              title={photo.metadata?.comment || photo.filename || "Ouvrir la photo"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={photo.metadata?.comment || photo.filename || "Photo de l'artisan"}
                loading="lazy"
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {photo.metadata?.comment && (
                <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[9px] text-white line-clamp-2 text-left">
                  {photo.metadata.comment}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Les six champs métier du rapport, dans l'ordre historique. */
export function ReportFields({ report }: { report: PortalReport }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
      <ReportField label="Travaux réalisés" value={report.travaux_realises} fullWidth />
      <ReportField label="Durée" value={formatDuration(report.duree_minutes)} />
      <ReportField label="Client présent" value={yesNo(report.client_present)} />
      <ReportField label="Matériel utilisé" value={report.materiel_utilise} fullWidth />
      <ReportField
        label="Reste à faire"
        value={
          report.reste_a_faire ? (
            <span>
              <span className="font-medium text-orange-600">Oui</span>
              {report.reste_a_faire_detail ? ` — ${report.reste_a_faire_detail}` : ""}
            </span>
          ) : (
            yesNo(report.reste_a_faire)
          )
        }
        fullWidth
      />
      <ReportField label="Anomalies" value={report.anomalies} fullWidth />
    </div>
  )
}

/**
 * Bandeau de chantier : durée **réelle** (`submitted_at − started_at`) à côté de
 * la durée **déclarée** (`duree_minutes`). Les deux, jamais l'une sans l'autre :
 * c'est le rapprochement qui fait l'information.
 */
export function WorkBanner({ report }: { report: PortalReport }) {
  const startedAt = report.started_at ?? null
  if (!startedAt && !report.submitted_at) return null
  const started = formatShortDateTime(startedAt)
  const submitted = formatShortDateTime(report.submitted_at)
  const real = formatElapsed(startedAt, report.submitted_at)
  const declared = report.duree_minutes !== null && report.duree_minutes !== undefined ? formatDuration(report.duree_minutes) : null

  return (
    <p className="rounded-md border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
      {started && <>Démarré {started}</>}
      {started && submitted && " · "}
      {submitted && <>Envoyé {submitted}</>}
      {real && (
        <>
          {" · "}
          <span className="font-medium text-foreground">Durée réelle {real}</span>
        </>
      )}
      {declared && <> (déclarée : {declared})</>}
    </p>
  )
}

export interface RejectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  comment: string
  onCommentChange: (comment: string) => void
  onSubmit: () => void
  isPending: boolean
  /** Affiche la case « Rouvrir l'intervention » (statut INTER_TERMINEE). */
  canReopen?: boolean
  reopen?: boolean
  onReopenChange?: (reopen: boolean) => void
}

/** Boîte de dialogue « Demander une correction » — motif obligatoire. */
export function RejectDialog({
  open,
  onOpenChange,
  comment,
  onCommentChange,
  onSubmit,
  isPending,
  canReopen = false,
  reopen = false,
  onReopenChange,
}: RejectDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (isPending) return
        onOpenChange(nextOpen)
      }}
      modal
    >
      <DialogContent className="sm:max-w-md !z-[1300]" overlayClassName="!z-[1200]">
        <DialogHeader>
          <DialogTitle>Demander une correction</DialogTitle>
          <DialogDescription>
            Expliquez à l&apos;artisan ce qui doit être corrigé. Il recevra votre commentaire dans le portail
            et pourra renvoyer une nouvelle version du rapport.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="portal-report-reject-comment">Commentaire (obligatoire)</Label>
          <Textarea
            id="portal-report-reject-comment"
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            placeholder="Ex : photo après illisible, préciser le matériel remplacé…"
            rows={4}
            autoFocus
          />
          {canReopen && (
            <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
              <Checkbox
                checked={reopen}
                onCheckedChange={(checked) => onReopenChange?.(checked === true)}
                aria-label="Rouvrir l'intervention"
              />
              <span>
                Rouvrir l&apos;intervention (<span className="font-medium">Inter. terminée</span> →{" "}
                <span className="font-medium">Inter. en cours</span>) pour que l&apos;artisan puisse renvoyer une
                version.
              </span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button type="button" onClick={onSubmit} disabled={isPending || !comment.trim()}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Envoyer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Boutons de décision du gestionnaire, communs à la section et au panneau. */
export function ReviewActions({
  onApprove,
  onReject,
  isPending,
}: {
  onApprove: () => void
  onReject: () => void
  isPending: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-2">
      <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={isPending} onClick={onReject}>
        <MessageSquareWarning className="mr-1 h-3.5 w-3.5" />
        Demander une correction
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
        disabled={isPending}
        onClick={onApprove}
      >
        {isPending ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
        )}
        Valider le rapport
      </Button>
    </div>
  )
}

/** Encart de décision déjà prise (validé / correction demandée). */
export function ReviewVerdict({ report }: { report: PortalReport }) {
  const reviewedAt = formatDateTime(report.reviewed_at)
  if (report.status === "approved") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-green-300 bg-green-50 p-2 text-xs text-green-900 dark:bg-green-950/40 dark:text-green-100">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Rapport validé{reviewedAt ? ` le ${reviewedAt}` : ""}.</span>
      </div>
    )
  }
  if (report.status === "rejected") {
    return (
      <div className="space-y-1 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-100">
        <div className="flex items-center gap-2 font-medium">
          <MessageSquareWarning className="h-4 w-4 shrink-0" />
          Correction demandée{reviewedAt ? ` le ${reviewedAt}` : ""}
        </div>
        {report.review_comment && <p className="whitespace-pre-wrap pl-6">{report.review_comment}</p>}
      </div>
    )
  }
  return null
}
