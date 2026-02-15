import { describe, it, expect } from "vitest"
import { mapRowToIntervention, buildInsertPayload, buildUpdatePayload } from "./mappers"

describe("Intervention Mappers", () => {
    describe("mapRowToIntervention", () => {
        it("should correctly map geocoding fields from database row to DTO", () => {
            const row = {
                id: "123",
                statut: "DEMANDE",
                adresse: "123 Manual St",
                adresse_complete: "123 Geolocalized St, 75001 Paris",
                latitude: 48.8566,
                longitude: 2.3522,
                created_at: "2023-01-01T00:00:00Z",
                updated_at: "2023-01-01T00:00:00Z",
            }

            const dto = mapRowToIntervention(row)

            expect(dto.address).toBe("123 Manual St")
            expect(dto.geolocalizedAddress).toBe("123 Geolocalized St, 75001 Paris")
            expect(dto.latitude).toBe(48.8566)
            expect(dto.longitude).toBe(2.3522)
        })

        it("should handle null geocoding fields", () => {
            const row = {
                id: "123",
                statut: "DEMANDE",
                adresse: "123 Manual St",
                adresse_complete: null,
                latitude: null,
                longitude: null,
            }

            const dto = mapRowToIntervention(row)

            expect(dto.geolocalizedAddress).toBeNull()
            expect(dto.latitude).toBeNull()
            expect(dto.longitude).toBeNull()
        })
    })

    describe("buildInsertPayload", () => {
        it("should correctly map geocoding fields to insert payload", () => {
            const input = {
                name: "Test Intervention",
                address: "123 Manual St",
                geolocalizedAddress: "123 Geolocalized St, 75001 Paris",
                latitude: 48.8566,
                longitude: 2.3522,
                status: "POTENTIEL" as const,
                context: "Test context",
                agency: "Test Agency",
                metier: "Test Metier",
            }

            const payload = buildInsertPayload(input)

            expect(payload.adresse).toBe("123 Manual St")
            expect(payload.adresse_complete).toBe("123 Geolocalized St, 75001 Paris")
            expect(payload.latitude).toBe(48.8566)
            expect(payload.longitude).toBe(2.3522)
        })
    })

    describe("buildUpdatePayload", () => {
        it("should correctly map geocoding fields to update payload", () => {
            const input = {
                address: "Updated Manual St",
                geolocalizedAddress: "Updated Geolocalized St, 75001 Paris",
                latitude: 48.9,
                longitude: 2.4,
            }

            const payload = buildUpdatePayload(input)

            expect(payload.adresse).toBe("Updated Manual St")
            expect(payload.adresse_complete).toBe("Updated Geolocalized St, 75001 Paris")
            expect(payload.latitude).toBe(48.9)
            expect(payload.longitude).toBe(2.4)
        })

        it("should not include geocoding fields if they are undefined in input", () => {
            const input = {
                address: "Just updating address",
            }

            const payload = buildUpdatePayload(input)

            expect(payload.adresse).toBe("Just updating address")
            expect(payload.adresse_complete).toBeUndefined()
            expect(payload.latitude).toBeUndefined()
            expect(payload.longitude).toBeUndefined()
        })
    })
})
