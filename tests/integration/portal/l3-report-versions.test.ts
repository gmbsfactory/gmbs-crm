/**
 * Lot L3 — versions de rapport, vérifiées contre la base LOCALE.
 *
 * Les tests unitaires du lot vérifient la **règle** (`decideNewVersion`) et les
 * appels émis par la route. Ici on vérifie ce que seule la base sait dire :
 *
 *   - l'index partiel `ux_artisan_reports_one_open` (99078) n'admet qu'UN rapport
 *     `submitted` par couple (intervention, artisan) — et il est bien **par
 *     couple** : deux artisans sur la même intervention ne se marchent pas dessus ;
 *   - la séquence de supersession écrite par `submitPortalReport` passe :
 *     `superseded` d'abord, insertion ensuite, `superseded_by` en dernier ;
 *   - la séquence inverse lève `23505` — c'est elle que la compensation de la
 *     route rattrape.
 *
 * **Toutes les écritures sont dans une transaction annulée** (`BEGIN … ROLLBACK`) :
 * la base locale porte les données de démo, et le trigger d'audit d'`artisans`
 * empêcherait de supprimer un artisan créé ici.
 */
import { describe, it, expect } from "vitest"
import {
  exigerBaseLocaleSiDemande,
  isLocalSupabaseAvailable,
  isPsqlAvailable,
  readLocalSupabaseEnv,
  runSql,
  VERROU_SOCLE_SQL,
} from "../helpers/local-supabase"

const LOCAL_DB_UP = isLocalSupabaseAvailable() && isPsqlAvailable()
exigerBaseLocaleSiDemande(LOCAL_DB_UP, "la base Supabase locale et psql")

const ARTISAN_A = "'33333333-3333-4333-8333-333333333333'"
const ARTISAN_B = "'44444444-4444-4444-8444-444444444444'"
const INTERVENTION = "'55555555-5555-4555-8555-555555555555'"
const REP_V1 = "'66666666-6666-4666-8666-666666666601'"
const REP_V2 = "'66666666-6666-4666-8666-666666666602'"

/** Ouvre la transaction, pose les deux artisans et l'intervention de travail. */
const FIXTURE = `
BEGIN;
${VERROU_SOCLE_SQL}
INSERT INTO public.artisans (id, nom, prenom, is_active)
  VALUES (${ARTISAN_A}, 'L3-TEST', 'ArtisanA', true), (${ARTISAN_B}, 'L3-TEST', 'ArtisanB', true);
INSERT INTO public.interventions (id, date) VALUES (${INTERVENTION}, now());
`

describe.skipIf(!LOCAL_DB_UP)("L3 — versions de rapport (base locale)", () => {
  const env = readLocalSupabaseEnv()!

  it("should n'admettre qu'un seul rapport en attente par couple (intervention, artisan)", () => {
    const res = runSql(
      env,
      `${FIXTURE}
       INSERT INTO public.artisan_reports (intervention_id, artisan_id, status, version)
         VALUES (${INTERVENTION}, ${ARTISAN_A}, 'submitted', 1);
       SAVEPOINT avant_doublon;
       INSERT INTO public.artisan_reports (intervention_id, artisan_id, status, version)
         VALUES (${INTERVENTION}, ${ARTISAN_A}, 'submitted', 2);
       ROLLBACK;`
    )
    expect(res.code).not.toBe(0)
    expect(res.output).toContain("ux_artisan_reports_one_open")
  })

  it("should laisser deux artisans avoir chacun leur rapport en attente sur la même intervention", () => {
    const res = runSql(
      env,
      `${FIXTURE}
       INSERT INTO public.artisan_reports (intervention_id, artisan_id, status, version)
         VALUES (${INTERVENTION}, ${ARTISAN_A}, 'submitted', 1),
                (${INTERVENTION}, ${ARTISAN_B}, 'submitted', 1);
       SELECT count(*) FROM public.artisan_reports
         WHERE intervention_id = ${INTERVENTION} AND status = 'submitted';
       ROLLBACK;`
    )
    expect(res.code).toBe(0)
    expect(res.output).toContain("2")
  })

  it("should accepter la supersession dans l'ordre écrit par la route : superseded, insert, superseded_by", () => {
    const res = runSql(
      env,
      `${FIXTURE}
       INSERT INTO public.artisan_reports (id, intervention_id, artisan_id, status, version)
         VALUES (${REP_V1}, ${INTERVENTION}, ${ARTISAN_A}, 'submitted', 1);
       -- 1. la version en attente libère la place
       UPDATE public.artisan_reports SET status = 'superseded', superseded_at = now()
         WHERE id = ${REP_V1} AND status = 'submitted';
       -- 2. la nouvelle version prend le numéro suivant
       INSERT INTO public.artisan_reports (id, intervention_id, artisan_id, status, version)
         VALUES (${REP_V2}, ${INTERVENTION}, ${ARTISAN_A}, 'submitted', 2);
       -- 3. chaînage APRÈS l'insertion : superseded_by est une clé étrangère
       UPDATE public.artisan_reports SET superseded_by = ${REP_V2} WHERE id = ${REP_V1};
       SELECT version || ':' || status || ':' || coalesce(superseded_by::text, '-')
         FROM public.artisan_reports WHERE intervention_id = ${INTERVENTION} ORDER BY version;
       ROLLBACK;`
    )
    expect(res.code).toBe(0)
    expect(res.output).toContain("1:superseded:66666666-6666-4666-8666-666666666602")
    expect(res.output).toContain("2:submitted:-")
  })

  it("should refuser l'ordre inverse (insertion avant supersession) : c'est le 23505 que la route compense", () => {
    const res = runSql(
      env,
      `${FIXTURE}
       INSERT INTO public.artisan_reports (id, intervention_id, artisan_id, status, version)
         VALUES (${REP_V1}, ${INTERVENTION}, ${ARTISAN_A}, 'submitted', 1);
       INSERT INTO public.artisan_reports (id, intervention_id, artisan_id, status, version)
         VALUES (${REP_V2}, ${INTERVENTION}, ${ARTISAN_A}, 'submitted', 2);
       ROLLBACK;`
    )
    expect(res.code).not.toBe(0)
    expect(res.output).toContain("ux_artisan_reports_one_open")
  })

  it("should garder has_portal_report vrai tant qu'une version reste en attente", () => {
    const res = runSql(
      env,
      `${FIXTURE}
       INSERT INTO public.artisan_reports (id, intervention_id, artisan_id, status, version)
         VALUES (${REP_V1}, ${INTERVENTION}, ${ARTISAN_A}, 'submitted', 1);
       UPDATE public.artisan_reports SET status = 'superseded', superseded_at = now() WHERE id = ${REP_V1};
       INSERT INTO public.artisan_reports (id, intervention_id, artisan_id, status, version)
         VALUES (${REP_V2}, ${INTERVENTION}, ${ARTISAN_A}, 'submitted', 2);
       SELECT has_portal_report FROM public.interventions WHERE id = ${INTERVENTION};
       ROLLBACK;`
    )
    expect(res.code).toBe(0)
    expect(res.output.split("\n").map((l) => l.trim())).toContain("t")
  })
})
