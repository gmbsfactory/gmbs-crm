import { describe, it } from "vitest"

// The compta exclusion API (exclude/restore) was removed when the
// "Supprimer" action on the comptabilité page was replaced by a
// status revert to INTER_EN_COURS. The dedicated exclusions table
// is kept in the database but no longer wired to the client.
describe.skip("comptaApi exclusions (removed)", () => {
  it("kept as a placeholder until the table is dropped", () => {})
})
