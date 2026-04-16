"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Search, X, Phone, Mail, MapPin, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase-client"
import { createPortal } from "react-dom"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { artisansApi } from "@/lib/api"
import type { NearbyArtisan } from "@/lib/api/common/types"
import {
  normalizeArtisanData,
  getDisplayName as getArtisanDisplayName,
  getAddressSegments as getArtisanAddressSegments,
  getPrimaryMetier as getArtisanPrimaryMetier,
  getNumeroAssocie as getArtisanNumeroAssocie,
  getStatusInfo as getArtisanStatusInfo,
  type ArtisanDisplaySource,
} from "@/lib/artisans"
import type { ArtisanSearchResult } from "@/lib/artisans/types"

export type { ArtisanSearchResult }

interface ArtisanSearchModalProps {
  open: boolean
  onClose: () => void
  onSelect: (artisan: ArtisanSearchResult) => void
  position?: { x: number; y: number; width?: number; height?: number } | null
  container?: HTMLElement | null
  latitude?: number | null
  longitude?: number | null
  metier_id?: string | null
}

export function ArtisanSearchModal({
  open,
  onClose,
  onSelect,
  position,
  container,
  latitude,
  longitude,
  metier_id,
}: ArtisanSearchModalProps) {
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<"nearby" | "search">("nearby")

  // Search mode states
  const [searchResults, setSearchResults] = useState<ArtisanSearchResult[]>([])

  // Nearby mode states
  const [nearbyArtisans, setNearbyArtisans] = useState<NearbyArtisan[]>([])
  const [nearbyOffset, setNearbyOffset] = useState(0)
  const [hasMoreNearby, setHasMoreNearby] = useState(true)

  // Common states
  const [absentArtisanIds, setAbsentArtisanIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const popoverRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { data: refData } = useReferenceDataQuery()

  // Load nearby artisans
  const loadNearbyArtisans = useCallback(
    async (offset: number = 0, append: boolean = false) => {
      if (!latitude || !longitude) {
        return
      }

      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      try {
        const response = await artisansApi.getNearbyArtisans({
          latitude,
          longitude,
          offset,
          limit: 30,
          metier_id,
        })

        if (append) {
          setNearbyArtisans((prev) => [...prev, ...response.artisans])
        } else {
          setNearbyArtisans(response.artisans)
        }
        setHasMoreNearby(response.hasMore)
        setNearbyOffset(offset + response.artisans.length)

        // Load absence data for the artisans
        if (response.artisans.length > 0) {
          const nowIso = new Date().toISOString()
          const artisanIds = response.artisans.map((a) => a.id)
          const { data: absences, error: absencesError } = await supabase
            .from("artisan_absences")
            .select("artisan_id")
            .in("artisan_id", artisanIds)
            .lte("start_date", nowIso)
            .gte("end_date", nowIso)

          if (absencesError) {
            console.warn("[ArtisanSearchModal] Erreur lors du chargement des absences:", absencesError)
          } else {
            setAbsentArtisanIds((prev) => {
              const newSet = new Set(prev)
              absences?.forEach((absence: { artisan_id?: string }) => {
                if (absence.artisan_id) {
                  newSet.add(absence.artisan_id)
                }
              })
              return newSet
            })
          }
        }
      } catch (err) {
        console.error("Erreur lors du chargement des artisans proches:", err)
        setError("Erreur lors du chargement des artisans")
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [latitude, longitude, metier_id]
  )

  // Search artisans by text using API V2
  const searchArtisans = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (!trimmed) {
      setSearchResults([])
      setAbsentArtisanIds(new Set())
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // ✅ Utiliser artisansApi.searchArtisans() au lieu d'une requête hardcodée
      const response = await artisansApi.searchArtisans({
        searchQuery: trimmed,
        latitude,
        longitude,
        metier_id,
        limit: 50,
      })

      setSearchResults(response.artisans)
      setAbsentArtisanIds(new Set())

      if (response.artisans.length === 0) {
        return
      }

      // Charger les absences pour les artisans trouvés
      const nowIso = new Date().toISOString()
      const artisanIds = response.artisans.map((artisan) => artisan.id)
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
          new Set((absences ?? []).map((absence: { artisan_id?: string }) => absence.artisan_id).filter(Boolean)),
        )
      }
    } catch (err) {
      console.error("Erreur lors de la recherche d'artisans:", err)
      setError("Erreur lors de la recherche")
      setSearchResults([])
      setAbsentArtisanIds(new Set())
    } finally {
      setIsLoading(false)
    }
  }, [latitude, longitude, metier_id])

  // Handle query changes
  useEffect(() => {
    const trimmed = query.trim()

    if (!trimmed) {
      // Empty query: switch to nearby mode
      setMode("nearby")
      setSearchResults([])
      if (latitude && longitude && open && nearbyArtisans.length === 0) {
        loadNearbyArtisans(0, false)
      }
      return
    }

    // Non-empty query: switch to search mode
    setMode("search")
    const timeoutId = setTimeout(() => {
      searchArtisans(trimmed)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query, searchArtisans, latitude, longitude, open, nearbyArtisans.length, loadNearbyArtisans])

  // Load nearby artisans on open
  useEffect(() => {
    if (open && !query && latitude && longitude && nearbyArtisans.length === 0) {
      loadNearbyArtisans(0, false)
    }
  }, [open, query, latitude, longitude, nearbyArtisans.length, loadNearbyArtisans])

  // Handle scroll for infinite loading
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || mode !== "nearby" || !hasMoreNearby || isLoadingMore) {
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    if (distanceFromBottom < 100) {
      loadNearbyArtisans(nearbyOffset, true)
    }
  }, [mode, hasMoreNearby, isLoadingMore, nearbyOffset, loadNearbyArtisans])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) return

    scrollContainer.addEventListener("scroll", handleScroll)
    return () => scrollContainer.removeEventListener("scroll", handleScroll)
  }, [handleScroll])

  // Close handlers
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

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setQuery("")
      setMode("nearby")
      setSearchResults([])
      setNearbyArtisans([])
      setNearbyOffset(0)
      setHasMoreNearby(true)
      setAbsentArtisanIds(new Set())
      setError(null)
    }
  }, [open])

  const handleSelect = (artisan: ArtisanSearchResult | NearbyArtisan) => {
    onSelect(artisan as ArtisanSearchResult)
    onClose()
  }

  // Wrapper functions using centralized artisan display utilities
  const getDisplayName = (artisan: ArtisanSearchResult | NearbyArtisan): string => {
    const displayData = normalizeArtisanData(artisan as ArtisanDisplaySource, {
      refData: { statuts: refData?.artisanStatuses },
      addressPriority: 'intervention'
    })
    return getArtisanDisplayName(displayData, "nom")
  }

  const getPrimaryMetier = (artisan: ArtisanSearchResult | NearbyArtisan) => {
    const displayData = normalizeArtisanData(artisan as ArtisanDisplaySource, {
      refData: { statuts: refData?.artisanStatuses },
      addressPriority: 'intervention'
    })
    return getArtisanPrimaryMetier(displayData)
  }

  const getAddressSegments = (artisan: ArtisanSearchResult | NearbyArtisan) => {
    const displayData = normalizeArtisanData(artisan as ArtisanDisplaySource, {
      refData: { statuts: refData?.artisanStatuses },
      addressPriority: 'intervention'
    })
    return getArtisanAddressSegments(displayData)
  }

  const getNumeroAssocie = (artisan: ArtisanSearchResult | NearbyArtisan) => {
    const displayData = normalizeArtisanData(artisan as ArtisanDisplaySource, {
      refData: { statuts: refData?.artisanStatuses },
      addressPriority: 'intervention'
    })
    return getArtisanNumeroAssocie(displayData)
  }

  const getStatusInfo = (artisan: ArtisanSearchResult | NearbyArtisan) => {
    const displayData = normalizeArtisanData(artisan as ArtisanDisplaySource, {
      refData: { statuts: refData?.artisanStatuses },
      addressPriority: 'intervention'
    })
    return getArtisanStatusInfo(displayData)
  }

  if (!open || typeof window === "undefined") return null

  const MODAL_WIDTH = 600
  const GAP = 12
  const MIN_MARGIN = 16

  const popoverStyle: React.CSSProperties = position
    ? (() => {
      let left = position.x - MODAL_WIDTH - GAP

      if (left < MIN_MARGIN) {
        left = position.x + (position.width || 0) + GAP
      }

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

  const results = mode === "search" ? searchResults : nearbyArtisans

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
          <span className="text-sm font-semibold">
            {mode === "nearby" ? "Artisans à proximité" : "Rechercher un artisan"}
          </span>
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
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-3">
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading && !isLoadingMore && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Chargement...
          </div>
        )}

        {!isLoading && mode === "search" && query && results.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Aucun artisan trouvé
          </div>
        )}

        {!isLoading && mode === "nearby" && !query && results.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {latitude && longitude
              ? "Aucun artisan à proximité"
              : "Saisissez une adresse pour voir les artisans à proximité"}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-0">
            {results.map((artisan) => {
              const displayName = getDisplayName(artisan)
              const plainNom = 'plain_nom' in artisan ? artisan.plain_nom : null
              const metier = getPrimaryMetier(artisan)
              const addressSegments = getAddressSegments(artisan)
              const distance = 'distanceKm' in artisan ? artisan.distanceKm : undefined
              const numeroAssocie = getNumeroAssocie(artisan)
              const statusInfo = getStatusInfo(artisan)

              return (
                <div
                  key={artisan.id}
                  onClick={() => handleSelect(artisan)}
                  className={cn(
                    "flex items-start gap-3 p-3 transition-colors border-b last:border-b-0 cursor-pointer hover:bg-accent/50"
                  )}
                >
                  <div className="flex-1 space-y-2">
                    {/* Header avec numéro et nom */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <span>{displayName}</span>
                          {statusInfo && (
                            <Badge
                              variant="outline"
                              className="flex-shrink-0 text-xs"
                              style={{
                                borderColor: statusInfo.color,
                                color: statusInfo.color,
                              }}
                            >
                              {statusInfo.label}
                            </Badge>
                          )}
                          {numeroAssocie && (
                            <span className="rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                              {numeroAssocie}
                            </span>
                          )}
                          {absentArtisanIds.has(artisan.id) && (
                            <Badge
                              variant="outline"
                              className="flex-shrink-0 bg-orange-100 text-orange-800 border-orange-300 text-xs"
                            >
                              Indisponible
                            </Badge>
                          )}
                        </div>
                        {/* Plain nom sur une nouvelle ligne */}
                        {plainNom && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {plainNom}
                          </div>
                        )}
                      </div>
                      {distance !== undefined && (
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
                        </div>
                      )}
                    </div>

                    {/* Métier et contact */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {artisan.telephone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{artisan.telephone}</span>
                        </div>
                      )}
                      {artisan.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{artisan.email}</span>
                        </div>
                      )}
                      {metier && (
                        <div className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5" />
                          <span>{metier.label}</span>
                        </div>
                      )}
                    </div>

                    {/* Adresse */}
                    {(addressSegments.street || addressSegments.postalCode || addressSegments.city) && (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="line-clamp-1">
                          {[addressSegments.street, addressSegments.postalCode, addressSegments.city]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Loading more indicator */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                Chargement...
              </div>
            )}

            {/* End of list indicator */}
            {mode === "nearby" && !hasMoreNearby && results.length > 0 && (
              <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                Tous les artisans ont été chargés
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(popoverContent, container ?? document.body)
}
