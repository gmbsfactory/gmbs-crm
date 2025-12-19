"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, useScroll, useTransform, useSpring, type MotionValue } from "framer-motion"
import { useQueryClient } from "@tanstack/react-query"
import { Building, ChevronDown, ChevronRight, FileText, MessageSquare, Upload, X, Search, Eye, Mail, MessageCircle, Users, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { MapLibreMap } from "@/components/maps/MapLibreMap"
import { DocumentManager } from "@/components/documents/DocumentManager"
import { useReferenceData } from "@/hooks/useReferenceData"
import { useGeocodeSearch } from "@/hooks/useGeocodeSearch"
import type { GeocodeSuggestion } from "@/hooks/useGeocodeSearch"
import { useNearbyArtisans, type NearbyArtisan } from "@/hooks/useNearbyArtisans"
import { interventionsApi } from "@/lib/api/v2"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import type { CreateInterventionData } from "@/lib/api/v2/common/types"
import { supabase } from "@/lib/supabase-client"
import { cn } from "@/lib/utils"
import { ArtisanSearchModal, type ArtisanSearchResult } from "@/components/artisans/ArtisanSearchModal"
import { Avatar } from "@/components/artisans/Avatar"
import { useArtisanModal } from "@/hooks/useArtisanModal"
import { toast } from "sonner"
import { findOrCreateOwner, findOrCreateTenant } from "@/lib/interventions/owner-tenant-helpers"
import { EmailEditModal } from "@/components/interventions/EmailEditModal"
import { generateDevisEmailTemplate, generateInterventionEmailTemplate, generateDevisWhatsAppText, generateInterventionWhatsAppText, type EmailTemplateData } from "@/lib/email-templates/intervention-emails"

const INTERVENTION_DOCUMENT_KINDS = [
  { kind: "devis", label: "Devis" },
  { kind: "facturesGMBS", label: "Facture GMBS" },
  { kind: "facturesMateriel", label: "Facture Matériel" },
  { kind: "photos", label: "Photos" },
  { kind: "facturesArtisans", label: "Facture Artisan" },
]

const MAX_RADIUS_KM = 10000

// Note: requires_reference est maintenant géré via la table agency_config en base de données
const STATUSES_REQUIRING_DATE_PREVUE = new Set(["VISITE_TECHNIQUE", "INTER_EN_COURS"])
const STATUSES_REQUIRING_DEFINITIVE_ID = new Set([
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "ACCEPTE",
  "INTER_EN_COURS",
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
  autoIdCounter = (autoIdCounter + 1) % 100000
  const counterSegment = autoIdCounter.toString().padStart(5, "0")
  const uuidSegment = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `AUTO-${timestampSegment}-${randomSegment}-${counterSegment}-${uuidSegment}`
}

const formatDistanceKm = (value: number) => {
  if (!Number.isFinite(value)) return "—"
  if (value < 1) return "< 1 km"
  if (value < 10) return `${value.toFixed(1)} km`
  return `${Math.round(value)} km`
}

function hexToRgba(hex: string, alpha: number): string | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return null
  const r = parseInt(result[1], 16)
  const g = parseInt(result[2], 16)
  const b = parseInt(result[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Fonction pour calculer la couleur de texte lisible (blanc ou noir)
function getReadableTextColor(bgColor: string | null | undefined): string {
  if (!bgColor) return "#1f2937"
  const hex = bgColor.replace("#", "")
  if (hex.length !== 6) return "#1f2937"
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#1f2937" : "#ffffff"
}

// Composant ColorBadgeSelect - Sélecteur visuel avec badges colorés
interface ColorBadgeOption {
  id: string
  label: string
  color?: string | null
}

interface ColorBadgeSelectProps {
  label: string
  value: string
  options: ColorBadgeOption[]
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  minWidth?: string
  hideLabel?: boolean
}

function ColorBadgeSelect({ label, value, options, onChange, placeholder = "Sélectionner", required, minWidth = "70px", hideLabel = false }: ColorBadgeSelectProps) {
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchBufferRef = useRef<string>("")

  const sortedOptions = useMemo(() => 
    [...options].sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })),
    [options]
  )

  const selectedOption = options.find(o => o.id === value)
  const selectedColor = selectedOption?.color || "#6b7280"
  const selectedLabel = selectedOption?.label || placeholder

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false)
      return
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!listRef.current) return
      const items = Array.from(listRef.current.querySelectorAll("[data-option-id]")) as HTMLElement[]
      if (items.length === 0) return
      const currentIndex = items.findIndex(item => item === document.activeElement)
      let nextIndex: number
      if (e.key === "ArrowDown") {
        nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, items.length - 1)
      } else {
        nextIndex = currentIndex === -1 ? items.length - 1 : Math.max(currentIndex - 1, 0)
      }
      const nextItem = items[nextIndex]
      if (nextItem) {
        nextItem.scrollIntoView({ block: "nearest", behavior: "smooth" })
        nextItem.focus()
      }
      return
    }

    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
      e.preventDefault()
      searchBufferRef.current += e.key.toLowerCase()
      const matchIndex = sortedOptions.findIndex(o => 
        o.label.toLowerCase().startsWith(searchBufferRef.current)
      )
      if (matchIndex !== -1 && listRef.current) {
        const items = listRef.current.querySelectorAll("[data-option-id]")
        const targetItem = items[matchIndex] as HTMLElement
        if (targetItem) {
          targetItem.scrollIntoView({ block: "nearest", behavior: "smooth" })
          targetItem.focus()
        }
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        searchBufferRef.current = ""
      }, 800)
    }
  }, [sortedOptions])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className="flex flex-col gap-0.5">
      {!hideLabel && <Label className="text-[10px] text-muted-foreground leading-none">{label}{required && " *"}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full h-7 px-3 text-xs font-semibold transition-all hover:scale-105 hover:shadow-md cursor-pointer"
            style={{
              backgroundColor: selectedColor,
              color: getReadableTextColor(selectedColor),
              minWidth: minWidth,
            }}
          >
            {selectedLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 border-none bg-transparent shadow-none"
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            setTimeout(() => {
              if (listRef.current) {
                const selected = listRef.current.querySelector("[data-selected='true']") as HTMLElement
                const firstItem = listRef.current.querySelector("[data-option-id]") as HTMLElement
                ;(selected || firstItem)?.focus()
              }
            }, 0)
          }}
        >
          <div ref={listRef} className="flex flex-col gap-1 py-1">
            {sortedOptions.map((option) => {
              const isSelected = option.id === value
              const optionColor = option.color || "#6b7280"
              return (
                <button
                  key={option.id}
                  type="button"
                  data-option-id={option.id}
                  data-selected={isSelected}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full h-7 px-3 text-xs font-semibold transition-all outline-none shadow-md hover:shadow-lg hover:scale-105",
                    "focus:ring-2 focus:ring-primary focus:ring-offset-1",
                    isSelected && "ring-2 ring-primary ring-offset-1"
                  )}
                  style={{
                    backgroundColor: optionColor,
                    color: getReadableTextColor(optionColor),
                  }}
                  onClick={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onChange(option.id)
                      setOpen(false)
                    }
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Composant ColorBadgeSelectStacking - Sélecteur avec effet Stacking Cards
interface ColorBadgeSelectStackingProps {
  label: string
  value: string
  options: ColorBadgeOption[]
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  minWidth?: string
  hideLabel?: boolean
}

const CARD_HEIGHT = 36

function StackingCard({
  option,
  index,
  isSelected,
  scrollProgress,
  totalItems,
  onSelect,
}: {
  option: ColorBadgeOption
  index: number
  isSelected: boolean
  scrollProgress: MotionValue<number>
  totalItems: number
  onSelect: () => void
}) {
  const total = Math.max(totalItems, 1)
  const segment = 1 / total
  const rangeStart = Math.max(0, index * segment)
  const rangeEnd = Math.min(1, rangeStart + segment * 0.6)
  const scale = useTransform(scrollProgress, [rangeStart, rangeEnd], [1, 0.92])
  const optionColor = option.color || "#6b7280"
  
  return (
    <div
      className="sticky flex items-center justify-center"
      style={{ top: 0, zIndex: index + 1, height: `${CARD_HEIGHT}px` }}
    >
      <motion.button
        type="button"
        data-option-id={option.id}
        data-selected={isSelected}
        style={{
          scale,
          backgroundColor: optionColor,
          color: getReadableTextColor(optionColor),
        }}
        className={cn(
          "w-full flex items-center justify-center rounded-full px-3 h-8 text-xs font-semibold origin-top",
          "border border-white/30 cursor-pointer hover:border-white/50",
          "focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-1",
          isSelected && "ring-2 ring-white"
        )}
        initial={false}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onSelect}
      >
        {option.label}
      </motion.button>
    </div>
  )
}

function StackingCardsList({
  sortedOptions,
  value,
  onChange,
  onClose,
}: {
  sortedOptions: ColorBadgeOption[]
  value: string
  onChange: (value: string) => void
  onClose: () => void
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchBufferRef = useRef<string>("")

  const { scrollYProgress } = useScroll({
    container: scrollContainerRef,
    offset: ["start start", "end end"],
  })
  
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 150,
    damping: 25,
    restDelta: 0.001
  })

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose()
      return
    }
    if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
      e.preventDefault()
      searchBufferRef.current += e.key.toLowerCase()
      const matchIndex = sortedOptions.findIndex(o => 
        o.label.toLowerCase().startsWith(searchBufferRef.current)
      )
      if (matchIndex !== -1 && scrollContainerRef.current) {
        const items = scrollContainerRef.current.querySelectorAll("[data-option-id]")
        const targetItem = items[matchIndex] as HTMLElement
        if (targetItem) {
          targetItem.scrollIntoView({ block: "center", behavior: "smooth" })
        }
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        searchBufferRef.current = ""
      }, 800)
    }
  }, [sortedOptions, onClose])

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const totalCards = sortedOptions.length
  const containerHeight = Math.min(280, Math.max(180, totalCards * CARD_HEIGHT * 0.6))
  const scrollPadding = totalCards * CARD_HEIGHT * 0.75

  return (
    <div onKeyDown={handleKeyDown}>
      <div 
        ref={scrollContainerRef}
        className="relative overflow-y-auto overflow-x-hidden scrollbar-minimal bg-transparent"
        style={{ height: `${containerHeight}px` }}
      >
        <div className="relative px-1 pt-1" style={{ paddingBottom: `${scrollPadding}px` }}>
          {sortedOptions.map((option, i) => (
            <StackingCard
              key={option.id}
              option={option}
              index={i}
              isSelected={option.id === value}
              scrollProgress={smoothProgress}
              totalItems={totalCards}
              onSelect={() => {
                onChange(option.id)
                onClose()
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ColorBadgeSelectStacking({ 
  label, value, options, onChange, placeholder = "Sélectionner", required, minWidth = "70px", hideLabel = false 
}: ColorBadgeSelectStackingProps) {
  const [open, setOpen] = useState(false)
  const sortedOptions = useMemo(() => 
    [...options].sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })),
    [options]
  )
  const selectedOption = options.find(o => o.id === value)
  const selectedColor = selectedOption?.color || "#6b7280"
  const selectedLabel = selectedOption?.label || placeholder

  return (
    <div className="flex flex-col gap-0.5">
      {!hideLabel && <Label className="text-[10px] text-muted-foreground leading-none">{label}{required && " *"}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full h-7 px-3 text-xs font-semibold transition-all hover:scale-105 hover:shadow-md cursor-pointer"
            style={{
              backgroundColor: selectedColor,
              color: getReadableTextColor(selectedColor),
              minWidth: minWidth,
            }}
          >
            {selectedLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 border-none bg-transparent shadow-none"
          align="start"
          style={{ width: '160px' }}
          sideOffset={6}
        >
          <StackingCardsList
            sortedOptions={sortedOptions}
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

interface NewInterventionFormProps {
  onSuccess?: (data: any) => void
  onCancel?: () => void
  mode?: "halfpage" | "centerpage" | "fullpage"
  formRef?: React.RefObject<HTMLFormElement | null>
  onSubmittingChange?: (isSubmitting: boolean) => void
  onClientNameChange?: (name: string) => void
  onAgencyNameChange?: (name: string) => void
  onClientPhoneChange?: (phone: string) => void
  onOpenSmsModal?: () => void
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
    nomPrenomFacturation: string
    telephoneProprietaire: string
    emailProprietaire: string
    nomPrenomClient: string
    telephoneClient: string
    emailClient: string
    artisan: string
    coutIntervention: string
    coutSST: string
    coutMateriel: string
    artisanTelephone: string
    artisanEmail: string
    artisanId: string
    commentairesIntervention: string
    consigneSecondArtisan: string
  }>
}

export function NewInterventionForm({
  onSuccess,
  onCancel,
  mode = "centerpage",
  formRef,
  onSubmittingChange,
  onClientNameChange,
  onAgencyNameChange,
  onClientPhoneChange,
  onOpenSmsModal,
  defaultValues
}: NewInterventionFormProps) {
  const { data: refData, loading: refDataLoading } = useReferenceData()
  const queryClient = useQueryClient()
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{
    id: string
    displayName: string
    code: string | null
    color: string | null
    roles: string[]
  } | null>(null)

  const [formData, setFormData] = useState({
    // Champs principaux
    statut_id: "",
    id_inter: "",
    agence_id: defaultValues?.agence_id || "",
    reference_agence: defaultValues?.reference_agence || "",
    assigned_user_id: defaultValues?.assigned_user_id || "",
    metier_id: defaultValues?.metier_id || "",
    contexte_intervention: "",
    consigne_intervention: "",

    // Adresse
    adresse: defaultValues?.adresse || "",
    code_postal: defaultValues?.code_postal || "",
    ville: defaultValues?.ville || "",
    latitude: defaultValues?.latitude || 48.8566,
    longitude: defaultValues?.longitude || 2.3522,
    adresseComplete: defaultValues?.adresse && defaultValues?.ville
      ? `${defaultValues.adresse}, ${defaultValues.ville}`
      : "Paris, France",

    // Dates
    date: new Date().toISOString().split('T')[0],
    date_prevue: defaultValues?.datePrevue || "",

    // Commentaires
    consigne_second_artisan: defaultValues?.consigneSecondArtisan || "",
    commentaire_initial: defaultValues?.commentairesIntervention || "",

    // Propriétaire (owner) - Champ fusionné nom-prénom
    nomPrenomFacturation: defaultValues?.nomPrenomFacturation || "",
    telephoneProprietaire: defaultValues?.telephoneProprietaire || "",
    emailProprietaire: defaultValues?.emailProprietaire || "",

    // Client (tenant) - Champ fusionné nom-prénom
    nomPrenomClient: defaultValues?.nomPrenomClient || "",
    telephoneClient: defaultValues?.telephoneClient || "",
    emailClient: defaultValues?.emailClient || "",

    // Logement vacant
    is_vacant: false,
    key_code: "",
    floor: "",
    apartment_number: "",
    vacant_housing_instructions: "",

    // Artisan
    artisan: defaultValues?.artisan || "",
    artisanTelephone: defaultValues?.artisanTelephone || "",
    artisanEmail: defaultValues?.artisanEmail || "",

    // Coûts
    coutSST: defaultValues?.coutSST || "",
    coutMateriel: defaultValues?.coutMateriel || "",
    coutIntervention: defaultValues?.coutIntervention || "",

    // Acomptes
    accompteSST: "",
    accompteSSTRecu: false,
    dateAccompteSSTRecu: "",
    accompteClient: "",
    accompteClientRecu: false,
    dateAccompteClientRecu: "",

    // Sous-statut personnalisé
    sousStatutText: "",
    sousStatutTextColor: "#000000",
    sousStatutBgColor: "transparent",

    // Deuxième artisan
    secondArtisan: "",
    secondArtisanTelephone: "",
    secondArtisanEmail: "",
    metierSecondArtisanId: "",
    coutSSTSecondArtisan: "",
    coutMaterielSecondArtisan: "",
  })

  const [perimeterKmInput, setPerimeterKmInput] = useState("50")
  const perimeterKmValue = useMemo(() => {
    const parsed = Number.parseFloat(perimeterKmInput)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 50
    }
    return Math.min(parsed, MAX_RADIUS_KM)
  }, [perimeterKmInput])
  const [selectedArtisanId, setSelectedArtisanId] = useState<string | null>(defaultValues?.artisanId ?? null)

  const {
    query: locationQuery,
    setQuery: setLocationQuery,
    suggestions: locationSuggestions,
    isSuggesting,
    clearSuggestions,
    geocode: geocodeQuery,
  } = useGeocodeSearch({ initialQuery: "" })
  const suggestionBlurTimeoutRef = useRef<number | null>(null)
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isProprietaireOpen, setIsProprietaireOpen] = useState(false)
  const [isClientOpen, setIsClientOpen] = useState(false)
  const [isAccompteOpen, setIsAccompteOpen] = useState(false)
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isCommentsOpen, setIsCommentsOpen] = useState(true)
  const [isSecondArtisanOpen, setIsSecondArtisanOpen] = useState(false)
  const [isSousStatutOpen, setIsSousStatutOpen] = useState(false)
  const [showArtisanSearch, setShowArtisanSearch] = useState(false)
  const [showSecondArtisanSearch, setShowSecondArtisanSearch] = useState(false)
  const [artisanSearchPosition, setArtisanSearchPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)
  const [secondArtisanSearchPosition, setSecondArtisanSearchPosition] = useState<{ x: number; y: number; width?: number; height?: number } | null>(null)
  // État pour stocker l'artisan sélectionné via recherche (qui peut ne pas être dans nearbyArtisans)
  const [searchSelectedArtisan, setSearchSelectedArtisan] = useState<NearbyArtisan | null>(null)
  const [searchSelectedSecondArtisan, setSearchSelectedSecondArtisan] = useState<NearbyArtisan | null>(null)
  const [absentArtisanIds, setAbsentArtisanIds] = useState<Set<string>>(new Set())
  const [selectedSecondArtisanId, setSelectedSecondArtisanId] = useState<string | null>(null)
  const { open: openArtisanModal } = useArtisanModal()
  const [createdInterventionId, setCreatedInterventionId] = useState<string | null>(null)
  
  // Email modal states
  const [isDevisEmailModalOpen, setIsDevisEmailModalOpen] = useState(false)
  const [isInterventionEmailModalOpen, setIsInterventionEmailModalOpen] = useState(false)
  const [selectedArtisanForEmail, setSelectedArtisanForEmail] = useState<string | null>(null)

  const {
    artisans: nearbyArtisans,
    loading: isLoadingNearbyArtisans,
    error: nearbyArtisansError,
  } = useNearbyArtisans(formData.latitude, formData.longitude, {
    limit: 100,
    maxDistanceKm: perimeterKmValue,
    sampleSize: 400,
    metier_id: formData.metier_id || null,
  })

  // Hook séparé pour les artisans du second métier
  const {
    artisans: nearbyArtisansSecondMetier,
    loading: isLoadingNearbyArtisansSecondMetier,
  } = useNearbyArtisans(formData.latitude, formData.longitude, {
    limit: 100,
    maxDistanceKm: perimeterKmValue,
    sampleSize: 400,
    metier_id: formData.metierSecondArtisanId || null,
  })

  const selectedArtisanData = useMemo(
    () => {
      if (!selectedArtisanId) return null
      // D'abord chercher dans les artisans à proximité
      const nearbyArtisan = nearbyArtisans.find((artisan) => artisan.id === selectedArtisanId)
      if (nearbyArtisan) return nearbyArtisan
      // Sinon utiliser l'artisan de la recherche (qui peut ne pas être à proximité)
      return searchSelectedArtisan
    },
    [selectedArtisanId, nearbyArtisans, searchSelectedArtisan],
  )

  const selectedSecondArtisanData = useMemo(
    () => {
      if (!selectedSecondArtisanId) return null
      const nearbyArtisan = nearbyArtisansSecondMetier.find((artisan) => artisan.id === selectedSecondArtisanId)
      if (nearbyArtisan) return nearbyArtisan
      return searchSelectedSecondArtisan
    },
    [selectedSecondArtisanId, nearbyArtisansSecondMetier, searchSelectedSecondArtisan],
  )

  useEffect(() => {
    let cancelled = false
    const artisanIds = new Set<string>()

    nearbyArtisans.forEach((artisan) => artisanIds.add(artisan.id))
    nearbyArtisansSecondMetier.forEach((artisan) => artisanIds.add(artisan.id))
    if (searchSelectedArtisan?.id) artisanIds.add(searchSelectedArtisan.id)
    if (searchSelectedSecondArtisan?.id) artisanIds.add(searchSelectedSecondArtisan.id)

    if (artisanIds.size === 0) {
      setAbsentArtisanIds(new Set())
      return
    }

    setAbsentArtisanIds(new Set())
    const nowIso = new Date().toISOString()

    const loadAbsences = async () => {
      const { data, error } = await supabase
        .from("artisan_absences")
        .select("artisan_id")
        .in("artisan_id", Array.from(artisanIds))
        .lte("start_date", nowIso)
        .gte("end_date", nowIso)

      if (cancelled) return

      if (error) {
        console.warn("[NewInterventionForm] Erreur lors du chargement des absences:", error)
        setAbsentArtisanIds(new Set())
        return
      }

      setAbsentArtisanIds(
        new Set((data ?? []).map((absence) => absence.artisan_id).filter(Boolean)),
      )
    }

    loadAbsences()

    return () => {
      cancelled = true
    }
  }, [
    nearbyArtisans,
    nearbyArtisansSecondMetier,
    searchSelectedArtisan?.id,
    searchSelectedSecondArtisan?.id,
  ])

  // Calcul de la marge du 2ème artisan en pourcentage
  const margeSecondArtisanPct = useMemo(() => {
    const coutInter = parseFloat(formData.coutIntervention) || 0
    const coutSST1 = parseFloat(formData.coutSST) || 0
    const coutMat1 = parseFloat(formData.coutMateriel) || 0
    const coutSST2 = parseFloat(formData.coutSSTSecondArtisan) || 0
    const coutMat2 = parseFloat(formData.coutMaterielSecondArtisan) || 0
    const coutInter2 = coutInter - (coutSST1 + coutMat1)
    const marge2 = coutInter2 - (coutSST2 + coutMat2)
    if (coutInter2 <= 0) return 0
    return (marge2 / coutInter2) * 100
  }, [formData.coutIntervention, formData.coutSST, formData.coutMateriel, formData.coutSSTSecondArtisan, formData.coutMaterielSecondArtisan])

  // Initialiser le statut par défaut à "DEMANDE"
  useEffect(() => {
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

  const mapMarkers = useMemo(() => {
    if (!refData?.artisanStatuses) {
      return nearbyArtisans.map((artisan) => ({
        id: artisan.id,
        lat: artisan.lat,
        lng: artisan.lng,
        color: artisan.id === selectedArtisanData?.id ? "#f97316" : "#2563eb",
        title: artisan.displayName,
      }))
    }

    const archiveStatuses = refData.artisanStatuses.filter(
      (s) => s.code === "ARCHIVE" || s.code === "ARCHIVER"
    )
    const archiveStatusIds = new Set(archiveStatuses.map((s) => s.id))
    const visibleArtisans =
      archiveStatusIds.size > 0
        ? nearbyArtisans.filter(
          (artisan) => !artisan.statut_id || !archiveStatusIds.has(artisan.statut_id),
        )
        : nearbyArtisans

    return visibleArtisans.map((artisan) => ({
      id: artisan.id,
      lat: artisan.lat,
      lng: artisan.lng,
      color: artisan.id === selectedArtisanData?.id ? "#f97316" : "#2563eb",
      title: artisan.displayName,
    }))
  }, [nearbyArtisans, selectedArtisanData, refData?.artisanStatuses])

  const mapSelectedConnection = useMemo(() => {
    if (!selectedArtisanData) return null
    return {
      lat: selectedArtisanData.lat,
      lng: selectedArtisanData.lng,
      distanceLabel: formatDistanceKm(selectedArtisanData.distanceKm),
    }
  }, [selectedArtisanData])

  useEffect(() => {
    return () => {
      if (suggestionBlurTimeoutRef.current) {
        window.clearTimeout(suggestionBlurTimeoutRef.current)
      }
    }
  }, [])

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
          roles: Array.isArray(user.roles) ? user.roles : [],
        })
      } catch (error) {
        console.warn(
          "[NewInterventionForm] Impossible de charger l'utilisateur courant",
          error,
        )
      }
    }

    loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  // Sync client name with parent
  useEffect(() => {
    onClientNameChange?.(formData.nomPrenomClient)
  }, [formData.nomPrenomClient, onClientNameChange])

  // Sync client phone with parent
  useEffect(() => {
    onClientPhoneChange?.(formData.telephoneClient)
  }, [formData.telephoneClient, onClientPhoneChange])

  // Sync agency name with parent
  useEffect(() => {
    if (refData?.agencies && formData.agence_id) {
      const agency = refData.agencies.find((a: any) => a.id === formData.agence_id)
      if (agency) {
        onAgencyNameChange?.(agency.label || "")
      }
    } else if (!formData.agence_id) {
      onAgencyNameChange?.("")
    }
  }, [formData.agence_id, refData?.agencies, onAgencyNameChange])

  const selectedStatus = useMemo(() => {
    if (!formData.statut_id || !refData?.interventionStatuses) {
      return undefined
    }
    return refData.interventionStatuses.find((status) => status.id === formData.statut_id)
  }, [formData.statut_id, refData])

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

  const handleInputChange = useCallback((field: keyof typeof formData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleLocationChange = (lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }))
    setGeocodeError(null)
  }

  const applyArtisanSelection = useCallback((artisan: NearbyArtisan | null) => {
    setSelectedArtisanId(artisan?.id ?? null)
    setFormData((prev) => ({
      ...prev,
      artisan: artisan?.displayName ?? "",
      artisanTelephone: artisan?.telephone ?? "",
      artisanEmail: artisan?.email ?? "",
    }))
  }, [])

  const handleSelectNearbyArtisan = useCallback(
    (artisan: NearbyArtisan) => {
      setSelectedArtisanId(artisan.id)
      handleInputChange("artisan", `${artisan.prenom || ""} ${artisan.nom || ""}`.trim())
    },
    [handleInputChange],
  )

  const handleRemoveSelectedArtisan = useCallback(() => {
    setSelectedArtisanId(null)
    setSearchSelectedArtisan(null)
  }, [])

  // Fonctions pour le 2ème artisan
  const handleSelectSecondArtisan = useCallback(
    (artisan: NearbyArtisan) => {
      setSelectedSecondArtisanId(artisan.id)
      handleInputChange("secondArtisan", `${artisan.prenom || ""} ${artisan.nom || ""}`.trim())
      handleInputChange("secondArtisanTelephone", artisan.telephone || "")
      handleInputChange("secondArtisanEmail", artisan.email || "")
    },
    [handleInputChange],
  )

  const handleRemoveSecondArtisan = useCallback(() => {
    setSelectedSecondArtisanId(null)
    setSearchSelectedSecondArtisan(null)
    handleInputChange("secondArtisan", "")
    handleInputChange("secondArtisanTelephone", "")
    handleInputChange("secondArtisanEmail", "")
  }, [handleInputChange])

  const handleSecondArtisanSearchSelect = useCallback((artisan: ArtisanSearchResult) => {
    const displayName = artisan.raison_sociale
      || artisan.plain_nom
      || [artisan.prenom, artisan.nom].filter(Boolean).join(" ")
      || "Artisan sans nom"

    setSelectedSecondArtisanId(artisan.id)
    setFormData((prev) => ({
      ...prev,
      secondArtisan: displayName,
      secondArtisanTelephone: artisan.telephone || "",
      secondArtisanEmail: artisan.email || "",
    }))

    const isInProximity = nearbyArtisansSecondMetier.some(a => a.id === artisan.id)
    if (!isInProximity) {
      const nearbyArtisanFormat: NearbyArtisan = {
        id: artisan.id,
        displayName: displayName,
        distanceKm: 0,
        telephone: artisan.telephone || null,
        email: artisan.email || null,
        adresse: artisan.adresse_intervention || artisan.adresse_siege_social || null,
        ville: artisan.ville_intervention || artisan.ville_siege_social || null,
        codePostal: artisan.code_postal_intervention || artisan.code_postal_siege_social || null,
        lat: 0,
        lng: 0,
        prenom: artisan.prenom || null,
        nom: artisan.nom || null,
        statut_id: artisan.statut_id || null,
        photoProfilMetadata: null,
      }
      setSearchSelectedSecondArtisan(nearbyArtisanFormat)
    } else {
      setSearchSelectedSecondArtisan(null)
    }
  }, [nearbyArtisansSecondMetier])

  // Fonctions pour les emails
  const effectiveSelectedArtisanId = useMemo(() => {
    return selectedArtisanForEmail || selectedArtisanId || null
  }, [selectedArtisanForEmail, selectedArtisanId])

  const selectedArtisanEmail = useMemo(() => {
    const artisanId = effectiveSelectedArtisanId
    if (!artisanId) return ''
    if (selectedArtisanData && selectedArtisanData.id === artisanId) {
      return selectedArtisanData.email || ''
    }
    if (selectedSecondArtisanData && selectedSecondArtisanData.id === artisanId) {
      return selectedSecondArtisanData.email || ''
    }
    return ''
  }, [effectiveSelectedArtisanId, selectedArtisanData, selectedSecondArtisanData])

  const generateEmailTemplateData = useCallback((artisanId: string): EmailTemplateData => {
    const nomClient = formData.nomPrenomClient || ''
    const telephoneClient = formData.telephoneClient || ''
    const adresseComplete = formData.adresse && (formData.code_postal || formData.ville)
      ? `${formData.adresse}, ${formData.code_postal || ''} ${formData.ville || ''}`.trim()
      : ''
    const isPrimary = artisanId === selectedArtisanId
    const consigneArtisan = isPrimary
      ? (formData.consigne_intervention || '')
      : (formData.consigne_second_artisan || '')
    const coutSST = formData.coutSST ? `${formData.coutSST} EUR` : 'Non spécifié'

    return {
      nomClient,
      telephoneClient,
      telephoneClient2: '',
      adresseComplete,
      datePrevue: formData.date_prevue || undefined,
      consigneArtisan: consigneArtisan || undefined,
      coutSST,
      commentaire: undefined,
      idIntervention: formData.id_inter || undefined,
    }
  }, [formData, selectedArtisanId])

  const handleOpenDevisEmailModal = useCallback((artisanId?: string) => {
    const targetArtisanId = artisanId || effectiveSelectedArtisanId
    if (!targetArtisanId) {
      toast.error('Veuillez sélectionner un artisan')
      return
    }
    if (artisanId) {
      setSelectedArtisanForEmail(artisanId)
    }
    setIsDevisEmailModalOpen(true)
  }, [effectiveSelectedArtisanId])

  const handleOpenInterventionEmailModal = useCallback((artisanId?: string) => {
    const targetArtisanId = artisanId || effectiveSelectedArtisanId
    if (!targetArtisanId) {
      toast.error('Veuillez sélectionner un artisan')
      return
    }
    if (artisanId) {
      setSelectedArtisanForEmail(artisanId)
    }
    setIsInterventionEmailModalOpen(true)
  }, [effectiveSelectedArtisanId])

  const handleArtisanSearchSelect = useCallback((artisan: ArtisanSearchResult) => {
    const displayName = artisan.raison_sociale
      || artisan.plain_nom
      || [artisan.prenom, artisan.nom].filter(Boolean).join(" ")
      || "Artisan sans nom"

    setSelectedArtisanId(artisan.id)
    setFormData((prev) => ({
      ...prev,
      artisan: displayName,
      artisanTelephone: artisan.telephone || "",
      artisanEmail: artisan.email || "",
    }))

    // Si l'artisan sélectionné via recherche n'est pas dans la liste de proximité,
    // on le convertit au format NearbyArtisan et on le stocke pour l'afficher
    const isInProximity = nearbyArtisans.some(a => a.id === artisan.id)
    if (!isInProximity) {
      // Convertir l'artisan de la recherche au format NearbyArtisan
      const nearbyArtisanFormat: NearbyArtisan = {
        id: artisan.id,
        displayName: displayName,
        distanceKm: 0, // Distance inconnue pour artisan hors proximité
        telephone: artisan.telephone || null,
        email: artisan.email || null,
        adresse: artisan.adresse_intervention || artisan.adresse_siege_social || null,
        ville: artisan.ville_intervention || artisan.ville_siege_social || null,
        codePostal: artisan.code_postal_intervention || artisan.code_postal_siege_social || null,
        lat: 0,
        lng: 0,
        prenom: artisan.prenom || null,
        nom: artisan.nom || null,
        statut_id: artisan.statut_id || null,
        photoProfilMetadata: null,
      }
      setSearchSelectedArtisan(nearbyArtisanFormat)
    } else {
      // Si l'artisan est dans la liste de proximité, pas besoin de le stocker séparément
      setSearchSelectedArtisan(null)
    }
  }, [nearbyArtisans])

  const handleOpenArtisanModal = useCallback((artisanId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    openArtisanModal(artisanId, {
      origin: `new-intervention`,
    })
  }, [openArtisanModal])

  const handleSuggestionSelect = useCallback((suggestion: GeocodeSuggestion) => {
    if (suggestionBlurTimeoutRef.current) {
      window.clearTimeout(suggestionBlurTimeoutRef.current)
      suggestionBlurTimeoutRef.current = null
    }

    const addressParts = parseAddress(suggestion.label)

    clearSuggestions()
    setShowLocationSuggestions(false)

    setFormData((prev) => ({
      ...prev,
      latitude: suggestion.lat,
      longitude: suggestion.lng,
      adresseComplete: suggestion.label,
      adresse: addressParts.street || suggestion.label,
      code_postal: addressParts.postalCode || "",
      ville: addressParts.city || "",
    }))

    setLocationQuery(suggestion.label)
    setGeocodeError(null)
  }, [clearSuggestions, setLocationQuery])

  const parseAddress = (fullAddress: string): { street: string; postalCode: string; city: string } => {
    const parts = fullAddress.split(',').map(p => p.trim())

    let street = ""
    let postalCode = ""
    let city = ""

    const postalCodeRegex = /\b(\d{5})\b/

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const match = part.match(postalCodeRegex)

      if (match) {
        postalCode = match[1]

        const cityInSamePart = part.replace(match[0], '').trim()
        if (cityInSamePart) {
          city = cityInSamePart
        }
        else if (i > 0 && !city) {
          city = parts[i - 1]
        }
      }
    }

    if (!city && parts.length >= 2) {
      city = parts[1].replace(postalCodeRegex, '').trim()
    }

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
    clearSuggestions()
    setShowLocationSuggestions(false)

    try {
      const result = await geocodeQuery(fullAddress)
      if (!result) {
        setGeocodeError("Adresse introuvable")
        return
      }

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const form = event.currentTarget
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }

    let idInterValue = formData.id_inter?.trim() ?? ""
    if (requiresDefinitiveId) {
      if (idInterValue.length === 0 || idInterValue.toLowerCase().includes("auto")) {
        form.reportValidity()
        return
      }
    } else if (!idInterValue) {
      idInterValue = generateAutoInterventionId()
      setFormData((prev) => ({ ...prev, id_inter: idInterValue }))
    }

    const datePrevueValue = formData.date_prevue?.trim() ?? ""
    if (requiresDatePrevue && datePrevueValue.length === 0) {
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
          nomPrenomFacturation: formData.nomPrenomFacturation,
          telephoneProprietaire: formData.telephoneProprietaire,
          emailProprietaire: formData.emailProprietaire,
        })
      } catch (error) {
        console.error("[NewInterventionForm] Erreur lors de la gestion du propriétaire:", error)
        toast.error("Erreur lors de la sauvegarde du propriétaire")
      }

      if (!formData.is_vacant) {
        try {
          tenantId = await findOrCreateTenant({
            nomPrenomClient: formData.nomPrenomClient,
            telephoneClient: formData.telephoneClient,
            emailClient: formData.emailClient,
          })
        } catch (error) {
          console.error("[NewInterventionForm] Erreur lors de la gestion du client:", error)
          toast.error("Erreur lors de la sauvegarde du client")
        }
      } else {
        tenantId = null
      }

      const createData: CreateInterventionData = {
        statut_id: formData.statut_id || undefined,
        agence_id: formData.agence_id || undefined,
        reference_agence: referenceAgenceValue.length > 0 ? referenceAgenceValue : null,
        assigned_user_id: formData.assigned_user_id || undefined,
        metier_id: formData.metier_id || undefined,
        date: formData.date || new Date().toISOString(),
        date_prevue: formData.date_prevue || undefined,
        contexte_intervention: formData.contexte_intervention || undefined,
        consigne_intervention: formData.consigne_intervention || undefined,
        consigne_second_artisan: formData.consigne_second_artisan || undefined,
        adresse: formData.adresse || undefined,
        code_postal: formData.code_postal || undefined,
        ville: formData.ville || undefined,
        latitude: formData.latitude,
        longitude: formData.longitude,
        id_inter: idInterValue,
        is_vacant: formData.is_vacant,
        key_code: formData.is_vacant ? (formData.key_code?.trim() || null) : null,
        floor: formData.is_vacant ? (formData.floor?.trim() || null) : null,
        apartment_number: formData.is_vacant ? (formData.apartment_number?.trim() || null) : null,
        vacant_housing_instructions: formData.is_vacant ? (formData.vacant_housing_instructions?.trim() || null) : null,
        owner_id: ownerId || undefined,
        tenant_id: tenantId || undefined,
        // Sous-statut personnalisé
        sous_statut_text: formData.sousStatutText?.trim() || null,
        sous_statut_text_color: formData.sousStatutTextColor || '#000000',
        sous_statut_bg_color: formData.sousStatutBgColor || 'transparent',
        // Deuxième artisan - métier
        metier_second_artisan_id: formData.metierSecondArtisanId || null,
      }

      Object.keys(createData).forEach((key) => {
        if (createData[key as keyof CreateInterventionData] === undefined) {
          delete createData[key as keyof CreateInterventionData]
        }
      })

      console.log(`[NewInterventionForm] 📝 Création de l'intervention via interventionsApi`)
      const created = await interventionsApi.create(createData)
      setCreatedInterventionId(created.id)

      // Assigner l'artisan principal si sélectionné
      if (selectedArtisanId) {
        try {
          await interventionsApi.setPrimaryArtisan(created.id, selectedArtisanId)
        } catch (artisanError) {
          console.error("[NewInterventionForm] Impossible d'assigner l'artisan", artisanError)
        }
      }

      // Assigner le second artisan si sélectionné
      if (selectedSecondArtisanId) {
        try {
          await interventionsApi.setSecondaryArtisan(created.id, selectedSecondArtisanId)
        } catch (artisanError) {
          console.error("[NewInterventionForm] Impossible d'assigner le second artisan", artisanError)
        }
      }

      // Créer les coûts si renseignés
      const coutSSTValue = parseFloat(formData.coutSST) || 0
      const coutMaterielValue = parseFloat(formData.coutMateriel) || 0
      const coutInterventionValue = parseFloat(formData.coutIntervention) || 0

      if (coutSSTValue > 0) {
        try {
          await interventionsApi.upsertCost(created.id, {
            cost_type: "sst",
            label: "Coût SST",
            amount: coutSSTValue,
            artisan_order: 1,
          })
        } catch (costError) {
          console.error("[NewInterventionForm] Erreur coût SST:", costError)
        }
      }

      if (coutMaterielValue > 0) {
        try {
          await interventionsApi.upsertCost(created.id, {
            cost_type: "materiel",
            label: "Coût Matériel",
            amount: coutMaterielValue,
            artisan_order: 1,
          })
        } catch (costError) {
          console.error("[NewInterventionForm] Erreur coût matériel:", costError)
        }
      }

      if (coutInterventionValue > 0) {
        try {
          await interventionsApi.upsertCost(created.id, {
            cost_type: "intervention",
            label: "Coût Intervention",
            amount: coutInterventionValue,
            artisan_order: null, // Coût global
          })
        } catch (costError) {
          console.error("[NewInterventionForm] Erreur coût intervention:", costError)
        }
      }

      // Créer les coûts du 2ème artisan si renseignés
      const coutSST2Value = parseFloat(formData.coutSSTSecondArtisan) || 0
      const coutMateriel2Value = parseFloat(formData.coutMaterielSecondArtisan) || 0

      if (selectedSecondArtisanId && coutSST2Value > 0) {
        try {
          await interventionsApi.upsertCost(created.id, {
            cost_type: "sst",
            label: "Coût SST 2ème artisan",
            amount: coutSST2Value,
            artisan_order: 2,
          })
        } catch (costError) {
          console.error("[NewInterventionForm] Erreur coût SST 2ème artisan:", costError)
        }
      }

      if (selectedSecondArtisanId && coutMateriel2Value > 0) {
        try {
          await interventionsApi.upsertCost(created.id, {
            cost_type: "materiel",
            label: "Coût Matériel 2ème artisan",
            amount: coutMateriel2Value,
            artisan_order: 2,
          })
        } catch (costError) {
          console.error("[NewInterventionForm] Erreur coût matériel 2ème artisan:", costError)
        }
      }

      // Ajouter le commentaire initial si renseigné
      const trimmedInitialComment = formData.commentaire_initial.trim()
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
          console.error("[NewInterventionForm] Impossible d'ajouter le commentaire initial", commentError)
          toast.error("L'intervention a bien été créée mais le commentaire initial n'a pas pu être enregistré.")
        }
      }

      toast.success("Intervention créée")
      onSuccess?.(created)

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
    // Utilise la configuration depuis agency_config en base de données
    return selectedAgencyData.requires_reference === true
  }, [selectedAgencyData])

  if (refDataLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">Chargement des données...</div>
      </div>
    )
  }

  // Hauteur de la section carte+artisans basée sur la sélection d'artisan
  const mapSectionHeight = selectedArtisanId ? "260px" : "450px"

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
      {/* LAYOUT DEUX COLONNES DISTINCTES - Chaque colonne a son propre scroll */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* COLONNE GAUCHE - Scroll indépendant */}
        <div className="flex-1 min-w-0 overflow-y-auto min-h-0 scrollbar-minimal scrollbar-left">
          <div
            className="grid gap-3 pb-4"
            style={{
              gridTemplateColumns: "repeat(4, 1fr)",
              gridTemplateRows: `auto auto auto ${mapSectionHeight} auto auto`,
            }}
          >
            {/* DIV1: HEADER PRINCIPAL - Row 1, Cols 1-4 */}
            <Card className="legacy-form-card" style={{ gridArea: "1 / 1 / 2 / 5" }}>
              <CardContent className="py-0.5 px-3">
                <div 
                  className="grid gap-2 items-end"
                  style={{
                    gridTemplateColumns: showReferenceField 
                      ? "auto 1fr 1fr 1fr 1fr 1fr" 
                      : "auto 1fr 1fr 1fr 1fr"
                  }}
                >
                  {/* Badge utilisateur assigné - Largeur fixe à gauche */}
                  <div className="flex items-center">
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="flex items-center justify-center h-7 w-7 cursor-pointer group rounded-full">
                          {(() => {
                            const assignedUser = refData?.users.find(u => u.id === formData.assigned_user_id)
                            return (
                              <GestionnaireBadge
                                firstname={assignedUser?.firstname}
                                lastname={assignedUser?.lastname}
                                color={assignedUser?.color}
                                size="sm"
                                className="transition-transform group-hover:scale-110 h-7 w-7"
                              />
                            )
                          })()}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Attribuer à</p>
                          <div className="space-y-1">
                            {refData?.users.map((user) => {
                              const displayName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim() || user.username
                              const isSelected = user.id === formData.assigned_user_id
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  className={cn(
                                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                                    isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
                                  )}
                                  onClick={() => handleInputChange("assigned_user_id", user.id)}
                                >
                                  <GestionnaireBadge
                                    firstname={user.firstname}
                                    lastname={user.lastname}
                                    color={user.color}
                                    size="sm"
                                    showBorder={false}
                                  />
                                  <span className="text-xs truncate flex-1">
                                    {user.code_gestionnaire ? `${user.code_gestionnaire} - ${displayName}` : displayName}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Statut - Badge coloré */}
                  <ColorBadgeSelect
                    label="Statut"
                    required
                    hideLabel
                    value={formData.statut_id}
                    onChange={(value) => handleInputChange("statut_id", value)}
                    placeholder="Statut"
                    options={(refData?.interventionStatuses || []).map(s => ({
                      id: s.id,
                      label: s.label,
                      color: s.color,
                    }))}
                  />

                  {/* Agence - Badge coloré */}
                  <ColorBadgeSelect
                    label="Agence"
                    hideLabel
                    value={formData.agence_id}
                    onChange={(value) => handleInputChange("agence_id", value)}
                    placeholder="Agence"
                    options={(refData?.agencies || []).map(a => ({
                      id: a.id,
                      label: a.label,
                      color: a.color,
                    }))}
                  />

                  {/* Réf. agence - Input conditionnel */}
                  {showReferenceField && (
                    <div className="flex items-center">
                      <Input
                        id="reference_agence"
                        name="reference_agence"
                        value={formData.reference_agence}
                        onChange={(event) => handleInputChange("reference_agence", event.target.value)}
                        placeholder="Réf. agence"
                        className="h-7 text-xs rounded-full px-3"
                        autoComplete="off"
                      />
                    </div>
                  )}

                  {/* Métier - Badge coloré */}
                  <ColorBadgeSelect
                    label="Métier"
                    hideLabel
                    value={formData.metier_id}
                    onChange={(value) => handleInputChange("metier_id", value)}
                    placeholder="Métier"
                    minWidth="100px"
                    options={(refData?.metiers || []).map(m => ({
                      id: m.id,
                      label: m.label,
                      color: m.color,
                    }))}
                  />

                  {/* ID Intervention - Input */}
                  <div className="flex items-center">
                    <Input
                      id="idIntervention"
                      value={formData.id_inter}
                      onChange={(event) => handleInputChange("id_inter", event.target.value)}
                      placeholder="ID Inter. (Auto)"
                      className="h-7 text-xs rounded-full px-3"
                      required={requiresDefinitiveId}
                      pattern={requiresDefinitiveId ? "^(?!.*(?:[Aa][Uu][Tt][Oo])).+$" : undefined}
                      title={requiresDefinitiveId ? "ID définitif requis" : undefined}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* DIV2: ADRESSE - Row 2, Cols 1-4 */}
            <Card style={{ gridArea: "2 / 1 / 3 / 5" }}>
              <CardContent className="py-2 px-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="adresse" className="text-[10px] text-muted-foreground whitespace-nowrap">Adresse *</Label>
                  <Input
                    id="adresse"
                    value={formData.adresse}
                    onChange={(event) => handleInputChange("adresse", event.target.value)}
                    placeholder="Adresse complète de l'intervention..."
                    className="h-7 text-xs flex-1"
                    required
                  />
                </div>
              </CardContent>
            </Card>

            {/* DIV3: LOCALISATION + RAYON + BOUTON - Row 3, Cols 1-4 */}
            <Card style={{ gridArea: "3 / 1 / 4 / 5" }}>
              <CardContent className="py-2 px-3">
                <div className="flex items-center gap-2">
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
                      placeholder="Rechercher une adresse pour localiser..."
                      className="h-7 text-xs"
                    />
                    {showLocationSuggestions && locationSuggestions.length > 0 && (
                      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-muted bg-background shadow-lg">
                        <ul className="divide-y divide-border text-left text-xs">
                          {locationSuggestions.map((suggestion) => (
                            <li key={`${suggestion.label}-${suggestion.lat}-${suggestion.lng}`}>
                              <button
                                type="button"
                                className="flex w-full flex-col gap-0.5 px-2 py-1.5 text-left transition hover:bg-muted/80 focus:bg-muted/80"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleSuggestionSelect(suggestion)}
                              >
                                <span className="truncate font-medium">{suggestion.label}</span>
                                <span className="text-[10px] text-muted-foreground">
                                  {suggestion.lat.toFixed(4)} • {suggestion.lng.toFixed(4)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Input
                    id="perimeterKm"
                    type="number"
                    min={1}
                    max={MAX_RADIUS_KM}
                    value={perimeterKmInput}
                    onChange={(event) => setPerimeterKmInput(event.target.value)}
                    onBlur={(event) => {
                      const raw = Number.parseFloat(event.target.value)
                      if (!Number.isFinite(raw) || raw <= 0) {
                        setPerimeterKmInput("50")
                        return
                      }
                      const clamped = Math.min(raw, MAX_RADIUS_KM)
                      setPerimeterKmInput(String(clamped))
                    }}
                    placeholder="km"
                    className="h-7 w-14 text-xs"
                  />
                  <span className="text-[10px] text-muted-foreground">km</span>
                  <Button type="button" variant="secondary" size="sm" className="h-7 text-xs px-2" onClick={handleGeocodeAddress} disabled={isGeocoding}>
                    {isGeocoding ? "..." : "Localiser"}
                  </Button>
                </div>
                {geocodeError && (
                  <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive mt-1">
                    {geocodeError}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* DIV7+8: CARTE + ARTISANS REDIMENSIONNABLES - Row 4, Cols 1-4 */}
            <div style={{ gridArea: "4 / 1 / 5 / 5", height: mapSectionHeight }}>
          <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg">
            {/* Panel Carte */}
            <ResizablePanel defaultSize={70} minSize={30} maxSize={85}>
              <Card className="h-full overflow-hidden rounded-r-none border-r-0">
                <CardContent className="p-0 h-full">
                  <MapLibreMap
                    lat={formData.latitude}
                    lng={formData.longitude}
                    height="100%"
                    onLocationChange={handleLocationChange}
                    markers={mapMarkers}
                    circleRadiusKm={perimeterKmValue}
                    selectedConnection={mapSelectedConnection ?? undefined}
                  />
                </CardContent>
              </Card>
            </ResizablePanel>

            {/* Handle de redimensionnement avec trois points */}
            <ResizableHandle className="w-2 bg-muted/50 hover:bg-primary/20 transition-colors data-[resize-handle-active]:bg-primary/30 group">
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-70 transition-opacity">
                  <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                  <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                  <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                </div>
              </div>
            </ResizableHandle>

            {/* Panel Artisans */}
            <ResizablePanel defaultSize={30} minSize={15} maxSize={70}>
              <Card className="h-full flex flex-col overflow-hidden rounded-l-none border-l-0">
                <CardContent className="p-3 flex flex-col h-full overflow-hidden">
                  {/* Header artisans */}
                  <div className="flex items-center justify-between gap-2 mb-3 flex-shrink-0">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      Artisans
                    </h3>
                    <div className="flex gap-1">
                      <Input
                        id="artisan"
                        value={formData.artisan}
                        onChange={(event) => handleInputChange("artisan", event.target.value)}
                        placeholder="Artisan"
                        className="h-7 text-xs w-24"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setArtisanSearchPosition({
                            x: rect.left,
                            y: rect.top,
                            width: rect.width,
                            height: rect.height
                          })
                          setShowArtisanSearch(true)
                        }}
                        title="Rechercher un artisan"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Artisan sélectionné */}
                  {selectedArtisanId && selectedArtisanData && (() => {
                    const artisan = selectedArtisanData
                    const artisanName = `${artisan.prenom || ""} ${artisan.nom || ""}`.trim() || "Artisan sans nom"
                    const artisanInitials = artisanName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
                    const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                    const statutArtisan = artisanStatus?.label || ""
                    const statutArtisanColor = artisanStatus?.color || null

                    return (
                      <div className="mb-2 flex-shrink-0">
                        <div className="relative rounded-lg border border-primary/70 ring-2 ring-primary/50 bg-background/80 p-2 text-xs shadow-sm">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1 h-5 w-5 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:text-destructive z-20"
                            onClick={() => handleRemoveSelectedArtisan()}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <div className="flex items-start gap-2">
                            <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} />
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-foreground block truncate">{artisan.displayName}</span>
                              <div className="flex items-center gap-1 mt-1">
                                {statutArtisan && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                                    {statutArtisan}
                                  </Badge>
                                )}
                                {absentArtisanIds.has(artisan.id) && (
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300">
                                    Indisponible
                                  </Badge>
                                )}
                                <Badge variant="default" className="text-[9px] px-1 py-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                              </div>
                              <div className="mt-1 text-[10px] text-muted-foreground truncate">
                                {artisan.telephone && <span>📞 {artisan.telephone}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Email sending section - Grisé car intervention non créée */}
                  {selectedArtisanId && selectedArtisanData && (
                    <TooltipProvider delayDuration={200}>
                      <div className="flex gap-1 p-2 bg-muted/50 rounded-lg border border-muted-foreground/20 mb-2 flex-shrink-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled
                                className="w-full text-[10px] h-7 px-2 opacity-50 cursor-not-allowed"
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Devis
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p>Créez l&apos;intervention avant l&apos;envoi de mail</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled
                                className="w-full text-[10px] h-7 px-2 opacity-50 cursor-not-allowed"
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Inter.
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p>Créez l&apos;intervention avant l&apos;envoi de mail</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  )}

                  {/* Liste des artisans - max 8 visibles avec scroll */}
                  <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                    {isLoadingNearbyArtisans ? (
                      <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Recherche...</div>
                    ) : nearbyArtisansError ? (
                      <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">{nearbyArtisansError}</div>
                    ) : nearbyArtisans.length === 0 ? (
                      <div className="rounded border border-border/50 bg-background px-2 py-2 text-[10px] text-muted-foreground">Aucun artisan dans un rayon de {perimeterKmValue} km.</div>
                    ) : (
                      nearbyArtisans.map((artisan) => {
                        const artisanName = `${artisan.prenom || ""} ${artisan.nom || ""}`.trim() || "Artisan sans nom"
                        const artisanInitials = artisanName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
                        const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                        const statutArtisan = artisanStatus?.label || ""
                        const statutArtisanColor = artisanStatus?.color || null

                        return (
                          <div
                            key={artisan.id}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              "rounded-lg border border-border/60 bg-background/80 p-2 text-xs shadow-sm transition-all cursor-pointer",
                              selectedArtisanId ? "opacity-0 scale-95 max-h-0 overflow-hidden pointer-events-none m-0 p-0 border-0" : "hover:border-primary/40"
                            )}
                            onClick={() => handleSelectNearbyArtisan(artisan)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectNearbyArtisan(artisan) } }}
                          >
                            <div className="flex items-center gap-2">
                              <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-foreground block truncate text-[11px]">{artisan.displayName}</span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {statutArtisan && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                                      {statutArtisan}
                                    </Badge>
                                  )}
                                  {absentArtisanIds.has(artisan.id) && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300">
                                      Indisponible
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-[9px] px-1 py-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={(e) => handleOpenArtisanModal(artisan.id, e)}>
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </ResizablePanel>
              </ResizablePanelGroup>
            </div>

            {/* DIV5: CONTEXTE INTERVENTION - Row 5, Cols 1-2 */}
            <Card style={{ gridArea: "5 / 1 / 6 / 3" }}>
              <CardContent className="p-4">
                <Label htmlFor="contexteIntervention" className="text-xs font-medium mb-2 block">Contexte intervention *</Label>
                <Textarea
                  id="contexteIntervention"
                  value={formData.contexte_intervention}
                  onChange={(event) => handleInputChange("contexte_intervention", event.target.value)}
                  placeholder="Décrivez le contexte..."
                  rows={4}
                  className="text-sm resize-none"
                  required
                />
              </CardContent>
            </Card>

            {/* DIV6: CONSIGNE INTERVENTION - Row 5, Cols 3-4 */}
            <Card style={{ gridArea: "5 / 3 / 6 / 5" }}>
              <CardContent className="p-4">
                <Label htmlFor="consigneIntervention" className="text-xs font-medium mb-2 block">Consigne pour l&apos;artisan</Label>
                <Textarea
                  id="consigneIntervention"
                  value={formData.consigne_intervention}
                  onChange={(event) => handleInputChange("consigne_intervention", event.target.value)}
                  placeholder="Consignes spécifiques..."
                  rows={4}
                  className="text-sm resize-none"
                />
              </CardContent>
            </Card>

            {/* DIV4: FINANCES & PLANIFICATION - Row 6, Cols 1-4 */}
            <Card style={{ gridArea: "6 / 1 / 7 / 5" }}>
              <CardContent className="p-4">
                <div className="grid grid-cols-5 gap-3 items-end">
                  <div>
                    <Label htmlFor="coutIntervention" className="text-xs">Coût inter.</Label>
                    <Input id="coutIntervention" type="number" step="0.01" min="0" value={formData.coutIntervention} onChange={(e) => handleInputChange("coutIntervention", e.target.value)} placeholder="0.00 €" className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="coutSST" className="text-xs">Coût SST</Label>
                    <Input id="coutSST" type="number" step="0.01" min="0" value={formData.coutSST} onChange={(e) => handleInputChange("coutSST", e.target.value)} placeholder="0.00 €" className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="coutMateriel" className="text-xs">Coût mat.</Label>
                    <Input id="coutMateriel" type="number" step="0.01" min="0" value={formData.coutMateriel} onChange={(e) => handleInputChange("coutMateriel", e.target.value)} placeholder="0.00 €" className="h-8 text-sm mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Marge</Label>
                    <div className="flex h-8 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm items-center mt-1">
                      {(() => {
                        const inter = parseFloat(formData.coutIntervention) || 0
                        const sst = parseFloat(formData.coutSST) || 0
                        const mat = parseFloat(formData.coutMateriel) || 0
                        if (inter > 0) {
                          const marge = ((inter - (sst + mat)) / inter) * 100
                          return <span className={cn("font-medium", marge < 0 ? "text-destructive" : "text-green-600")}>{marge.toFixed(1)} %</span>
                        }
                        return <span className="text-muted-foreground">-- %</span>
                      })()}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="datePrevue" className="text-xs">Date prévue {requiresDatePrevue && "*"}</Label>
                    <Input id="datePrevue" type="date" value={formData.date_prevue} onChange={(e) => handleInputChange("date_prevue", e.target.value)} className="h-8 text-sm mt-1" required={requiresDatePrevue} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* COLONNE DROITE - Collapsibles avec scroll indépendant */}
        <div className="w-[320px] flex-shrink-0 overflow-y-auto min-h-0 scrollbar-minimal">
          <div className="flex flex-col gap-2 pb-4">
          {/* Détails facturation */}
          <Collapsible open={isProprietaireOpen} onOpenChange={setIsProprietaireOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    Détails facturation
                    {isProprietaireOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-3 pb-3">
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="nomPrenomFacturation" className="text-[10px]">Nom Prénom</Label>
                      <Input id="nomPrenomFacturation" value={formData.nomPrenomFacturation} onChange={(e) => handleInputChange("nomPrenomFacturation", e.target.value)} placeholder="Nom Prénom" className="h-7 text-xs mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="telephoneProprietaire" className="text-[10px]">Téléphone</Label>
                        <Input id="telephoneProprietaire" value={formData.telephoneProprietaire} onChange={(e) => handleInputChange("telephoneProprietaire", e.target.value)} placeholder="06..." className="h-7 text-xs mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="emailProprietaire" className="text-[10px]">Email</Label>
                        <Input id="emailProprietaire" type="email" value={formData.emailProprietaire} onChange={(e) => handleInputChange("emailProprietaire", e.target.value)} placeholder="email@..." className="h-7 text-xs mt-1" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Détails client */}
          <Collapsible open={isClientOpen} onOpenChange={setIsClientOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    Détails client
                    {isClientOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-3 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <input type="checkbox" id="is_vacant" className="h-3 w-3 rounded border-gray-300" checked={formData.is_vacant} onChange={(e) => handleInputChange("is_vacant", e.target.checked)} />
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
                          <Input id="key_code" value={formData.key_code} onChange={(e) => handleInputChange("key_code", e.target.value)} className="h-7 text-xs mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="floor" className="text-[10px]">Étage</Label>
                          <Input id="floor" value={formData.floor} onChange={(e) => handleInputChange("floor", e.target.value)} className="h-7 text-xs mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="apartment_number" className="text-[10px]">N° appart.</Label>
                          <Input id="apartment_number" value={formData.apartment_number} onChange={(e) => handleInputChange("apartment_number", e.target.value)} className="h-7 text-xs mt-1" />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="vacant_housing_instructions" className="text-[10px]">Consigne</Label>
                        <Textarea id="vacant_housing_instructions" value={formData.vacant_housing_instructions} onChange={(e) => handleInputChange("vacant_housing_instructions", e.target.value)} placeholder="Consignes..." className="min-h-[60px] text-xs mt-1 resize-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="nomPrenomClient" className="text-[10px]">Nom Prénom</Label>
                        <Input id="nomPrenomClient" value={formData.nomPrenomClient} onChange={(e) => handleInputChange("nomPrenomClient", e.target.value)} placeholder="Nom Prénom" className="h-7 text-xs mt-1" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="telephoneClient" className="text-[10px]">Téléphone</Label>
                          <Input id="telephoneClient" value={formData.telephoneClient} onChange={(e) => handleInputChange("telephoneClient", e.target.value)} placeholder="06..." className="h-7 text-xs mt-1" />
                        </div>
                        <div>
                          <Label htmlFor="emailClient" className="text-[10px]">Email</Label>
                          <Input id="emailClient" type="email" value={formData.emailClient} onChange={(e) => handleInputChange("emailClient", e.target.value)} placeholder="email@..." className="h-7 text-xs mt-1" />
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Acomptes */}
          <Collapsible open={isAccompteOpen} onOpenChange={setIsAccompteOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <FileText className="h-3 w-3" />
                    Acomptes
                    {isAccompteOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-3 pb-3 space-y-3">
                  {/* Acompte SST */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-medium text-muted-foreground">Acompte SST</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="accompteSST" className="text-[10px]">Montant</Label>
                        <Input
                          id="accompteSST"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.accompteSST}
                          onChange={(e) => handleInputChange("accompteSST", e.target.value)}
                          placeholder="0.00 €"
                          className="h-7 text-xs mt-1"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="accompteSSTRecu"
                            className="h-3 w-3 rounded border-gray-300"
                            checked={formData.accompteSSTRecu}
                            onChange={(e) => handleInputChange("accompteSSTRecu", e.target.checked)}
                          />
                          <Label htmlFor="accompteSSTRecu" className="text-[10px] font-normal cursor-pointer">Reçu</Label>
                        </div>
                      </div>
                    </div>
                    {formData.accompteSSTRecu && (
                      <div>
                        <Label htmlFor="dateAccompteSSTRecu" className="text-[10px]">Date réception</Label>
                        <Input
                          id="dateAccompteSSTRecu"
                          type="date"
                          value={formData.dateAccompteSSTRecu}
                          onChange={(e) => handleInputChange("dateAccompteSSTRecu", e.target.value)}
                          className="h-7 text-xs mt-1"
                        />
                      </div>
                    )}
                  </div>
                  {/* Acompte Client */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-medium text-muted-foreground">Acompte Client</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="accompteClient" className="text-[10px]">Montant</Label>
                        <Input
                          id="accompteClient"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.accompteClient}
                          onChange={(e) => handleInputChange("accompteClient", e.target.value)}
                          placeholder="0.00 €"
                          className="h-7 text-xs mt-1"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="accompteClientRecu"
                            className="h-3 w-3 rounded border-gray-300"
                            checked={formData.accompteClientRecu}
                            onChange={(e) => handleInputChange("accompteClientRecu", e.target.checked)}
                          />
                          <Label htmlFor="accompteClientRecu" className="text-[10px] font-normal cursor-pointer">Reçu</Label>
                        </div>
                      </div>
                    </div>
                    {formData.accompteClientRecu && (
                      <div>
                        <Label htmlFor="dateAccompteClientRecu" className="text-[10px]">Date réception</Label>
                        <Input
                          id="dateAccompteClientRecu"
                          type="date"
                          value={formData.dateAccompteClientRecu}
                          onChange={(e) => handleInputChange("dateAccompteClientRecu", e.target.value)}
                          className="h-7 text-xs mt-1"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Deuxième artisan */}
          <Collapsible open={isSecondArtisanOpen} onOpenChange={setIsSecondArtisanOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Users className="h-3 w-3" />
                    2ème Artisan
                    {isSecondArtisanOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-3 pb-3 space-y-3">
                  {/* Métier du 2ème artisan */}
                  <div>
                    <Label className="text-[10px]">Métier</Label>
                    <Select value={formData.metierSecondArtisanId} onValueChange={(value) => handleInputChange("metierSecondArtisanId", value)}>
                      <SelectTrigger className="h-7 text-xs mt-1">
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
                  </div>

                  {/* Recherche artisan */}
                  <div className="flex gap-2">
                    <Input
                      value={formData.secondArtisan}
                      onChange={(e) => handleInputChange("secondArtisan", e.target.value)}
                      placeholder="Nom artisan"
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 flex-shrink-0"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect()
                        setSecondArtisanSearchPosition({
                          x: rect.left,
                          y: rect.top,
                          width: rect.width,
                          height: rect.height
                        })
                        setShowSecondArtisanSearch(true)
                      }}
                      title="Rechercher un artisan"
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* Artisan sélectionné */}
                  {selectedSecondArtisanId && selectedSecondArtisanData && (() => {
                    const artisan = selectedSecondArtisanData
                    const artisanName = `${artisan.prenom || ""} ${artisan.nom || ""}`.trim() || "Artisan sans nom"
                    const artisanInitials = artisanName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
                    const artisanStatus = refData?.artisanStatuses?.find((s) => s.id === artisan.statut_id)
                    const statutArtisan = artisanStatus?.label || ""
                    const statutArtisanColor = artisanStatus?.color || null

                    return (
                      <div className="relative rounded-lg border border-primary/70 ring-2 ring-primary/50 bg-background/80 p-2 text-xs shadow-sm">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1 h-5 w-5 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:text-destructive z-20"
                          onClick={handleRemoveSecondArtisan}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                        <div className="flex items-start gap-2">
                          <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} />
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-foreground block truncate text-[11px]">{artisan.displayName}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {statutArtisan && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                                  {statutArtisan}
                                </Badge>
                              )}
                              {absentArtisanIds.has(artisan.id) && (
                                <Badge variant="outline" className="text-[8px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300">
                                  Indisponible
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })()}

                  {/* Email pour 2ème artisan - Grisé car intervention non créée */}
                  {selectedSecondArtisanId && (
                    <TooltipProvider delayDuration={200}>
                      <div className="flex gap-1 p-2 bg-muted/50 rounded-lg border border-muted-foreground/20">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled
                                className="w-full text-[10px] h-6 px-2 opacity-50 cursor-not-allowed"
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Devis
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p>Créez l&apos;intervention avant l&apos;envoi de mail</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled
                                className="w-full text-[10px] h-6 px-2 opacity-50 cursor-not-allowed"
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Inter.
                              </Button>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p>Créez l&apos;intervention avant l&apos;envoi de mail</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  )}

                  {/* Liste des artisans du 2ème métier (si métier sélectionné et pas d'artisan) */}
                  {formData.metierSecondArtisanId && !selectedSecondArtisanId && (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {isLoadingNearbyArtisansSecondMetier ? (
                        <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">Recherche...</div>
                      ) : nearbyArtisansSecondMetier.length === 0 ? (
                        <div className="text-[10px] text-muted-foreground text-center py-2">Aucun artisan trouvé</div>
                      ) : (
                        nearbyArtisansSecondMetier.slice(0, 5).map((artisan) => {
                          const artisanName = `${artisan.prenom || ""} ${artisan.nom || ""}`.trim() || "Artisan sans nom"
                          const artisanInitials = artisanName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"

                          return (
                            <div
                              key={artisan.id}
                              role="button"
                              tabIndex={0}
                              className="rounded-lg border border-border/60 bg-background/80 p-1.5 text-xs cursor-pointer hover:border-primary/40"
                              onClick={() => handleSelectSecondArtisan(artisan)}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectSecondArtisan(artisan) } }}
                            >
                              <div className="flex items-center gap-2">
                                <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} />
                                <span className="font-medium text-foreground truncate text-[10px] flex-1">{artisan.displayName}</span>
                                {absentArtisanIds.has(artisan.id) && (
                                  <Badge variant="outline" className="text-[8px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300">
                                    Indisponible
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[8px] px-1 py-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}

                  {/* Consigne 2ème artisan */}
                  <div>
                    <Label htmlFor="consigneSecondArtisan" className="text-[10px]">Consigne</Label>
                    <Textarea
                      id="consigneSecondArtisan"
                      value={formData.consigne_second_artisan}
                      onChange={(e) => handleInputChange("consigne_second_artisan", e.target.value)}
                      placeholder="Consignes spécifiques..."
                      rows={2}
                      className="text-xs mt-1 resize-none"
                    />
                  </div>

                  {/* Coûts 2ème artisan */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label htmlFor="coutSSTSecondArtisan" className="text-[10px]">Coût SST</Label>
                      <Input
                        id="coutSSTSecondArtisan"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.coutSSTSecondArtisan}
                        onChange={(e) => handleInputChange("coutSSTSecondArtisan", e.target.value)}
                        placeholder="0.00 €"
                        className="h-7 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="coutMaterielSecondArtisan" className="text-[10px]">Coût mat.</Label>
                      <Input
                        id="coutMaterielSecondArtisan"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.coutMaterielSecondArtisan}
                        onChange={(e) => handleInputChange("coutMaterielSecondArtisan", e.target.value)}
                        placeholder="0.00 €"
                        className="h-7 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Marge</Label>
                      <div className="flex h-7 w-full rounded-md border border-input bg-muted px-2 py-1 text-xs shadow-sm items-center mt-1">
                        <span className={cn("font-medium", margeSecondArtisanPct < 0 ? "text-destructive" : "text-green-600")}>
                          {margeSecondArtisanPct.toFixed(1)} %
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Documents */}
          <Collapsible open={isDocumentsOpen} onOpenChange={setIsDocumentsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Upload className="h-3 w-3" />
                    Documents
                    {isDocumentsOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-3 pb-3">
                  {createdInterventionId ? (
                    <DocumentManager entityType="intervention" entityId={createdInterventionId} kinds={INTERVENTION_DOCUMENT_KINDS} currentUser={currentUser ?? undefined} />
                  ) : (
                    <p className="text-xs italic text-muted-foreground">
                      Les documents pourront être ajoutés après la création de l&apos;intervention.
                    </p>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Commentaires - ouvert par défaut, avec uniquement le commentaire initial */}
          <Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
            <Card className="flex-1 flex flex-col">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <MessageSquare className="h-3 w-3" />
                    Commentaire initial
                    <ChevronDown className={cn("ml-auto h-3 w-3 transition-transform", isCommentsOpen && "rotate-180")} />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex-1">
                <CardContent className="pt-0 px-3 pb-3">
                  <div className="space-y-2">
                    <Textarea
                      id="commentaireInitial"
                      value={formData.commentaire_initial}
                      onChange={(event) => handleInputChange("commentaire_initial", event.target.value)}
                      placeholder="Commentaire initial sur l'intervention..."
                      rows={4}
                      className="text-sm resize-none"
                      disabled={isSubmitting}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Ce commentaire sera enregistré automatiquement après la création.
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Sous-statut personnalisé */}
          <Collapsible open={isSousStatutOpen} onOpenChange={setIsSousStatutOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
                  <CardTitle className="flex items-center gap-2 text-xs">
                    <Palette className="h-3 w-3" />
                    Sous-statut
                    {isSousStatutOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-3 pb-3 space-y-3">
                  <div>
                    <Label htmlFor="sousStatutText" className="text-[10px]">Texte</Label>
                    <Input
                      id="sousStatutText"
                      value={formData.sousStatutText}
                      onChange={(e) => handleInputChange("sousStatutText", e.target.value)}
                      placeholder="Ex: En attente devis..."
                      className="h-7 text-xs mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="sousStatutTextColor" className="text-[10px]">Couleur texte</Label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          id="sousStatutTextColor"
                          value={formData.sousStatutTextColor}
                          onChange={(e) => handleInputChange("sousStatutTextColor", e.target.value)}
                          className="h-7 w-10 rounded cursor-pointer border border-input"
                        />
                        <Input
                          value={formData.sousStatutTextColor}
                          onChange={(e) => handleInputChange("sousStatutTextColor", e.target.value)}
                          className="h-7 text-xs flex-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="sousStatutBgColor" className="text-[10px]">Couleur fond</Label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          id="sousStatutBgColor"
                          value={formData.sousStatutBgColor === "transparent" ? "#ffffff" : formData.sousStatutBgColor}
                          onChange={(e) => handleInputChange("sousStatutBgColor", e.target.value)}
                          className="h-7 w-10 rounded cursor-pointer border border-input"
                        />
                        <Input
                          value={formData.sousStatutBgColor}
                          onChange={(e) => handleInputChange("sousStatutBgColor", e.target.value)}
                          placeholder="transparent"
                          className="h-7 text-xs flex-1"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Aperçu du sous-statut */}
                  {formData.sousStatutText && (
                    <div className="mt-2">
                      <Label className="text-[10px] text-muted-foreground">Aperçu</Label>
                      <div
                        className="inline-block px-2 py-0.5 rounded text-xs font-medium mt-1"
                        style={{
                          backgroundColor: formData.sousStatutBgColor === "transparent" ? "transparent" : formData.sousStatutBgColor,
                          color: formData.sousStatutTextColor,
                          border: formData.sousStatutBgColor === "transparent" ? `1px solid ${formData.sousStatutTextColor}` : "none"
                        }}
                      >
                        {formData.sousStatutText}
                      </div>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          </div>
        </div>
      </div>

      {/* Modal de recherche d'artisan principal */}
      <ArtisanSearchModal
        open={showArtisanSearch}
        onClose={() => {
          setShowArtisanSearch(false)
          setArtisanSearchPosition(null)
        }}
        onSelect={handleArtisanSearchSelect}
        position={artisanSearchPosition}
      />

      {/* Modal de recherche du 2ème artisan */}
      <ArtisanSearchModal
        open={showSecondArtisanSearch}
        onClose={() => {
          setShowSecondArtisanSearch(false)
          setSecondArtisanSearchPosition(null)
        }}
        onSelect={handleSecondArtisanSearchSelect}
        position={secondArtisanSearchPosition}
      />

      {/* Modal Email Devis */}
      {isDevisEmailModalOpen && effectiveSelectedArtisanId && (
        <EmailEditModal
          isOpen={isDevisEmailModalOpen}
          onClose={() => {
            setIsDevisEmailModalOpen(false)
            setSelectedArtisanForEmail(null)
          }}
          emailType="devis"
          artisanId={effectiveSelectedArtisanId}
          artisanEmail={selectedArtisanEmail}
          interventionId={createdInterventionId || `temp-${Date.now()}`}
          templateData={generateEmailTemplateData(effectiveSelectedArtisanId)}
        />
      )}

      {/* Modal Email Intervention */}
      {isInterventionEmailModalOpen && effectiveSelectedArtisanId && (
        <EmailEditModal
          isOpen={isInterventionEmailModalOpen}
          onClose={() => {
            setIsInterventionEmailModalOpen(false)
            setSelectedArtisanForEmail(null)
          }}
          emailType="intervention"
          artisanId={effectiveSelectedArtisanId}
          artisanEmail={selectedArtisanEmail}
          interventionId={createdInterventionId || `temp-${Date.now()}`}
          templateData={generateEmailTemplateData(effectiveSelectedArtisanId)}
        />
      )}
    </form>
  )
}

export default NewInterventionForm
