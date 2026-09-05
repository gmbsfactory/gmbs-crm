"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, History, Smartphone, Building2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useArtisanPortalTimeline } from "@/components/ui/artisan-modal/_hooks/useArtisanPortalTimeline"
import { SOURCE_LABELS, timelineDetail, timelineLabel } from "@/lib/artisans/portal-timeline"

type Props = {
  artisanId: string
}

function formatHorodatage(valeur: string | null | undefined): string {
  if (!valeur) return ""
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Fiche artisan — carte « Journal des actions » (spécification §4.3, lot L6).
 *
 * Ce que la carte apporte : *qui a fait quoi, et quand*. Prix accepté, chantier
 * démarré, rapport envoyé, pièce déposée — avec l'acteur et, surtout, la
 * **source** : une acceptation de prix saisie au CRM (« l'artisan m'a dit oui
 * au téléphone ») et la même acceptation faite depuis l'application n'ont pas
 * la même valeur probante en cas de litige. Sans cette distinction, le journal
 * ne servirait à rien.
 *
 * L'écart d'horloge est signalé : un téléphone hors ligne peut déclarer une
 * heure fausse, le serveur la recale et pose `payload.clock_skew` (§4.1).
 */
export function ArtisanPortalTimelineCard({ artisanId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const { events, isLoading, error } = useArtisanPortalTimeline(artisanId, isOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50">
            <CardTitle className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Journal des actions
              </span>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0">
            {isLoading && <p className="text-xs text-muted-foreground">Chargement du journal…</p>}
            {!isLoading && error && (
              <p className="text-xs text-destructive">{error.message}</p>
            )}
            {!isLoading && !error && events.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucune action enregistrée pour cet artisan.
              </p>
            )}

            {events.length > 0 && (
              <ol className="space-y-2" data-testid="journal-artisan">
                {events.map((event) => {
                  const detail = timelineDetail(event)
                  const decalage = event.payload?.clock_skew === true
                  const surCRM = event.source === "crm"
                  return (
                    <li
                      key={event.id}
                      data-testid={`journal-${event.id}`}
                      className="rounded-md border p-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium">{timelineLabel(event.action_type)}</span>
                          {event.intervention?.id_inter && (
                            <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                              {event.intervention.id_inter}
                            </span>
                          )}
                          {detail && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>
                          )}
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {event.actor} · {SOURCE_LABELS[event.source]}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Badge
                            variant="outline"
                            className="gap-1 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide"
                          >
                            {surCRM ? (
                              <Building2 className="h-3 w-3" aria-hidden />
                            ) : (
                              <Smartphone className="h-3 w-3" aria-hidden />
                            )}
                            {surCRM ? "CRM" : "Portail"}
                          </Badge>
                          <p className="mt-1 text-[11px] text-muted-foreground whitespace-nowrap">
                            {formatHorodatage(event.occurred_at)}
                          </p>
                          {decalage && (
                            <p
                              className="text-[10px] text-amber-600"
                              title="L'horloge du téléphone était fausse : la date a été recalée à l'enregistrement."
                            >
                              horloge recalée
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
