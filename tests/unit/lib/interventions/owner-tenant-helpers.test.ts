import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock de la couche API : owner-tenant-helpers consomme ownersApi/tenantsApi.
vi.mock("@/lib/api", () => ({
  ownersApi: {
    update: vi.fn(async (id: string, updates: Record<string, unknown>) => ({ id, ...updates })),
    create: vi.fn(async (data: Record<string, unknown>) => ({ id: "new-owner-id", ...data })),
    searchByPhone: vi.fn(async () => []),
    findByNomFacturation: vi.fn(async () => []),
  },
  tenantsApi: {
    update: vi.fn(async (id: string, updates: Record<string, unknown>) => ({ id, ...updates })),
    create: vi.fn(async (data: Record<string, unknown>) => ({ id: "new-tenant-id", ...data })),
    searchByPhone: vi.fn(async () => []),
    searchByEmail: vi.fn(async () => []),
  },
}))

import { ownersApi, tenantsApi } from "@/lib/api"
import {
  resolveOwnerForSubmit,
  resolveTenantForSubmit,
} from "@/lib/interventions/owner-tenant-helpers"

const EXISTING_OWNER = "11111111-1111-1111-1111-111111111111"
const EXISTING_TENANT = "22222222-2222-2222-2222-222222222222"

describe("resolveOwnerForSubmit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("délie (null) quand la section facturation est entièrement vidée", async () => {
    const result = await resolveOwnerForSubmit({
      existingOwnerId: EXISTING_OWNER,
      nomPrenomFacturation: "",
      telephoneProprietaire: "",
      emailProprietaire: "",
    })

    expect(result).toBeNull()
    expect(ownersApi.update).not.toHaveBeenCalled()
    expect(ownersApi.create).not.toHaveBeenCalled()
  })

  it("traite une saisie composée uniquement d'espaces comme vide → null", async () => {
    const result = await resolveOwnerForSubmit({
      existingOwnerId: EXISTING_OWNER,
      nomPrenomFacturation: "   ",
    })

    expect(result).toBeNull()
    expect(ownersApi.update).not.toHaveBeenCalled()
  })

  it("met à jour EN PLACE le record lié (pas de création) et garde owner_id stable", async () => {
    const result = await resolveOwnerForSubmit({
      existingOwnerId: EXISTING_OWNER,
      nomPrenomFacturation: "  Dupont Jean  ",
      telephoneProprietaire: "0600000000",
      emailProprietaire: "jean@dupont.fr",
    })

    expect(result).toBe(EXISTING_OWNER)
    expect(ownersApi.update).toHaveBeenCalledWith(EXISTING_OWNER, {
      plain_nom_facturation: "Dupont Jean",
      telephone: "0600000000",
      email: "jean@dupont.fr",
    })
    expect(ownersApi.create).not.toHaveBeenCalled()
  })

  it("met un champ vidé à null sur le record lié (effacement granulaire)", async () => {
    const result = await resolveOwnerForSubmit({
      existingOwnerId: EXISTING_OWNER,
      nomPrenomFacturation: "Dupont Jean",
      telephoneProprietaire: "",
      emailProprietaire: "",
    })

    expect(result).toBe(EXISTING_OWNER)
    expect(ownersApi.update).toHaveBeenCalledWith(EXISTING_OWNER, {
      plain_nom_facturation: "Dupont Jean",
      telephone: null,
      email: null,
    })
  })

  it("crée (via findOrCreate) quand il n'y a pas de lien existant", async () => {
    const result = await resolveOwnerForSubmit({
      existingOwnerId: null,
      nomPrenomFacturation: "Nouveau Client",
    })

    expect(result).toBe("new-owner-id")
    expect(ownersApi.create).toHaveBeenCalled()
    expect(ownersApi.update).not.toHaveBeenCalled()
  })
})

describe("resolveTenantForSubmit", () => {
  beforeEach(() => vi.clearAllMocks())

  it("retourne null si le logement est vacant, même avec des champs saisis", async () => {
    const result = await resolveTenantForSubmit({
      existingTenantId: EXISTING_TENANT,
      isVacant: true,
      nomPrenomClient: "Locataire X",
      emailClient: "x@y.fr",
    })

    expect(result).toBeNull()
    expect(tenantsApi.update).not.toHaveBeenCalled()
  })

  it("délie (null) quand la section client est vidée", async () => {
    const result = await resolveTenantForSubmit({
      existingTenantId: EXISTING_TENANT,
      isVacant: false,
      nomPrenomClient: "",
      telephoneClient: "",
      emailClient: "",
    })

    expect(result).toBeNull()
    expect(tenantsApi.update).not.toHaveBeenCalled()
  })

  it("met à jour EN PLACE le client lié sans créer de doublon", async () => {
    const result = await resolveTenantForSubmit({
      existingTenantId: EXISTING_TENANT,
      isVacant: false,
      nomPrenomClient: "Martin Claire",
      telephoneClient: "0700000000",
      emailClient: "claire@martin.fr",
    })

    expect(result).toBe(EXISTING_TENANT)
    expect(tenantsApi.update).toHaveBeenCalledWith(EXISTING_TENANT, {
      plain_nom_client: "Martin Claire",
      telephone: "0700000000",
      email: "claire@martin.fr",
    })
    expect(tenantsApi.create).not.toHaveBeenCalled()
  })

  it("crée (via findOrCreate) quand il n'y a pas de client lié", async () => {
    const result = await resolveTenantForSubmit({
      existingTenantId: null,
      isVacant: false,
      nomPrenomClient: "Nouveau Locataire",
    })

    expect(result).toBe("new-tenant-id")
    expect(tenantsApi.create).toHaveBeenCalled()
    expect(tenantsApi.update).not.toHaveBeenCalled()
  })
})
