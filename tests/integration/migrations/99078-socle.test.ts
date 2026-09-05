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
 *
 * ⚠️ **UNE exception, à connaître avant de lancer ce fichier** (correctif de revue, constat 10) :
 * le test d'idempotence rejoue les migrations **hors transaction**, sur la base locale
 * *partagée* avec les autres équipes. `DROP FUNCTION … CASCADE` y supprime
 * `trg_artisan_dossier_sync` puis le repose quelques millisecondes plus tard : une écriture
 * concurrente sur `artisan_attachments` pendant cette fenêtre ne synchroniserait pas le
 * dossier. **Ne pas lancer ce fichier pendant une démo.**
 *
 * Les suites d'intégration du socle se sérialisent entre elles par le verrou consultatif
 * `VERROU_SOCLE` (`pg_advisory_xact_lock`) : sans lui, le rejeu (`AccessExclusiveLock`) et les
 * écritures d'`anon-access.test.ts` se bloquaient mutuellement — deadlock reproduit en local.
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
// Correctif de revue (constat 10) : sauter en silence n'est pas garder. Avec
// REQUIRE_LOCAL_SUPABASE=1 (commande de vérification du lot, CI), l'absence de base échoue.
exigerBaseLocaleSiDemande(LOCAL_DB_UP, "la base Supabase locale et psql")

const ARTISAN = "'11111111-1111-4111-8111-111111111111'"
const INTERVENTION = "'22222222-2222-4222-8222-222222222222'"

/** Ouvre la transaction et crée l'artisan (plus l'intervention) de travail. */
const FIXTURE = `
BEGIN;
${VERROU_SOCLE_SQL}
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
      "should rejouer 99078, 99079, 99081 et 99082 deux fois de suite sans erreur",
      () => {
        for (const migration of [
          "supabase/migrations/99078_portal_v2_socle.sql",
          "supabase/migrations/99079_artisan_portal_actions.sql",
          "supabase/migrations/99081_actor_resolution_lecture_seule.sql",
          "supabase/migrations/99082_rls_tables_enfant_intervention.sql",
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

    it("should réparer un artisan DÉJÀ COMPLET dont dossier_validated_at est NULL (constat 2)", () => {
      // C'est l'état de 100 % de la base avant cette migration, et le cas que la suite
      // d'origine ne pouvait pas voir : elle construisait toujours l'artisan de zéro et
      // n'exerçait que la MONTÉE vers COMPLET. Or la garde anti-WAL ne testait que
      // statut_dossier et pieces_a_verifier : sur un dossier déjà COMPLET dont le compteur
      // ne bouge pas, l'UPDATE était filtré, le CASE jamais évalué, la date restait NULL
      // indéfiniment — alors que le portail affiche « Dossier complet validé le … ».
      const corps = `
        ${toutesLesPieces("approved")}
        ${marqueur("POSEE", `SELECT dossier_validated_at IS NOT NULL FROM public.artisans WHERE id = ${ARTISAN}`)}
        -- on se remet dans l'état d'un artisan antérieur à la migration
        UPDATE public.artisans SET dossier_validated_at = NULL WHERE id = ${ARTISAN};
        ${marqueur("EFFACEE", `SELECT dossier_validated_at FROM public.artisans WHERE id = ${ARTISAN}`)}
        -- une écriture quelconque sur une pièce redéclenche le trigger : il doit REPOSER la date
        UPDATE public.artisan_attachments SET review_status = 'approved'
         WHERE artisan_id = ${ARTISAN} AND kind = 'kbis';
        ${compteurs}
        ${marqueur("REPAREE", `SELECT dossier_validated_at IS NOT NULL FROM public.artisans WHERE id = ${ARTISAN}`)}
      `
      const sortie = scenario(corps)
      expect(sortie).toContain("POSEE=true")
      expect(sortie).toContain("EFFACEE=NULL")
      expect(sortie).toContain("COMPTEURS=0|COMPLET")
      expect(sortie).toContain("REPAREE=true")
    })

    it("should ne laisser AUCUN dossier COMPLET sans date après le rattrapage 4.c (constats 2 et 3)", () => {
      // Invariants vérifiés sur la base réelle, après le rejeu des migrations ci-dessus.
      // Le rattrapage d'origine ne touchait que le compteur, par une jointure interne :
      // ni statut_dossier (dont la migration CHANGE la règle de calcul), ni la date.
      const res = runSql(
        env,
        `
        SELECT 'COMPLET_SANS_DATE=' || count(*)::text FROM public.artisans
          WHERE statut_dossier = 'COMPLET' AND dossier_validated_at IS NULL;
        SELECT 'DATE_SANS_COMPLET=' || count(*)::text FROM public.artisans
          WHERE statut_dossier IS DISTINCT FROM 'COMPLET' AND dossier_validated_at IS NOT NULL;
        SELECT 'STATUT_PERIME=' || count(*)::text FROM public.artisans a
          WHERE a.statut_dossier IS DISTINCT FROM public.calculate_artisan_dossier_status(a.id);
        SELECT 'COMPTEUR_PERIME=' || count(*)::text FROM public.artisans a
          WHERE a.pieces_a_verifier IS DISTINCT FROM COALESCE((
            SELECT count(*) FROM public.artisan_attachments x
             WHERE x.artisan_id = a.id AND x.review_status = 'pending'), 0);
        `
      )
      expect(res.code, res.output).toBe(0)
      expect(res.output).toContain("COMPLET_SANS_DATE=0")
      expect(res.output).toContain("DATE_SANS_COMPLET=0")
      expect(res.output).toContain("STATUT_PERIME=0")
      expect(res.output).toContain("COMPTEUR_PERIME=0")
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

    it("should accepter la supersession dans le BON ordre : superseded PUIS insert (constat 5)", () => {
      // L'index ux_artisan_reports_one_open n'est pas deferrable : l'ordre inverse lève 23505
      // (test « refuser un second rapport submitted » ci-dessus). L'ordre imposé est
      // contractualisé dans 99078 et dans le §8.1 du contrat d'API — il est ici GARANTI.
      const corps = `
        INSERT INTO public.artisan_reports (id, intervention_id, artisan_id, status, version)
        VALUES ('55555555-5555-4555-8555-555555555555', ${INTERVENTION}, ${ARTISAN}, 'submitted', 1);
        UPDATE public.artisan_reports SET status = 'superseded', superseded_at = now()
         WHERE id = '55555555-5555-4555-8555-555555555555';
        INSERT INTO public.artisan_reports (id, intervention_id, artisan_id, status, version)
        VALUES ('66666666-6666-4666-8666-666666666666', ${INTERVENTION}, ${ARTISAN}, 'submitted', 2);
        -- superseded_by est une FK vers artisan_reports : elle ne peut être posée qu'APRÈS
        -- l'insertion de la version suivante (vérification immédiate, index non deferrable).
        UPDATE public.artisan_reports
           SET superseded_by = '66666666-6666-4666-8666-666666666666'
         WHERE id = '55555555-5555-4555-8555-555555555555';
        ${marqueur(
          "OUVERTS",
          `SELECT count(*) FROM public.artisan_reports
            WHERE intervention_id = ${INTERVENTION} AND status = 'submitted'`
        )}
      `
      expect(scenario(corps)).toContain("OUVERTS=1")
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

    it("should refuser deux fois le même event_uid pour le MÊME artisan (idempotence du rejeu)", () => {
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

    it("should accepter le MÊME event_uid pour deux artisans différents (constat 6)", () => {
      // La clé d'idempotence est générée par le téléphone : unique GLOBALEMENT, deux appareils
      // produisant la même chaîne (« evt-1 », un compteur local) se bloquaient mutuellement, et
      // la route — qui traite un event_uid connu comme un rejeu et répond 200 — aurait perdu
      // silencieusement l'action du second artisan tout en lui rendant la trace du premier.
      const corps = `
        INSERT INTO public.artisans (id, nom, prenom, is_active)
          VALUES ('77777777-7777-4777-8777-777777777777', 'L0-TEST-2', 'Socle', true);
        INSERT INTO public.artisan_portal_actions (artisan_id, action_type, event_uid)
        VALUES (${ARTISAN}, 'WORK_STARTED', 'evt-1'),
               ('77777777-7777-4777-8777-777777777777', 'WORK_STARTED', 'evt-1');
        ${marqueur("NB", `SELECT count(*) FROM public.artisan_portal_actions WHERE event_uid = 'evt-1'`)}
      `
      expect(scenario(corps)).toContain("NB=2")
    })

    it("should refuser une ligne source='crm' sans acteur (constats 7 et 20)", () => {
      // « Acteur jamais nul des deux côtés » était une promesse de commentaire ; c'est
      // exactement ainsi qu'artisan_audit_log a dérivé (92 % de lignes sans acteur).
      const res = runSql(
        env,
        `${FIXTURE}
         INSERT INTO public.artisan_portal_actions (artisan_id, action_type, source)
         VALUES (${ARTISAN}, 'DOCUMENT_APPROVED', 'crm');
         ROLLBACK;`
      )
      expect(res.code).not.toBe(0)
      expect(res.output).toMatch(/artisan_portal_actions_acteur_check/)
    })

    it("should refuser un occurred_at hors bornes (constat 9)", () => {
      // Les bornes [recorded_at − 7 j, recorded_at + 5 min] ne vivaient que dans un COMMENT :
      // une date arbitraire remontait en tête de la timeline (index artisan_id, occurred_at DESC).
      for (const valeur of ["now() + INTERVAL '2 hours'", "now() - INTERVAL '30 days'"]) {
        const res = runSql(
          env,
          `${FIXTURE}
           INSERT INTO public.artisan_portal_actions (artisan_id, action_type, occurred_at)
           VALUES (${ARTISAN}, 'WORK_STARTED', ${valeur});
           ROLLBACK;`
        )
        expect(res.code, `${valeur} aurait dû être refusée : ${res.output}`).not.toBe(0)
        expect(res.output).toMatch(/artisan_portal_actions_occurred_at_check/)
      }
    })

    it("should accepter une horloge légèrement en avance (tolérance de 5 min)", () => {
      const corps = `
        INSERT INTO public.artisan_portal_actions (artisan_id, action_type, occurred_at)
        VALUES (${ARTISAN}, 'WORK_STARTED', now() + INTERVAL '2 minutes');
        ${marqueur("NB", `SELECT count(*) FROM public.artisan_portal_actions WHERE artisan_id = ${ARTISAN}`)}
      `
      expect(scenario(corps)).toContain("NB=1")
    })

    it("should refuser tout UPDATE : le journal est append-only (constat 16)", () => {
      // Le trigger est BEFORE UPDATE **seulement** : il ne gêne aucune FK ON DELETE, ce qui
      // était l'objection d'origine — objection qui ne valait que pour DELETE, jamais pour
      // UPDATE. Sans lui, service_role (le rôle de TOUTES les routes serveur) pouvait
      // réécrire une ligne du journal sans laisser de trace.
      const res = runSql(
        env,
        `${FIXTURE}
         INSERT INTO public.artisan_portal_actions (id, artisan_id, action_type)
         VALUES ('88888888-8888-4888-8888-888888888888', ${ARTISAN}, 'WORK_STARTED');
         UPDATE public.artisan_portal_actions SET payload = '{"triche":true}'::jsonb
          WHERE id = '88888888-8888-4888-8888-888888888888';
         ROLLBACK;`
      )
      expect(res.code).not.toBe(0)
      expect(res.output).toMatch(/append-only/)
    })

    it("should garder la trace quand l'intervention est supprimée (constats 8 et 16)", () => {
      // ON DELETE SET NULL, pas CASCADE : la preuve d'un prix accepté ou d'une heure de
      // démarrage ne doit pas disparaître avec l'intervention que le CRM supprime.
      const corps = `
        INSERT INTO public.artisan_portal_actions (artisan_id, intervention_id, action_type, payload)
        VALUES (${ARTISAN}, ${INTERVENTION}, 'PRICE_ACCEPTED',
                '{"intervention":{"id_inter":"DEMO-001"},"amount":120}'::jsonb);
        -- intervention_audit_log référence l'intervention sans ON DELETE : la suppression
        -- réelle passe d'abord par la purge du journal d'audit (vérifié ici).
        DELETE FROM public.intervention_audit_log WHERE intervention_id = ${INTERVENTION};
        DELETE FROM public.interventions WHERE id = ${INTERVENTION};
        ${marqueur(
          "SURVIT",
          `SELECT count(*) || '|' || COALESCE(max(intervention_id::text),'NULL') || '|' ||
                  max(payload -> 'intervention' ->> 'id_inter')
             FROM public.artisan_portal_actions WHERE artisan_id = ${ARTISAN}`
        )}
      `
      expect(scenario(corps)).toContain("SURVIT=1|NULL|DEMO-001")
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
