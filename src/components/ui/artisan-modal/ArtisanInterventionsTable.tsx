"use client"

import React, { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { interventionsApi } from "@/lib/api/v2"
import { useReferenceData } from "@/hooks/useReferenceData"
import { useInterventionModal } from "@/hooks/useInterventionModal"
import { cn } from "@/lib/utils"
import type { Intervention } from "@/lib/api/v2/common/types"

type ArtisanInterventionsTableProps = {
  artisanId: string
}

export function ArtisanInterventionsTable({ artisanId }: ArtisanInterventionsTableProps) {
  const { open: openInterventionModal } = useInterventionModal()
  const { data: referenceData } = useReferenceData()

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
    <Card>
      <CardHeader>
        <CardTitle>Interventions de l&apos;artisan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date intervention</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Assigné à</TableHead>
                <TableHead>Agence</TableHead>
                <TableHead>Ville + Code postal</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-[60px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-destructive">
                    Erreur lors du chargement des interventions
                  </TableCell>
                </TableRow>
              ) : interventions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucune intervention trouvée
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
                      <TableCell className="text-sm">{formatDate(intervention.date)}</TableCell>
                      <TableCell className="text-sm">{intervention.id_inter || "—"}</TableCell>
                      <TableCell className="text-sm">{assignedUserName || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {agency ? (
                          agency.color ? (
                            <Badge
                              variant="outline"
                              className={cn("text-xs")}
                              style={{
                                borderColor: agency.color,
                                backgroundColor: `${agency.color}15`,
                                color: agency.color,
                              }}
                            >
                              {agency.label || agency.code}
                            </Badge>
                          ) : (
                            agency.label || agency.code
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {[intervention.code_postal, intervention.ville].filter(Boolean).join(" ") || "—"}
                      </TableCell>
                      <TableCell>
                        {statusLabel ? (
                          <Badge
                            variant="outline"
                            className={cn("text-xs")}
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
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewIntervention(intervention.id)}
                          className="h-8 w-8"
                          aria-label="Voir l'intervention"
                        >
                          <Eye className="h-4 w-4" />
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
