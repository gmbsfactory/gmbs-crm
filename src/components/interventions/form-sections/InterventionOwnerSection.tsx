"use client"

import type { ReactNode } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PresenceFieldIndicator } from "@/components/ui/intervention-modal/PresenceFieldIndicator"
import { cn } from "@/lib/utils"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface InterventionOwnerSectionProps {
  formData: InterventionFormData
  onChange: (field: keyof InterventionFormData, value: string) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Show orange required indicator on card + input */
  requiresNomFacturation?: boolean
  withPresence?: boolean
}

export function InterventionOwnerSection({
  formData,
  onChange,
  isOpen,
  onOpenChange,
  requiresNomFacturation = false,
  withPresence = false,
}: InterventionOwnerSectionProps) {
  const Presence = withPresence ? PresenceFieldIndicator : PassThrough

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className={cn(requiresNomFacturation && !formData.nomPrenomFacturation?.trim() && "ring-2 ring-orange-400/50")}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
            <CardTitle className="flex items-center gap-2 text-xs">
              Détails facturation
              {requiresNomFacturation && !formData.nomPrenomFacturation?.trim() && (
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champ obligatoire manquant" />
              )}
              {isOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-3 pb-3">
            <div className="space-y-2">
              <div>
                <Label htmlFor="nomPrenomFacturation" className="text-[10px]">
                  Nom Prénom {requiresNomFacturation && <span className="text-orange-500">*</span>}
                </Label>
                <Presence fieldName="nomPrenomFacturation">
                  <Input
                    id="nomPrenomFacturation"
                    value={formData.nomPrenomFacturation}
                    onChange={(e) => onChange("nomPrenomFacturation", e.target.value)}
                    placeholder="Nom Prénom"
                    className={cn(
                      "h-7 text-xs mt-1",
                      requiresNomFacturation && !formData.nomPrenomFacturation?.trim() && "border-orange-400 focus-visible:ring-orange-400",
                    )}
                  />
                </Presence>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="telephoneProprietaire" className="text-[10px]">Téléphone</Label>
                  <Presence fieldName="telephoneProprietaire">
                    <Input
                      id="telephoneProprietaire"
                      value={formData.telephoneProprietaire}
                      onChange={(e) => onChange("telephoneProprietaire", e.target.value)}
                      placeholder="06..."
                      className="h-7 text-xs mt-1"
                    />
                  </Presence>
                </div>
                <div>
                  <Label htmlFor="emailProprietaire" className="text-[10px]">Email</Label>
                  <Presence fieldName="emailProprietaire">
                    <Input
                      id="emailProprietaire"
                      type="email"
                      value={formData.emailProprietaire}
                      onChange={(e) => onChange("emailProprietaire", e.target.value)}
                      placeholder="email@..."
                      className="h-7 text-xs mt-1"
                    />
                  </Presence>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function PassThrough({ children }: { fieldName: string; children: ReactNode }) {
  return <>{children}</>
}
