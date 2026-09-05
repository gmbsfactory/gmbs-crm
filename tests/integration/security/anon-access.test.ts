/**
 * Non-régression de sécurité du socle v2 (lot L0, spécification §4.6).
 *
 * Deux fuites déjà constatées sur ce projet motivent ce fichier :
 *   - `ALTER DEFAULT PRIVILEGES` (00001:732-747) grante ALL à `anon` sur toute table
 *     de `public` : sans REVOKE nominatif, `price_accepted_amount`, `paid_at` et le
 *     journal d'actions seraient lisibles sans compte ;
 *   - « RLS activée sans policy = deny-all » (incident de l'avatar artisan, 99057) :
 *     on vérifie donc AUSSI que `authenticated` lit toujours `intervention_artisans`.
 *
 * Les deux sens sont testés dans le même fichier, volontairement.
 */
import { describe, it, expect } from "vitest"
import {
  isLocalSupabaseAvailable,
  readLocalSupabaseEnv,
  rest,
  signAuthenticatedToken,
  type LocalSupabaseEnv,
} from "../helpers/local-supabase"

const LOCAL_DB_UP = isLocalSupabaseAvailable()

describe.skipIf(!LOCAL_DB_UP)("Accès anonyme aux tables du socle portail v2", () => {
  const env = readLocalSupabaseEnv() as LocalSupabaseEnv

  /** « 0 ligne ou erreur de permission » : les deux réponses sont acceptables (§4.6). */
  function expectNoDataLeak(status: number, body: unknown, raw: string) {
    if (status === 200) {
      expect(Array.isArray(body), raw).toBe(true)
      expect((body as unknown[]).length, `des lignes ont fuité : ${raw}`).toBe(0)
    } else {
      expect(status, raw).toBeGreaterThanOrEqual(400)
    }
  }

  describe("clé anon", () => {
    it("should ne rien renvoyer sur intervention_artisans", async () => {
      const res = await rest(env, env.anonKey, "/intervention_artisans?select=*&limit=5")
      expectNoDataLeak(res.status, res.body, res.raw)
    })

    it("should ne rien renvoyer sur les montants dus à chaque artisan", async () => {
      const res = await rest(
        env,
        env.anonKey,
        "/intervention_artisans?select=artisan_id,price_accepted_amount,payment_status,paid_at&limit=5"
      )
      expectNoDataLeak(res.status, res.body, res.raw)
    })

    it("should ne rien renvoyer sur artisan_portal_actions", async () => {
      const res = await rest(env, env.anonKey, "/artisan_portal_actions?select=*&limit=5")
      expectNoDataLeak(res.status, res.body, res.raw)
    })

    it("should refuser une écriture sur artisan_portal_actions", async () => {
      const res = await rest(env, env.anonKey, "/artisan_portal_actions", {
        method: "POST",
        body: {
          artisan_id: "00000000-0000-4000-8000-000000000000",
          action_type: "WORK_STARTED",
        },
      })
      expect(res.status, res.raw).toBeGreaterThanOrEqual(400)
    })
  })

  describe("rôle authenticated — non-régression du lockout 99057", () => {
    const token = () => signAuthenticatedToken(env)

    it("should lire intervention_artisans (RLS activée AVEC policy)", async () => {
      const res = await rest(env, env.anonKey, "/intervention_artisans?select=id&limit=1", {
        token: token(),
      })
      // Le point du test n'est pas le nombre de lignes (la base peut être vide) mais
      // l'absence d'erreur de permission : « RLS activée sans policy » renverrait 200 + []
      // sur un SELECT, mais casserait toute écriture. On vérifie donc les deux.
      expect(res.status, res.raw).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
    })

    it("should accepter une écriture sur intervention_artisans (policies INSERT/UPDATE/DELETE présentes)", async () => {
      const probe = await rest(env, env.anonKey, "/intervention_artisans?id=eq.00000000-0000-4000-8000-000000000000", {
        method: "PATCH",
        body: { role: "primary" },
        token: token(),
      })
      // Aucune ligne ne correspond : PostgREST répond 204. Une RLS sans policy UPDATE
      // répondrait 403 « new row violates row-level security policy ».
      expect([200, 204], probe.raw).toContain(probe.status)
    })

    it("should lire artisan_portal_actions", async () => {
      const res = await rest(env, env.anonKey, "/artisan_portal_actions?select=id&limit=1", {
        token: token(),
      })
      expect(res.status, res.raw).toBe(200)
    })

    it("should refuser l'INSERT dans artisan_portal_actions (journal en lecture seule)", async () => {
      const res = await rest(env, env.anonKey, "/artisan_portal_actions", {
        method: "POST",
        body: {
          artisan_id: "00000000-0000-4000-8000-000000000000",
          action_type: "WORK_STARTED",
        },
        token: token(),
      })
      expect(res.status, res.raw).toBeGreaterThanOrEqual(400)
    })

    it("should refuser l'UPDATE et le DELETE dans artisan_portal_actions", async () => {
      const update = await rest(env, env.anonKey, "/artisan_portal_actions?id=eq.00000000-0000-4000-8000-000000000000", {
        method: "PATCH",
        body: { payload: {} },
        token: token(),
      })
      expect(update.status, update.raw).toBeGreaterThanOrEqual(400)

      const remove = await rest(env, env.anonKey, "/artisan_portal_actions?id=eq.00000000-0000-4000-8000-000000000000", {
        method: "DELETE",
        token: token(),
      })
      expect(remove.status, remove.raw).toBeGreaterThanOrEqual(400)
    })
  })

  describe("rôle service_role — les routes portail continuent d'écrire", () => {
    it("should lire intervention_artisans et artisan_portal_actions", async () => {
      const links = await rest(env, env.serviceRoleKey, "/intervention_artisans?select=id&limit=1")
      expect(links.status, links.raw).toBe(200)

      const actions = await rest(env, env.serviceRoleKey, "/artisan_portal_actions?select=id&limit=1")
      expect(actions.status, actions.raw).toBe(200)
    })
  })
})
