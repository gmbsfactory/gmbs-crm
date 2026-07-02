"use client"

import { BILAN_REGLES_METIER, BILAN_WHATSAPP } from "@/lib/bilan-s1/constants"
import type { BilanMetrics } from "@/types/bilan-s1"
import { fmt } from "@/lib/bilan-s1/fallback"

const GAUGE_RADIUS = 88
const GAUGE_CIRC = 2 * Math.PI * GAUGE_RADIUS

/** Écran 3/3 — rapport final : fiabilité (live) & règles métier. */
export function ScreenRapport({ m }: { m: BilanMetrics }) {
  const actions = m.counts.actionsTotal
  const { bugsReels, signalements } = BILAN_WHATSAPP
  const sansBugPct = actions ? 100 - (bugsReels / actions) * 100 : null
  const rules = BILAN_REGLES_METIER

  return (
    <section className="screen" id="bs1-rapport">
      <div className="topbar">
        <span className="screen-label">3 / 3 · Rapport final</span>
        <h1>Fiabilité &amp; règles métier</h1>
        <span className="window">bugs rapportés à l’activité réelle et au paramétrage en vigueur</span>
      </div>

      <div className="finalgrid">
        <div className="card">
          <h3>Taux d’actions sans bug</h3>
          <div className="gaugewrap">
            <svg className="gauge" width="220" height="220" viewBox="0 0 220 220">
              <circle cx="110" cy="110" r={GAUGE_RADIUS} fill="none" stroke="#1a2440" strokeWidth="20" />
              <circle
                cx="110"
                cy="110"
                r={GAUGE_RADIUS}
                fill="none"
                stroke="var(--bs1-green)"
                strokeWidth="20"
                strokeLinecap="round"
                strokeDasharray={
                  sansBugPct != null
                    ? `${((sansBugPct / 100) * GAUGE_CIRC).toFixed(1)} ${GAUGE_CIRC.toFixed(1)}`
                    : `${GAUGE_CIRC.toFixed(1)} ${GAUGE_CIRC.toFixed(1)}`
                }
                transform="rotate(-90 110 110)"
                style={{ transition: "stroke-dasharray .8s ease" }}
              />
              <text className="g-pct" x="110" y="108" textAnchor="middle">
                {sansBugPct != null ? `${sansBugPct.toFixed(2).replace(".", ",")} %` : "—"}
              </text>
              <text className="g-lbl" x="110" y="132" textAnchor="middle">
                des actions n’ont produit
              </text>
              <text className="g-lbl" x="110" y="146" textAnchor="middle">
                aucun bug
              </text>
            </svg>
            <div className="footnote" style={{ textAlign: "center" }}>
              {bugsReels} bugs pour {fmt(actions)} actions · 1 bug pour ≈ {fmt(actions ? Math.round(actions / bugsReels) : null)}{" "}
              actions
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Du signalement au correctif</h3>
          <div className="frows">
            <div className="frow">
              <div className="ftop">
                <span>Signalements reçus</span>
                <b>20 · 100 %</b>
              </div>
              <div className="ftrack">
                <div className="ffill" style={{ width: "100%", background: "linear-gradient(90deg,#2563eb,var(--bs1-accent))" }} />
              </div>
            </div>
            <div className="frow">
              <div className="ftop">
                <span>Bugs réels du CRM</span>
                <b>10 · 50 %</b>
              </div>
              <div className="ftrack">
                <div className="ffill" style={{ width: "50%", background: "linear-gradient(90deg,#9f1239,var(--bs1-rose))" }} />
              </div>
            </div>
            <div className="frow">
              <div className="ftop">
                <span>Bugs corrigés au jeu 02/07</span>
                <b>8 · 80 %</b>
              </div>
              <div className="ftrack">
                <div className="ffill" style={{ width: "40%", background: "linear-gradient(90deg,#14805e,var(--bs1-green))" }} />
              </div>
            </div>
            <div className="footnote">
              Les 10 signalements restants (50 %) : données à corriger, formats de fichier, faux positif, demandes
              d’évolution — dont 2 où une règle métier voulue a fait exactement son travail (acompte, archives).
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Règles métier en vigueur</h3>
          <div className="rulesbig">
            <span className="v">{rules.total}</span>
            <span className="l">règles actives sur les {rules.statuts} statuts d’intervention</span>
          </div>
          <ul className="clean">
            <li>{rules.transitions} transitions de statut autorisées (les autres sont bloquées)</li>
            <li>{rules.validations} validations bloquantes (facture GMBS, gestionnaire, commentaire…)</li>
            <li>{rules.champsRequis} champs obligatoires selon le statut</li>
            <li>{rules.automatismes} automatismes (email devis, génération facture)</li>
          </ul>
          <div className="zerobug">
            <span className="v">0</span>
            <span className="l">
              bug imputable au moteur de règles : les 8 bugs touchaient l’affichage ou la technique, jamais la logique
              métier
            </span>
          </div>
        </div>
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
