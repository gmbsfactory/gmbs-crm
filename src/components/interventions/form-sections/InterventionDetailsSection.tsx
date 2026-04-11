"use client"

import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { PresenceFieldIndicator } from "@/components/ui/intervention-modal/PresenceFieldIndicator"
import { cn } from "@/lib/utils"
import { formatMarginPercentage, getMarginColorClass } from "@/lib/utils/margin-calculator"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface MarginData {
  isValid: boolean
  marginPercentage: number
}

interface InterventionDetailsSectionProps {
  formData: InterventionFormData
  onChange: (field: keyof InterventionFormData, value: string) => void
  margePrimaryArtisan: MarginData
  requiresDatePrevue: boolean
  /** Edit-only: lock contexte for non-admin users */
  canEditContext?: boolean
  /** Edit-only: show required indicator on consigne */
  requiresConsigneArtisan?: boolean
  /** Edit-only: show required indicator on costs */
  requiresCouts?: boolean
  withPresence?: boolean
}

/**
 * Grid rows 5-6: Contexte + Consigne + Finances/Planning
 */
export function InterventionDetailsSection({
  formData,
  onChange,
  margePrimaryArtisan,
  requiresDatePrevue,
  canEditContext = true,
  requiresConsigneArtisan = false,
  requiresCouts = false,
  withPresence = false,
}: InterventionDetailsSectionProps) {
  const Presence = withPresence ? PresenceFieldIndicator : PassThrough

  return (
    <>
      {/* DIV5: CONTEXTE INTERVENTION - Row 5, Cols 1-2 */}
      <Card style={{ gridArea: "5 / 1 / 6 / 3" }}>
        <CardContent className="p-4">
          <Label htmlFor="contexteIntervention" className="text-xs font-medium mb-2 block">Contexte intervention *</Label>
          <Presence fieldName="contexteIntervention">
            <Textarea
              id="contexteIntervention"
              value={formData.contexte_intervention}
              onChange={canEditContext ? (event) => onChange("contexte_intervention", event.target.value) : undefined}
              placeholder="Décrivez le contexte..."
              rows={4}
              className={cn("text-sm resize-none", !canEditContext && "cursor-not-allowed bg-muted/50 text-muted-foreground")}
              readOnly={!canEditContext}
              aria-readonly={!canEditContext}
              required
            />
          </Presence>
          {!canEditContext && <p className="mt-1 text-[10px] text-muted-foreground">Admin uniquement</p>}
        </CardContent>
      </Card>

      {/* DIV6: CONSIGNE INTERVENTION - Row 5, Cols 3-4 */}
      <Card
        style={{ gridArea: "5 / 3 / 6 / 5" }}
        className={cn(requiresConsigneArtisan && !formData.consigne_intervention?.trim() && "ring-2 ring-orange-400/50")}
      >
        <CardContent className="p-4">
          <Label htmlFor="consigneIntervention" className="text-xs font-medium mb-2 block">
            Consigne pour l&apos;artisan {requiresConsigneArtisan && <span className="text-orange-500">*</span>}
          </Label>
          <Presence fieldName="consigneIntervention">
            <Textarea
              id="consigneIntervention"
              value={formData.consigne_intervention}
              onChange={(event) => onChange("consigne_intervention", event.target.value)}
              placeholder="Consignes spécifiques..."
              rows={4}
              className={cn(
                "text-sm resize-none",
                requiresConsigneArtisan && !formData.consigne_intervention?.trim() && "border-orange-400 focus-visible:ring-orange-400",
              )}
            />
          </Presence>
        </CardContent>
      </Card>

      {/* DIV4: FINANCES & PLANIFICATION - Row 6, Cols 1-4 */}
      <Card
        style={{ gridArea: "6 / 1 / 7 / 5" }}
        className={cn(
          requiresCouts && (!(parseFloat(formData.coutIntervention) > 0) || !(parseFloat(formData.coutSST) > 0)) && "ring-2 ring-orange-400/50",
        )}
      >
        <CardContent className="p-4">
          <div className="grid grid-cols-5 gap-3 items-end">
            <Presence fieldName="coutIntervention">
              <div>
                <Label htmlFor="coutIntervention" className="text-xs">
                  Coût inter. {requiresCouts && <span className="text-orange-500">*</span>}
                </Label>
                <Input
                  id="coutIntervention"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.coutIntervention}
                  onChange={(e) => onChange("coutIntervention", e.target.value)}
                  placeholder="0.00 €"
                  className={cn(
                    "h-8 text-sm mt-1",
                    requiresCouts && !(parseFloat(formData.coutIntervention) > 0) && "border-orange-400 focus-visible:ring-orange-400",
                  )}
                />
              </div>
            </Presence>
            <Presence fieldName="coutSST">
              <div>
                <Label htmlFor="coutSST" className="text-xs">
                  Coût SST {requiresCouts && <span className="text-orange-500">*</span>}
                </Label>
                <Input
                  id="coutSST"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.coutSST}
                  onChange={(e) => onChange("coutSST", e.target.value)}
                  placeholder="0.00 €"
                  className={cn(
                    "h-8 text-sm mt-1",
                    requiresCouts && !(parseFloat(formData.coutSST) > 0) && "border-orange-400 focus-visible:ring-orange-400",
                  )}
                />
              </div>
            </Presence>
            <Presence fieldName="coutMateriel">
              <div>
                <Label htmlFor="coutMateriel" className="text-xs">Coût mat.</Label>
                <Input
                  id="coutMateriel"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.coutMateriel}
                  onChange={(e) => onChange("coutMateriel", e.target.value)}
                  placeholder="0.00 €"
                  className="h-8 text-sm mt-1"
                />
              </div>
            </Presence>
            <div>
              <Label className="text-xs">Marge</Label>
              <div className="flex h-8 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm items-center mt-1">
                {margePrimaryArtisan.isValid ? (
                  <span className={cn("font-medium", getMarginColorClass(margePrimaryArtisan.marginPercentage))}>
                    {formatMarginPercentage(margePrimaryArtisan.marginPercentage)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-- %</span>
                )}
              </div>
            </div>
            <Presence fieldName="datePrevue">
              <div className="relative">
                <Label htmlFor="datePrevue" className="text-xs">
                  Date prévue {requiresDatePrevue && <span className="text-orange-500">*</span>}
                </Label>
                <Input
                  id="datePrevue"
                  type="date"
                  value={formData.date_prevue}
                  onChange={(e) => onChange("date_prevue", e.target.value)}
                  className={cn(
                    "h-8 text-sm mt-1",
                    requiresDatePrevue && !formData.date_prevue?.trim() && "border-orange-400 focus-visible:ring-orange-400",
                  )}
                  required={requiresDatePrevue}
                />
                {requiresDatePrevue && !formData.date_prevue?.trim() && (
                  <span className="absolute top-0 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Date prévue requise" />
                )}
              </div>
            </Presence>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

function PassThrough({ children }: { fieldName: string; children: ReactNode }) {
  return <>{children}</>
}
