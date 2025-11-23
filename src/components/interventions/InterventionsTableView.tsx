"use client"

import { Loader2 } from "lucide-react"
import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import InterventionTable, { type InterventionTableRow } from "@/components/interventions/InterventionTable"
import type { InterventionView } from "@/types/intervention-view"
import useInterventionModal from "@/hooks/useInterventionModal"
import { useReferenceData } from "@/hooks/useReferenceData"
import { mapStatusFromDb } from "@/lib/interventions/mappers"
import { getStatusDisplayLabel } from "@/lib/interventions/deposit-helpers"

function hslToHex(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l)
  const toHex = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(Math.min(k - 3, 9 - k), 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, "0")
  }
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`
}

function generateColorFromString(value: string) {
  const seed = value
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const hue = seed % 360
  return hslToHex(hue, 0.65, 0.48)
}

type InterventionsTableViewProps = {
  interventions: InterventionView[]
  loading: boolean
  error: string | null
}

export default function InterventionsTableView({ interventions, loading, error }: InterventionsTableViewProps) {
  const { open } = useInterventionModal()
  const { data: referenceData } = useReferenceData()

  const userLookup = useMemo(() => {
    const map = new Map<string, { label: string; color: string | null }>()
    if (!referenceData?.users) return map

    referenceData.users.forEach((user) => {
      const nameParts = [user.firstname, user.lastname].filter(Boolean).join(" ").trim()
      const label = user.code_gestionnaire?.trim() || nameParts || user.username || user.id
      const color = user.color || generateColorFromString(label)
      if (user.username) {
        map.set(user.username, { label, color })
      }
      map.set(user.id, { label, color })
      if (user.code_gestionnaire) {
        map.set(user.code_gestionnaire, { label, color })
      }
    })

    return map
  }, [referenceData])

  const tableRows: InterventionTableRow[] = useMemo(
    () =>
      interventions.map((item) => {
        const assignedCode = item.assignedUserCode ?? item.attribueA ?? undefined
        const managerInfo = assignedCode ? userLookup.get(assignedCode) : undefined
        const normalizedStatus = mapStatusFromDb(item.statusValue ?? item.statut ?? undefined)
        const managerLabel = managerInfo?.label ?? assignedCode ?? null
        const managerColor = managerInfo?.color ?? (assignedCode ? generateColorFromString(assignedCode) : null)

        const sstPayment = item.payments?.find(p => p.payment_type === 'acompte_sst')
        const clientPayment = item.payments?.find(p => p.payment_type === 'acompte_client')
        const statusDisplayLabel = getStatusDisplayLabel(
          normalizedStatus,
          item.statusLabel ?? normalizedStatus,
          sstPayment,
          clientPayment
        )

        return {
          id: item.id,
          date: item.date ?? "",
          createdAt: item.date ?? "",
          updatedAt: item.date ?? "",
          name: item.contexteIntervention || item.commentaireAgent || "Intervention",
          agency: item.agence ?? null,
          address: item.adresse ?? "",
          context: item.contexteIntervention || "",
          consigne: item.consigneIntervention ?? null,
          status: normalizedStatus,
          statusChangedAt: item.date ?? "",
          dueAt: item.datePrevue ?? item.dateIntervention ?? null,
          invoice2goId: item.idFacture ? String(item.idFacture) : null,
          artisanId: item.artisan ?? null,
          managerId: assignedCode ?? null,
          managerLabel,
          managerColor,
          isValidated: Boolean(item.idFacture),
          documents: [],
          statusDisplayLabel,
        }
      }),
    [interventions, userLookup],
  )

  const orderedIds = useMemo(() => tableRows.map((row) => row.id), [tableRows])

  // Early returns après tous les hooks
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <InterventionTable
          interventions={tableRows}
          onRowClick={(intervention, index) =>
            open(intervention.id, {
              layoutId: `table-row-${intervention.id}`,
              orderedIds,
              index,
            })
          }
          onRowDoubleClick={(intervention, index) =>
            open(intervention.id, {
              layoutId: `table-row-${intervention.id}`,
              orderedIds,
              index,
            })
          }
        />
      </CardContent>
    </Card>
  )
}
