import { z } from "zod"

export const InterventionStatusValues = [
  "DEMANDE",
  "DEVIS_ENVOYE",
  "VISITE_TECHNIQUE",
  "REFUSE",
  "ANNULE",
  "STAND_BY",
  "ACCEPTE",
  "INTER_EN_COURS",
  "INTER_TERMINEE",
  "SAV",
  "ATT_ACOMPTE",
] as const

export type InterventionStatusValue = (typeof InterventionStatusValues)[number]

export const InterventionStatusEnum = z.enum(InterventionStatusValues)

export const InterventionBaseSchema = z.object({
  name: z.string().min(1, "Le nom de l'intervention est obligatoire"),
  address: z.string().min(1, "L'adresse est obligatoire"),
  context: z.string().min(1, "Merci de renseigner le contexte"),
  agency: z.string().optional(),
  consigne: z.string().optional(),
  invoice2goId: z.string().trim().min(1).optional(),
  dueAt: z.coerce.date().optional(),
  artisanId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional(),
  status: InterventionStatusEnum.optional(),
})

export const CreateInterventionSchema = InterventionBaseSchema.extend({
  status: InterventionStatusEnum.default("DEMANDE"),
})

export const UpdateInterventionSchema = InterventionBaseSchema.partial()

export const DuplicateCheckSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  agency: z.string().optional(),
})

export const InvoiceLookupSchema = z.object({
  invoice2goId: z.string().min(1),
})

export type CreateInterventionInput = z.infer<typeof CreateInterventionSchema>
export type UpdateInterventionInput = z.infer<typeof UpdateInterventionSchema>
export type DuplicateCheckInput = z.infer<typeof DuplicateCheckSchema>
export type InvoiceLookupInput = z.infer<typeof InvoiceLookupSchema>

export type InterventionDocumentDTO = {
  id: string
  interventionId: string
  name: string
  mimeType: string
  storagePath: string
  publicUrl: string | null
  sizeBytes: number | null
  metadata: Record<string, unknown> | null
  createdAt: string | Date
}

export type InterventionDTO = {
  id: string
  date: string | Date
  createdAt: string | Date
  updatedAt: string | Date
  name: string
  agency: string | null
  address: string
  context: string
  consigne: string | null
  status: InterventionStatusValue
  statusChangedAt: string | Date
  dueAt: string | Date | null
  invoice2goId: string | null
  artisanId: string | null
  managerId: string | null
  isValidated: boolean
}

export type InterventionWithDocuments = InterventionDTO & {
  documents: InterventionDocumentDTO[]
}
