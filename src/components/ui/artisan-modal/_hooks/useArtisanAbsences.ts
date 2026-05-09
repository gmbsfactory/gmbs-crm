import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import { artisansApi } from "@/lib/api"
import type { ArtisanWithRelations } from "@/components/ui/artisan-modal/_lib/artisan-form-mapper"

type NewAbsence = { start_date: string; end_date: string; reason: string }

const EMPTY_NEW_ABSENCE: NewAbsence = { start_date: "", end_date: "", reason: "" }

export function useArtisanAbsences(
  artisanId: string,
  artisan: ArtisanWithRelations | null | undefined,
  invalidateArtisanDetail: () => void,
) {
  const [newAbsence, setNewAbsence] = useState<NewAbsence>(EMPTY_NEW_ABSENCE)

  const absences = useMemo(() => {
    const raw = artisan?.artisan_absences ?? []
    if (!Array.isArray(raw)) return []
    return raw
      .filter((absence) => absence?.start_date || absence?.end_date)
      .map((absence) => ({
        id: absence.id ?? `${absence.start_date ?? ""}-${absence.end_date ?? ""}`,
        startDate: absence.start_date ?? null,
        endDate: absence.end_date ?? null,
        reason: absence.reason ?? null,
        isConfirmed: absence.is_confirmed ?? null,
      }))
  }, [artisan])

  const handleAddAbsence = useCallback(async () => {
    if (!newAbsence.start_date || !newAbsence.end_date) {
      toast.error("Veuillez renseigner les dates de début et de fin")
      return
    }

    try {
      await artisansApi.createAbsence(artisanId, {
        start_date: newAbsence.start_date,
        end_date: newAbsence.end_date,
        reason: newAbsence.reason || undefined,
        is_confirmed: false,
      })
      setNewAbsence(EMPTY_NEW_ABSENCE)
      invalidateArtisanDetail()
      toast.success("Absence ajoutée")
    } catch {
      toast.error("Erreur lors de l'ajout de l'absence")
    }
  }, [newAbsence, artisanId, invalidateArtisanDetail])

  const handleDeleteAbsence = useCallback(
    async (id: string) => {
      try {
        await artisansApi.deleteAbsence(id)
        invalidateArtisanDetail()
        toast.success("Absence supprimée")
      } catch {
        toast.error("Erreur lors de la suppression de l'absence")
      }
    },
    [invalidateArtisanDetail],
  )

  return {
    newAbsence,
    setNewAbsence,
    absences,
    handleAddAbsence,
    handleDeleteAbsence,
  }
}
