"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Building, ChevronDown, ChevronRight, FileText, MessageSquare, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MapLibreMap } from "@/components/maps/MapLibreMap"
import { DocumentManager } from "@/components/documents/DocumentManager"
import { CommentSection } from "@/components/shared/CommentSection"
import { supabase } from "@/lib/supabase-client"
import { useGeocodeSearch } from "@/hooks/useGeocodeSearch"
import type { GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import { useReferenceData } from "@/hooks/useReferenceData"
import { interventionsApi } from "@/lib/api/v2"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import type { CreateInterventionData } from "@/lib/api/v2/common/types"
import { toast } from "sonner"
import { findOrCreateOwner, findOrCreateTenant } from "@/lib/interventions/owner-tenant-helpers"

const INTERVENTION_DOCUMENT_KINDS = [
  { kind: "devis", label: "Devis" },
  { kind: "facturesGMBS", label: "Facture GMBS" },
  { kind: "facturesMateriel", label: "Facture Matériel" },
  { kind: "photos", label: "Photos" },
  { kind: "facturesArtisans", label: "Facture Artisan" },
]

const AGENCIES_WITH_OPTIONAL_REFERENCE = new Set(["imodirect", "afedim", "oqoro"])
const STATUSES_REQUIRING_DATE_PREVUE = new Set(["VISITE_TECHNIQUE", "EN_COURS", "INTER_EN_COURS"])
const STATUSES_REQUIRING_DEFINITIVE_ID = new Set([
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "ACCEPTE",
  "EN_COURS",
  "INTER_EN_COURS",
  "TERMINE",
  "INTER_TERMINEE",
  "STAND_BY",
])

// Compteur pour garantir l'unicité même si Date.now() est identique
let autoIdCounter = 0

const generateAutoInterventionId = () => {
  const timestampSegment = Date.now().toString().slice(-6)
  const randomSegment = Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")
  // Incrémenter le compteur pour garantir l'unicité
  autoIdCounter = (autoIdCounter + 1) % 100000
  const counterSegment = autoIdCounter.toString().padStart(5, "0")
  // Utiliser crypto.randomUUID si disponible pour une partie supplémentaire
  const uuidSegment = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `AUTO-${timestampSegment}-${randomSegment}-${counterSegment}-${uuidSegment}`
}

interface CurrentUser {
  id: string
  displayName: string
  code?: string | null
  color?: string | null
}

interface LegacyInterventionFormProps {
  onSuccess?: (data: any) => void
  onCancel?: () => void
  mode?: "halfpage" | "centerpage" | "fullpage"
  formRef?: React.RefObject<HTMLFormElement | null>
  onSubmittingChange?: (isSubmitting: boolean) => void
  defaultValues?: Partial<{
    agence_id: string
    reference_agence: string
    assigned_user_id: string
    metier_id: string
    adresse: string
    code_postal: string
    ville: string
    latitude: number
    longitude: number
    datePrevue: string
    nomProprietaire: string
    prenomProprietaire: string
    telephoneProprietaire: string
    emailProprietaire: string
    nomClient: string
    prenomClient: string
    telephoneClient: string
    emailClient: string
    artisan: string
    coutIntervention: string
    coutSST: string
    coutMateriel: string
    numero_sst: string
    pourcentage_sst: number | undefined
    accompteSST: string
    accompteSSTRecu: boolean
    dateAccompteSSTRecu: string
    accompteClient: string
    accompteClientRecu: boolean
    dateAccompteClientRecu: string
    commentairesIntervention: string
    artisanTelephone: string
    artisanEmail: string
    consigneSecondArtisan: string
    artisanId: string
  }>
}

export function LegacyInterventionForm({ onSuccess, onCancel, mode = "centerpage", formRef, onSubmittingChange, defaultValues }: LegacyInterventionFormProps) {
  const { data: refData, loading: refDataLoading } = useReferenceData()
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [formData, setFormData] = useState({
    statut_id: "", // Sera initialisé à "DEMANDE" par le useEffect
    idIntervention: "", // Toujours vide pour devis supp (auto-généré)
    agence_id: defaultValues?.agence_id || "",
    reference_agence: defaultValues?.reference_agence || "",
    assigned_user_id: defaultValues?.assigned_user_id || "",
    metier_id: defaultValues?.metier_id || "",
    contexteIntervention: "", // Toujours vide pour devis supp (obligatoire à remplir)
    consigneIntervention: "", // Toujours vide pour devis supp
    adresse: defaultValues?.adresse || "",
    code_postal: defaultValues?.code_postal || "",
    ville: defaultValues?.ville || "",
    latitude: defaultValues?.latitude || 48.8566,
    longitude: defaultValues?.longitude || 2.3522,
    adresseComplete: defaultValues?.adresse && defaultValues?.ville
      ? `${defaultValues.adresse}, ${defaultValues.ville}`
      : "Paris, France",
    coutIntervention: defaultValues?.coutIntervention || "",
    coutSST: defaultValues?.coutSST || "",
    coutMateriel: defaultValues?.coutMateriel || "",
    marge: "",
    datePrevue: defaultValues?.datePrevue || "",
    nomProprietaire: defaultValues?.nomProprietaire || "",
    prenomProprietaire: defaultValues?.prenomProprietaire || "",
    telephoneProprietaire: defaultValues?.telephoneProprietaire || "",
    emailProprietaire: defaultValues?.emailProprietaire || "",
    nomClient: defaultValues?.nomClient || "",
    prenomClient: defaultValues?.prenomClient || "",
    telephoneClient: defaultValues?.telephoneClient || "",
    emailClient: defaultValues?.emailClient || "",
    artisan: defaultValues?.artisan || "",
    artisanTelephone: defaultValues?.artisanTelephone || "",
    artisanEmail: defaultValues?.artisanEmail || "",
    accompteSST: defaultValues?.accompteSST || "",
    accompteSSTRecu: defaultValues?.accompteSSTRecu || false,
    dateAccompteSSTRecu: defaultValues?.dateAccompteSSTRecu || "",
    accompteClient: defaultValues?.accompteClient || "",
    accompteClientRecu: defaultValues?.accompteClientRecu || false,
    dateAccompteClientRecu: defaultValues?.dateAccompteClientRecu || "",
    commentairesIntervention: defaultValues?.commentairesIntervention || "",
    consigneSecondArtisan: defaultValues?.consigneSecondArtisan || "",
    artisanId: defaultValues?.artisanId || "", // ID de l'artisan pour l'assignation après création
    is_vacant: false,
    key_code: "",
    floor: "",
    apartment_number: "",
    vacant_housing_instructions: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    suggestions: locationSuggestions,
    isSuggesting,
    clearSuggestions,
    geocode: geocodeQuery,
  } = useGeocodeSearch({ initialQuery: "" }) // Ne pas initialiser avec l'adresse
  const suggestionBlurTimeoutRef = useRef<number | null>(null)
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [isProprietaireOpen, setIsProprietaireOpen] = useState(false)
  const [isAccompteOpen, setIsAccompteOpen] = useState(false)
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(false)
  const [createdInterventionId, setCreatedInterventionId] = useState<string | null>(null)

  useEffect(() => {
    // Toujours initialiser le statut à "DEMANDE" pour les nouvelles interventions
    if (!refData?.interventionStatuses || formData.statut_id) {
      return
    }
    const defaultStatus = refData.interventionStatuses.find(
      (status) =>
        status.code === "DEMANDE" ||
        status.label?.toLowerCase() === "demandé" ||
        status.label?.toLowerCase() === "demande",
    )
    if (defaultStatus?.id) {
      setFormData((prev) => ({ ...prev, statut_id: defaultStatus.id }))
    }
  }, [refData, formData.statut_id])

  useEffect(() => {
    let isMounted = true

    const loadCurrentUser = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!response.ok) {
          throw new Error("Une erreur est survenue lors du chargement de l'utilisateur")
        }
        const payload = await response.json()
        if (!isMounted) return

        const user = payload?.user
        if (!user) return

        const first = user.firstname ?? user.prenom ?? ""
        const last = user.lastname ?? user.name ?? ""
        const displayNameCandidate = [first, last].filter(Boolean).join(" ").trim()
        const displayName =
          displayNameCandidate || user.username || user.email || "Vous"

        setCurrentUser({
          id: user.id,
          displayName,
          code: user.code_gestionnaire ?? null,
          color: user.color ?? null,
        })
      } catch (error) {
        console.warn(
          "[LegacyInterventionForm] Impossible de charger l'utilisateur courant",
          error,
        )
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    return () => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }
    }
  }, [])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }))
    setGeocodeError(null)
  }

  const handleSuggestionSelect = useCallback((suggestion: GeocodeSuggestion) => {
    // Annuler le timeout de blur si existant
    if (suggestionBlurTimeoutRef.current) {
      window.clearTimeout(suggestionBlurTimeoutRef.current)
      suggestionBlurTimeoutRef.current = null
    }

    // Parser l'adresse pour extraire code postal et ville
    const addressParts = parseAddress(suggestion.label)

    // Fermer immédiatement le dropdown
    clearSuggestions()
    setShowLocationSuggestions(false)

    // Mettre à jour tous les champs
    setFormData((prev) => ({
      ...prev,
      latitude: suggestion.lat,
      longitude: suggestion.lng,
      adresseComplete: suggestion.label,
      adresse: addressParts.street || suggestion.label,
      code_postal: addressParts.postalCode || "",
      ville: addressParts.city || "",
    }))

    // Mettre à jour la query pour refléter la sélection
    setLocationQuery(suggestion.label)
    setGeocodeError(null)
  }, [clearSuggestions, setLocationQuery])

  // Fonction helper pour parser une adresse
  const parseAddress = (fullAddress: string): { street: string; postalCode: string; city: string } => {
    // Formats supportés :
    // OpenCage : "123 Rue de Rivoli, 75001 Paris, France"
    // Nominatim : "Rue de Rivoli, Paris, Île-de-France, 75001, France"

    const parts = fullAddress.split(',').map(p => p.trim())

    let street = ""
    let postalCode = ""
    let city = ""

    // Chercher le code postal dans toutes les parties (format 5 chiffres français)
    const postalCodeRegex = /\b(\d{5})\b/

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const match = part.match(postalCodeRegex)

      if (match) {
        postalCode = match[1]

        // Si le code postal est dans la même partie que la ville (format "75001 Paris")
        const cityInSamePart = part.replace(match[0], '').trim()
        if (cityInSamePart) {
          city = cityInSamePart
        }
        // Sinon, chercher la ville dans les parties précédentes
        else if (i > 0 && !city) {
          city = parts[i - 1]
        }
      }
    }

    // Si pas de ville trouvée, prendre la deuxième partie comme ville
    if (!city && parts.length >= 2) {
      city = parts[1].replace(postalCodeRegex, '').trim()
    }

    // La rue est toujours la première partie (avant la première virgule)
    street = parts[0] || fullAddress

    return { street, postalCode, city }
  }

  const handleGeocodeAddress = useCallback(async () => {
    const fullAddress = locationQuery.trim()
    if (!fullAddress) {
      setGeocodeError("Adresse manquante")
      return
    }

    setIsGeocoding(true)
    setGeocodeError(null)
    clearSuggestions() // Fermer le dropdown
    setShowLocationSuggestions(false)

    try {
      const result = await geocodeQuery(fullAddress)
      if (!result) {
        setGeocodeError("Adresse introuvable")
        return
      }

      // Parser l'adresse pour extraire code postal et ville
      const addressParts = parseAddress(result.label)

      setFormData((prev) => ({
        ...prev,
        latitude: result.lat,
        longitude: result.lng,
        adresseComplete: result.label,
        adresse: addressParts.street || result.label,
        code_postal: addressParts.postalCode || "",
        ville: addressParts.city || "",
      }))
      setLocationQuery(result.label)
    } catch (error) {
      console.error("[Geocode] Error:", error)
      setGeocodeError("Une erreur est survenue lors de la géolocalisation")
    } finally {
      setIsGeocoding(false)
    }
  }, [locationQuery, geocodeQuery, clearSuggestions, setLocationQuery])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    // Validation des champs obligatoires (BR-INT-001)
    // Utilise la validation HTML5 native du formulaire
    const form = event.currentTarget as HTMLFormElement
    if (!form.checkValidity()) {
      form.reportValidity() // Affiche les messages natifs du navigateur
      return
    }

    let idInterValue = formData.idIntervention?.trim() ?? ""
    // BR-DEVI-001 : Statuts post "Devis envoyé" => ID définitif obligatoire
    if (requiresDefinitiveId) {
      if (idInterValue.length === 0 || idInterValue.toLowerCase().includes("auto")) {
        form.reportValidity()
        return
      }
    } else if (!idInterValue) {
      idInterValue = generateAutoInterventionId()
      setFormData((prev) => ({ ...prev, idIntervention: idInterValue }))
    }

    if (requiresDatePrevue && !(formData.datePrevue?.trim())) {
      form.reportValidity()
      return
    }

    setIsSubmitting(true)
    onSubmittingChange?.(true)

    try {
      const referenceAgenceValue = formData.reference_agence?.trim() ?? ""

      // Trouver ou créer le propriétaire et le client
      let ownerId: string | null = null
      let tenantId: string | null = null

      try {
        ownerId = await findOrCreateOwner({
          nomProprietaire: formData.nomProprietaire,
          prenomProprietaire: formData.prenomProprietaire,
          telephoneProprietaire: formData.telephoneProprietaire,
          emailProprietaire: formData.emailProprietaire,
        })
      } catch (error) {
        console.error("[LegacyInterventionForm] Erreur lors de la gestion du propriétaire:", error)
        toast.error("Erreur lors de la sauvegarde du propriétaire")
      }

      // Ne créer/trouver le tenant que si le logement n'est pas vacant
      if (!formData.is_vacant) {
        try {
          tenantId = await findOrCreateTenant({
            nomClient: formData.nomClient,
            prenomClient: formData.prenomClient,
            telephoneClient: formData.telephoneClient,
            emailClient: formData.emailClient,
          })
        } catch (error) {
          console.error("[LegacyInterventionForm] Erreur lors de la gestion du client:", error)
          toast.error("Erreur lors de la sauvegarde du client")
        }
      } else {
        // Si logement vacant, on doit mettre tenant_id à null explicitement
        tenantId = null
      }

      // Préparer les données pour l'API V2
      const createData: CreateInterventionData = {
        statut_id: formData.statut_id || undefined,
        agence_id: formData.agence_id || undefined,
        reference_agence: referenceAgenceValue.length > 0 ? referenceAgenceValue : null,
        assigned_user_id: formData.assigned_user_id || undefined,
        metier_id: formData.metier_id || undefined,
        date: formData.datePrevue || new Date().toISOString(),
        date_prevue: formData.datePrevue || undefined,
        contexte_intervention: formData.contexteIntervention || undefined,
        consigne_intervention: formData.consigneIntervention || undefined,
        adresse: formData.adresse || undefined,
        code_postal: formData.code_postal || undefined,
        ville: formData.ville || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
        id_inter: idInterValue,
        is_vacant: formData.is_vacant,
        // Toujours envoyer les champs de logement vacant si is_vacant=true, même s'ils sont vides
        key_code: formData.is_vacant ? (formData.key_code?.trim() || null) : null,
        floor: formData.is_vacant ? (formData.floor?.trim() || null) : null,
        apartment_number: formData.is_vacant ? (formData.apartment_number?.trim() || null) : null,
        vacant_housing_instructions: formData.is_vacant ? (formData.vacant_housing_instructions?.trim() || null) : null,
        owner_id: ownerId || undefined,
        tenant_id: tenantId || undefined,
        // Note: client_id est un alias de tenant_id dans certains contextes, mais on utilise tenant_id ici
      }

      // Nettoyer les champs undefined
      Object.keys(createData).forEach((key) => {
        if (createData[key as keyof CreateInterventionData] === undefined) {
          delete createData[key as keyof CreateInterventionData]
        }
      })

      const created = await interventionsApi.create(createData)
      setCreatedInterventionId(created.id)

      // Assigner l'artisan si un ID est fourni (depuis defaultValues ou formData)
      const artisanIdToAssign = defaultValues?.artisanId || formData.artisanId
      if (artisanIdToAssign && artisanIdToAssign.trim() !== "") {
        try {
          await interventionsApi.setPrimaryArtisan(created.id, artisanIdToAssign)
        } catch (artisanError) {
          console.error("[LegacyInterventionForm] Impossible d'assigner l'artisan", artisanError)
          // Ne pas bloquer la création si l'assignation de l'artisan échoue
        }
      }

      const trimmedInitialComment = formData.commentairesIntervention.trim()
      if (trimmedInitialComment.length > 0) {
        try {
          await commentsApi.create({
            entity_id: created.id,
            entity_type: "intervention",
            content: trimmedInitialComment,
            comment_type: "internal",
            is_internal: true,
            author_id: currentUser?.id,
          })
        } catch (commentError) {
          console.error("[LegacyInterventionForm] Impossible d'ajouter le commentaire initial", commentError)
          console.error("[LegacyInterventionForm] Impossible d'ajouter le commentaire initial", commentError)
          toast.error("L'intervention a bien été créée mais le commentaire initial n'a pas pu être enregistré. Merci de l'ajouter manuellement.")
        }
      }

      setFormData((prev) => ({
        ...prev,
        commentairesIntervention: "",
      }))

      toast.success("Intervention créée")

      // Appeler onSuccess qui devrait fermer le modal
      // Si onSuccess ne ferme pas le modal, onCancel le fera
      onSuccess?.(created)

      // S'assurer que le modal se ferme même si onSuccess ne le fait pas
      // Utiliser un petit délai pour permettre à onSuccess de se terminer
      if (onCancel) {
        setTimeout(() => {
          onCancel()
        }, 150)
      }
    } catch (error) {
      console.error("Erreur lors de la création:", error)
      toast.error("Erreur lors de la création de l'intervention")
    } finally {
      setIsSubmitting(false)
      onSubmittingChange?.(false)
    }
  }

  const isFullPage = mode === "fullpage"
  const isCenterPage = mode === "centerpage"
  const useTwoColumns = isFullPage || isCenterPage

  const containerClass = useTwoColumns ? "space-y-4" : "space-y-4"
  const contentClass = useTwoColumns ? "grid grid-cols-1 gap-6 lg:grid-cols-2" : "space-y-4"

  const selectedStatus = useMemo(() => {
    if (!formData.statut_id || !refData?.interventionStatuses) {
      return undefined
    }
    return refData.interventionStatuses.find((status) => status.id === formData.statut_id)
  }, [formData.statut_id, refData])

  const requiresDatePrevue = useMemo(() => {
    if (!selectedStatus) {
      return false
    }
    const code = (selectedStatus.code ?? "").toUpperCase()
    if (STATUSES_REQUIRING_DATE_PREVUE.has(code)) {
      return true
    }
    const normalizedLabel = (selectedStatus.label ?? "").trim().toLowerCase()
    return (
      normalizedLabel === "visite technique" ||
      normalizedLabel === "intervention en cours" ||
      normalizedLabel === "inter en cours"
    )
  }, [selectedStatus])

  const selectedAgencyId = formData.agence_id
  const selectedAgencyData = useMemo(() => {
    if (!selectedAgencyId || !refData?.agencies) {
      return undefined
    }
    return refData.agencies.find((agency) => agency.id === selectedAgencyId)
  }, [selectedAgencyId, refData])

  const showReferenceField = useMemo(() => {
    if (!selectedAgencyData) {
      return false
    }
    const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase()
    const normalizedLabel = normalize(selectedAgencyData.label)
    const normalizedCode = normalize(selectedAgencyData.code)
    return (
      AGENCIES_WITH_OPTIONAL_REFERENCE.has(normalizedLabel) ||
      AGENCIES_WITH_OPTIONAL_REFERENCE.has(normalizedCode)
    )
  }, [selectedAgencyData])

  const mainGridClassName = showReferenceField
    ? "grid legacy-form-main-grid legacy-form-main-grid--with-reference"
    : "grid legacy-form-main-grid"

  const requiresDefinitiveId = useMemo(() => {
    if (!selectedStatus) {
      return false
    }
    const code = (selectedStatus.code ?? "").toUpperCase()
    if (STATUSES_REQUIRING_DEFINITIVE_ID.has(code)) {
      return true
    }
    const normalizedLabel = (selectedStatus.label ?? "").trim().toLowerCase()
    return (
      normalizedLabel === "devis envoyé" ||
      normalizedLabel === "visite technique" ||
      normalizedLabel === "accepté" ||
      normalizedLabel === "accepte" ||
      normalizedLabel === "en cours" ||
      normalizedLabel === "intervention en cours" ||
      normalizedLabel === "inter en cours" ||
      normalizedLabel === "terminé" ||
      normalizedLabel === "termine" ||
      normalizedLabel === "stand-by" ||
      normalizedLabel === "stand by"
    )
  }, [selectedStatus])

  if (refDataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Chargement des données...</div>
      </div>
    )
  }

  return (
    <form ref={formRef} className={containerClass} onSubmit={handleSubmit}>
      <Card className="legacy-form-card">
        <CardContent className="pt-4">
          <div className={mainGridClassName}>
            <div className="legacy-form-field">
              <Label htmlFor="statut" className="legacy-form-label">
                Statut *
              </Label>
              <Select value={formData.statut_id} onValueChange={(value) => handleInputChange("statut_id", value)}>
                <SelectTrigger className="legacy-form-select">
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  {refData?.interventionStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="text"
                value={formData.statut_id || ""}
                onChange={() => { }}
                required
                pattern=".+"
                title="Statut est obligatoire"
                style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
                tabIndex={-1}
                readOnly
                aria-hidden="true"
                onFocus={(e) => e.target.blur()}
              />
            </div>
            <div className="legacy-form-field">
              <Label htmlFor="idIntervention" className="legacy-form-label">
                ID Intervention {requiresDefinitiveId && "*"}
              </Label>
              <Input
                id="idIntervention"
                value={formData.idIntervention}
                onChange={(event) => handleInputChange("idIntervention", event.target.value)}
                placeholder={requiresDefinitiveId ? "Saisir l'ID définitif" : "Auto-généré"}
                className="legacy-form-input"
                disabled={!requiresDefinitiveId}
                required={requiresDefinitiveId}
                pattern={requiresDefinitiveId ? "^(?!.*(?:[Aa][Uu][Tt][Oo])).+$" : undefined}
                title={requiresDefinitiveId ? "ID intervention définitif requis (sans la chaîne \"AUTO\")" : undefined}
              />
            </div>
            <div className="legacy-form-field">
              <Label htmlFor="agence" className="legacy-form-label">
                Agence *
              </Label>
              <Select value={formData.agence_id} onValueChange={(value) => handleInputChange("agence_id", value)}>
                <SelectTrigger className="legacy-form-select">
                  <SelectValue placeholder="Sélectionner une agence" />
                </SelectTrigger>
                <SelectContent>
                  {refData?.agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.id}>
                      {agency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="text"
                value={formData.agence_id || ""}
                onChange={() => { }}
                required
                pattern=".+"
                title="Agence est obligatoire"
                style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
                tabIndex={-1}
                readOnly
                aria-hidden="true"
                onFocus={(e) => e.target.blur()}
              />
            </div>
            {showReferenceField && (
              <div className="legacy-form-field">
                <Label htmlFor="reference_agence" className="legacy-form-label">
                  Référence agence
                </Label>
                <Input
                  id="reference_agence"
                  name="reference_agence"
                  value={formData.reference_agence}
                  onChange={(event) => handleInputChange("reference_agence", event.target.value)}
                  placeholder="Ex: REF-12345"
                  className="legacy-form-input"
                  autoComplete="off"
                />
              </div>
            )}
            <div className="legacy-form-field">
              <Label htmlFor="attribueA" className="legacy-form-label">
                Attribué à
              </Label>
              <Select value={formData.assigned_user_id} onValueChange={(value) => handleInputChange("assigned_user_id", value)}>
                <SelectTrigger className="legacy-form-select">
                  <SelectValue placeholder="Sélectionner un gestionnaire" />
                </SelectTrigger>
                <SelectContent>
                  {refData?.users.map((user) => {
                    const displayName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username
                    return (
                      <SelectItem key={user.id} value={user.id}>
                        {user.code_gestionnaire ? `${user.code_gestionnaire} - ${displayName}` : displayName}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="legacy-form-field">
              <Label htmlFor="typeMetier" className="legacy-form-label">
                Type (Métier) *
              </Label>
              <Select value={formData.metier_id} onValueChange={(value) => handleInputChange("metier_id", value)}>
                <SelectTrigger className="legacy-form-select">
                  <SelectValue placeholder="Sélectionner un métier" />
                </SelectTrigger>
                <SelectContent>
                  {refData?.metiers.map((metier) => (
                    <SelectItem key={metier.id} value={metier.id}>
                      {metier.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="text"
                value={formData.metier_id || ""}
                onChange={() => { }}
                required
                pattern=".+"
                title="Métier est obligatoire"
                style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
                tabIndex={-1}
                readOnly
                aria-hidden="true"
                onFocus={(e) => e.target.blur()}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className={`legacy-form-content-grid ${contentClass}`}>
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" />
                Détails intervention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div>
                <Label htmlFor="contexteIntervention" className="text-xs">
                  Contexte d&apos;intervention *
                </Label>
                <Textarea
                  id="contexteIntervention"
                  value={formData.contexteIntervention}
                  onChange={(event) => handleInputChange("contexteIntervention", event.target.value)}
                  placeholder="Décrivez le contexte de l&apos;intervention..."
                  rows={3}
                  className="text-sm"
                  required
                />
              </div>
              <div>
                <Label htmlFor="consigneIntervention" className="text-xs">
                  Consigne d&apos;intervention
                </Label>
                <Textarea
                  id="consigneIntervention"
                  value={formData.consigneIntervention}
                  onChange={(event) => handleInputChange("consigneIntervention", event.target.value)}
                  placeholder="Consignes spécifiques pour l&apos;intervention..."
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div>
                <Label htmlFor="adresse" className="text-xs">
                  Adresse *
                </Label>
                <Textarea
                  id="adresse"
                  value={formData.adresse}
                  onChange={(event) => handleInputChange("adresse", event.target.value)}
                  placeholder="Adresse complète de l&apos;intervention"
                  rows={2}
                  className="text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="codePostal" className="text-xs">
                    Code postal
                  </Label>
                  <Input
                    id="codePostal"
                    value={formData.code_postal}
                    onChange={(event) => handleInputChange("code_postal", event.target.value)}
                    placeholder="75001"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="ville" className="text-xs">
                    Ville
                  </Label>
                  <Input
                    id="ville"
                    value={formData.ville}
                    onChange={(event) => handleInputChange("ville", event.target.value)}
                    placeholder="Paris"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Localisation</Label>
                <div className="mt-2 space-y-3">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        value={locationQuery}
                        onChange={(event) => {
                          setLocationQuery(event.target.value)
                          setGeocodeError(null)
                        }}
                        onFocus={() => {
                          setShowLocationSuggestions(true)
                          if (suggestionBlurTimeoutRef.current) {
                            window.clearTimeout(suggestionBlurTimeoutRef.current)
                            suggestionBlurTimeoutRef.current = null
                          }
                        }}
                        onBlur={() => {
                          suggestionBlurTimeoutRef.current = window.setTimeout(() => {
                            clearSuggestions()
                            setShowLocationSuggestions(false)
                          }, 150)
                        }}
                        placeholder="Rechercher une adresse..."
                        className="h-8 text-sm"
                      />
                      {showLocationSuggestions && locationSuggestions.length > 0 && (
                        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-muted bg-background shadow-lg">
                          <ul className="divide-y divide-border text-left text-sm">
                            {locationSuggestions.map((suggestion) => (
                              <li key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}>
                                <button
                                  type="button"
                                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition hover:bg-muted/80 focus:bg-muted/80"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => handleSuggestionSelect(suggestion)}
                                >
                                  <span className="truncate font-medium">{suggestion.label}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {suggestion.lat.toFixed(4)} • {suggestion.lng.toFixed(4)}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={handleGeocodeAddress} disabled={isGeocoding}>
                      {isGeocoding ? "Recherche..." : "Localiser"}
                    </Button>
                  </div>
                  {isSuggesting && (
                    <div className="text-xs text-muted-foreground">Recherche d&apos;adresses...</div>
                  )}
                  {geocodeError && (
                    <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {geocodeError}
                    </div>
                  )}
                  <div className="overflow-hidden rounded-lg border">
                    <MapLibreMap
                      lat={formData.latitude}
                      lng={formData.longitude}
                      height="200px"
                      onLocationChange={handleLocationChange}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span>Lat: {formData.latitude.toFixed(4)}</span>
                    <span>Lng: {formData.longitude.toFixed(4)}</span>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <Label className="mb-3 block text-xs font-medium">Coûts</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <Label htmlFor="coutIntervention" className="text-xs">
                      Coût intervention
                    </Label>
                    <Input
                      id="coutIntervention"
                      value={formData.coutIntervention}
                      onChange={(event) => handleInputChange("coutIntervention", event.target.value)}
                      placeholder="0.00 €"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="coutSST" className="text-xs">
                      Coût SST
                    </Label>
                    <Input
                      id="coutSST"
                      value={formData.coutSST}
                      onChange={(event) => handleInputChange("coutSST", event.target.value)}
                      placeholder="0.00 €"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="coutMateriel" className="text-xs">
                      Coût matériel
                    </Label>
                    <Input
                      id="coutMateriel"
                      value={formData.coutMateriel}
                      onChange={(event) => handleInputChange("coutMateriel", event.target.value)}
                      placeholder="0.00 €"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="marge" className="text-xs">
                      Marge
                    </Label>
                    <Input
                      id="marge"
                      value={formData.marge}
                      onChange={(event) => handleInputChange("marge", event.target.value)}
                      placeholder="0.00 €"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="datePrevue" className="text-xs">
                      Date prévue {requiresDatePrevue && "*"}
                    </Label>
                    <Input
                      id="datePrevue"
                      type="date"
                      value={formData.datePrevue}
                      onChange={(event) => handleInputChange("datePrevue", event.target.value)}
                      className="h-8 text-sm"
                      required={requiresDatePrevue}
                      title={requiresDatePrevue ? "Date prévue obligatoire pour ce statut" : undefined}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Collapsible open={isProprietaireOpen} onOpenChange={setIsProprietaireOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    Détails propriétaire et client
                    {isProprietaireOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div>
                    <Label className="mb-2 block text-xs font-medium">Propriétaire</Label>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <Label htmlFor="nomProprietaire" className="text-xs">
                          Nom
                        </Label>
                        <Input
                          id="nomProprietaire"
                          value={formData.nomProprietaire}
                          onChange={(event) => handleInputChange("nomProprietaire", event.target.value)}
                          placeholder="Nom du propriétaire"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prenomProprietaire" className="text-xs">
                          Prénom
                        </Label>
                        <Input
                          id="prenomProprietaire"
                          value={formData.prenomProprietaire}
                          onChange={(event) => handleInputChange("prenomProprietaire", event.target.value)}
                          placeholder="Prénom du propriétaire"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="telephoneProprietaire" className="text-xs">
                          Téléphone
                        </Label>
                        <Input
                          id="telephoneProprietaire"
                          value={formData.telephoneProprietaire}
                          onChange={(event) => handleInputChange("telephoneProprietaire", event.target.value)}
                          placeholder="06 12 34 56 78"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="emailProprietaire" className="text-xs">
                          Email
                        </Label>
                        <Input
                          id="emailProprietaire"
                          type="email"
                          value={formData.emailProprietaire}
                          onChange={(event) => handleInputChange("emailProprietaire", event.target.value)}
                          placeholder="proprietaire@example.com"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="block text-xs font-medium">Client</Label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="is_vacant"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={formData.is_vacant}
                          onChange={(e) => handleInputChange("is_vacant", e.target.checked)}
                        />
                        <Label htmlFor="is_vacant" className="text-xs font-normal cursor-pointer select-none">
                          logement vacant
                        </Label>
                      </div>
                    </div>

                    {formData.is_vacant ? (
                      <div className="space-y-3">
                        {/* Ligne 1 : Code clé, Etage, N° Appartement */}
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label htmlFor="key_code" className="text-xs uppercase">CODE CLÉ</Label>
                            <Input
                              id="key_code"
                              value={formData.key_code}
                              onChange={(event) => handleInputChange("key_code", event.target.value)}
                              className="h-8 text-sm mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="floor" className="text-xs">etage</Label>
                            <Input
                              id="floor"
                              value={formData.floor}
                              onChange={(event) => handleInputChange("floor", event.target.value)}
                              className="h-8 text-sm mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor="apartment_number" className="text-xs">n° appartement</Label>
                            <Input
                              id="apartment_number"
                              value={formData.apartment_number}
                              onChange={(event) => handleInputChange("apartment_number", event.target.value)}
                              className="h-8 text-sm mt-1"
                            />
                          </div>
                        </div>
                        {/* Ligne 2 : Consigne */}
                        <div>
                          <Label htmlFor="vacant_housing_instructions" className="text-xs">Consigne</Label>
                          <Textarea
                            id="vacant_housing_instructions"
                            value={formData.vacant_housing_instructions}
                            onChange={(event) => handleInputChange("vacant_housing_instructions", event.target.value)}
                            placeholder="Consignes"
                            className="min-h-[80px] text-sm mt-1 resize-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <Label htmlFor="nomClient" className="text-xs">
                            Nom
                          </Label>
                          <Input
                            id="nomClient"
                            value={formData.nomClient}
                            onChange={(event) => handleInputChange("nomClient", event.target.value)}
                            placeholder="Nom du client"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="prenomClient" className="text-xs">
                            Prénom
                          </Label>
                          <Input
                            id="prenomClient"
                            value={formData.prenomClient}
                            onChange={(event) => handleInputChange("prenomClient", event.target.value)}
                            placeholder="Prénom du client"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="telephoneClient" className="text-xs">
                            Téléphone
                          </Label>
                          <Input
                            id="telephoneClient"
                            value={formData.telephoneClient}
                            onChange={(event) => handleInputChange("telephoneClient", event.target.value)}
                            placeholder="06 12 34 56 78"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label htmlFor="emailClient" className="text-xs">
                            Email
                          </Label>
                          <Input
                            id="emailClient"
                            type="email"
                            value={formData.emailClient}
                            onChange={(event) => handleInputChange("emailClient", event.target.value)}
                            placeholder="client@example.com"
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Building className="h-4 w-4" />
                Artisans
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="artisan" className="text-xs">
                    Artisan
                  </Label>
                  <Input
                    id="artisan"
                    value={formData.artisan}
                    onChange={(event) => handleInputChange("artisan", event.target.value)}
                    placeholder="Nom de l'artisan"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="artisanTelephone" className="text-xs">
                    Téléphone
                  </Label>
                  <Input
                    id="artisanTelephone"
                    value={formData.artisanTelephone}
                    onChange={(event) => handleInputChange("artisanTelephone", event.target.value)}
                    placeholder="06 12 34 56 78"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="artisanEmail" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="artisanEmail"
                    type="email"
                    value={formData.artisanEmail}
                    onChange={(event) => handleInputChange("artisanEmail", event.target.value)}
                    placeholder="artisan@example.com"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Collapsible open={isAccompteOpen} onOpenChange={setIsAccompteOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    Gestion des acomptes
                    {isAccompteOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label htmlFor="accompteSST" className="text-xs">
                        Acompte SST
                      </Label>
                      <Input
                        id="accompteSST"
                        value={formData.accompteSST}
                        onChange={(event) => handleInputChange("accompteSST", event.target.value)}
                        placeholder="Montant"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Acompte SST reçu</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.accompteSSTRecu}
                          onChange={(event) => handleInputChange("accompteSSTRecu", event.target.checked)}
                        />
                        <Input
                          type="date"
                          value={formData.dateAccompteSSTRecu}
                          onChange={(event) => handleInputChange("dateAccompteSSTRecu", event.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="accompteClient" className="text-xs">
                        Acompte client
                      </Label>
                      <Input
                        id="accompteClient"
                        value={formData.accompteClient}
                        onChange={(event) => handleInputChange("accompteClient", event.target.value)}
                        placeholder="Montant"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Acompte client reçu</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={formData.accompteClientRecu}
                          onChange={(event) => handleInputChange("accompteClientRecu", event.target.checked)}
                        />
                        <Input
                          type="date"
                          value={formData.dateAccompteClientRecu}
                          onChange={(event) => handleInputChange("dateAccompteClientRecu", event.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Upload className="h-4 w-4" />
                    Documents
                    {isDocumentsOpen ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  <DocumentManager
                    entityType="intervention"
                    entityId={formData.idIntervention}
                    kinds={INTERVENTION_DOCUMENT_KINDS}
                    currentUser={currentUser ?? undefined}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <MessageSquare className="h-4 w-4" />
                    Commentaires
                    {isCommentsOpen ? (
                      <ChevronDown className="ml-auto h-4 w-4" />
                    ) : (
                      <ChevronRight className="ml-auto h-4 w-4" />
                    )}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4 pt-0">
                  {createdInterventionId ? (
                    <CommentSection
                      entityType="intervention"
                      entityId={createdInterventionId}
                      currentUserId={currentUser?.id}
                    />
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      Les commentaires seront disponibles après la création de l&apos;intervention.
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="commentairesIntervention" className="text-xs">
                      Commentaire initial
                    </Label>
                    <Textarea
                      id="commentairesIntervention"
                      value={formData.commentairesIntervention}
                      onChange={(event) => handleInputChange("commentairesIntervention", event.target.value)}
                      placeholder="Commentaires sur l'intervention..."
                      rows={4}
                      className="text-sm"
                      disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      Ce commentaire sera enregistré automatiquement après la création.
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
      </div>
    </form>
  )
}

export default LegacyInterventionForm
