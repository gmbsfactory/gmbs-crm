import { describe, it, expect } from "vitest"

import {
  NULLABLE_UUID_FIELDS,
  normalizeNullableUuidFields,
} from "@/lib/api/interventions/crud/normalize-uuid-fields"
import type { UpdateInterventionData } from "@/lib/api/common/types"

const VALID_UUID = "9af00b88-2fc7-4bf0-bfb9-0cd52cd473f0"

describe("normalizeNullableUuidFields", () => {
  it("should convert an empty assigned_user_id (intervention sans gestionnaire) to null", () => {
    // Reproduit le bug 22P02 : un formulaire sans gestionnaire assigné transmet "".
    const result = normalizeNullableUuidFields({ assigned_user_id: "" })

    expect(result.assigned_user_id).toBeNull()
  })

  it("should convert whitespace-only UUID strings to null", () => {
    const result = normalizeNullableUuidFields({ owner_id: "   " })

    expect(result.owner_id).toBeNull()
  })

  it("should convert empty strings to null for every nullable UUID field", () => {
    const input = Object.fromEntries(
      NULLABLE_UUID_FIELDS.map((field) => [field, ""]),
    ) as UpdateInterventionData

    const result = normalizeNullableUuidFields(input)

    for (const field of NULLABLE_UUID_FIELDS) {
      expect(result[field]).toBeNull()
    }
  })

  it("should preserve a valid UUID untouched", () => {
    const result = normalizeNullableUuidFields({ assigned_user_id: VALID_UUID })

    expect(result.assigned_user_id).toBe(VALID_UUID)
  })

  it("should leave explicit null values as null", () => {
    const result = normalizeNullableUuidFields({ tenant_id: null })

    expect(result.tenant_id).toBeNull()
  })

  it("should not introduce keys that were absent from the payload", () => {
    const result = normalizeNullableUuidFields({ adresse: "12 rue de Paris" })

    expect("assigned_user_id" in result).toBe(false)
    expect(result.adresse).toBe("12 rue de Paris")
  })

  it("should not mutate the original payload", () => {
    const input: UpdateInterventionData = { assigned_user_id: "" }

    const result = normalizeNullableUuidFields(input)

    expect(input.assigned_user_id).toBe("")
    expect(result).not.toBe(input)
  })

  it("should not touch non-nullable id fields like statut_id (guarded upstream)", () => {
    // statut_id est NOT NULL en base : on ne le force pas à null pour éviter une
    // violation de contrainte ; il est déjà neutralisé en amont via `|| undefined`.
    const result = normalizeNullableUuidFields({
      statut_id: "" as unknown as string,
    })

    expect(result.statut_id).toBe("")
  })
})
