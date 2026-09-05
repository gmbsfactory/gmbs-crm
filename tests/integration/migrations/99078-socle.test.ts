/**
 * 99078_portal_v2_socle.sql — socle base de données de la vision v2 (lot L0).
 *
 * Ces tests parlent à la base Supabase **locale** et se désactivent d'eux-mêmes
 * quand elle est arrêtée. Ils vérifient ce que la migration promet et ce que les
 * lots suivants tiendront pour acquis :
 *   - la migration est rejouable (idempotence réelle, pas déclarée) ;
 *   - `calculate_artisan_dossier_status` ne compte que les pièces validées, sans
 *     faire basculer les dossiers historiques (`review_status` NULL ou 'approved') ;
 *   - `pieces_a_verifier` suit l'INSERT, l'UPDATE de `review_status` et le DELETE ;
 *   - `dossier_validated_at` n'est posée qu'une fois ;
 *   - `superseded` est accepté et il n'y a jamais deux rapports `submitted` par couple.
 *
 * **Toutes les écritures se font dans une transaction annulée** (`BEGIN … ROLLBACK`).
 * C'est indispensable : la base locale porte les données de démo, et un artisan créé
 * ici ne pourrait pas être supprimé ensuite (le trigger d'audit d'`artisans` insère
 * dans `artisan_audit_log`, dont la clé étrangère bloque la suppression).
 */
import { describe, it, expect } from "vitest"
import {
  isLocalSupabaseAvailable,
  isPsqlAvailable,
  readLocalSupabaseEnv,
  rest,
  runMigration,
  runSql,
  type LocalSupabaseEnv,
} from "../helpers/local-supabase"

const LOCAL_DB_UP = isLocalSupabaseAvailable() && isPsqlAvailable()

const ARTISAN = "'11111111-1111-4111-8111-111111111111'"
const INTERVENTION = "'22222222-2222-4222-8222-222222222222'"

/** Ouvre la transaction et crée l'artisan (plus l'intervention) de travail. */
const FIXTURE = `
BEGIN;
INSERT INTO public.artisans (id, nom, prenom, is_active)
  VALUES (${ARTISAN}, 'L0-TEST', 'Socle', true);
INSERT INTO public.interventions (id, date) VALUES (${INTERVENTION}, now());
`

/** Dépose une pièce du dossier avec le `review_status` voulu (NULL = historique). */
function piece(kind: string, reviewStatus: string | null): string {
  const status = reviewStatus === null ? "NULL" : `'${reviewStatus}'`
  return `INSERT INTO public.artisan_attachments (artisan_id, kind, url, filename, review_status)
          VALUES (${ARTISAN}, '${kind}', 'https://exemple.test/${kind}.pdf', '${kind}.pdf', ${status});`
}

const REQUIRED_KINDS = ["kbis", "assurance", "cni_recto_verso", "iban", "decharge_partenariat"]

/** Toutes les pièces requises, avec le même verdict. */
function toutesLesPieces(reviewStatus: string | null): string {
  return REQUIRED_KINDS.map((kind) => piece(kind, reviewStatus)).join("\n")
}

/** Émet une ligne « CLE=valeur » lisible dans la sortie psql. */
function marqueur(cle: string, expression: string): string {
  return `SELECT '${cle}=' || COALESCE((${expression})::text, 'NULL');`
}

describe.skipIf(!LOCAL_DB_UP)("99078_portal_v2_socle", () => {
  const env = readLocalSupabaseEnv() as LocalSupabaseEnv

  /** Joue un script dans une transaction annulée et rend la sortie brute. */
  function scenario(corps: string): string {
    const res = runSql(env, `${FIXTURE}\n${corps}\nROLLBACK;`)
    expect(res.code, res.output).toBe(0)
    return res.output
  }

  const statutDossier = marqueur("STATUT", `SELECT public.calculate_artisan_dossier_status(${ARTISAN})`)
  const compteurs = marqueur(
    "COMPTEURS",
    `SELECT pieces_a_verifier || '|' || COALESCE(statut_dossier, 'NULL') FROM public.artisans WHERE id = ${ARTISAN}`
  )

  describe("idempotence", () => {
    it(
      "should rejouer 99078 puis 99079 deux fois de suite sans erreur",
      () => {
        for (const migration of [
          "supabase/migrations/99078_portal_v2_socle.sql",
          "supabase/migrations/99079_artisan_portal_actions.sql",
        ]) {
          const premier = runMigration(env, migration)
          expect(premier.code, premier.output).toBe(0)
          const second = runMigration(env, migration)
          expect(second.code, second.output).toBe(0)
        }
      },
      180_000
    )
  })

  describe("calculate_artisan_dossier_status", () => {
    it("should retourner INCOMPLET sans aucune pièce", () => {
      expect(scenario(statutDossier)).toContain("STATUT=INCOMPLET")
    })

    it("should compter les pièces historiques dont review_status vaut NULL (non-régression)", () => {
      // Arrange : un artisan « COMPLET » d'avant la mise en service du portail.
      // Assert : le COALESCE doit le laisser COMPLET. Écrit « IN ('approved', NULL) »,
      // il basculerait — l'inverse exact de la non-régression voulue.
      expect(scenario(`${toutesLesPieces(null)}\n${statutDossier}`)).toContain("STATUT=COMPLET")
    })

    it("should compter les pièces approved (non-régression du DEFAULT de 99076)", () => {
      expect(scenario(`${toutesLesPieces("approved")}\n${statutDossier}`)).toContain("STATUT=COMPLET")
    })

    it("should ignorer une pièce pending : un dépôt portail ne rend pas le dossier COMPLET", () => {
      const corps = [
        ...REQUIRED_KINDS.slice(0, 4).map((kind) => piece(kind, "approved")),
        piece(REQUIRED_KINDS[4], "pending"),
        statutDossier,
      ].join("\n")
      expect(scenario(corps)).toContain("STATUT=À compléter")
    })

    it("should ignorer une pièce rejected", () => {
      const corps = [
        ...REQUIRED_KINDS.slice(0, 4).map((kind) => piece(kind, "approved")),
        piece(REQUIRED_KINDS[4], "rejected"),
        statutDossier,
      ].join("\n")
      expect(scenario(corps)).toContain("STATUT=À compléter")
    })

    it("should ignorer les kinds hors liste requise", () => {
      expect(scenario(`${piece("autre", "approved")}\n${statutDossier}`)).toContain("STATUT=INCOMPLET")
    })
  })

  describe("trg_artisan_dossier_sync", () => {
    it("should incrémenter pieces_a_verifier à l'INSERT d'une pièce pending", () => {
      expect(scenario(`${piece("kbis", "pending")}\n${compteurs}`)).toContain("COMPTEURS=1|INCOMPLET")
    })

    it("should décrémenter pieces_a_verifier quand la pièce est validée (UPDATE)", () => {
      // C'est le cas que les deux triggers de 00008 ne voyaient pas : ils
      // n'écoutaient que INSERT et DELETE, jamais l'UPDATE de review_status.
      const corps = `
        ${piece("kbis", "pending")}
        ${marqueur("AVANT", `SELECT pieces_a_verifier FROM public.artisans WHERE id = ${ARTISAN}`)}
        UPDATE public.artisan_attachments
           SET review_status = 'approved', reviewed_at = now()
         WHERE artisan_id = ${ARTISAN} AND kind = 'kbis';
        ${compteurs}
      `
      const sortie = scenario(corps)
      expect(sortie).toContain("AVANT=1")
      expect(sortie).toContain("COMPTEURS=0|À compléter")
    })

    it("should décrémenter pieces_a_verifier au DELETE d'une pièce pending", () => {
      const corps = `
        ${piece("kbis", "pending")}
        DELETE FROM public.artisan_attachments WHERE artisan_id = ${ARTISAN} AND kind = 'kbis';
        ${compteurs}
      `
      expect(scenario(corps)).toContain("COMPTEURS=0|INCOMPLET")
    })

    it("should poser dossier_validated_at au premier passage à COMPLET, une seule fois", () => {
      const corps = `
        ${REQUIRED_KINDS.slice(0, 4).map((kind) => piece(kind, "approved")).join("\n")}
        ${piece(REQUIRED_KINDS[4], "pending")}
        ${marqueur("AVANT", `SELECT dossier_validated_at FROM public.artisans WHERE id = ${ARTISAN}`)}
        UPDATE public.artisan_attachments SET review_status = 'approved'
         WHERE artisan_id = ${ARTISAN} AND kind = '${REQUIRED_KINDS[4]}';
        ${marqueur("APRES", `SELECT dossier_validated_at IS NOT NULL FROM public.artisans WHERE id = ${ARTISAN}`)}
        ${marqueur("DATE1", `SELECT dossier_validated_at FROM public.artisans WHERE id = ${ARTISAN}`)}
        ${piece("autre", "approved")}
        ${marqueur("DATE2", `SELECT dossier_validated_at FROM public.artisans WHERE id = ${ARTISAN}`)}
      `
      const sortie = scenario(corps).split("\n")
      expect(sortie).toContain("AVANT=NULL")
      expect(sortie).toContain("APRES=true")

      // Une pièce déposée après coup ne redate pas la validation du dossier.
      const date1 = sortie.find((l) => l.startsWith("DATE1="))
      const date2 = sortie.find((l) => l.startsWith("DATE2="))
      expect(date1).toBeDefined()
      expect(date2?.slice("DATE2=".length)).toBe(date1?.slice("DATE1=".length))
    })

    it("should effacer dossier_validated_at si le dossier redevient incomplet", () => {
      const corps = `
        ${toutesLesPieces("approved")}
        ${marqueur("COMPLET", `SELECT dossier_validated_at IS NOT NULL FROM public.artisans WHERE id = ${ARTISAN}`)}
        UPDATE public.artisan_attachments SET review_status = 'rejected', review_comment = 'Illisible'
         WHERE artisan_id = ${ARTISAN} AND kind = 'kbis';
        ${compteurs}
        ${marqueur("DATE", `SELECT dossier_validated_at FROM public.artisans WHERE id = ${ARTISAN}`)}
      `
      const sortie = scenario(corps)
      expect(sortie).toContain("COMPLET=true")
      expect(sortie).toContain("COMPTEURS=0|À compléter")
      expect(sortie).toContain("DATE=NULL")
    })

    it("should n'écrire sur artisans que si quelque chose change (garde anti-WAL)", () => {
      // Deux pièces 'approved' d'affilée : le statut ne bouge pas, le compteur non plus.
      // xmin doit rester identique — sinon chaque dépôt coûterait un événement realtime.
      const corps = `
        ${piece("kbis", "approved")}
        ${marqueur("XMIN1", `SELECT xmin FROM public.artisans WHERE id = ${ARTISAN}`)}
        ${piece("assurance", "approved")}
        ${marqueur("XMIN2", `SELECT xmin FROM public.artisans WHERE id = ${ARTISAN}`)}
      `
      const lignes = scenario(corps).split("\n")
      const xmin1 = lignes.find((l) => l.startsWith("XMIN1="))?.slice("XMIN1=".length)
      const xmin2 = lignes.find((l) => l.startsWith("XMIN2="))?.slice("XMIN2=".length)
      expect(xmin1).toBeDefined()
      expect(xmin2).toBe(xmin1)
    })
  })

  describe("artisan_reports", () => {
    it("should accepter le statut superseded, refusé par le CHECK de 99076", () => {
      const corps = `
        INSERT INTO public.artisan_reports (intervention_id, artisan_id, status, version)
        VALUES (${INTERVENTION}, ${ARTISAN}, 'superseded', 1);
        ${marqueur(
          "NB",
          `SELECT count(*) FROM public.artisan_reports
            WHERE intervention_id = ${INTERVENTION} AND status = 'superseded'`
        )}
      `
      expect(scenario(corps)).toContain("NB=1")
    })

    it("should refuser un second rapport submitted pour le même couple", () => {
      const res = runSql(
        env,
        `${FIXTURE}
         INSERT INTO public.artisan_reports (intervention_id, artisan_id, status, version)
         VALUES (${INTERVENTION}, ${ARTISAN}, 'submitted', 1),
                (${INTERVENTION}, ${ARTISAN}, 'submitted', 2);
         ROLLBACK;`
      )
      // ux_artisan_reports_one_open : au plus un rapport en attente par couple.
      expect(res.code).not.toBe(0)
      expect(res.output).toMatch(/ux_artisan_reports_one_open/)
    })

    it("should tolérer plusieurs versions dès qu'une seule est submitted", () => {
      const corps = `
        INSERT INTO public.artisan_reports (intervention_id, artisan_id, status, version)
        VALUES (${INTERVENTION}, ${ARTISAN}, 'superseded', 1),
               (${INTERVENTION}, ${ARTISAN}, 'submitted', 2);
        ${marqueur("NB", `SELECT count(*) FROM public.artisan_reports WHERE intervention_id = ${INTERVENTION}`)}
      `
      expect(scenario(corps)).toContain("NB=2")
    })

    it("should refuser un statut hors CHECK", () => {
      const res = runSql(
        env,
        `${FIXTURE}
         INSERT INTO public.artisan_reports (intervention_id, artisan_id, status, version)
         VALUES (${INTERVENTION}, ${ARTISAN}, 'chose_inconnue', 1);
         ROLLBACK;`
      )
      expect(res.code).not.toBe(0)
      expect(res.output).toMatch(/artisan_reports_status_check/)
    })

    it("should imposer version NOT NULL", () => {
      const res = runSql(
        env,
        `${FIXTURE}
         INSERT INTO public.artisan_reports (intervention_id, artisan_id, status, version)
         VALUES (${INTERVENTION}, ${ARTISAN}, 'submitted', NULL);
         ROLLBACK;`
      )
      expect(res.code).not.toBe(0)
      expect(res.output).toMatch(/version/)
    })
  })

  describe("intervention_artisans", () => {
    it("should refuser un payment_status hors CHECK", () => {
      const res = runSql(
        env,
        `${FIXTURE}
         INSERT INTO public.intervention_artisans (intervention_id, artisan_id, payment_status)
         VALUES (${INTERVENTION}, ${ARTISAN}, 'peut_etre');
         ROLLBACK;`
      )
      expect(res.code).not.toBe(0)
      expect(res.output).toMatch(/payment_status/)
    })

    it("should poser payment_status = not_applicable par défaut", () => {
      const corps = `
        INSERT INTO public.intervention_artisans (intervention_id, artisan_id)
        VALUES (${INTERVENTION}, ${ARTISAN});
        ${marqueur(
          "PAIEMENT",
          `SELECT payment_status FROM public.intervention_artisans
            WHERE intervention_id = ${INTERVENTION} AND artisan_id = ${ARTISAN}`
        )}
      `
      expect(scenario(corps)).toContain("PAIEMENT=not_applicable")
    })

    it("should exposer les colonnes prix, démarrage et paiement à PostgREST", async () => {
      // Lecture seule : garantit que le schéma est bien rechargé côté API,
      // ce dont dépendent toutes les routes des lots suivants.
      const res = await rest(
        env,
        env.serviceRoleKey,
        "/intervention_artisans?select=id,price_response,price_responded_at,price_accepted_amount," +
          "price_refused_reason,price_response_source,price_response_by,work_started_at," +
          "work_started_from,work_started_by,payment_status,paid_at,payment_updated_by,payment_updated_at&limit=1"
      )
      expect(res.status, res.raw).toBe(200)
    })
  })

  describe("artisan_portal_actions (99079)", () => {
    it("should refuser un action_type hors CHECK", () => {
      const res = runSql(
        env,
        `${FIXTURE}
         INSERT INTO public.artisan_portal_actions (artisan_id, action_type)
         VALUES (${ARTISAN}, 'DANSE_DE_LA_PLUIE');
         ROLLBACK;`
      )
      expect(res.code).not.toBe(0)
      expect(res.output).toMatch(/action_type/)
    })

    it("should refuser deux fois le même event_uid (idempotence du rejeu hors ligne)", () => {
      const res = runSql(
        env,
        `${FIXTURE}
         INSERT INTO public.artisan_portal_actions (artisan_id, action_type, event_uid)
         VALUES (${ARTISAN}, 'WORK_STARTED', 'evt-l0-test'),
                (${ARTISAN}, 'WORK_STARTED', 'evt-l0-test');
         ROLLBACK;`
      )
      expect(res.code).not.toBe(0)
      expect(res.output).toMatch(/ux_artisan_portal_actions_event_uid/)
    })

    it("should accepter plusieurs actions sans event_uid (index unique partiel)", () => {
      const corps = `
        INSERT INTO public.artisan_portal_actions (artisan_id, action_type)
        VALUES (${ARTISAN}, 'WORK_STARTED'), (${ARTISAN}, 'PRICE_ACCEPTED');
        ${marqueur("NB", `SELECT count(*) FROM public.artisan_portal_actions WHERE artisan_id = ${ARTISAN}`)}
      `
      expect(scenario(corps)).toContain("NB=2")
    })

    it("should ne pas être publiée en temps réel", () => {
      const res = runSql(
        env,
        `SELECT 'PUBLIEE=' || count(*) FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime' AND tablename = 'artisan_portal_actions';`
      )
      expect(res.code, res.output).toBe(0)
      expect(res.output).toContain("PUBLIEE=0")
    })
  })
})
