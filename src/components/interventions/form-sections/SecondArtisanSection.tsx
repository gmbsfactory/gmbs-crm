"use client"

import { ChevronDown, ChevronRight, Users, Search, Eye, Mail, MessageCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import { SearchableBadgeSelect } from "@/components/ui/searchable-badge-select"
import { Avatar } from "@/components/artisans/Avatar"
import { PresenceFieldIndicator } from "@/components/ui/intervention-modal/PresenceFieldIndicator"
import { formatDistanceKm, hexToRgba } from "@/lib/interventions/form-utils"
import type { NearbyArtisan } from "@/hooks/useNearbyArtisans"
import type { InterventionFormData } from "@/lib/interventions/form-types"

interface SecondArtisanSectionProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  formData: InterventionFormData
  onChange: (field: string, value: any) => void

  // Artisan state
  selectedArtisanId: string | null
  selectedSecondArtisanId: string | null
  selectedSecondArtisanData: NearbyArtisan | null
  nearbyArtisansSecondMetier: NearbyArtisan[]
  absentArtisanIds: Set<string>

  // Display
  secondArtisanDisplayMode: "nom" | "rs" | "tel"
  setSecondArtisanDisplayMode: (mode: "nom" | "rs" | "tel") => void
  getArtisanDisplayName: (artisan: NearbyArtisan, mode: "nom" | "rs" | "tel") => string
  artisanStatuses?: Array<{ id: string; label?: string | null; color?: string | null }>
  metiers?: Array<{ id: string; label: string; color?: string | null }>

  // Email/WhatsApp
  isInterButtonDisabled: boolean
  openEmailModal: (type: 'devis' | 'intervention', artisanId?: string) => void
  handleOpenWhatsApp: (type: 'devis' | 'intervention', artisanId: string, phone: string) => void

  // Actions
  handleSelectSecondArtisan: (artisan: NearbyArtisan) => void
  handleRemoveSecondArtisan: () => void
  handleOpenArtisanModal: (artisanId: string, event: React.MouseEvent) => void
  onSearchClick: (position: { x: number; y: number; width: number; height: number }) => void
  onPopoverOpenChange?: (isOpen: boolean) => void
}

export function SecondArtisanSection({
  isOpen,
  onOpenChange,
  formData,
  onChange,
  selectedArtisanId,
  selectedSecondArtisanId,
  selectedSecondArtisanData,
  nearbyArtisansSecondMetier,
  absentArtisanIds,
  secondArtisanDisplayMode,
  setSecondArtisanDisplayMode,
  getArtisanDisplayName,
  artisanStatuses,
  metiers,
  isInterButtonDisabled,
  openEmailModal,
  handleOpenWhatsApp,
  handleSelectSecondArtisan,
  handleRemoveSecondArtisan,
  handleOpenArtisanModal,
  onSearchClick,
  onPopoverOpenChange,
}: SecondArtisanSectionProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-2 px-3 hover:bg-muted/50">
            <CardTitle className="flex items-center gap-2 text-xs">
              <Users className="h-3 w-3" />
              Deuxième artisan
              {isOpen ? <ChevronDown className="ml-auto h-3 w-3" /> : <ChevronRight className="ml-auto h-3 w-3" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-3 pb-3">
            <div className="space-y-3">
              {/* Header artisans */}
              <div className="flex items-center justify-between gap-2 flex-shrink-0 pt-[13px] flex-wrap min-w-0">
                <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                  <PresenceFieldIndicator fieldName="metierSecondArtisanId">
                  <SearchableBadgeSelect
                    label="Métier"
                    value={formData.metierSecondArtisanId}
                    options={(metiers || []).map(m => ({
                      id: m.id,
                      label: m.label,
                      color: m.color,
                    }))}
                    onChange={(value) => onChange("metierSecondArtisanId", value)}
                    placeholder="Métier..."
                    minWidth="100px"
                    hideLabel
                    onOpenChange={onPopoverOpenChange}
                    searchPlaceholder="Rechercher un métier..."
                    emptyText="Aucun métier trouvé"
                    presenceFieldName="metierSecondArtisanId"
                  />
                  </PresenceFieldIndicator>
                  <div className="flex gap-0.5 flex-shrink-0">
                    {(["nom", "rs", "tel"] as const).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        variant={secondArtisanDisplayMode === mode ? "default" : "ghost"}
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => setSecondArtisanDisplayMode(mode)}
                      >
                        {mode === "rs" ? "RS" : mode}
                      </Button>
                    ))}
                  </div>
                </div>
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

              {/* Artisan secondaire sélectionné */}
              {selectedSecondArtisanId && selectedSecondArtisanData && (() => {
                const artisan = selectedSecondArtisanData
                const artisanDisplayName = getArtisanDisplayName(artisan, secondArtisanDisplayMode)
                const artisanInitials = artisanDisplayName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
                const artisanStatus = artisanStatuses?.find((s) => s.id === artisan.statut_id)
                const statutArtisan = artisanStatus?.label || ""
                const statutArtisanColor = artisanStatus?.color || null

                return (
                  <div className="relative rounded-lg border border-orange-500/70 ring-2 ring-orange-500/50 bg-background/80 p-2 text-xs shadow-sm">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1 h-5 w-5 rounded-full bg-background/80 text-muted-foreground shadow-sm hover:text-destructive z-20"
                      onClick={() => handleRemoveSecondArtisan()}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                      <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} className="hidden" />
                      <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                        <span className="font-semibold text-foreground truncate text-xs min-w-0">{artisanDisplayName}</span>
                        {absentArtisanIds.has(artisan.id) && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300 flex-shrink-0">
                            Indisponible
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap flex-shrink-0 ml-auto">
                        {statutArtisan && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0" style={statutArtisanColor ? { backgroundColor: hexToRgba(statutArtisanColor, 0.15) || undefined, color: statutArtisanColor, borderColor: statutArtisanColor } : undefined}>
                            {statutArtisan}
                          </Badge>
                        )}
                        <Badge variant="default" className="text-[9px] px-1 py-0 bg-orange-500 flex-shrink-0">{formatDistanceKm(artisan.distanceKm)}</Badge>
                      </div>
                    </div>
                    {artisan.telephone && (
                      <div className="mt-1 text-[10px] text-muted-foreground truncate">
                        📞 {artisan.telephone}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Email sending section for second artisan */}
              {selectedSecondArtisanId && selectedSecondArtisanData && (
                <div className="flex flex-col gap-1 p-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800/50">
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => openEmailModal('devis', selectedSecondArtisanId)} disabled={!selectedSecondArtisanId} className="flex-1 text-[10px] h-7 px-2 border-orange-300 hover:bg-orange-100 dark:border-orange-700 dark:hover:bg-orange-900/30">
                      <Mail className="h-3 w-3 mr-1" />
                      Devis
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => openEmailModal('intervention', selectedSecondArtisanId)} disabled={isInterButtonDisabled} className="flex-1 text-[10px] h-7 px-2 border-orange-300 hover:bg-orange-100 dark:border-orange-700 dark:hover:bg-orange-900/30">
                      <Mail className="h-3 w-3 mr-1" />
                      Inter.
                    </Button>
                  </div>
                  {selectedSecondArtisanData.telephone && (
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleOpenWhatsApp('devis', selectedSecondArtisanId, selectedSecondArtisanData.telephone || '')} disabled={!selectedSecondArtisanId} className="flex-1 text-[10px] h-7 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]">
                        <MessageCircle className="h-3 w-3 mr-1" />
                        WA Devis
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleOpenWhatsApp('intervention', selectedSecondArtisanId, selectedSecondArtisanData.telephone || '')} disabled={isInterButtonDisabled} className="flex-1 text-[10px] h-7 px-2 bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]">
                        <MessageCircle className="h-3 w-3 mr-1" />
                        WA Inter.
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Liste des artisans pour sélection */}
              {!selectedSecondArtisanId && (
                <div className="max-h-[150px] overflow-y-auto space-y-1 scrollbar-minimal">
                  {nearbyArtisansSecondMetier
                    .filter(artisan => artisan.id !== selectedArtisanId)
                    .slice(0, 5)
                    .map((artisan) => {
                      const artisanDisplayName = getArtisanDisplayName(artisan, secondArtisanDisplayMode)
                      const artisanInitials = artisanDisplayName.split(" ").map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase() || "??"
                      const artisanStatus = artisanStatuses?.find((s) => s.id === artisan.statut_id)
                      const statutArtisan = artisanStatus?.label || ""
                      const statutArtisanColor = artisanStatus?.color || null

                      return (
                        <div
                          key={artisan.id}
                          role="button"
                          tabIndex={0}
                          className="rounded-lg border border-border/60 bg-background/80 p-2 text-xs shadow-sm transition-all cursor-pointer hover:border-orange-500/40"
                          onClick={() => handleSelectSecondArtisan(artisan)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSelectSecondArtisan(artisan) } }}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap w-full min-w-0">
                            <Avatar photoProfilMetadata={artisan.photoProfilMetadata} initials={artisanInitials} name={artisan.displayName} size={40} className="hidden" />
                            <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
                              <span className="font-medium text-foreground truncate text-[11px] min-w-0">{artisanDisplayName}</span>
                              {absentArtisanIds.has(artisan.id) && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 text-orange-800 border-orange-300 flex-shrink-0">
                                  Indisponible
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap flex-shrink-0 ml-auto">
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
                    })}
                </div>
              )}

              {/* Consigne pour le deuxième artisan */}
              <div>
                <Label htmlFor="consigne_second_artisan" className="text-[10px]">Consigne 2ème artisan</Label>
                <PresenceFieldIndicator fieldName="consigne_second_artisan">
                <Textarea
                  id="consigne_second_artisan"
                  value={formData.consigne_second_artisan}
                  onChange={(e) => onChange("consigne_second_artisan", e.target.value)}
                  placeholder="Consignes spécifiques..."
                  className="min-h-[50px] text-xs mt-1 resize-none"
                />
                </PresenceFieldIndicator>
              </div>

              {/* Coûts du 2ème artisan */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="coutSSTSecondArtisan" className="text-[10px]">Coût SST</Label>
                  <PresenceFieldIndicator fieldName="coutSSTSecondArtisan">
                  <Input id="coutSSTSecondArtisan" type="number" step="0.01" min="0" value={formData.coutSSTSecondArtisan} onChange={(e) => onChange("coutSSTSecondArtisan", e.target.value)} placeholder="0.00 €" className="h-7 text-xs mt-1" />
                  </PresenceFieldIndicator>
                </div>
                <div>
                  <Label htmlFor="coutMaterielSecondArtisan" className="text-[10px]">Coût mat.</Label>
                  <PresenceFieldIndicator fieldName="coutMaterielSecondArtisan">
                  <Input id="coutMaterielSecondArtisan" type="number" step="0.01" min="0" value={formData.coutMaterielSecondArtisan} onChange={(e) => onChange("coutMaterielSecondArtisan", e.target.value)} placeholder="0.00 €" className="h-7 text-xs mt-1" />
                  </PresenceFieldIndicator>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
