"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { hexToRgba } from "@/types/artisan-page"
import { PIECES_A_VERIFIER_COLOR } from "@/lib/artisans/document-review"

interface DossierBadgeProps {
  /** `artisans.statut_dossier` : COMPLET · À compléter · INCOMPLET. */
  statutDossier: string | undefined
  /** `artisans.pieces_a_verifier` : pièces déposées en attente de vérification. */
  piecesAVerifier?: number
}

/** Couleurs du badge de statut de dossier (inchangées depuis l'origine). */
const COULEUR_COMPLET = "#10B981"
const COULEUR_INCOMPLET = "#F59E0B"
const COULEUR_A_COMPLETER = "#EF4444"

function couleurDossier(statutDossier: string): string {
  const s = statutDossier.toLowerCase()
  if (s === "incomplet") return COULEUR_INCOMPLET
  if (s === "à compléter" || s === "a compléter") return COULEUR_A_COMPLETER
  return COULEUR_COMPLET
}

/**
 * Colonne « Dossier » de la page Artisans.
 *
 * Deux informations distinctes, jamais fusionnées :
 * - le **statut du dossier**, badge historique (vert / orange / rouge) ;
 * - la **pastille violette « n à vérifier »** quand des pièces déposées depuis
 *   le portail attendent une décision (lot L5).
 *
 * Le violet est celui du badge « À vérifier » des rapports
 * (`portal-report-status.ts`) : même geste métier côté gestionnaire, une seule
 * couleur à apprendre. Le nombre de pastilles violettes de la page est la file
 * de travail du gestionnaire, et elle doit pouvoir tomber à zéro.
 */
export function DossierBadge({ statutDossier, piecesAVerifier = 0 }: DossierBadgeProps) {
  const aVerifier = Number.isFinite(piecesAVerifier) && piecesAVerifier > 0 ? piecesAVerifier : 0

  if (!statutDossier && aVerifier === 0) {
    return <span className="text-muted-foreground">&mdash;</span>
  }

  const color = statutDossier ? couleurDossier(statutDossier) : null

  return (
    <div className="flex items-center justify-center gap-1">
      {statutDossier && color && (
        <Badge
          variant="outline"
          className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap"
          style={{
            backgroundColor: hexToRgba(color, 0.15) || color + "20",
            color,
            borderColor: color,
          }}
        >
          {statutDossier}
        </Badge>
      )}
      {aVerifier > 0 && (
        <Badge
          variant="outline"
          data-testid="pieces-a-verifier"
          title={
            aVerifier === 1
              ? "1 pièce déposée en attente de vérification"
              : `${aVerifier} pièces déposées en attente de vérification`
          }
          aria-label={`${aVerifier} ${aVerifier === 1 ? "pièce" : "pièces"} à vérifier`}
          className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap"
          style={{
            backgroundColor:
              hexToRgba(PIECES_A_VERIFIER_COLOR, 0.15) || PIECES_A_VERIFIER_COLOR + "20",
            color: PIECES_A_VERIFIER_COLOR,
            borderColor: PIECES_A_VERIFIER_COLOR,
          }}
        >
          {aVerifier} à vérifier
        </Badge>
      )}
    </div>
  )
}
