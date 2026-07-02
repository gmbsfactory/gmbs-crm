import { describe, expect, it } from "vitest"
import {
  canViewBilan,
  DEFAULT_TEMP_HOURS,
  EMPTY_VISIBILITY,
  isConfigActive,
  isDevUser,
  sanitizeVisibilityRequest,
  type PageVisibilityConfig,
} from "@/lib/bilan-s1/visibility-core"

const NOW = Date.parse("2026-07-02T10:00:00Z")
const USER_ID = "11111111-2222-3333-4444-555555555555"

const config = (overrides: Partial<PageVisibilityConfig>): PageVisibilityConfig => ({
  ...EMPTY_VISIBILITY,
  ...overrides,
})

describe("bilan-s1/visibility-core", () => {
  describe("isDevUser", () => {
    it("should detect the dev role case-insensitively", () => {
      expect(isDevUser(["gestionnaire", "DEV "])).toBe(true)
      expect(isDevUser(["admin"])).toBe(false)
    })
  })

  describe("isConfigActive", () => {
    it("should be active when expiresAt is null (permanent)", () => {
      expect(isConfigActive(config({}), NOW)).toBe(true)
    })

    it("should be active before expiry and inactive after", () => {
      const c = config({ expiresAt: "2026-07-02T12:00:00Z" })
      expect(isConfigActive(c, NOW)).toBe(true)
      expect(isConfigActive(c, Date.parse("2026-07-02T12:00:01Z"))).toBe(false)
    })
  })

  describe("canViewBilan", () => {
    it("should always allow devs, even with an expired config", () => {
      const c = config({ expiresAt: "2026-07-01T00:00:00Z" })
      expect(canViewBilan({ id: USER_ID, roles: ["dev"] }, c, NOW)).toBe(true)
    })

    it("should deny non-devs on an empty config (dev-only par défaut)", () => {
      expect(canViewBilan({ id: USER_ID, roles: ["gestionnaire"] }, config({}), NOW)).toBe(false)
    })

    it("should allow a user whose role is granted", () => {
      const c = config({ allowedRoles: ["gestionnaire"] })
      expect(canViewBilan({ id: USER_ID, roles: ["Gestionnaire"] }, c, NOW)).toBe(true)
      expect(canViewBilan({ id: USER_ID, roles: ["manager"] }, c, NOW)).toBe(false)
    })

    it("should allow a user granted individually", () => {
      const c = config({ allowedUserIds: [USER_ID] })
      expect(canViewBilan({ id: USER_ID, roles: ["gestionnaire"] }, c, NOW)).toBe(true)
      expect(canViewBilan({ id: "99999999-8888-7777-6666-555555555555", roles: ["gestionnaire"] }, c, NOW)).toBe(false)
    })

    it("should revoke non-dev access once the config expires", () => {
      const c = config({ allowedRoles: ["gestionnaire"], expiresAt: "2026-07-02T09:00:00Z" })
      expect(canViewBilan({ id: USER_ID, roles: ["gestionnaire"] }, c, NOW)).toBe(false)
    })
  })

  describe("sanitizeVisibilityRequest", () => {
    it("should accept known roles, dedupe, and drop the implicit dev role", () => {
      const res = sanitizeVisibilityRequest({ roles: ["admin", "ADMIN", "dev", "gestionnaire"], userIds: [] }, NOW)
      expect(res).toEqual({ ok: true, allowedRoles: ["admin", "gestionnaire"], allowedUserIds: [], expiresAt: null })
    })

    it("should reject unknown roles and invalid user ids", () => {
      expect(sanitizeVisibilityRequest({ roles: ["superuser"] }, NOW)).toMatchObject({ ok: false })
      expect(sanitizeVisibilityRequest({ userIds: ["pas-un-uuid"] }, NOW)).toMatchObject({ ok: false })
    })

    it("should compute expiresAt from hours when temporary (default 4h)", () => {
      const res = sanitizeVisibilityRequest({ temporary: true }, NOW)
      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.expiresAt).toBe(new Date(NOW + DEFAULT_TEMP_HOURS * 3_600_000).toISOString())
      }
    })

    it("should bound the temporary duration (1..168h)", () => {
      expect(sanitizeVisibilityRequest({ temporary: true, hours: 0 }, NOW)).toMatchObject({ ok: false })
      expect(sanitizeVisibilityRequest({ temporary: true, hours: 200 }, NOW)).toMatchObject({ ok: false })
      const ok = sanitizeVisibilityRequest({ temporary: true, hours: 48 }, NOW)
      expect(ok.ok).toBe(true)
    })

    it("should ignore hours when not temporary (permanent)", () => {
      const res = sanitizeVisibilityRequest({ temporary: false, hours: 12 }, NOW)
      expect(res).toMatchObject({ ok: true, expiresAt: null })
    })
  })
})
