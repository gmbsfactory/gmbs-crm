"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { getHighlightSegments } from "@/components/search/highlight"
import { CommentSection } from "@/components/shared/CommentSection"
import type { InterventionView as InterventionEntity } from "@/types/intervention-view"

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })

function HighlightedText({ text, searchQuery }: { text: string; searchQuery: string }) {
  const segments = getHighlightSegments(text, searchQuery)
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${segment.text}-${index}`}
          className={segment.isMatch ? "search-highlight" : undefined}
        >
          {segment.text}
        </span>
      ))}
    </>
  )
}

export function ExpandedRowContent({
  intervention,
  statusColor,
  showStatusBorder,
  statusBorderWidth,
  currentUserId,
  searchQuery = "",
}: {
  intervention: InterventionEntity
  statusColor: string
  showStatusBorder: boolean
  statusBorderWidth: string
  currentUserId?: string | null
  searchQuery?: string
}) {
  const interventionData = useMemo(() => {
    const intervAny = intervention as any
    return {
      contexte: intervAny.contexteIntervention || "—",
      consigne: intervAny.consigneIntervention || "—",
      coutSST: intervAny.coutSST,
      adresse: intervAny.adresse || "—",
      nomPrenomClient: intervAny.nomPrenomClient || "",
      telephoneClient: intervAny.telephoneClient || "",
      telephone2Client: intervAny.telephone2Client || "",
      referenceAgence: intervAny.referenceAgence || intervAny.reference_agence || "",
      deuxiemeArtisan: intervAny.deuxiemeArtisan || "",
      acompteSST: (intervAny.payments as { payment_type: string; amount: number }[] | undefined)
        ?.find((p) => p.payment_type === "acompte_sst")?.amount ?? null,
      acompteClient: (intervAny.payments as { payment_type: string; amount: number }[] | undefined)
        ?.find((p) => p.payment_type === "acompte_client")?.amount ?? null,
    }
  }, [intervention])

  const showReferenceAgence = !!interventionData.referenceAgence && interventionData.referenceAgence !== "—"

  const renderText = (text: string) => {
    if (searchQuery && searchQuery.trim().length > 0 && text !== "—") {
      return <HighlightedText text={text} searchQuery={searchQuery} />
    }
    return text
  }

  return (
    <div
      className={cn(
        "w-full bg-accent/10 dark:bg-accent/15",
        showStatusBorder && "border-l"
      )}
      style={{
        ...(showStatusBorder ? {
          borderLeftColor: statusColor,
          borderLeftWidth: statusBorderWidth,
        } : {}),
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
        {/* Colonne 1 - Informations Générales */}
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">Contexte</p>
            <p className="text-sm font-medium text-foreground">{renderText(interventionData.contexte)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">Consigne</p>
            <p className="text-sm font-medium text-foreground">{renderText(interventionData.consigne)}</p>
          </div>
          {interventionData.coutSST != null && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">Coût Artisan</p>
              <p className="text-sm font-semibold text-foreground">{numberFormatter.format(interventionData.coutSST)} €</p>
            </div>
          )}
        </div>

        {/* Colonne 2 - Informations Client */}
        <div className="space-y-3">
          {showReferenceAgence && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">Référence agence</p>
              <p className="text-sm font-medium text-foreground">{renderText(interventionData.referenceAgence || "—")}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">Adresse</p>
            <p className="text-sm font-medium text-foreground">{renderText(interventionData.adresse)}</p>
          </div>
          {(interventionData.nomPrenomClient || interventionData.telephoneClient) && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">Info client</p>
              <p className="text-sm font-medium text-foreground">
                {interventionData.nomPrenomClient && (
                  <span>{renderText(interventionData.nomPrenomClient)}</span>
                )}
                {interventionData.nomPrenomClient && interventionData.telephoneClient && (
                  <span className="text-muted-foreground"> — </span>
                )}
                {interventionData.telephoneClient && (
                  <span>{renderText(interventionData.telephoneClient)}</span>
                )}
                {interventionData.telephone2Client && (
                  <span className="text-muted-foreground"> | <span className="text-foreground">{renderText(interventionData.telephone2Client)}</span></span>
                )}
              </p>
            </div>
          )}
          {interventionData.deuxiemeArtisan && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">2ème artisan</p>
              <p className="text-sm font-medium text-foreground">
                {renderText(interventionData.deuxiemeArtisan)}
              </p>
            </div>
          )}
          {(interventionData.acompteSST != null || interventionData.acompteClient != null) && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">Acomptes</p>
              <p className="text-sm font-medium text-foreground space-x-3">
                {interventionData.acompteSST != null && (
                  <span>SST : <span className="font-semibold">{numberFormatter.format(interventionData.acompteSST)} €</span></span>
                )}
                {interventionData.acompteClient != null && (
                  <span>Client : <span className="font-semibold">{numberFormatter.format(interventionData.acompteClient)} €</span></span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Colonne 3 - Commentaires */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wide mb-0.5">Commentaires</p>
          <CommentSection
            entityType="intervention"
            entityId={intervention.id}
            currentUserId={currentUserId}
            disableScrollFades
            searchQuery={searchQuery}
          />
        </div>
      </div>
    </div>
  )
}
