"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { INTERVENTION_STATUS, INTERVENTION_STATUS_ORDER } from "@/config/interventions"
import { useInterventionForm, useStatusGuard } from "@/hooks/useInterventionForm"
import type { CreateInterventionInput, UpdateInterventionInput, InterventionStatusValue } from "@/types/interventions"
import { supabase } from "@/lib/supabase-client"
import { cn } from "@/lib/utils"

const ARTISAN_REQUIRED_STATUSES: InterventionStatusValue[] = [
  "VISITE_TECHNIQUE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
]

export type InterventionFormProps = {
  mode?: "create" | "edit"
  interventionId?: string
  defaultValues?: Partial<CreateInterventionInput & UpdateInterventionInput>
  onSuccess?: (payload: unknown) => void
}

export default function InterventionForm({
  mode = "create",
  interventionId,
  defaultValues,
  onSuccess,
}: InterventionFormProps) {
  const [canEditContext, setCanEditContext] = useState(mode !== "edit")

  const { form, submit, isSubmitting, serverError, duplicates, checkDuplicates } = useInterventionForm({
    mode,
    interventionId,
    defaultValues,
    onSuccess,
    canEditContext: mode === "create" ? true : canEditContext,
  })

  useEffect(() => {
    if (mode !== "edit") {
      return
    }

    let cancelled = false

    const loadRoles = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!response.ok) {
          throw new Error("Impossible de récupérer l'utilisateur courant")
        }

        const payload = await response.json()
        if (cancelled) return

        const roles: string[] = Array.isArray(payload?.user?.roles) ? payload.user.roles : []
        const isAdmin = roles.some(
          (role) => typeof role === "string" && role.toLowerCase().includes("admin"),
        )
        setCanEditContext(isAdmin)
      } catch (error) {
        if (!cancelled) {
          setCanEditContext(false)
        }
      }
    }

    loadRoles()

    return () => {
      cancelled = true
    }
  }, [mode])

  const status = (form.watch("status") as InterventionStatusValue | undefined) ?? "DEMANDE"
  const artisanId = form.watch("artisanId") as string | undefined
  const { error: statusError, validate } = useStatusGuard({ status, artisanId })
  const isContextReadOnly = mode === "edit" && !canEditContext

  const [isSearchingArtisan, setIsSearchingArtisan] = useState(false)
  const [artisanResults, setArtisanResults] = useState<unknown[]>([])

  useEffect(() => {
    if (mode !== "create") return

    const subscription = form.watch((value) => {
      const name = value.name as string
      const address = value.address as string
      const agency = value.agency as string | undefined
      if (name && address) {
        checkDuplicates({ name, address, agency })
      }
    })
    return () => subscription.unsubscribe()
  }, [checkDuplicates, form, mode])

  const statusOptions = useMemo(
    () =>
      INTERVENTION_STATUS_ORDER.map((key) => ({
        key,
        label: INTERVENTION_STATUS[key].label,
      })),
    [],
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return
    await submit(event)
  }

  const handleArtisanSearch = async () => {
    setIsSearchingArtisan(true)
    try {
      // TODO: Brancher l'intégration Google Maps + recherche locale/artisan
      const response = await fetch("/api/interventions/artisans/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: form.getValues("artisanId"),
          address: form.getValues("address"),
        }),
      })
      if (!response.ok) {
        throw new Error("Recherche artisan indisponible")
      }
      const data = await response.json()
      setArtisanResults(data)
    } catch (error) {
      console.warn("[InterventionForm] artisan search placeholder", error)
    } finally {
      setIsSearchingArtisan(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
        <div className="intervention-form-section">
          <div className="intervention-form-section-header">
            <div className="intervention-form-section-title">Informations principales</div>
          </div>
          <div className="intervention-form-section-content">
            <div className="intervention-form-field">
              <Label htmlFor="name" className="intervention-form-label">Nom intervention *</Label>
              <Input 
                id="name" 
                placeholder="Ex: Rénovation toiture" 
                className="intervention-form-input"
                {...form.register("name")} 
                required 
              />
            </div>
            <div className="intervention-form-field">
              <Label htmlFor="address" className="intervention-form-label">Adresse *</Label>
              <Input 
                id="address" 
                placeholder="123 rue de Paris, Lyon" 
                className="intervention-form-input"
                {...form.register("address")} 
                required 
              />
            </div>
            <div className="intervention-form-field">
              <Label htmlFor="context" className="intervention-form-label">Contexte d&apos;intervention *</Label>
              <Textarea 
                id="context" 
                placeholder="Préciser le contexte client/agence" 
                rows={3} 
                className={cn(
                  "intervention-form-textarea",
                  isContextReadOnly && "cursor-not-allowed bg-muted/50 text-muted-foreground",
                )}
                readOnly={isContextReadOnly}
                aria-readonly={isContextReadOnly}
                {...form.register("context")} 
                required 
              />
              {isContextReadOnly && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Seuls les administrateurs peuvent modifier ce champ après création.
                </p>
              )}
            </div>
            <div className="intervention-form-field">
              <Label htmlFor="agency" className="intervention-form-label">Agence</Label>
              <Input 
                id="agency" 
                placeholder="GMBS Lyon" 
                className="intervention-form-input"
                {...form.register("agency")} 
              />
            </div>
            <div className="intervention-form-field">
              <Label htmlFor="invoice2goId" className="intervention-form-label">ID Invoice2go</Label>
              <Input 
                id="invoice2goId" 
                placeholder="Définir pour valider l&apos;intervention" 
                className="intervention-form-input"
                {...form.register("invoice2goId")}
                onBlur={async () => {
                  const value = form.getValues("invoice2goId")
                  if (!value) return
                  // TODO: appeler l'API pour précharger le PDF/preview Invoice2go
                  await fetch("/api/interventions/invoice", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ invoice2goId: value }),
                  }).catch((error) => {
                    console.warn("[InterventionForm] invoice preview placeholder", error)
                  })
                }}
              />
            </div>
            <div className="intervention-form-field">
              <Label htmlFor="consigne" className="intervention-form-label">Consignes à l&apos;artisan</Label>
              <Textarea 
                id="consigne" 
                placeholder="Instructions spécifiques" 
                rows={2} 
                className="intervention-form-textarea"
                {...form.register("consigne")} 
              />
            </div>
          </div>
        </div>

        <div className="intervention-form-section">
          <div className="intervention-form-section-header">
            <div className="intervention-form-section-title">Statut &amp; planification</div>
          </div>
          <div className="intervention-form-section-content">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="intervention-form-field">
                <Label className="intervention-form-label">Statut</Label>
                <Select
                  value={status}
                  onValueChange={(value) => form.setValue("status", value as InterventionStatusValue, { shouldValidate: true })}
                >
                  <SelectTrigger className="intervention-form-select">
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.key} value={option.key}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}
              </div>
              <div className="intervention-form-field">
                <Label htmlFor="dueAt" className="intervention-form-label">Échéance</Label>
                <Input 
                  id="dueAt" 
                  type="date" 
                  className="intervention-form-input"
                  {...form.register("dueAt")} 
                />
                {status === "INTER_EN_COURS" ? (
                  <p className="text-xs text-muted-foreground">
                    Défaut automatique à +7 jours si laissé vide.
                  </p>
                ) : null}
              </div>
              <div className="intervention-form-field">
                <Label htmlFor="artisanId" className="intervention-form-label">
                  Artisan assigné {ARTISAN_REQUIRED_STATUSES.includes(status) ? "*" : ""}
                </Label>
                <div className="flex gap-2">
                  <Input 
                    id="artisanId" 
                    placeholder="UUID artisan" 
                    className="intervention-form-input"
                    {...form.register("artisanId")} 
                  />
                  <Button 
                    type="button" 
                    className="intervention-form-button"
                    onClick={handleArtisanSearch} 
                    disabled={isSearchingArtisan}
                  >
                    Rechercher
                  </Button>
                </div>
                {ARTISAN_REQUIRED_STATUSES.includes(status) ? (
                  <p className="text-xs text-muted-foreground">Requis pour ce statut.</p>
                ) : null}
              </div>
              <div className="intervention-form-field">
                <Label htmlFor="managerId" className="intervention-form-label">Gestionnaire</Label>
                <Input 
                  id="managerId" 
                  placeholder="UUID utilisateur" 
                  className="intervention-form-input"
                  {...form.register("managerId")} 
                />
              </div>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border/60">
              <p className="text-xs text-muted-foreground">
                TODO: connecter la recherche artisan à Google Maps, base locale et DeepSearch pour proposer des suggestions.
              </p>
              {artisanResults.length > 0 ? (
                <pre className="max-h-40 w-full overflow-auto rounded border bg-muted/40 p-2 text-[11px] mt-2">
                  {JSON.stringify(artisanResults, null, 2)}
                </pre>
              ) : null}
            </div>
          </div>
        </div>

        {duplicates.length > 0 ? (
          <div className="intervention-form-warning">
            <div className="intervention-form-section-title">Possible doublon détecté</div>
            <div className="space-y-2 text-sm mt-2">
              <p>Vérifiez les interventions existantes avant de continuer :</p>
              <ul className="list-disc space-y-1 pl-5">
                {duplicates.map((dup) => (
                  <li key={dup.id}>
                    <Link href={`/interventions/${dup.id}`} className="underline">
                      {dup.name} — {dup.address}
                    </Link>
                    {dup.agency ? <span className="text-muted-foreground"> ({dup.agency})</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {serverError ? (
          <div className="intervention-form-error">
            <p className="text-sm">{serverError}</p>
          </div>
        ) : null}
        
        <div className="flex justify-end gap-2 pt-4">
          <Button 
            type="submit" 
            className="intervention-form-button--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Enregistrement..." : mode === "create" ? "Créer l'intervention" : "Enregistrer"}
          </Button>
        </div>
      </form>
  )
}
