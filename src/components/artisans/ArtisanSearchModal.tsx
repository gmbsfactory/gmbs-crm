"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search, X, User, Phone, Mail, MapPin, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase-client"
import { createPortal } from "react-dom"
import { useReferenceData } from "@/hooks/useReferenceData"

export interface ArtisanSearchResult {
  id: string
  prenom?: string | null
  nom?: string | null
  plain_nom?: string | null
  raison_sociale?: string | null
  email?: string | null
  telephone?: string | null
  telephone2?: string | null
  numero_associe?: string | null
  adresse_intervention?: string | null
  ville_intervention?: string | null
  code_postal_intervention?: string | null
  adresse_siege_social?: string | null
  ville_siege_social?: string | null
  code_postal_siege_social?: string | null
  statut_id?: string | null
  is_active?: boolean | null
  status?: {
    id: string
    code: string
    label: string
    color?: string | null
  } | null
  metiers?: Array<{
    is_primary: boolean
    metier: {
      id: string
      code: string
      label: string
    }
  }> | null
}

interface ArtisanSearchModalProps {
  open: boolean
  onClose: () => void
  onSelect: (artisan: ArtisanSearchResult) => void
  position?: { x: number; y: number; width?: number; height?: number } | null
  container?: HTMLElement | null
}

const sanitizePhone = (input: string): string => {
  return input.replace(/\D/g, "")
}

const escapeIlike = (input: string): string => {
  return input.replace(/[%_\\]/g, "\\$&")
}

export function ArtisanSearchModal({ open, onClose, onSelect, position, container }: ArtisanSearchModalProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ArtisanSearchResult[]>([])
  const [absentArtisanIds, setAbsentArtisanIds] = useState<Set<string>>(new Set())
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: refData } = useReferenceData()
  const archiveStatusFilterRef = useRef<string | null | undefined>(undefined)

  const buildArchiveStatusFilter = useCallback(async () => {
    if (archiveStatusFilterRef.current !== undefined) {
      return archiveStatusFilterRef.current
    }

    const archiveStatusIds =
      refData?.artisanStatuses
        ?.filter((status) => status.code === "ARCHIVE" || status.code === "ARCHIVER")
        .map((status) => status.id) ?? []

    if (archiveStatusIds.length > 0) {
      const filter = `(${archiveStatusIds.map((id) => `"${id}"`).join(",")})`
      archiveStatusFilterRef.current = filter
      return filter
    }

    const { data, error } = await supabase
      .from("artisan_statuses")
      .select("id")
      .in("code", ["ARCHIVE", "ARCHIVER"])

    if (error) {
      console.warn("[ArtisanSearchModal] Impossible de charger les statuts archivés:", error)
      return null
    }

    const ids = data?.map((status) => status.id).filter(Boolean) || []
    const filter = ids.length > 0 ? `(${ids.map((id) => `"${id}"`).join(",")})` : null
    archiveStatusFilterRef.current = filter
    return filter
  }, [refData?.artisanStatuses])

  const searchArtisans = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setResults([])
      setAbsentArtisanIds(new Set())
      return
    }

    setIsSearching(true)
    setError(null)

    try {
      const pattern = escapeIlike(trimmed)
      const normalizedDigits = sanitizePhone(trimmed)

      const orFilters = [
        `numero_associe.ilike.*${pattern}*`,
        `plain_nom.ilike.*${pattern}*`,
        `raison_sociale.ilike.*${pattern}*`,
        `prenom.ilike.*${pattern}*`,
        `nom.ilike.*${pattern}*`,
        `email.ilike.*${pattern}*`,
      ]

      if (normalizedDigits) {
        orFilters.push(`telephone.ilike.*${normalizedDigits}*`)
        orFilters.push(`telephone2.ilike.*${normalizedDigits}*`)
      } else {
        orFilters.push(`telephone.ilike.*${pattern}*`)
        orFilters.push(`telephone2.ilike.*${pattern}*`)
      }

      const archiveStatusFilter = await buildArchiveStatusFilter()

      let queryBuilder = supabase
        .from("artisans")
        .select(
          `
            id,
            prenom,
            nom,
            plain_nom,
            raison_sociale,
            email,
            telephone,
            telephone2,
            numero_associe,
            adresse_intervention,
            ville_intervention,
            code_postal_intervention,
            adresse_siege_social,
            ville_siege_social,
            code_postal_siege_social,
            statut_id,
            is_active,
            status:artisan_statuses (
              id,
              code,
              label,
              color
            ),
            metiers:artisan_metiers (
              is_primary,
              metier:metiers (
                id,
                code,
                label
              )
            )
          `
        )
        .or(orFilters.join(","))
        .order("numero_associe", { ascending: true })
        .limit(50)

      if (archiveStatusFilter) {
        queryBuilder = queryBuilder.not("statut_id", "in", archiveStatusFilter)
      }

      const { data, error: searchError } = await queryBuilder

      if (searchError) {
        throw searchError
      }

      // Transformer les données pour convertir status de tableau à objet unique
      const transformedData = (data || []).map((artisan: any) => ({
        ...artisan,
        status: Array.isArray(artisan.status)
          ? (artisan.status.length > 0 ? artisan.status[0] : null)
          : artisan.status
      }))

      setResults(transformedData)
      setAbsentArtisanIds(new Set())

      if (transformedData.length === 0) {
        return
      }

      const nowIso = new Date().toISOString()
      const artisanIds = transformedData.map((artisan) => artisan.id)
      const { data: absences, error: absencesError } = await supabase
        .from("artisan_absences")
        .select("artisan_id")
        .in("artisan_id", artisanIds)
        .lte("start_date", nowIso)
        .gte("end_date", nowIso)

      if (absencesError) {
        console.warn("[ArtisanSearchModal] Erreur lors du chargement des absences:", absencesError)
        setAbsentArtisanIds(new Set())
      } else {
        setAbsentArtisanIds(
          new Set((absences ?? []).map((absence) => absence.artisan_id).filter(Boolean)),
        )
      }
    } catch (err) {
      console.error("Erreur lors de la recherche d'artisans:", err)
      setError("Erreur lors de la recherche")
      setResults([])
      setAbsentArtisanIds(new Set())
    } finally {
      setIsSearching(false)
    }
  }, [buildArchiveStatusFilter])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchArtisans(query)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, searchArtisans])

  // Fermer avec Escape et clic à l'extérieur
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("mousedown", handleClickOutside)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, onClose])

  const handleSelect = (artisan: ArtisanSearchResult) => {
    onSelect(artisan)
    setQuery("")
    setResults([])
    onClose()
  }

  const getDisplayName = (artisan: ArtisanSearchResult): string => {
    if (artisan.raison_sociale) {
      return artisan.raison_sociale
    }
    if (artisan.plain_nom) {
      return artisan.plain_nom
    }
    const parts = [artisan.prenom, artisan.nom].filter(Boolean)
    return parts.join(" ") || "Artisan sans nom"
  }

  const getPrimaryMetier = (artisan: ArtisanSearchResult) => {
    const primary = artisan.metiers?.find((m) => m.is_primary)
    return primary?.metier || artisan.metiers?.[0]?.metier
  }

  const getAddressSegments = (artisan: ArtisanSearchResult) => {
    const street = artisan.adresse_intervention ?? artisan.adresse_siege_social ?? null
    const postalCode = artisan.code_postal_intervention ?? artisan.code_postal_siege_social ?? null
    const city = artisan.ville_intervention ?? artisan.ville_siege_social ?? null

    return { street, postalCode, city }
  }

  if (!open || typeof window === "undefined") return null

  const MODAL_WIDTH = 600
  const GAP = 12
  const MIN_MARGIN = 16

  // Calculer la position du popover
  const popoverStyle: React.CSSProperties = position
    ? (() => {
      // Calculer la position à gauche du bouton
      let left = position.x - MODAL_WIDTH - GAP

      // Si le modal dépasse le bord gauche, l'ouvrir à droite
      if (left < MIN_MARGIN) {
        left = position.x + (position.width || 0) + GAP
      }

      // Vérifier que le modal ne dépasse pas le bord droit
      const maxRight = typeof window !== "undefined" ? window.innerWidth - MIN_MARGIN : left + MODAL_WIDTH
      if (left + MODAL_WIDTH > maxRight) {
        left = maxRight - MODAL_WIDTH
      }

      return {
        position: "fixed",
        left: `${left}px`,
        top: `${position.y}px`,
        zIndex: 99999,
        pointerEvents: "auto",
      }
    })()
    : {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 99999,
      pointerEvents: "auto",
    }

  const popoverContent = (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="w-[600px] max-w-[90vw] max-h-[70vh] flex flex-col rounded-lg border bg-background shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Rechercher un artisan</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 rounded-full"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Search input */}
      <div className="px-4 py-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, prénom, email, téléphone..."
            className="pl-9 pr-9 h-9 text-sm"
            autoFocus
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isSearching && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Recherche en cours...
          </div>
        )}

        {!isSearching && !error && query && results.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Aucun artisan trouvé
          </div>
        )}

        {!isSearching && !query && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Saisissez un nom, email ou téléphone pour rechercher
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <div className="space-y-2">
            {results.map((artisan) => {
              const displayName = getDisplayName(artisan)
              const metier = getPrimaryMetier(artisan)
              const statusColor = artisan.status?.color || "#6b7280"
              const addressSegments = getAddressSegments(artisan)

              return (
                <button
                  key={artisan.id}
                  onClick={() => handleSelect(artisan)}
                  className={cn(
                    "w-full text-left rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50"
                  )}
                >
                  <div className="space-y-2">
                    {/* Header avec nom et statut */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-semibold text-foreground truncate">
                            {displayName}
                          </span>
                        </div>
                        {artisan.numero_associe && (
                          <p className="text-xs text-muted-foreground mt-1">
                            N° {artisan.numero_associe}
                          </p>
                        )}
                      </div>
                      {(artisan.status || absentArtisanIds.has(artisan.id)) && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {artisan.status && (
                            <Badge
                              variant="outline"
                              className="flex-shrink-0"
                              style={{
                                borderColor: statusColor,
                                color: statusColor,
                              }}
                            >
                              {artisan.status.label}
                            </Badge>
                          )}
                          {absentArtisanIds.has(artisan.id) && (
                            <Badge
                              variant="outline"
                              className="flex-shrink-0 bg-orange-100 text-orange-800 border-orange-300"
                            >
                              Indisponible
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Métier */}
                    {metier && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>{metier.label}</span>
                      </div>
                    )}

                    {/* Contact */}
                    <div className="space-y-1">
                      {artisan.telephone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{artisan.telephone}</span>
                        </div>
                      )}
                      {artisan.email && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{artisan.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Adresse */}
                    {(addressSegments.street || addressSegments.postalCode || addressSegments.city) && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">
                          {[addressSegments.street, addressSegments.postalCode, addressSegments.city]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )

  // Créer un conteneur pour le portal qui échappe au contexte disabled
  // Utiliser un conteneur avec pointer-events: auto pour garantir l'interactivité
  return createPortal(popoverContent, container ?? document.body)
}
