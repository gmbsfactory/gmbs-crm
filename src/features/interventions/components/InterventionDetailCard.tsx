"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { InterventionView } from "@/types/intervention-view"
import { Calendar, Euro, Mail, MapPin, Phone, User, X } from "lucide-react"

export type InterventionDetailCardProps = {
  intervention: InterventionView
  onClose?: () => void
  onEdit?: (intervention: InterventionView) => void
  onSendEmail?: (intervention: InterventionView) => void
  onCall?: (intervention: InterventionView) => void
  onAddDocument?: (intervention: InterventionView) => void
  onStatusChange?: (intervention: InterventionView, newStatus: string) => void
  className?: string
}

export function InterventionDetailCard({ intervention, onClose, onSendEmail, onCall, className = "" }: InterventionDetailCardProps) {
  const dateStr = (intervention.dateIntervention || intervention.date || "")
    ? new Date(intervention.dateIntervention || intervention.date || "").toLocaleDateString("fr-FR")
    : "—"
  const valueStr = typeof intervention.marge === "number"
    ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(intervention.marge)
    : (typeof intervention.coutIntervention === "number"
        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(intervention.coutIntervention)
        : "—")
  const assignedUserDisplay = intervention.assignedUserCode ?? intervention.attribueA ?? "Non assigné"

  return (
    <Card className={`shadow-lg ${className}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-xl">{intervention.contexteIntervention || "Intervention"}</CardTitle>
          <div className="text-muted-foreground text-sm">
            {intervention.prenomClient || ""} {intervention.nomClient || ""}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" /> <span>{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Euro className="h-4 w-4" /> <span>{valueStr}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground col-span-2">
            <MapPin className="h-4 w-4" />
            <span>{intervention.adresse || "—"}, {intervention.codePostal || ""} {intervention.ville || ""}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" /> <span>{assignedUserDisplay}</span>zferdezdsf
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Commentaire</div>
          <div className="rounded border bg-muted/30 p-2 text-sm min-h-10">
            {intervention.commentaire || intervention.commentaireAgent || "—"}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onSendEmail?.(intervention)}>
            <Mail className="h-4 w-4 mr-2" /> Email
          </Button>
          <Button variant="outline" size="sm" onClick={() => onCall?.(intervention)}>
            <Phone className="h-4 w-4 mr-2" /> Appel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
