/**
 * 99083_email_attachments_intervention.sql — pièces jointes de l'e-mail (lot L7).
 *
 * Ce que la migration promet et que la route d'envoi tient pour acquis :
 *   - `intervention_attachments.sent_to_artisan_at` / `sent_to_artisan_email_log_id` existent,
 *     avec une clé étrangère `ON DELETE SET NULL` vers `email_logs` — supprimer un journal
 *     d'envoi ne doit jamais supprimer la pièce ;
 *   - l'index partiel ne couvre que les pièces réellement envoyées ;
 *   - `email_logs.attachment_ids` remplace le compteur aveugle `attachments_count` ;
 *   - le premier envoi fait foi : le filtre `sent_to_artisan_at IS NULL` de la route ne
 *     réécrit pas une date déjà posée (WAL borné sur une table en REPLICA IDENTITY FULL) ;
 *   - `anon` n'a plus aucun privilège sur `email_logs` — TRUNCATE et TRIGGER ne passent par
 *     aucune policy RLS, c'est le motif de 99082.
 *
 * Toutes les écritures se font dans une transaction annulée (`BEGIN … ROLLBACK`) : la base
 * locale porte les données de démo.
 */
import { describe, it, expect } from "vitest"
import {
  exigerBaseLocaleSiDemande,
  isLocalSupabaseAvailable,
  isPsqlAvailable,
  readLocalSupabaseEnv,
  rest,
  runMigration,
  runSql,
  VERROU_SOCLE_SQL,
  type LocalSupabaseEnv,
} from "../helpers/local-supabase"

const LOCAL_DB_UP = isLocalSupabaseAvailable() && isPsqlAvailable()
exigerBaseLocaleSiDemande(LOCAL_DB_UP, "la base Supabase locale et psql")

const MIGRATION = "supabase/migrations/99083_email_attachments_intervention.sql"
const INTERVENTION = "'33333333-3333-4333-8333-333333333333'"

const FIXTURE = `
BEGIN;
${VERROU_SOCLE_SQL}
INSERT INTO public.interventions (id, date) VALUES (${INTERVENTION}, now());
INSERT INTO public.intervention_attachments (id, intervention_id, kind, url, filename)
  VALUES ('44444444-4444-4444-8444-444444444444', ${INTERVENTION}, 'devis',
          'http://127.0.0.1:54321/storage/v1/object/public/documents/intervention/x/devis.pdf',
          'devis.pdf');
INSERT INTO public.email_logs (id, intervention_id, recipient_email, subject, status)
  VALUES ('55555555-5555-4555-8555-555555555555', ${INTERVENTION},
          'karim@example.invalid', 'Demande de devis', 'sent');
`

describe.skipIf(!LOCAL_DB_UP)("99083 — pièces jointes de l'e-mail", () => {
  const env = readLocalSupabaseEnv() as LocalSupabaseEnv

  describe("structure", () => {
    it("should exposer les deux colonnes de marque d'envoi", () => {
      const result = runSql(
        env,
        `SELECT column_name || ':' || data_type
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'intervention_attachments'
            AND column_name IN ('sent_to_artisan_at','sent_to_artisan_email_log_id')
          ORDER BY column_name;`,
      )
      expect(result.code).toBe(0)
      expect(result.output.split("\n")).toEqual([
        "sent_to_artisan_at:timestamp with time zone",
        "sent_to_artisan_email_log_id:uuid",
      ])
    })

    it("should ajouter attachment_ids à email_logs, non nul et vide par défaut", () => {
      const result = runSql(
        env,
        `SELECT data_type || '|' || is_nullable || '|' || coalesce(column_default,'')
           FROM information_schema.columns
          WHERE table_schema='public' AND table_name='email_logs' AND column_name='attachment_ids';`,
      )
      expect(result.output).toContain("ARRAY|NO|")
      expect(result.output).toContain("'{}'::uuid[]")
    })

    it("should indexer partiellement, uniquement les pièces envoyées", () => {
      const result = runSql(
        env,
        `SELECT indexdef FROM pg_indexes
          WHERE schemaname='public' AND indexname='idx_intervention_attachments_sent_to_artisan';`,
      )
      expect(result.output).toContain("WHERE (sent_to_artisan_at IS NOT NULL)")
    })

    it("should relier le journal d'envoi en ON DELETE SET NULL : supprimer un e-mail ne supprime pas la pièce", () => {
      const result = runSql(
        env,
        `SELECT confdeltype FROM pg_constraint
          WHERE conname='intervention_attachments_sent_email_log_fkey';`,
      )
      expect(result.output).toBe("n") // 'n' = SET NULL
    })
  })

  describe("comportement", () => {
    it("should conserver la pièce quand le journal d'envoi est supprimé", () => {
      const result = runSql(
        env,
        `${FIXTURE}
         UPDATE public.intervention_attachments
            SET sent_to_artisan_at = now(),
                sent_to_artisan_email_log_id = '55555555-5555-4555-8555-555555555555'
          WHERE id = '44444444-4444-4444-8444-444444444444';
         DELETE FROM public.email_logs WHERE id = '55555555-5555-4555-8555-555555555555';
         SELECT 'PIECES=' || count(*)
             || ' LIEN=' || count(sent_to_artisan_email_log_id)
             || ' DATE=' || count(sent_to_artisan_at)
           FROM public.intervention_attachments
          WHERE id = '44444444-4444-4444-8444-444444444444';
         ROLLBACK;`,
      )
      expect(result.code, result.output).toBe(0)
      // La pièce est là, la date d'envoi aussi, seul le lien vers le journal est vidé.
      expect(result.output).toContain("PIECES=1 LIEN=0 DATE=1")
    })

    it("should ne pas réécrire une date d'envoi déjà posée (le premier envoi fait foi)", () => {
      const result = runSql(
        env,
        `${FIXTURE}
         UPDATE public.intervention_attachments
            SET sent_to_artisan_at = '2026-09-01T08:00:00Z'
          WHERE id = '44444444-4444-4444-8444-444444444444';
         -- Le renvoi rejoue exactement le filtre de markAttachmentsAsSentToArtisan.
         UPDATE public.intervention_attachments
            SET sent_to_artisan_at = '2026-09-20T08:00:00Z'
          WHERE id = '44444444-4444-4444-8444-444444444444'
            AND sent_to_artisan_at IS NULL;
         SELECT 'ENVOYEE_LE=' || to_char(sent_to_artisan_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
           FROM public.intervention_attachments
          WHERE id = '44444444-4444-4444-8444-444444444444';
         ROLLBACK;`,
      )
      expect(result.code, result.output).toBe(0)
      expect(result.output).toContain("ENVOYEE_LE=2026-09-01")
    })

    it("should mémoriser quelles pièces sont parties dans chaque e-mail", () => {
      const result = runSql(
        env,
        `${FIXTURE}
         UPDATE public.email_logs
            SET attachment_ids = ARRAY['44444444-4444-4444-8444-444444444444']::uuid[]
          WHERE id = '55555555-5555-4555-8555-555555555555';
         SELECT 'PIECES_JOURNALISEES=' || array_length(attachment_ids, 1)
           FROM public.email_logs WHERE id = '55555555-5555-4555-8555-555555555555';
         ROLLBACK;`,
      )
      expect(result.code, result.output).toBe(0)
      expect(result.output).toContain("PIECES_JOURNALISEES=1")
    })
  })

  describe("sécurité", () => {
    it("should retirer tout privilège d'anon sur email_logs (TRUNCATE ne passe par aucune policy)", () => {
      const result = runSql(
        env,
        `SELECT coalesce(string_agg(privilege_type, ',' ORDER BY privilege_type), 'aucun')
           FROM information_schema.role_table_grants
          WHERE table_schema='public' AND table_name='email_logs' AND grantee='anon';`,
      )
      expect(result.output).toBe("aucun")
    })

    it("should laisser authenticated lire et écrire email_logs (non-régression du lockout 99057)", () => {
      const result = runSql(
        env,
        `SELECT string_agg(privilege_type, ',' ORDER BY privilege_type)
           FROM information_schema.role_table_grants
          WHERE table_schema='public' AND table_name='email_logs' AND grantee='authenticated';`,
      )
      expect(result.output).toBe("DELETE,INSERT,SELECT,UPDATE")
    })

    it("should ne rien laisser lire à la clé anon sur email_logs", async () => {
      const response = await rest(env, env.anonKey, "/email_logs?select=id&limit=1")
      // 401/403/404 (privilège retiré) ou 200 avec 0 ligne (RLS) : jamais de contenu.
      if (response.status === 200) {
        expect(response.body).toEqual([])
      } else {
        expect(response.status).toBeGreaterThanOrEqual(400)
      }
    })
  })

  describe("idempotence", () => {
    it("should se rejouer sans erreur", () => {
      const first = runMigration(env, MIGRATION)
      expect(first.code, first.output).toBe(0)
      const second = runMigration(env, MIGRATION)
      expect(second.code, second.output).toBe(0)
    })
  })
})
