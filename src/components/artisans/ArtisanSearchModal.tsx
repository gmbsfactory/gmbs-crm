"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Phone, Mail, MapPin, Briefcase } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase-client"
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
  /**
   * Virtual anchor coordinates (viewport-relative). The popover is positioned
   * relative to this rectangle. When omitted, the popover centers on screen.
   */
  position?: { x: number; y: number; width?: number; height?: number } | null
  latitude?: number | null
  longitude?: number | null
  metier_id?: string | null
}

const POPOVER_WIDTH = 600
const GAP = 12

export function ArtisanSearchModal({
  open,
  onClose,
  onSelect,
  position,
  latitude,
  longitude,
  metier_id,
}: ArtisanSearchModalProps) {
  const [query, setQuery] = useState("")
  const [mode, setMode] = useState<"nearby" | "search">("nearby")

  const [searchResults, setSearchResults] = useState<ArtisanSearchResult[]>([])
  const [nearbyArtisans, setNearbyArtisans] = useState<NearbyArtisan[]>([])
  const [nearbyOffset, setNearbyOffset] = useState(0)
  const [hasMoreNearby, setHasMoreNearby] = useState(true)

  const [absentArtisanIds, setAbsentArtisanIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: refData } = useReferenceDataQuery()

  const loadNearbyArtisans = useCallback(
    async (offset = 0, append = false) => {
      if (!latitude || !longitude) return

      if (append) setIsLoadingMore(true)
      else setIsLoading(true)
      setError(null)

      try {
        const response = await artisansApi.getNearbyArtisans({
          latitude,
          longitude,
          offset,
          limit: 30,
          metier_id,
        })

        setNearbyArtisans((prev) => (append ? [...prev, ...response.artisans] : response.artisans))
        setHasMoreNearby(response.hasMore)
        setNearbyOffset(offset + response.artisans.length)

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
            console.warn("[ArtisanSearchModal] Erreur chargement absences:", absencesError)
          } else {
            setAbsentArtisanIds((prev) => {
              const next = new Set(prev)
              absences?.forEach((a: { artisan_id?: string }) => {
                if (a.artisan_id) next.add(a.artisan_id)
              })
              return next
            })
          }
        }
      } catch (err) {
        console.error("Erreur chargement artisans proches:", err)
        setError("Erreur lors du chargement des artisans")
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [latitude, longitude, metier_id]
  )

  const searchArtisans = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim()
      if (!trimmed) {
        setSearchResults([])
        setAbsentArtisanIds(new Set())
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await artisansApi.searchArtisans({
          searchQuery: trimmed,
          latitude,
          longitude,
          metier_id,
          limit: 50,
        })

        setSearchResults(response.artisans)
        setAbsentArtisanIds(new Set())

        if (response.artisans.length === 0) return

        const nowIso = new Date().toISOString()
        const artisanIds = response.artisans.map((a) => a.id)
        const { data: absences, error: absencesError } = await supabase
          .from("artisan_absences")
          .select("artisan_id")
          .in("artisan_id", artisanIds)
          .lte("start_date", nowIso)
          .gte("end_date", nowIso)

        if (absencesError) {
          console.warn("[ArtisanSearchModal] Erreur chargement absences:", absencesError)
          setAbsentArtisanIds(new Set())
        } else {
          setAbsentArtisanIds(
            new Set((absences ?? []).map((a: { artisan_id?: string }) => a.artisan_id).filter(Boolean) as string[])
          )
        }
      } catch (err) {
        console.error("Erreur recherche artisans:", err)
        setError("Erreur lors de la recherche")
        setSearchResults([])
        setAbsentArtisanIds(new Set())
      } finally {
        setIsLoading(false)
      }
    },
    [latitude, longitude, metier_id]
  )

  // Query → mode + debounced search
  useEffect(() => {
    const trimmed = query.trim()

    if (!trimmed) {
      setMode("nearby")
      setSearchResults([])
      if (latitude && longitude && open && nearbyArtisans.length === 0) {
        loadNearbyArtisans(0, false)
      }
      return
    }

    setMode("search")
    const timeoutId = setTimeout(() => searchArtisans(trimmed), 300)
    return () => clearTimeout(timeoutId)
  }, [query, searchArtisans, latitude, longitude, open, nearbyArtisans.length, loadNearbyArtisans])

  // Load nearby on open
  useEffect(() => {
    if (open && !query && latitude && longitude && nearbyArtisans.length === 0) {
      loadNearbyArtisans(0, false)
    }
  }, [open, query, latitude, longitude, nearbyArtisans.length, loadNearbyArtisans])

  // Reset on close
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

  const listRef = useRef<HTMLDivElement>(null)
  const handleScroll = useCallback(() => {
    if (!listRef.current || mode !== "nearby" || !hasMoreNearby || isLoadingMore) return
    const { scrollTop, scrollHeight, clientHeight } = listRef.current
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadNearbyArtisans(nearbyOffset, true)
    }
  }, [mode, hasMoreNearby, isLoadingMore, nearbyOffset, loadNearbyArtisans])

  const handleSelect = (artisan: ArtisanSearchResult | NearbyArtisan) => {
    onSelect(artisan as ArtisanSearchResult)
    onClose()
  }

  // Display helpers
  const toDisplayData = (artisan: ArtisanSearchResult | NearbyArtisan) =>
    normalizeArtisanData(artisan as ArtisanDisplaySource, {
      refData: { statuts: refData?.artisanStatuses },
      addressPriority: "intervention",
    })

  const results = mode === "search" ? searchResults : nearbyArtisans

  // Virtual anchor placed at the requested viewport coordinates.
  const anchorStyle: React.CSSProperties = position
    ? {
        position: "fixed",
        left: position.x,
        top: position.y,
        width: position.width ?? 0,
        height: position.height ?? 0,
        pointerEvents: "none",
      }
    : {
        position: "fixed",
        left: "50%",
        top: "50%",
        width: 0,
        height: 0,
        pointerEvents: "none",
      }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()} modal={false}>
      <PopoverPrimitive.Anchor asChild>
        <div style={anchorStyle} aria-hidden />
      </PopoverPrimitive.Anchor>
      {/*
        No Portal: when invoked from inside a Radix Dialog (modal), portaling
        the popover out steals it from the Dialog focus trap — the
        CommandInput becomes unfocusable. Rendering inline keeps the popover
        inside the trap; position: fixed on the anchor + Popper still places
        the content correctly in the viewport.
      */}
        <PopoverPrimitive.Content
          side="left"
          align="start"
          sideOffset={GAP}
          collisionPadding={16}
          avoidCollisions
          onOpenAutoFocus={(e) => {
            // Let cmdk manage focus inside CommandInput.
            e.preventDefault()
          }}
          onCloseAutoFocus={(e) => {
            // Anchor is a hidden virtual div; let the parent Dialog focus
            // trap restore focus naturally instead of Radix jumping to it.
            e.preventDefault()
          }}
          className={cn(
            "z-[10000] flex max-h-[70vh] flex-col rounded-lg border bg-popover text-popover-foreground shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
          style={{ width: POPOVER_WIDTH, maxWidth: "90vw" }}
        >
          <Command shouldFilter={false} className="flex h-full w-full flex-col">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={
                mode === "nearby"
                  ? "Rechercher un artisan (nom, téléphone, email)..."
                  : "Rechercher par nom, prénom, email, téléphone..."
              }
              autoFocus
            />

            <CommandList
              ref={listRef}
              onScroll={handleScroll}
              className="max-h-[60vh]"
            >
              {error && (
                <div className="m-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              {isLoading && !isLoadingMore && (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  Chargement...
                </div>
              )}

              {!isLoading && results.length === 0 && (
                <CommandEmpty>
                  {mode === "search"
                    ? "Aucun artisan trouvé"
                    : latitude && longitude
                    ? "Aucun artisan à proximité"
                    : "Saisissez une adresse pour voir les artisans à proximité"}
                </CommandEmpty>
              )}

              {results.length > 0 && (
                <CommandGroup
                  heading={mode === "nearby" ? "Artisans à proximité" : "Résultats"}
                >
                  {results.map((artisan) => {
                    const displayData = toDisplayData(artisan)
                    const displayName = getArtisanDisplayName(displayData, "nom")
                    const plainNom = "plain_nom" in artisan ? artisan.plain_nom : null
                    const metier = getArtisanPrimaryMetier(displayData)
                    const addressSegments = getArtisanAddressSegments(displayData)
                    const distance = "distanceKm" in artisan ? artisan.distanceKm : undefined
                    const numeroAssocie = getArtisanNumeroAssocie(displayData)
                    const statusInfo = getArtisanStatusInfo(displayData)
                    const isAbsent = absentArtisanIds.has(artisan.id)

                    return (
                      <CommandItem
                        key={artisan.id}
                        value={`${artisan.id} ${displayName} ${plainNom ?? ""} ${artisan.telephone ?? ""} ${artisan.email ?? ""}`}
                        onSelect={() => handleSelect(artisan)}
                        className="flex items-start gap-3 border-b last:border-b-0 rounded-none px-3 py-3"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <span>{displayName}</span>
                                {statusInfo && (
                                  <Badge
                                    variant="outline"
                                    className="flex-shrink-0 text-xs"
                                    style={{ borderColor: statusInfo.color, color: statusInfo.color }}
                                  >
                                    {statusInfo.label}
                                  </Badge>
                                )}
                                {numeroAssocie && (
                                  <span className="rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-muted-foreground">
                                    {numeroAssocie}
                                  </span>
                                )}
                                {isAbsent && (
                                  <Badge
                                    variant="outline"
                                    className="flex-shrink-0 bg-orange-100 text-orange-800 border-orange-300 text-xs"
                                  >
                                    Indisponible
                                  </Badge>
                                )}
                              </div>
                              {plainNom && (
                                <div className="text-xs text-muted-foreground mt-1">{plainNom}</div>
                              )}
                            </div>
                            {distance !== undefined && (
                              <div className="text-[10px] font-mono text-muted-foreground">
                                {distance < 1
                                  ? `${Math.round(distance * 1000)}m`
                                  : `${distance.toFixed(1)}km`}
                              </div>
                            )}
                          </div>

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
                      </CommandItem>
                    )
                  })}

                  {isLoadingMore && (
                    <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                      Chargement...
                    </div>
                  )}

                  {mode === "nearby" && !hasMoreNearby && results.length > 0 && (
                    <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                      Tous les artisans ont été chargés
                    </div>
                  )}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  )
}
