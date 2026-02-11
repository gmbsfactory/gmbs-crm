import { describe, expect, it } from "vitest"
import { utilsApi } from "@/lib/api/v2/utilsApi"

describe("mapInterventionRecord - assigned user display", () => {
  it("prefers code_gestionnaire for attribueA and assignedUserCode", () => {
    const user = {
      id: "user-1",
      firstname: "Boujimal",
      lastname: "Badr",
      username: "badr",
      email: "badr@gmbs.fr",
      roles: ["admin"],
      token_version: 0,
      color: "#FF6B6B",
      code_gestionnaire: "B",
      status: "offline" as const,
      last_seen_at: null,
      created_at: null,
      updated_at: null,
    }

    const refs = {
      data: {} as unknown,
      fetchedAt: Date.now(),
      usersById: new Map([[user.id, user]]),
      agenciesById: new Map(),
      interventionStatusesById: new Map(),
      artisanStatusesById: new Map(),
      metiersById: new Map(),
    }

    const result = utilsApi.mapInterventionRecord(
      {
        id: "intervention-1",
        assigned_user_id: user.id,
        statut_id: null,
      },
      refs,
    )

    expect(result.attribueA).toBe("B")
    expect(result.assignedUserCode).toBe("B")
  })
})
