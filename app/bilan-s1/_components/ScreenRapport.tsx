"use client"

import { BILAN_WHATSAPP } from "@/lib/bilan-s1/constants"
import type { BilanMetrics } from "@/types/bilan-s1"
import { fmt } from "@/lib/bilan-s1/fallback"
import { MeetingPoints } from "./MeetingPoints"

const GAUGE_RADIUS = 66
const GAUGE_CIRC = 2 * Math.PI * GAUGE_RADIUS

/**
 * Écran 3/3 — rapport final : fiabilité (live) sur le tiers gauche,
 * points à traiter en réunion (interactifs) sur les deux tiers droits.
 */
export function ScreenRapport({ m }: { m: BilanMetrics }) {
  const actions = m.counts.actionsTotal
  const { bugsReels, bugsCorriges, signalements } = BILAN_WHATSAPP
  const sansBugPct = actions ? 100 - (bugsReels / actions) * 100 : null
  const bugsPct = Math.round((bugsReels / signalements) * 100)
  const corrigesPct = Math.round((bugsCorriges / bugsReels) * 100)

  return (
    <section className="screen" id="bs1-rapport">
      <div className="topbar">
        <span className="screen-label">3 / 3 · Rapport final</span>
        <h1>Fiabilité &amp; points à traiter</h1>
        <span className="window">bugs rapportés à l’activité réelle · demandes à trancher ensemble</span>
      </div>

      <div className="finalgrid">
        <div className="leftcol">
          <div className="card">
            <h3>Taux d’actions sans bug</h3>
            <div className="gaugewrap">
              <svg className="gauge" width="170" height="170" viewBox="0 0 170 170">
                <circle cx="85" cy="85" r={GAUGE_RADIUS} fill="none" stroke="#1a2440" strokeWidth="16" />
                <circle
                  cx="85"
                  cy="85"
                  r={GAUGE_RADIUS}
                  fill="none"
                  stroke="var(--bs1-green)"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeDasharray={
                    sansBugPct != null
                      ? `${((sansBugPct / 100) * GAUGE_CIRC).toFixed(1)} ${GAUGE_CIRC.toFixed(1)}`
                      : `${GAUGE_CIRC.toFixed(1)} ${GAUGE_CIRC.toFixed(1)}`
                  }
                  transform="rotate(-90 85 85)"
                  style={{ transition: "stroke-dasharray .8s ease" }}
                />
                <text className="g-pct" x="85" y="84" textAnchor="middle">
                  {sansBugPct != null ? `${sansBugPct.toFixed(2).replace(".", ",")} %` : "—"}
                </text>
                <text className="g-lbl" x="85" y="104" textAnchor="middle">
                  sans bug
                </text>
              </svg>
              <div className="footnote" style={{ textAlign: "center" }}>
                {bugsReels} bugs pour {fmt(actions)} actions
                <br />1 bug pour ≈ {fmt(actions ? Math.round(actions / bugsReels) : null)} actions
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Du signalement au correctif</h3>
            <div className="frows">
              <div className="frow">
                <div className="ftop">
                  <span>Signalements reçus</span>
                  <b>{signalements} · 100 %</b>
                </div>
                <div className="ftrack">
                  <div className="ffill" style={{ width: "100%", background: "linear-gradient(90deg,#2563eb,var(--bs1-accent))" }} />
                </div>
              </div>
              <div className="frow">
                <div className="ftop">
                  <span>Bugs réels du CRM</span>
                  <b>{bugsReels} · {bugsPct} %</b>
                </div>
                <div className="ftrack">
                  <div className="ffill" style={{ width: `${bugsPct}%`, background: "linear-gradient(90deg,#9f1239,var(--bs1-rose))" }} />
                </div>
              </div>
              <div className="frow">
                <div className="ftop">
                  <span>Bugs corrigés</span>
                  <b>{bugsCorriges} · {corrigesPct} %</b>
                </div>
                <div className="ftrack">
                  <div
                    className="ffill"
                    style={{
                      width: `${Math.round((bugsCorriges / signalements) * 100)}%`,
                      background: "linear-gradient(90deg,#14805e,var(--bs1-green))",
                    }}
                  />
                </div>
              </div>
              <div className="footnote">
                Le reste : données, formats, faux positif, demandes d’évolution — dont 3 où une contrainte voulue a
                fait son travail (acompte, archives, unicité des ID).
              </div>
            </div>
          </div>
        </div>

        <MeetingPoints />
      </div>

      <div className="verdict">
        <div className="kpi">
          <div className="val">1 / {actions ? Math.round(actions / signalements) : "—"}</div>
          <div className="lbl">signalement par action réalisée</div>
        </div>
        <div className="kpi">
          <div className="val">{BILAN_WHATSAPP.medianeCorrection}</div>
          <div className="lbl">correction médiane d’un bug</div>
        </div>
        <div className="kpi">
          <div className="val">{BILAN_WHATSAPP.medianeReponseMin} min</div>
          <div className="lbl">première réponse médiane</div>
        </div>
        <div className="kpi">
          <div className="val">{m.perUser.length || "—"} / 12</div>
          <div className="lbl">utilisateurs actifs dès la S1</div>
        </div>
      </div>
    </section>
  )
}
