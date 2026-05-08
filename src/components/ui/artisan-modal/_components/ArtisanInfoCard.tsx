"use client"

import type { ReactNode } from "react"
import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form"
import { User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { AddressField } from "./AddressField"
import { MetiersPicker, type MetierOption } from "./MetiersPicker"
import type { ArtisanFormValues } from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

const inputClass =
  "h-8 text-sm bg-background border-input/80 focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/60"
const labelClass = "text-xs font-medium text-foreground/80"

type Props = {
  control: Control<ArtisanFormValues>
  register: UseFormRegister<ArtisanFormValues>
  watch: UseFormWatch<ArtisanFormValues>
  setValue: UseFormSetValue<ArtisanFormValues>
  metierOptions: MetierOption[]
  latitude: number | null
  longitude: number | null
  /** When true, fields enforce required validation, show ` *` on labels and an orange pulse when empty after submit. */
  required?: boolean
  /** Triggers the required indicator UI (only meaningful when required=true). */
  isSubmitted?: boolean
  /** Optional initial address; used by Edit modal to seed AddressField after data loads. */
  initialAddress?: string
  /** Remount key — used by Edit to reset AddressField when artisan data arrives. */
  addressFieldKey?: string
  /** Right-side header content (e.g. dossier badge + isDirty badge in Edit). */
  headerExtra?: ReactNode
}

export function ArtisanInfoCard({
  control,
  register,
  watch,
  setValue,
  metierOptions,
  latitude,
  longitude,
  required = false,
  isSubmitted = false,
  initialAddress,
  addressFieldKey,
  headerExtra,
}: Props) {
  const showIndicator = required && isSubmitted
  const star = required ? " *" : ""

  const requiredCls = (value: string | undefined | null) =>
    cn(
      inputClass,
      showIndicator && !value?.toString().trim() && "border-orange-400 focus-visible:ring-orange-400",
    )

  const indicator = (value: string | undefined | null) =>
    showIndicator && !value?.toString().trim() ? (
      <span
        className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-orange-500 animate-pulse"
        title="Champ obligatoire"
      />
    ) : null

  const prenom = watch("prenom")
  const nom = watch("nom")
  const raisonSociale = watch("raison_sociale")
  const telephone = watch("telephone")
  const email = watch("email")

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4" />
            Informations de l&apos;artisan
          </CardTitle>
          {headerExtra ? <div className="flex items-center gap-2">{headerExtra}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="prenom" className={labelClass}>{`Prénom${star}`}</Label>
            <div className="relative">
              <Input
                id="prenom"
                placeholder="Prénom"
                className={requiredCls(prenom)}
                {...register("prenom", required ? { required: true } : undefined)}
              />
              {indicator(prenom)}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nom" className={labelClass}>{`Nom${star}`}</Label>
            <div className="relative">
              <Input
                id="nom"
                placeholder="Nom"
                className={requiredCls(nom)}
                {...register("nom", required ? { required: true } : undefined)}
              />
              {indicator(nom)}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="raison_sociale" className={labelClass}>{`Raison sociale${star}`}</Label>
          <div className="relative">
            <Input
              id="raison_sociale"
              placeholder="Nom de l'entreprise"
              className={requiredCls(raisonSociale)}
              {...register("raison_sociale", required ? { required: true } : undefined)}
            />
            {indicator(raisonSociale)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="telephone" className={labelClass}>{`Téléphone${star}`}</Label>
            <div className="relative">
              <Input
                id="telephone"
                placeholder="06 00 00 00 00"
                className={requiredCls(telephone)}
                {...register("telephone", required ? { required: true } : undefined)}
              />
              {indicator(telephone)}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="telephone2" className={labelClass}>Tél. secondaire</Label>
            <Input
              id="telephone2"
              placeholder="Optionnel"
              className={inputClass}
              {...register("telephone2")}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="email" className={labelClass}>{`Email${star}`}</Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              placeholder="contact@email.com"
              className={requiredCls(email)}
              {...register("email", required ? { required: true } : undefined)}
            />
            {indicator(email)}
          </div>
        </div>

        <div className="space-y-1">
          <Label className={labelClass}>{`Métiers${star}`}</Label>
          <MetiersPicker
            control={control}
            options={metierOptions}
            required={required}
            showRequiredIndicator={showIndicator}
          />
        </div>

        <AddressField
          key={addressFieldKey}
          register={register}
          setValue={setValue}
          latitude={latitude}
          longitude={longitude}
          initialAddress={initialAddress}
          showRequiredIndicator={showIndicator}
        />
      </CardContent>
    </Card>
  )
}
