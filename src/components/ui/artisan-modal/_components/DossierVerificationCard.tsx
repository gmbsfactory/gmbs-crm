"use client"

import React, { useMemo, useState } from "react"
import { BadgeCheck, ChevronDown, ChevronRight, ExternalLink, ShieldCheck, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DocumentPreview } from "@/components/documents/DocumentPreview"
import type { AttachmentRecord } from "@/components/documents/types"
import {
  MAX_REVIEW_COMMENT_LENGTH,
  PIECES_A_VERIFIER_COLOR,
  estVerifiee,
  reviewLabel,
} from "@/lib/artisans/document-review"
import { useArtisanDossierReview } from "@/components/ui/artisan-modal/_hooks/useArtisanDossierReview"
import { ARTISAN_DOCUMENT_KINDS } from "@/components/ui/artisan-modal/_lib/constants"

type Props = {
  artisanId: string
  /** `artisans.dossier_validated_at` : posé par le trigger au passage à COMPLET. */
  dossierValidatedAt?: string | null
  /** Lecture seule (permission absente ou édition verrouillée par un autre gestionnaire). */
  readOnly?: boolean
}

const LIBELLE_PAR_KIND = new Map(ARTISAN_DOCUMENT_KINDS.map((k) => [k.kind, k.label]))

function formatDate(valeur: string | null | undefined): string {
  if (!valeur) return ""
  const date = new Date(valeur)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
}

/** Couleur du badge d'état d'une pièce. */
function couleurEtat(reviewStatus: string | null | undefined): string {
  if (reviewStatus === "pending") return PIECES_A_VERIFIER_COLOR
  if (reviewStatus === "rejected") return "#EF4444"
  return "#10B981"
}

/**
 * Fiche artisan — carte « Vérification des pièces » (spec §5.5, lot L5).
 *
 * Ce que la carte apporte, et qui manquait entièrement côté CRM :
 * - un **aperçu** de chaque pièce déposée ;
 * - **Valider** / **Refuser** par pièce, le refus exigeant un **motif** (le
 *   bouton reste désactivé tant que le champ est vide : l'artisan doit savoir
 *   quoi redéposer, sinon il redépose la même chose) ;
 * - une **date de validité** facultative, rangée dans `metadata.valid_until` ;
 * - la mention « vérifiée le … » — affichée **seulement** si `reviewed_at` est
 *   renseigné : `review_status` a pour DEFAULT `'approved'`, une pièce héritée
 *   de l'historique n'a donc jamais été regardée par personne ;
 * - « **Dossier complet validé le …** » dès que `dossier_validated_at` est posé.
 */
export function DossierVerificationCard({ artisanId, dossierValidatedAt, readOnly = false }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [refusPiece, setRefusPiece] = useState<AttachmentRecord | null>(null)
  const [motif, setMotif] = useState("")
  const [validites, setValidites] = useState<Record<string, string>>({})

  const { pieces, nbAVerifier, dossierValidable, isLoading, enCours, reviewPiece, validerDossier } =
    useArtisanDossierReview(artisanId, isOpen)

  const dateValidation = useMemo(() => formatDate(dossierValidatedAt), [dossierValidatedAt])

  const fermerRefus = () => {
    setRefusPiece(null)
    setMotif("")
  }

  const confirmerRefus = async () => {
    if (!refusPiece || !motif.trim()) return
    await reviewPiece(refusPiece.id, { decision: "rejected", comment: motif.trim() })
    fermerRefus()
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/50">
              <CardTitle className="flex items-center gap-2 text-sm justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Vérification des pièces
                  {nbAVerifier > 0 && (
                    <Badge
                      variant="outline"
                      data-testid="dossier-a-verifier"
                      className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide"
                      style={{
                        color: PIECES_A_VERIFIER_COLOR,
                        borderColor: PIECES_A_VERIFIER_COLOR,
                        backgroundColor: `${PIECES_A_VERIFIER_COLOR}20`,
                      }}
                    >
                      {nbAVerifier} à vérifier
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {dateValidation && (
                    <span className="text-[11px] font-normal text-emerald-600 flex items-center gap-1">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Dossier complet validé le {dateValidation}
                    </span>
                  )}
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              {isLoading && <p className="text-xs text-muted-foreground">Chargement des pièces…</p>}

              {!isLoading && pieces.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucune pièce déposée pour le moment.
                </p>
              )}

              {pieces.map((piece) => {
                const etat = piece.review_status ?? null
                const couleur = couleurEtat(etat)
                const verifiee = estVerifiee(piece.reviewed_at)
                const validUntil = (piece.metadata?.valid_until as string | undefined) ?? ""
                const enTraitement = enCours === piece.id

                return (
                  <div
                    key={piece.id}
                    data-testid={`piece-${piece.id}`}
                    className="rounded-md border p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate">
                            {LIBELLE_PAR_KIND.get(piece.kind) ?? piece.kind}
                          </span>
                          <Badge
                            variant="outline"
                            className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide"
                            style={{
                              color: couleur,
                              borderColor: couleur,
                              backgroundColor: `${couleur}20`,
                            }}
                          >
                            {reviewLabel(etat)}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {piece.filename ?? "Sans nom"}
                        </p>
                        {/* Une pièce héritée du DEFAULT 'approved' n'affiche RIEN :
                            seul reviewed_at atteste d'une décision humaine. */}
                        {verifiee && (
                          <p className="text-[11px] text-muted-foreground">
                            Vérifiée le {formatDate(piece.reviewed_at)}
                          </p>
                        )}
                        {etat === "rejected" && piece.review_comment && (
                          <p className="text-[11px] text-red-600 mt-1 whitespace-pre-wrap">
                            Motif : {piece.review_comment}
                          </p>
                        )}
                        {validUntil && (
                          <p className="text-[11px] text-muted-foreground">
                            Valide jusqu&apos;au {formatDate(validUntil)}
                          </p>
                        )}
                      </div>
                      <a
                        href={piece.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Ouvrir la pièce dans un nouvel onglet"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    <DocumentPreview
                      url={piece.url}
                      mimeType={piece.mime_type}
                      filename={piece.filename ?? undefined}
                      className="h-32"
                    />

                    {!readOnly && (
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`validite-${piece.id}`}
                            className="text-[10px] text-muted-foreground"
                          >
                            Date de validité
                          </Label>
                          <Input
                            id={`validite-${piece.id}`}
                            type="date"
                            className="h-8 w-[9.5rem] text-xs"
                            value={validites[piece.id] ?? validUntil}
                            onChange={(e) =>
                              setValidites((v) => ({ ...v, [piece.id]: e.target.value }))
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          disabled={enTraitement}
                          onClick={() =>
                            reviewPiece(piece.id, {
                              decision: "approved",
                              validUntil: validites[piece.id] ?? validUntil ?? null,
                            })
                          }
                        >
                          <BadgeCheck className="h-3.5 w-3.5 mr-1" />
                          Valider
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-red-600"
                          disabled={enTraitement}
                          onClick={() => {
                            setRefusPiece(piece)
                            setMotif("")
                          }}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Refuser
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}

              {!readOnly && (
                <div className="pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={!dossierValidable || enCours === "__dossier__"}
                    title={
                      dossierValidable
                        ? "Endosser le dossier de cet artisan"
                        : "Les 5 pièces requises doivent d'abord être validées"
                    }
                    onClick={() => void validerDossier()}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                    Valider le dossier
                  </Button>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Refus : motif OBLIGATOIRE, le bouton reste désactivé tant qu'il est vide. */}
      <Dialog open={Boolean(refusPiece)} onOpenChange={(open) => !open && fermerRefus()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refuser la pièce</DialogTitle>
            <DialogDescription>
              Le motif est obligatoire : il est affiché en entier à l&apos;artisan, qui saura quoi
              redéposer.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value.slice(0, MAX_REVIEW_COMMENT_LENGTH))}
            placeholder="Ex. : le Kbis date de plus de 3 mois."
            rows={4}
            aria-label="Motif du refus"
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={fermerRefus}>
              Annuler
            </Button>
            <Button type="button" disabled={!motif.trim()} onClick={() => void confirmerRefus()}>
              Refuser la pièce
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
