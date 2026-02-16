"use client"

import React, { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { interventionsApi } from "@/lib/api/v2"
import { useReferenceDataQuery } from "@/hooks/useReferenceDataQuery"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { cn } from "@/lib/utils"
import type { Intervention } from "@/lib/api/v2/common/types"

type ArtisanInterventionsTableProps = {
  artisanId: string
  enableInternalScroll?: boolean
}

export function ArtisanInterventionsTable({ artisanId, enableInternalScroll = false }: ArtisanInterventionsTableProps) {
  const { open: openInterventionModal } = useInterventionModal()
  const { data: referenceData } = useReferenceDataQuery()

  // Charger les interventions de l'artisan via interventions_artisans
  const {
    data: interventionsResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["interventions", "artisan", artisanId],
    enabled: Boolean(artisanId),
    queryFn: async () => {
      const result = await interventionsApi.getByArtisan(artisanId, {
        limit: 5000,
      })
      return result
    },
  })

  const interventions = interventionsResponse?.data || []

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "—"
    try {
      return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(new Date(dateString))
    } catch {
      return dateString
    }
  }

  const getStatusLabel = (statutId: string | null | undefined) => {
    if (!statutId || !referenceData?.interventionStatuses) return null
    return referenceData.interventionStatuses.find((s) => s.id === statutId)?.label || null
  }

  const getStatusColor = (statutId: string | null | undefined) => {
    if (!statutId || !referenceData?.interventionStatuses) return undefined
    return referenceData.interventionStatuses.find((s) => s.id === statutId)?.color || undefined
  }

  const handleViewIntervention = (interventionId: string) => {
    // Ouvrir le modal d'intervention en stockant l'artisan d'origine dans les métadonnées
    openInterventionModal(interventionId, {
      origin: `artisan:${artisanId}`,
    })
  }

  return (
    <Card className={cn(enableInternalScroll && "h-full flex flex-col")}>
      <CardHeader className={cn(enableInternalScroll && "shrink-0 py-3 px-4")}>
        <CardTitle className={cn(enableInternalScroll && "text-sm")}>Interventions de l&apos;artisan</CardTitle>
      </CardHeader>
      <CardContent className={cn(enableInternalScroll && "flex-1 min-h-0 overflow-hidden p-0 px-4 pb-4")}>
        <div className={cn("rounded-md border overflow-hidden", enableInternalScroll && "h-full overflow-y-auto scrollbar-minimal")}>
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[70px] text-xs px-2">Date</TableHead>
                <TableHead className="w-[50px] text-xs px-2">ID</TableHead>
                <TableHead className="text-xs px-2">Assigné</TableHead>
                <TableHead className="w-[80px] text-xs px-2">Agence</TableHead>
                <TableHead className="text-xs px-2">Lieu</TableHead>
                <TableHead className="w-[90px] text-xs px-2">Statut</TableHead>
                <TableHead className="w-[40px] text-xs px-1"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-4">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-destructive text-xs py-4">
                    Erreur lors du chargement
                  </TableCell>
                </TableRow>
              ) : interventions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground text-xs py-4">
                    Aucune intervention
                  </TableCell>
                </TableRow>
              ) : (
                interventions.map((intervention) => {
                  const statusLabel = getStatusLabel(intervention.statut_id)
                  const statusColor = getStatusColor(intervention.statut_id)
                  const assignedUser = referenceData?.users.find((u) => u.id === intervention.assigned_user_id)
                  const assignedUserName = assignedUser
                    ? [assignedUser.firstname, assignedUser.lastname].filter(Boolean).join(" ").trim() ||
                      assignedUser.username
                    : null
                  const agency = referenceData?.agencies.find((a) => a.id === intervention.agence_id)

                  return (
                    <TableRow key={intervention.id}>
                      <TableCell className="text-xs px-2 py-1.5">{formatDate(intervention.date)}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 font-mono truncate">{intervention.id_inter || "—"}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5 truncate">{assignedUserName || "—"}</TableCell>
                      <TableCell className="text-xs px-2 py-1.5">
                        {agency ? (
                          agency.color ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0"
                              style={{
                                borderColor: agency.color,
                                backgroundColor: `${agency.color}15`,
                                color: agency.color,
                              }}
                            >
                              {agency.code || agency.label?.slice(0, 3)}
                            </Badge>
                          ) : (
                            <span className="truncate">{agency.code || agency.label?.slice(0, 3)}</span>
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs px-2 py-1.5 truncate">
                        {intervention.ville || intervention.code_postal || "—"}
                      </TableCell>
                      <TableCell className="px-2 py-1.5">
                        {statusLabel ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 truncate max-w-full"
                            style={
                              statusColor
                                ? {
                                    borderColor: statusColor,
                                    backgroundColor: `${statusColor}15`,
                                    color: statusColor,
                                  }
                                : undefined
                            }
                          >
                            {statusLabel}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="px-1 py-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewIntervention(intervention.id)}
                          className="h-6 w-6"
                          aria-label="Voir l'intervention"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
