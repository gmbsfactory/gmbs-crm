import type { InterventionWithStatus } from "@/types/intervention"

type InterventionRecord = InterventionWithStatus & {
  intervention_artisans?: Array<{
    artisan_id?: string
    is_primary?: boolean
    role?: string | null
    artisans?: { prenom?: string | null; nom?: string | null } | null
  }>
}

export type { InterventionRecord }

export const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "—"
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(amount))
}

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
}

export const formatName = (first?: string | null, last?: string | null) => {
  const full = `${first ?? ""} ${last ?? ""}`.trim()
  return full.length ? full : "—"
}

export const formatClientName = (intervention: any) => {
  // Priorité aux données de facturation (owner/propriétaire)
  if (intervention?.nomPrenomFacturation) {
    return intervention.nomPrenomFacturation
  }
  const prenomFacturation = intervention?.prenomProprietaire ?? intervention?.prenom_proprietaire
  const nomFacturation = intervention?.nomProprietaire ?? intervention?.nom_proprietaire
  if (prenomFacturation || nomFacturation) {
    return formatName(prenomFacturation, nomFacturation)
  }
  // Fallback sur le client/tenant
  return formatName(intervention?.prenomClient ?? intervention?.prenom_client, intervention?.nomClient ?? intervention?.nom_client)
}

export const formatAddress = (intervention: any) => {
  const parts = [
    intervention?.adresse ?? "",
    [intervention?.code_postal ?? intervention?.codePostal ?? "", intervention?.ville ?? ""].filter(Boolean).join(" "),
  ].filter((part) => (part ?? "").toString().trim().length > 0)
  return parts.length ? parts.join(", ") : "—"
}

export const getMetierLabel = (intervention: any) => intervention?.metierLabel ?? intervention?.metier ?? "—"

export const getCostAmountByType = (intervention: InterventionRecord, type: "materiel" | "intervention" | "sst") => {
  const costs = Array.isArray((intervention as any).costs) ? (intervention as any).costs : []
  if (costs.length > 0) {
    return costs
      .filter((cost: any) => cost?.cost_type === type)
      .reduce((sum: number, cost: any) => sum + (Number(cost?.amount) || 0), 0)
  }
  if (type === "materiel") return (intervention as any).coutMateriel ?? null
  if (type === "intervention") return (intervention as any).coutIntervention ?? null
  if (type === "sst") return (intervention as any).coutSST ?? null
  return null
}

export const getPaymentInfo = (intervention: InterventionRecord, paymentType: string) => {
  const inter = intervention as any
  const payments = Array.isArray(intervention.payments) && intervention.payments.length > 0
    ? intervention.payments
    : Array.isArray(inter.intervention_payments)
      ? inter.intervention_payments
      : []
  if (!payments.length) return { amount: null, date: null }
  const filtered = payments.filter((payment: any) => payment?.payment_type === paymentType)
  if (!filtered.length) return { amount: null, date: null }
  const amount = filtered.reduce((sum: number, payment: any) => sum + (Number(payment?.amount) || 0), 0)
  const date = filtered.find((payment: any) => payment?.payment_date)?.payment_date ?? filtered[0]?.payment_date ?? null
  return { amount, date }
}

export const getArtisanName = (intervention: InterventionRecord) => {
  const artisans = Array.isArray(intervention.intervention_artisans) ? intervention.intervention_artisans : []
  const primary = artisans.find((artisan) => artisan?.is_primary) ?? artisans[0]
  const details = primary?.artisans
  return formatName(details?.prenom, details?.nom)
}
