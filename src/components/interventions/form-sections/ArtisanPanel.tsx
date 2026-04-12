"use client"

import { Building, Search, Eye, Mail, MessageCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/artisans/Avatar"
import { PresenceFieldIndicator } from "@/components/ui/intervention-modal/PresenceFieldIndicator"
import { cn } from "@/lib/utils"
import { formatDistanceKm, hexToRgba } from "@/lib/interventions/form-utils"
import type { NearbyArtisan } from "@/hooks/useNearbyArtisans"

interface ArtisanPanelProps {
  // Artisan state
  selectedArtisanId: string | null
  selectedArtisanData: NearbyArtisan | null
  nearbyArtisans: NearbyArtisan[]
  isLoadingNearbyArtisans: boolean
  nearbyArtisansError: string | null
  absentArtisanIds: Set<string>
  perimeterKmValue: number
  requiresArtisan: boolean

  // Display
  artisanDisplayMode: "nom" | "rs" | "tel"
  setArtisanDisplayMode: (mode: "nom" | "rs" | "tel") => void
  getArtisanDisplayName: (artisan: NearbyArtisan, mode: "nom" | "rs" | "tel") => string
  artisanStatuses?: Array<{ id: string; label?: string | null; color?: string | null }>

  // Email/WhatsApp
  isDevisButtonDisabled: boolean
  isInterButtonDisabled: boolean
  openEmailModal: (type: 'devis' | 'intervention') => void
  handleOpenWhatsApp: (type: 'devis' | 'intervention', artisanId: string, phone: string) => void

  // Actions
  handleSelectNearbyArtisan: (artisan: NearbyArtisan) => void
  handleRemoveSelectedArtisan: () => void
  handleOpenArtisanModal: (artisanId: string, event: React.MouseEvent) => void
  onSearchClick: (position: { x: number; y: number; width: number; height: number }) => void
}

export function ArtisanPanel({
  selectedArtisanId,
  selectedArtisanData,
  nearbyArtisans,
  isLoadingNearbyArtisans,
  nearbyArtisansError,
  absentArtisanIds,
  perimeterKmValue,
  requiresArtisan,
  artisanDisplayMode,
  setArtisanDisplayMode,
  getArtisanDisplayName,
  artisanStatuses,
  isDevisButtonDisabled,
  isInterButtonDisabled,
  openEmailModal,
  handleOpenWhatsApp,
  handleSelectNearbyArtisan,
  handleRemoveSelectedArtisan,
  handleOpenArtisanModal,
  onSearchClick,
}: ArtisanPanelProps) {
  return (
    <Card className={cn("h-full flex flex-col overflow-hidden rounded-l-none border-l-0", requiresArtisan && (!selectedArtisanId || !selectedArtisanData) && "ring-2 ring-orange-400/50")}>
      <CardContent className="p-3 flex flex-col h-full overflow-hidden">
        {/* Header artisans */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-shrink-0 flex-wrap min-w-0">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <h3 className="font-semibold text-sm flex items-center gap-2 flex-shrink-0">
              <Building className="h-4 w-4" />
              Artisans {requiresArtisan && <span className="text-orange-500">*</span>}
            </h3>
            <div className="flex gap-0.5 flex-shrink-0">
              {(["nom", "rs", "tel"] as const).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={artisanDisplayMode === mode ? "default" : "ghost"}
                  size="sm"
                  className="h-5 px-1.5 text-[10px]"
                  onClick={() => setArtisanDisplayMode(mode)}
                >
                  {mode === "rs" ? "RS" : mode}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                onSearchClick({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
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
          const artisanDisplayName = getArtisanDisplayName(artisan, artisanDisplayMode)
          const artisanInitials = artisanDisplayName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
          const artisanStatus = artisanStatuses?.find((s) => s.id === artisan.statut_id)
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
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} className="hidden" />
                  <span className="font-semibold text-foreground truncate text-xs min-w-0 flex-1">{artisanDisplayName}</span>
                  {statutArtisan && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                      {statutArtisan}
                    </Badge>
                  )}
                  {absentArtisanIds.has(artisan.id) && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300 flex-shrink-0">
                      Indisponible
                    </Badge>
                  )}
                  <Badge variant="default" className="text-[9px] px-1 py-0 flex-shrink-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                  {artisan.telephone && (
                    <span className="text-[10px] text-muted-foreground truncate flex-shrink-0">📞 {artisan.telephone}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Email sending section */}
        {selectedArtisanId && selectedArtisanData && (
          <div className="flex flex-col gap-1 p-2 bg-primary/5 dark:bg-primary/10 rounded-lg border border-primary/20 dark:border-primary/30 mb-2 flex-shrink-0">
            {/* Boutons Email */}
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openEmailModal('devis')}
                disabled={isDevisButtonDisabled}
                className="flex-1 text-[10px] h-7 px-2 border-primary/30 hover:bg-primary/10 dark:border-primary/40 dark:hover:bg-primary/20"
              >
                <Mail className="h-3 w-3 mr-1" />
                Devis
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => openEmailModal('intervention')}
                disabled={isInterButtonDisabled}
                className="flex-1 text-[10px] h-7 px-2 border-primary/30 hover:bg-primary/10 dark:border-primary/40 dark:hover:bg-primary/20"
              >
                <Mail className="h-3 w-3 mr-1" />
                Inter.
              </Button>
            </div>
            {/* Boutons WhatsApp */}
            {selectedArtisanData.telephone && (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenWhatsApp('devis', selectedArtisanId, selectedArtisanData.telephone || '')}
                  disabled={isDevisButtonDisabled}
                  className="flex-1 text-[10px] h-7 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]"
                >
                  <MessageCircle className="h-3 w-3 mr-1" />
                  WA Devis
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenWhatsApp('intervention', selectedArtisanId, selectedArtisanData.telephone || '')}
                  disabled={isInterButtonDisabled}
                  className="flex-1 text-[10px] h-7 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]"
                >
                  <MessageCircle className="h-3 w-3 mr-1" />
                  WA Inter.
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Liste des artisans - max 8 visibles avec scroll */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0 scrollbar-minimal">
          {isLoadingNearbyArtisans ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Recherche...</div>
          ) : nearbyArtisansError ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">{nearbyArtisansError}</div>
          ) : nearbyArtisans.length === 0 ? (
            <div className="rounded border border-border/50 bg-background px-2 py-2 text-[10px] text-muted-foreground">Aucun artisan dans un rayon de {perimeterKmValue} km.</div>
          ) : (
            nearbyArtisans.map((artisan) => {
              const artisanDisplayName = getArtisanDisplayName(artisan, artisanDisplayMode)
              const artisanInitials = artisanDisplayName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
              const artisanStatus = artisanStatuses?.find((s) => s.id === artisan.statut_id)
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
                  <div className="flex items-center justify-between gap-2 flex-wrap w-full min-w-0">
                    <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} className="hidden" />
                    <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
                      <span className="font-medium text-foreground truncate text-[11px] min-w-0">{artisanDisplayName}</span>
                      {absentArtisanIds.has(artisan.id) && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300 flex-shrink-0">
                          Indisponible
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap flex-shrink-0">
                      {statutArtisan && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                          {statutArtisan}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 flex-shrink-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                      <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground flex-shrink-0" onClick={(e) => handleOpenArtisanModal(artisan.id, e)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}
