"use client"

import { Controller, type Control, type UseFormRegister } from "react-hook-form"
import { Building2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SiretField } from "./SiretField"
import {
  STATUT_JURIDIQUE_OPTIONS,
  ZONE_INTERVENTION_OPTIONS,
} from "@/components/ui/artisan-modal/_lib/constants"
import type { ArtisanFormValues } from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

const inputClass =
  "h-8 text-sm bg-background border-input/80 focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
const labelClass = "text-xs font-medium text-foreground/80"

type Props = {
  control: Control<ArtisanFormValues>
  register: UseFormRegister<ArtisanFormValues>
  /**
   * If provided, N° associé renders read-only with this value (used by Create with a generated number).
   * If omitted, the field is editable via register("numero_associe").
   */
  numeroAssocieReadOnlyValue?: string
}

export function CompanyParamsCard({
  control,
  register,
  numeroAssocieReadOnlyValue,
}: Props) {
  const isReadOnly = numeroAssocieReadOnlyValue !== undefined

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4" />
          Paramètres de l&apos;entreprise
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className={labelClass}>Statut juridique</Label>
            <Controller
              name="statut_juridique"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={(value) => {
                    if (value !== field.value) field.onChange(value)
                  }}
                >
                  <SelectTrigger className={inputClass}>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUT_JURIDIQUE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="numero_associe" className={labelClass}>N° associé</Label>
            {isReadOnly ? (
              <Input
                id="numero_associe"
                placeholder={numeroAssocieReadOnlyValue ? "" : "Chargement..."}
                className={`${inputClass} bg-muted/50 font-medium`}
                value={numeroAssocieReadOnlyValue}
                readOnly
                {...register("numero_associe")}
              />
            ) : (
              <Input
                id="numero_associe"
                placeholder="Code interne"
                className={`${inputClass} bg-muted/50 font-medium`}
                {...register("numero_associe")}
              />
            )}
          </div>
        </div>

        <SiretField control={control} />

        <div className="space-y-1">
          <Label className={labelClass}>Zone d&apos;intervention</Label>
          <Controller
            name="zone_intervention"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || ""}
                onValueChange={(value) => {
                  if (value !== field.value) field.onChange(value)
                }}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {ZONE_INTERVENTION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </CardContent>
    </Card>
  )
}
