"use client"

import { BILAN_BUGS } from "@/lib/bilan-s1/constants"
import type { BilanMetrics } from "@/types/bilan-s1"
import { fmt } from "@/lib/bilan-s1/fallback"

/** Écran 2/3 — signalements WhatsApp & réactivité dev (tient sur une page). */
export function ScreenSupport({ m }: { m: BilanMetrics }) {
  const git = m.git

  return (
    <section className="screen" id="bs1-support">
      <div className="topbar">
        <span className="screen-label">2 / 3 · Support &amp; dev</span>
        <h1>Signalements &amp; réactivité</h1>
        <span className="window">16 sujets remontés sur WhatsApp · lun 29/06 → jeu 02/07</span>
      </div>

      <div className="strip">
        <div className="kpi">
          <div className="val">16</div>
          <div className="lbl">signalements traités</div>
        </div>
        <div className="kpi">
          <div className="val">8</div>
          <div className="lbl">bugs réels du CRM</div>
          <div className="sub">8 autres : données, formats, workflow, évolutions…</div>
        </div>
        <div className="kpi">
          <div className="val" style={{ color: "var(--bs1-green)" }}>
            7 <span className="unit">/ 8</span>
          </div>
          <div className="lbl">bugs corrigés (88 %)</div>
          <div className="sub">reste le n°4 (délai nom artisan) à requalifier</div>
        </div>
        <div className="kpi">
          <div className="val">
            10 <span className="unit">min</span>
          </div>
          <div className="lbl">1ʳᵉ réponse (médiane)</div>
        </div>
        <div className="kpi">
          <div className="val">2 h 13</div>
          <div className="lbl">délai de correction (médiane)</div>
          <div className="sub">min 22 min · max 9 h 52 (nuit)</div>
        </div>
      </div>

      <div className="split">
        <div className="card" style={{ overflow: "auto" }}>
          <h3>Les 16 signalements</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Quand</th>
                <th>Qui</th>
                <th>Sujet</th>
                <th>Type</th>
                <th>1ʳᵉ rép.</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {BILAN_BUGS.map((b) => (
                <tr key={b.n}>
                  <td className="num">{b.n}</td>
                  <td className="num">{b.q}</td>
                  <td>{b.who}</td>
                  <td>{b.txt}</td>
                  <td>
                    <span className={`badge ${b.type === "Bug" ? "b-bug" : "b-type"}`}>{b.type}</span>
                  </td>
                  <td className="num">{b.rep}</td>
                  <td>
                    <span className={`badge b-${b.st}`}>{b.stTxt}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sidecol">
          <div className="card">
            <h3>Côté dev (depuis dimanche soir)</h3>
            <div className="devgrid">
              <div className="cell">
                <div className="v">{git ? git.commits : "—"}</div>
                <div className="l">commits{m.gitSource === "snapshot" ? " (relevé du 02/07)" : ""}</div>
              </div>
              <div className="cell">
                <div className="v">{git ? git.fixes : "—"}</div>
                <div className="l">correctifs</div>
              </div>
              <div className="cell">
                <div className="v" style={{ fontSize: 18 }}>
                  {git ? (
                    <>
                      <span className="plus">+{fmt(git.insertions)}</span> <span className="minus">−{fmt(git.deletions)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
                <div className="l">lignes + / −</div>
              </div>
              <div className="cell">
                <div className="v">{git ? git.files : "—"}</div>
                <div className="l">fichiers touchés</div>
              </div>
            </div>
            <div className="footnote">
              16 commits répondent directement à 9 signalements — l’archivage clic droit en a demandé 5 à lui seul.
            </div>
            {git?.lastCommit ? (
              <div className="lastcommit">
                Dernier commit · {git.lastCommit.date} — {git.lastCommit.subject}
              </div>
            ) : null}
          </div>

          <div className="card">
            <h3>Travail invisible (jamais signalé)</h3>
            <ul className="clean">
              <li>Présence realtime : fini les « hors-ligne » fantômes</li>
              <li>Faille de sécurité (RLS) refermée sur le journal d’audit</li>
              <li>Filtres de colonne à jour sans F5 (extension proactive)</li>
              <li>Monitoring temps réel de l’activité pour piloter la semaine</li>
              <li>Import sécurisé : validation des colonnes + purge propre</li>
            </ul>
          </div>

          <div className="card">
            <h3>À trancher vendredi</h3>
            <ul className="clean todo">
              <li>Sortie d’archives artisan (évolution à cadrer)</li>
              <li>Pièces jointes &gt; 3,2 Mo : lien de téléchargement ? compression ?</li>
              <li>Workflow acompte : valider Accepté → Att. acompte → Accepté</li>
            </ul>
          </div>
        </div>
      </div>
      {m.errors.length > 0 ? <div className="errbar">Requêtes en échec : {m.errors.join(" · ")}</div> : null}
    </section>
  )
}
