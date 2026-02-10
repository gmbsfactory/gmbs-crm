"use client"

import React, { memo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/artisans/Avatar"
import { Eye, Trash2, Mail, Phone } from "lucide-react"
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { ArtisanContextMenuContent } from "@/components/artisans/ArtisanContextMenu"
import { GestionnaireBadge } from "@/components/ui/gestionnaire-badge"
import type { Contact } from "@/types/artisan-page"
import { hexToRgba } from "@/types/artisan-page"
import { HighlightedText } from "./HighlightedText"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArtisanTableRowProps {
  contact: Contact
  index: number
  searchTerm: string
  metierColorMap: Record<string, { color: string | null; label: string }>
  canDeleteArtisans: boolean
  onViewDetails: (contact: Contact) => void
  onDelete: (contact: Contact) => void
}

// ---------------------------------------------------------------------------
// Sub-components (inline, small)
// ---------------------------------------------------------------------------

function DossierBadge({ statutDossier }: { statutDossier: string | undefined }) {
  if (!statutDossier) return <span className="text-muted-foreground">&mdash;</span>
  const s = statutDossier.toLowerCase()

  let color = "#10B981" // Green (COMPLET)
  if (s === "incomplet") {
    color = "#F59E0B"
  } else if (s === "à compléter" || s === "a compléter") {
    color = "#EF4444"
  }

  return (
    <Badge
      variant="outline"
      className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap"
      style={{
        backgroundColor: hexToRgba(color, 0.15) || color + "20",
        color,
        borderColor: color,
      }}
    >
      {statutDossier}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

export const ArtisanTableRow = memo(function ArtisanTableRow({
  contact,
  index,
  searchTerm,
  metierColorMap,
  canDeleteArtisans,
  onViewDetails,
  onDelete,
}: ArtisanTableRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <tr
          className={`hover:bg-slate-100/60 dark:hover:bg-muted/30 transition-colors ${
            index % 2 === 0 ? "bg-white dark:bg-background" : "bg-slate-50 dark:bg-muted/10"
          }`}
        >
          {/* Artisan */}
          <td className="px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <Avatar
                photoProfilMetadata={contact.photoProfilMetadata}
                initials={contact.artisanInitials || "??"}
                name={contact.name}
                size={40}
                priority={index < 3}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate" title={contact.name}>
                      <HighlightedText text={contact.name} searchQuery={searchTerm} />
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Zone {contact.zoneIntervention ?? "\u2014"}
                    </span>
                  </div>
                  <div className="flex items-center flex-shrink-0">
                    {contact.statutArtisan && contact.statutArtisanColor && (
                      <Badge
                        variant="outline"
                        className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor:
                            hexToRgba(contact.statutArtisanColor, 0.15) ||
                            contact.statutArtisanColor + "20",
                          color: contact.statutArtisanColor,
                          borderColor: contact.statutArtisanColor,
                        }}
                      >
                        {contact.statutArtisan}
                      </Badge>
                    )}
                    {contact.statutArtisan && !contact.statutArtisanColor && (
                      <Badge
                        variant="outline"
                        className="border px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-700 border-gray-300"
                      >
                        {contact.statutArtisan}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </td>

          {/* Entreprise */}
          <td className="px-2.5 py-1.5 max-w-[180px]">
            <div className="space-y-0.5">
              <div
                className="font-medium truncate"
                title={`${contact.company || "\u2014"}${contact.statutJuridique ? ` / ${contact.statutJuridique}` : ""}`}
              >
                <HighlightedText text={contact.company || "\u2014"} searchQuery={searchTerm} />
                {contact.statutJuridique && (
                  <span className="text-muted-foreground"> / {contact.statutJuridique}</span>
                )}
              </div>
            </div>
          </td>

          {/* Metier */}
          <td className="px-2.5 py-1.5 max-w-[160px]">
            <div className="flex flex-wrap gap-1">
              {contact.metiers && contact.metiers.length > 0 ? (
                contact.metiers.slice(0, 2).map((metierKey, idx) => {
                  const metierInfo = metierColorMap[metierKey]
                  const color = metierInfo?.color
                  const displayLabel = metierInfo?.label || metierKey
                  return (
                    <Badge
                      key={idx}
                      variant="outline"
                      className="px-1.5 py-0 text-[9px] font-medium border whitespace-nowrap"
                      style={
                        color
                          ? {
                              backgroundColor: hexToRgba(color, 0.15) || `${color}20`,
                              color,
                              borderColor: color,
                            }
                          : undefined
                      }
                      title={displayLabel}
                    >
                      {displayLabel}
                    </Badge>
                  )
                })
              ) : (
                <span className="text-muted-foreground">&mdash;</span>
              )}
              {contact.metiers && contact.metiers.length > 2 && (
                <Badge
                  variant="outline"
                  className="px-1.5 py-0 text-[9px] font-medium border"
                  title={contact.metiers
                    .slice(2)
                    .map((k) => metierColorMap[k]?.label || k)
                    .join(", ")}
                >
                  +{contact.metiers.length - 2}
                </Badge>
              )}
            </div>
          </td>

          {/* Contact */}
          <td className="px-2.5 py-1.5 max-w-[140px]">
            <div className="space-y-0.5 text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate" title={contact.email || "\u2014"}>
                <Mail className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">
                  <HighlightedText text={contact.email || "\u2014"} searchQuery={searchTerm} />
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 flex-shrink-0" />
                <span>
                  <HighlightedText text={contact.phone || "\u2014"} searchQuery={searchTerm} />
                </span>
              </div>
            </div>
          </td>

          {/* Gestionnaire */}
          <td className="px-2.5 py-1.5">
            <div className="flex items-center justify-center">
              <GestionnaireBadge
                firstname={contact.gestionnaireFirstname}
                lastname={contact.gestionnaireLastname}
                color={contact.gestionnaireColor}
                avatarUrl={contact.gestionnaireAvatarUrl}
                size="sm"
              />
            </div>
          </td>

          {/* Adresse siege */}
          <td className="px-2.5 py-1.5 text-muted-foreground max-w-[200px]">
            <span className="line-clamp-2" title={contact.adresse || "\u2014"}>
              <HighlightedText text={contact.adresse || "\u2014"} searchQuery={searchTerm} />
            </span>
          </td>

          {/* Dossier */}
          <td className="px-2.5 py-1.5">
            <div className="flex items-center justify-center">
              <DossierBadge statutDossier={contact.statutDossier} />
            </div>
          </td>

          {/* Actions */}
          <td className="px-2.5 py-1.5">
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onViewDetails(contact)}
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
              {canDeleteArtisans && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-600"
                  onClick={() => onDelete(contact)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </td>
        </tr>
      </ContextMenuTrigger>
      <ArtisanContextMenuContent
        artisanId={contact.id}
        isArchived={contact.statutInactif || contact.statutDossier === "Archivé"}
      />
    </ContextMenu>
  )
})
