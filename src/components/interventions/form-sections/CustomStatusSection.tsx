"use client"

import { ChevronDown, ChevronRight, Palette, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { PresenceFieldIndicator } from "@/components/ui/intervention-modal/PresenceFieldIndicator"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface CustomStatusSectionProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  formData: InterventionFormData
  onChange: (field: string, value: string) => void
}

export function CustomStatusSection({
  isOpen,
  onOpenChange,
  formData,
  onChange,
}: CustomStatusSectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
            <CardTitle className="flex items-center gap-2 text-xs">
              <Palette className="h-3 w-3" />
              Sous-statut
              {formData.sousStatutText && (
                <span
                  className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded"
                  style={{
                    color: formData.sousStatutTextColor,
                    backgroundColor: formData.sousStatutBgColor !== 'transparent' ? formData.sousStatutBgColor : undefined
                  }}
                >
                  {formData.sousStatutText}
                </span>
              )}
              {isOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-3 pb-3">
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground">
                Ajoutez un sous-statut personnalisé pour cette intervention (max 25 caractères).
              </p>
              <div>
                <Label htmlFor="sousStatutText" className="text-[10px]">Texte du sous-statut</Label>
                <PresenceFieldIndicator fieldName="sousStatutText">
                <Input
                  id="sousStatutText"
                  value={formData.sousStatutText}
                  onChange={(e) => onChange("sousStatutText", e.target.value)}
                  placeholder="Ex: Devis supp, Urgent..."
                  maxLength={25}
                  className="h-7 text-xs mt-1"
                />
                </PresenceFieldIndicator>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor="sousStatutTextColor" className="text-[10px]">Couleur du texte</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      id="sousStatutTextColor"
                      value={formData.sousStatutTextColor}
                      onChange={(e) => onChange("sousStatutTextColor", e.target.value)}
                      className="h-7 w-12 rounded border border-input cursor-pointer p-0.5"
                      title="Couleur du texte"
                    />
                    <span className="text-[10px] text-muted-foreground">{formData.sousStatutTextColor}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <Label htmlFor="sousStatutBgColor" className="text-[10px]">Surlignage</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      id="sousStatutBgColor"
                      value={formData.sousStatutBgColor === 'transparent' ? '#ffffff' : formData.sousStatutBgColor}
                      onChange={(e) => onChange("sousStatutBgColor", e.target.value)}
                      className="h-7 w-12 rounded border border-input cursor-pointer p-0.5"
                      title="Couleur de surlignage"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[9px]"
                      onClick={() => onChange("sousStatutBgColor", "transparent")}
                      title="Supprimer le surlignage"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              {formData.sousStatutText && (
                <div className="p-2 bg-muted/50 rounded-lg border border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">Aperçu :</p>
                  <span
                    className="text-sm font-medium px-1.5 py-0.5 rounded"
                    style={{
                      color: formData.sousStatutTextColor,
                      backgroundColor: formData.sousStatutBgColor !== 'transparent' ? formData.sousStatutBgColor : undefined
                    }}
                  >
                    {formData.sousStatutText}
                  </span>
                </div>
              )}
              {formData.sousStatutText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-destructive hover:text-destructive"
                  onClick={() => {
                    onChange("sousStatutText", "")
                    onChange("sousStatutTextColor", "#000000")
                    onChange("sousStatutBgColor", "transparent")
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Effacer le sous-statut
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
