"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PresenceFieldIndicator } from "@/components/ui/intervention-modal/PresenceFieldIndicator"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface PaymentSectionProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  formData: InterventionFormData
  canEditAccomptes: boolean

  // Handlers
  handleAccompteSSTChange: (value: string) => void
  handleAccompteClientChange: (value: string) => void
  handleAccompteSSTBlur: () => void
  handleAccompteClientBlur: () => void
  handleAccompteSSTRecuChange: (checked: boolean) => void
  handleAccompteClientRecuChange: (checked: boolean) => void
  handleDateAccompteSSTRecuChange: (value: string) => void
  handleDateAccompteClientRecuChange: (value: string) => void
}

export function PaymentSection({
  isOpen,
  onOpenChange,
  formData,
  canEditAccomptes,
  handleAccompteSSTChange,
  handleAccompteClientChange,
  handleAccompteSSTBlur,
  handleAccompteClientBlur,
  handleAccompteSSTRecuChange,
  handleAccompteClientRecuChange,
  handleDateAccompteSSTRecuChange,
  handleDateAccompteClientRecuChange,
}: PaymentSectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
            <CardTitle className="flex items-center gap-2 text-xs">
              Gestion des acomptes
              {isOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-3 pb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="accompteClient" className="text-[10px]">Acompte client</Label>
                <PresenceFieldIndicator fieldName="accompteClient">
                <Input id="accompteClient" value={formData.accompteClient} onChange={(e) => handleAccompteClientChange(e.target.value)} onBlur={handleAccompteClientBlur} placeholder="Montant" className="h-7 text-xs" disabled={!canEditAccomptes} type="number" step="0.01" min="0" />
                </PresenceFieldIndicator>
              </div>
              <div>
                <Label className="text-[10px]">Reçu</Label>
                <div className="flex items-center gap-1">
                  <input type="checkbox" checked={formData.accompteClientRecu} onChange={(e) => handleAccompteClientRecuChange(e.target.checked)} className="h-3 w-3" />
                  <Input type="date" value={formData.dateAccompteClientRecu} onChange={(e) => handleDateAccompteClientRecuChange(e.target.value)} className="h-7 text-xs flex-1" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="accompteSST" className="text-[10px]">Acompte SST</Label>
                <PresenceFieldIndicator fieldName="accompteSST">
                <Input id="accompteSST" value={formData.accompteSST} onChange={(e) => handleAccompteSSTChange(e.target.value)} onBlur={handleAccompteSSTBlur} placeholder="Montant" className="h-7 text-xs" disabled={!canEditAccomptes} type="number" step="0.01" min="0" />
                </PresenceFieldIndicator>
              </div>
              <div>
                <Label className="text-[10px]">Envoyé</Label>
                <div className="flex items-center gap-1">
                  <input type="checkbox" checked={formData.accompteSSTRecu} onChange={(e) => handleAccompteSSTRecuChange(e.target.checked)} className="h-3 w-3" />
                  <Input type="date" value={formData.dateAccompteSSTRecu} onChange={(e) => handleDateAccompteSSTRecuChange(e.target.value)} className="h-7 text-xs flex-1" />
                </div>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground">Éditable si statut = Accepté ou Attente acompte</p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
