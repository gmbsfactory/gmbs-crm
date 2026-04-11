"use client"

import type { ReactNode } from "react"
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PresenceFieldIndicator } from "@/components/ui/intervention-modal/PresenceFieldIndicator"
import { cn } from "@/lib/utils"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface InterventionClientSectionProps {
  formData: InterventionFormData
  onChange: (field: keyof InterventionFormData, value: string | boolean) => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  /** Show orange required indicators for client fields */
  requiresClientInfo?: boolean
  withPresence?: boolean
  onOpenSmsModal?: () => void
}

export function InterventionClientSection({
  formData,
  onChange,
  isOpen,
  onOpenChange,
  requiresClientInfo = false,
  withPresence = false,
  onOpenSmsModal,
}: InterventionClientSectionProps) {
  const Presence = withPresence ? PresenceFieldIndicator : PassThrough
  const missingRequired = requiresClientInfo && !formData.is_vacant && (!formData.nomPrenomClient?.trim() || !formData.telephoneClient?.trim())

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card className={cn(missingRequired && "ring-2 ring-orange-400/50")}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
            <CardTitle className="flex items-center gap-2 text-xs">
              Détails client
              {missingRequired && (
                <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" title="Champs obligatoires manquants" />
              )}
              {isOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-3 pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_vacant"
                  className="h-3 w-3 rounded border-gray-300"
                  checked={formData.is_vacant}
                  onChange={(e) => onChange("is_vacant", e.target.checked)}
                />
                <Label htmlFor="is_vacant" className="text-[10px] font-normal cursor-pointer">logement vacant</Label>
              </div>
              {!formData.is_vacant && onOpenSmsModal && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] flex items-center gap-1"
                  onClick={onOpenSmsModal}
                  disabled={!formData.nomPrenomClient || !formData.telephoneClient}
                >
                  <MessageSquare className="h-3 w-3" />
                  SMS
                </Button>
              )}
            </div>
            {formData.is_vacant ? (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="key_code" className="text-[10px]">CODE CLÉ</Label>
                    <Input id="key_code" value={formData.key_code} onChange={(e) => onChange("key_code", e.target.value)} className="h-7 text-xs mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="floor" className="text-[10px]">Étage</Label>
                    <Input id="floor" value={formData.floor} onChange={(e) => onChange("floor", e.target.value)} className="h-7 text-xs mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="apartment_number" className="text-[10px]">N° appart.</Label>
                    <Input id="apartment_number" value={formData.apartment_number} onChange={(e) => onChange("apartment_number", e.target.value)} className="h-7 text-xs mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="vacant_housing_instructions" className="text-[10px]">Consigne</Label>
                  <Textarea
                    id="vacant_housing_instructions"
                    value={formData.vacant_housing_instructions}
                    onChange={(e) => onChange("vacant_housing_instructions", e.target.value)}
                    placeholder="Consignes..."
                    className="min-h-[60px] text-xs mt-1 resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <Label htmlFor="nomPrenomClient" className="text-[10px]">
                    Nom Prénom {requiresClientInfo && !formData.is_vacant && <span className="text-orange-500">*</span>}
                  </Label>
                  <Presence fieldName="nomPrenomClient">
                    <Input
                      id="nomPrenomClient"
                      value={formData.nomPrenomClient}
                      onChange={(e) => onChange("nomPrenomClient", e.target.value)}
                      placeholder="Nom Prénom"
                      className={cn(
                        "h-7 text-xs mt-1",
                        requiresClientInfo && !formData.is_vacant && !formData.nomPrenomClient?.trim() && "border-orange-400 focus-visible:ring-orange-400",
                      )}
                    />
                  </Presence>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="telephoneClient" className="text-[10px]">
                      Téléphone {requiresClientInfo && !formData.is_vacant && <span className="text-orange-500">*</span>}
                    </Label>
                    <Presence fieldName="telephoneClient">
                      <Input
                        id="telephoneClient"
                        value={formData.telephoneClient}
                        onChange={(e) => onChange("telephoneClient", e.target.value)}
                        placeholder="06..."
                        className={cn(
                          "h-7 text-xs mt-1",
                          requiresClientInfo && !formData.is_vacant && !formData.telephoneClient?.trim() && "border-orange-400 focus-visible:ring-orange-400",
                        )}
                      />
                    </Presence>
                  </div>
                  <div>
                    <Label htmlFor="emailClient" className="text-[10px]">Email</Label>
                    <Presence fieldName="emailClient">
                      <Input
                        id="emailClient"
                        type="email"
                        value={formData.emailClient}
                        onChange={(e) => onChange("emailClient", e.target.value)}
                        placeholder="email@..."
                        className="h-7 text-xs mt-1"
                      />
                    </Presence>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function PassThrough({ children }: { fieldName: string; children: ReactNode }) {
  return <>{children}</>
}
