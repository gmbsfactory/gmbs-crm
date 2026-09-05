import { supabase } from "./common/client"
import type { PaymentStatus } from "@/lib/interventions/payment-status"

/**
 * Statut de paiement d'un artisan sur une intervention (lot L6).
 * Une ligne par affectation : deux artisans sur une intervention ont deux
 * paiements distincts, ce qu'`intervention_payments` ne sait pas exprimer.
 */
export interface ArtisanPaymentRow {
  intervention_id: string
  artisan_id: string
  role: string | null
  is_primary: boolean | null
  payment_status: PaymentStatus
  paid_at: string | null
  payment_updated_at: string | null
  artisan_nom: string
}

export interface FacturationEntriesResult {
  dateMap: Map<string, string>
  sortedIds: string[]
  total: number
}

/**
 * API pour la gestion des checks comptabilité
 * Permet de marquer les interventions comme "gérées" dans l'onglet compta
 */
export const comptaApi = {
  /**
   * Récupère les interventions dont le statut actuel est INTER_TERMINEE.
   * Enrichit avec la date de facturation (dernière transition vers INTER_TERMINEE).
   */
  async getAllFacturationEntries(
    dateRange?: { start: string; end: string } | null
  ): Promise<FacturationEntriesResult> {
    // 1. Résoudre l'UUID du statut INTER_TERMINEE
    const { data: statusData, error: statusError } = await supabase
      .from("intervention_statuses")
      .select("id")
      .eq("code", "INTER_TERMINEE")
      .single()

    if (statusError || !statusData) {
      console.error("Error fetching INTER_TERMINEE status:", statusError)
      throw statusError || new Error("Status INTER_TERMINEE not found")
    }

    // 2. En parallèle : interventions au statut actuel INTER_TERMINEE + transitions (dates)
    const [interventionsResult, transitionsResult] = await Promise.all([
      supabase
        .from("interventions")
        .select("id")
        .eq("statut_id", statusData.id),
      supabase
        .from("intervention_status_transitions")
        .select("intervention_id, transition_date")
        .eq("to_status_code", "INTER_TERMINEE")
        .order("transition_date", { ascending: false }),
    ])

    if (interventionsResult.error) {
      console.error("Error fetching INTER_TERMINEE interventions:", interventionsResult.error)
      throw interventionsResult.error
    }

    // Set des IDs au statut actuel INTER_TERMINEE
    const termineeIds = new Set<string>(
      (interventionsResult.data || []).map((row: { id: string }) => row.id)
    )

    // Map des dates de facturation (dernière transition vers INTER_TERMINEE)
    const dateMap = new Map<string, string>()
    for (const row of transitionsResult.data || []) {
      if (termineeIds.has(row.intervention_id) && !dateMap.has(row.intervention_id)) {
        dateMap.set(row.intervention_id, row.transition_date)
      }
    }

    // Ajouter les interventions INTER_TERMINEE sans transition (cas rare)
    for (const id of termineeIds) {
      if (!dateMap.has(id)) {
        dateMap.set(id, "")
      }
    }

    // Filtrer par date range sur la date de facturation
    let sortedIds: string[]
    if (dateRange) {
      sortedIds = Array.from(dateMap.entries())
        .filter(([, date]) => {
          if (!date) return false
          return date >= dateRange.start && date <= dateRange.end
        })
        .sort(([, a], [, b]) => (b || "").localeCompare(a || ""))
        .map(([id]) => id)
    } else {
      sortedIds = Array.from(dateMap.entries())
        .sort(([, a], [, b]) => (b || "").localeCompare(a || ""))
        .map(([id]) => id)
    }

    // Nettoyer la dateMap pour ne garder que les IDs filtrés
    const filteredDateMap = new Map<string, string>()
    for (const id of sortedIds) {
      const date = dateMap.get(id)
      if (date) filteredDateMap.set(id, date)
    }

    return { dateMap: filteredDateMap, sortedIds, total: sortedIds.length }
  },

  /**
   * Récupère les dates de facturation (date de passage à INTER_TERMINEE) pour les interventions
   * @returns Map intervention_id -> date de facturation
   */
  async getFacturationDates(interventionIds: string[]): Promise<Map<string, string>> {
    if (!interventionIds.length) return new Map()

    const dateMap = new Map<string, string>()
    const BATCH_SIZE = 50 // Limiter la taille des requêtes pour éviter les URLs trop longues

    // Diviser en lots
    for (let i = 0; i < interventionIds.length; i += BATCH_SIZE) {
      const batch = interventionIds.slice(i, i + BATCH_SIZE)

      const { data, error } = await supabase
        .from("intervention_status_transitions")
        .select("intervention_id, transition_date")
        .in("intervention_id", batch)
        .eq("to_status_code", "INTER_TERMINEE")
        .order("transition_date", { ascending: false })

      if (error) {
        console.error("Error fetching facturation dates batch:", error)
        continue
      }

      // Ajouter à la map (la date la plus récente pour chaque intervention)
      for (const row of data || []) {
        if (!dateMap.has(row.intervention_id)) {
          dateMap.set(row.intervention_id, row.transition_date)
        }
      }
    }

    return dateMap
  },

  /**
   * Récupère les IDs des interventions cochées comme "gérées"
   */
  async getCheckedInterventions(interventionIds: string[]): Promise<Set<string>> {
    if (!interventionIds.length) return new Set()

    const checkedIds = new Set<string>()
    const BATCH_SIZE = 50

    // Diviser en lots pour éviter les URLs trop longues
    for (let i = 0; i < interventionIds.length; i += BATCH_SIZE) {
      const batch = interventionIds.slice(i, i + BATCH_SIZE)

      const { data, error } = await supabase
        .from("intervention_compta_checks")
        .select("intervention_id")
        .in("intervention_id", batch)

      if (error) {
        console.error("Error fetching compta checks batch:", error)
        continue
      }

      for (const row of data || []) {
        checkedIds.add(row.intervention_id)
      }
    }

    return checkedIds
  },

  /**
   * Vérifie si une intervention est cochée
   */
  async isChecked(interventionId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from("intervention_compta_checks")
      .select("id")
      .eq("intervention_id", interventionId)

    if (error) {
      console.error("Error checking compta status:", error)
      return false
    }

    return (data?.length ?? 0) > 0
  },

  /**
   * Coche une intervention comme "gérée"
   */
  async check(interventionId: string): Promise<boolean> {
    const { error } = await supabase
      .from("intervention_compta_checks")
      .upsert(
        { intervention_id: interventionId },
        { onConflict: "intervention_id" }
      )

    if (error) {
      console.error("Error adding compta check:", error)
      return false
    }
    return true
  },

  /**
   * Statuts de paiement des artisans pour une page d'interventions.
   *
   * Lecture directe d'`intervention_artisans` plutôt qu'ajout de colonnes au
   * `FULL_INTERVENTION_SELECT` : ce SELECT est partagé par tout le CRM, et le
   * paiement n'intéresse que la page Comptabilité.
   *
   * **`intervention_payments` n'est jamais lu ici** : `is_received` y désigne
   * l'encaissement *client*, pas le règlement de l'artisan.
   */
  async getArtisanPayments(interventionIds: string[]): Promise<Map<string, ArtisanPaymentRow[]>> {
    const result = new Map<string, ArtisanPaymentRow[]>()
    if (!interventionIds.length) return result

    const BATCH_SIZE = 50
    for (let i = 0; i < interventionIds.length; i += BATCH_SIZE) {
      const batch = interventionIds.slice(i, i + BATCH_SIZE)
      const { data, error } = await supabase
        .from("intervention_artisans")
        .select(
          "intervention_id, artisan_id, role, is_primary, payment_status, paid_at, payment_updated_at, artisans ( prenom, nom, raison_sociale )",
        )
        .in("intervention_id", batch)

      if (error) {
        console.error("Error fetching artisan payments batch:", error)
        continue
      }

      for (const row of (data ?? []) as unknown as Array<
        Omit<ArtisanPaymentRow, "artisan_nom"> & {
          artisans: { prenom: string | null; nom: string | null; raison_sociale: string | null } | null
        }
      >) {
        const a = row.artisans
        const nom =
          [a?.prenom, a?.nom].filter(Boolean).join(" ").trim() || a?.raison_sociale || "Artisan"
        const liste = result.get(row.intervention_id) ?? []
        liste.push({
          intervention_id: row.intervention_id,
          artisan_id: row.artisan_id,
          role: row.role ?? null,
          is_primary: row.is_primary ?? null,
          payment_status: (row.payment_status ?? "not_applicable") as PaymentStatus,
          paid_at: row.paid_at ?? null,
          payment_updated_at: row.payment_updated_at ?? null,
          artisan_nom: nom,
        })
        result.set(row.intervention_id, liste)
      }
    }

    // L'artisan principal en tête : c'est l'ordre de la colonne « Artisan ».
    for (const liste of result.values()) {
      liste.sort((a, b) => Number(b.is_primary ?? false) - Number(a.is_primary ?? false))
    }
    return result
  },

  /**
   * Enregistre le statut de paiement d'un artisan sur une intervention.
   * Passe par la route Next (permission `write_interventions` vérifiée côté
   * serveur) : `authenticated` a un `UPDATE USING(true)` sur la table, la garde
   * ne peut donc pas venir de la base.
   */
  async setArtisanPayment(
    interventionId: string,
    artisanId: string,
    payload: { payment_status: PaymentStatus; paid_at?: string | null },
  ): Promise<{ ok: boolean; error?: string }> {
    const response = await fetch(`/api/interventions/${interventionId}/artisans/${artisanId}/payment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_status: payload.payment_status,
        paid_at: payload.paid_at ?? null,
      }),
    })
    const json = (await response.json().catch(() => null)) as { error?: string } | null
    if (!response.ok) return { ok: false, error: json?.error ?? "Enregistrement du paiement impossible" }
    return { ok: true }
  },

  /**
   * Décoche une intervention
   */
  async uncheck(interventionId: string): Promise<boolean> {
    const { error } = await supabase
      .from("intervention_compta_checks")
      .delete()
      .eq("intervention_id", interventionId)

    if (error) {
      console.error("Error removing compta check:", error)
      return false
    }
    return true
  },

}
