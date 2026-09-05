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
  exigerBaseLocaleSiDemande,
  isLocalSupabaseAvailable,
  isPsqlAvailable,
  readLocalSupabaseEnv,
  rest,
  runSql,
  signAuthenticatedToken,
  VERROU_SOCLE_SQL,
  type LocalSupabaseEnv,
} from "../helpers/local-supabase"

const LOCAL_DB_UP = isLocalSupabaseAvailable() && isPsqlAvailable()
// Correctif de revue (constat 10) : avec REQUIRE_LOCAL_SUPABASE=1, on échoue au lieu de sauter.
exigerBaseLocaleSiDemande(LOCAL_DB_UP, "la base Supabase locale et psql")

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

    it("should refuser d'appeler calculate_artisan_dossier_status (constats 1 et 13)", async () => {
      // La fonction est SECURITY DEFINER : elle lit artisan_attachments en contournant la RLS.
      // Grantée à anon (DEFAULT PRIVILEGES de 00001, rendus par le DROP + CREATE de 99078),
      // elle devenait un oracle non authentifié sur l'état documentaire de n'importe quel
      // artisan dont on devine l'UUID — elle renvoyait 200 « INCOMPLET ».
      const res = await rest(env, env.anonKey, "/rpc/calculate_artisan_dossier_status", {
        method: "POST",
        body: { artisan_uuid: "00000000-0000-4000-8000-000000000000" },
      })
      expect(res.status, res.raw).toBeGreaterThanOrEqual(400)
      expect(res.raw).not.toContain("COMPLET")
    })

    it("should ne rien renvoyer sur les tables voisines du montant dû (constat 17)", async () => {
      // Le REVOKE de 99078 sur intervention_artisans ne déplaçait la fuite que d'une table :
      // intervention_costs.amount (cost_type='sst') EST la valeur que price_accepted_amount
      // recopie. Corrigé par 99082 (RLS + policies + REVOKE, motif 99057).
      for (const table of ["intervention_costs", "intervention_attachments"]) {
        const res = await rest(env, env.anonKey, `/${table}?select=*&limit=5`)
        expectNoDataLeak(res.status, res.body, res.raw)
      }
    })

    it("should ne rien renvoyer sur les tables enrichies par 99078 (constat 21)", async () => {
      for (const table of ["artisans", "artisan_attachments", "artisan_reports"]) {
        const res = await rest(env, env.anonKey, `/${table}?select=*&limit=5`)
        expectNoDataLeak(res.status, res.body, res.raw)
      }
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

    it("should écrire sur des LIGNES RÉELLES d'intervention_artisans (constats 14 et 15)", () => {
      // CORRECTIF DE REVUE (constat 14). L'ancienne version PATCHait un id inexistant et
      // acceptait 200 ou 204. Or un UPDATE sur ZÉRO ligne renvoie 204 même sans policy
      // UPDATE : la RLS filtre au scan, il ne reste rien à écrire, aucune erreur n'est levée
      // (démontré en local : « UPDATE 0 » sur une table sans aucune policy UPDATE). Ce test
      // ne pouvait donc pas détecter le lockout 99057 qu'il prétendait garder.
      //
      // On exerce les trois verbes sur des lignes réellement créées, dans une transaction
      // ANNULÉE — la base locale est partagée (données de démo, autres équipes) et un artisan
      // créé ici ne pourrait pas être supprimé ensuite (FK d'artisan_audit_log).
      //
      // Le `sub` du jeton est celui d'un VRAI compte auth : c'est ce qui déclenche la chaîne
      // audit_intervention_artisan → resolve_actor_user_id → get_current_user_id, qui levait
      // 0A000 « UPDATE is not allowed in a non-volatile function » (constat 15, corrigé par
      // 99081). Avec un `sub` aléatoire, la chaîne s'arrête avant et le bug reste invisible.
      const res = runSql(
        env,
        `
        BEGIN;
        ${VERROU_SOCLE_SQL}
        INSERT INTO public.artisans (id, nom, prenom, is_active)
          VALUES ('33333333-3333-4333-8333-333333333333', 'SONDE-RLS', 'L0', true);
        INSERT INTO public.interventions (id, date)
          VALUES ('44444444-4444-4444-8444-444444444444', now());
        SELECT set_config('request.jwt.claims',
                 json_build_object(
                   'sub', COALESCE((SELECT id::text FROM auth.users ORDER BY created_at LIMIT 1),
                                   gen_random_uuid()::text),
                   'role', 'authenticated')::text, true) IS NOT NULL;
        SET LOCAL role authenticated;

        INSERT INTO public.intervention_artisans (intervention_id, artisan_id)
          VALUES ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333');
        SELECT 'INSERT_OK=' || count(*)::text FROM public.intervention_artisans
          WHERE intervention_id = '44444444-4444-4444-8444-444444444444';

        UPDATE public.intervention_artisans SET payment_status = 'awaiting_invoice'
          WHERE intervention_id = '44444444-4444-4444-8444-444444444444';
        SELECT 'UPDATE_OK=' || payment_status FROM public.intervention_artisans
          WHERE intervention_id = '44444444-4444-4444-8444-444444444444';

        DELETE FROM public.intervention_artisans
          WHERE intervention_id = '44444444-4444-4444-8444-444444444444';
        SELECT 'DELETE_OK=' || count(*)::text FROM public.intervention_artisans
          WHERE intervention_id = '44444444-4444-4444-8444-444444444444';
        ROLLBACK;
        `
      )
      expect(res.code, res.output).toBe(0)
      expect(res.output).toContain("INSERT_OK=1")
      expect(res.output).toContain("UPDATE_OK=awaiting_invoice")
      expect(res.output).toContain("DELETE_OK=0")
    })

    it("should renvoyer la valeur écrite sur une ligne existante (PATCH + return=representation)", async () => {
      // Complément REST du test précédent : la même écriture vue par PostgREST, sur une
      // ligne réelle des données de démo, avec restauration de la valeur d'origine.
      const avant = await rest<Array<{ id: string; price_refused_reason: string | null }>>(
        env,
        env.serviceRoleKey,
        "/intervention_artisans?select=id,price_refused_reason&limit=1"
      )
      expect(avant.status, avant.raw).toBe(200)
      const ligne = (avant.body as Array<{ id: string; price_refused_reason: string | null }>)[0]
      if (!ligne) return // base sans données de démo : le test psql ci-dessus fait foi

      const sonde = `sonde-rls-${Date.now()}`
      const patch = await rest<Array<{ price_refused_reason: string }>>(
        env,
        env.anonKey,
        `/intervention_artisans?id=eq.${ligne.id}`,
        {
          method: "PATCH",
          body: { price_refused_reason: sonde },
          token: token(),
          prefer: "return=representation",
        }
      )
      try {
        expect(patch.status, patch.raw).toBe(200)
        expect((patch.body as Array<{ price_refused_reason: string }>)[0]?.price_refused_reason).toBe(sonde)
      } finally {
        await rest(env, env.serviceRoleKey, `/intervention_artisans?id=eq.${ligne.id}`, {
          method: "PATCH",
          body: { price_refused_reason: ligne.price_refused_reason },
        })
      }
    })

    it("should lire intervention_costs et intervention_attachments (non-régression 99082)", async () => {
      // 99082 active la RLS sur ces deux tables : les policies authenticated doivent être là,
      // sinon on reproduit le lockout de l'avatar (RLS activée sans policy = deny-all).
      for (const table of ["intervention_costs", "intervention_attachments"]) {
        const res = await rest(env, env.anonKey, `/${table}?select=id&limit=1`, { token: token() })
        expect(res.status, `${table} : ${res.raw}`).toBe(200)
      }
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
