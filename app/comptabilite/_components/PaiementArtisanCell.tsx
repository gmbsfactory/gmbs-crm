"use client"

import { useState } from "react"
import { Check, Euro } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { ArtisanPaymentRow } from "@/lib/api/comptaApi"
import {
  PAYMENT_ADMIN_LABELS,
  PAYMENT_STATUSES,
  type PaymentStatus,
} from "@/lib/interventions/payment-status"

/**
 * Page Comptabilité — saisie du statut de paiement **par artisan** (spec §5.7, lot L6).
 *
 * Pourquoi une saisie par ligne d'affectation et non par intervention : une
 * intervention peut porter deux artisans, l'un payé et l'autre non.
 * `intervention_payments.acompte_sst` n'a pas d'`artisan_order` et ne sait donc
 * pas exprimer ce cas — et `is_received` y désigne un encaissement *client*.
 *
 * La date est **obligatoire pour « Payé »** : « Payé le 20/09 » est ce que lit
 * l'artisan ; « Payé » sans date le fait rappeler pour savoir quand.
 */

const COULEURS: Record<PaymentStatus, string> = {
  not_applicable: "#94A3B8",
  awaiting_invoice: "#F59E0B",
  invoice_received: "#3B82F6",
  in_progress: "#6366F1",
  paid: "#10B981",
  disputed: "#EF4444",
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatCourt(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })
}

type Props = {
  interventionId: string
  paiements: ArtisanPaymentRow[]
  onSave: (
    interventionId: string,
    artisanId: string,
    payload: { payment_status: PaymentStatus; paid_at?: string | null },
  ) => Promise<boolean>
  enCours: string | null
  readOnly?: boolean
}

export function PaiementArtisanCell({ interventionId, paiements, onSave, enCours, readOnly = false }: Props) {
  const [open, setOpen] = useState(false)
  const [dates, setDates] = useState<Record<string, string>>({})

  if (paiements.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>
  }

  const enregistrer = async (ligne: ArtisanPaymentRow, statut: PaymentStatus) => {
    const paidAt =
      statut === "paid" ? dates[ligne.artisan_id] ?? ligne.paid_at?.slice(0, 10) ?? aujourdhui() : null
    const ok = await onSave(interventionId, ligne.artisan_id, {
      payment_status: statut,
      paid_at: paidAt,
    })
    if (ok) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
      <PopoverTrigger asChild disabled={readOnly}>
        <button
          type="button"
          className="flex w-full flex-col items-start gap-0.5 text-left"
          aria-label="Statut de paiement des artisans"
          data-testid={`paiement-${interventionId}`}
        >
          {paiements.map((ligne) => (
            <Badge
              key={ligne.artisan_id}
              variant="outline"
              className="max-w-full truncate border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide"
              style={{
                color: COULEURS[ligne.payment_status],
                borderColor: COULEURS[ligne.payment_status],
                backgroundColor: `${COULEURS[ligne.payment_status]}18`,
              }}
            >
              {PAYMENT_ADMIN_LABELS[ligne.payment_status]}
              {ligne.payment_status === "paid" && ligne.paid_at ? ` ${formatCourt(ligne.paid_at)}` : ""}
            </Badge>
          ))}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-3" align="start">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
          <Euro className="h-3.5 w-3.5" aria-hidden />
          Paiement de l&apos;artisan
        </p>
        <div className="space-y-3">
          {paiements.map((ligne) => {
            const busy = enCours === `${interventionId}:${ligne.artisan_id}`
            return (
              <div key={ligne.artisan_id} className="space-y-1.5 rounded-md border p-2">
                <p className="truncate text-xs font-medium">
                  {ligne.artisan_nom}
                  {ligne.is_primary === false && (
                    <span className="ml-1 text-[10px] text-muted-foreground">(2ᵉ artisan)</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1">
                  {PAYMENT_STATUSES.map((statut) => (
                    <Button
                      key={statut}
                      type="button"
                      size="sm"
                      variant={ligne.payment_status === statut ? "default" : "outline"}
                      className="h-6 px-2 text-[10px]"
                      disabled={busy}
                      onClick={() => void enregistrer(ligne, statut)}
                    >
                      {ligne.payment_status === statut && <Check className="mr-1 h-3 w-3" aria-hidden />}
                      {PAYMENT_ADMIN_LABELS[statut]}
                    </Button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor={`paid-at-${interventionId}-${ligne.artisan_id}`}
                      className="text-[10px] text-muted-foreground"
                    >
                      Date de paiement
                    </Label>
                    <Input
                      id={`paid-at-${interventionId}-${ligne.artisan_id}`}
                      type="date"
                      className={cn("h-7 w-[9.5rem] text-xs")}
                      value={dates[ligne.artisan_id] ?? ligne.paid_at?.slice(0, 10) ?? ""}
                      onChange={(e) =>
                        setDates((d) => ({ ...d, [ligne.artisan_id]: e.target.value }))
                      }
                    />
                  </div>
                  <p className="pb-1 text-[10px] text-muted-foreground">
                    Requise pour « Payé »
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
