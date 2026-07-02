"use client"

import { useMemo } from "react"
import type { BilanMetrics } from "@/types/bilan-s1"
import { fmt, frDecimal } from "@/lib/bilan-s1/fallback"
import { VisibilityControl } from "./VisibilityControl"

/** Écran 1/3 — adoption réelle du CRM (tout est live). */
export function ScreenAdoption({ m, offline }: { m: BilanMetrics; offline: boolean }) {
  const c = m.counts
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("fr-FR", {
        timeZone: "Europe/Paris",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      })
        .format(new Date())
        .replace(".", ""),
    []
  )
  const dayMax = Math.max(...m.perDay.map((d) => d.actions), 1)
  const users = m.perUser.slice(0, 11)
  const userMax = Math.max(...users.map((u) => u.actions), 1)
  const hoursOf = new Map((m.screen?.perUser ?? []).map((s) => [s.user.split(" ")[0], s.hours]))
  const liveTime = new Date(m.generatedAt).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })

  return (
    <section className="screen" id="bs1-adoption">
      <div className="topbar">
        <span className="screen-label">1 / 3 · Adoption</span>
        <h1>GMBS CRM — Bilan semaine 1</h1>
        <span className="window">lun 29/06 → ven 03/07 12h00 · équipe complète depuis lundi</span>
        <span className={offline ? "live offline" : "live"}>
          <span className="dot" />
          <span>
            {offline
              ? "hors ligne — instantané du jeu 02/07 01h24"
              : `LIVE — mis à jour à ${liveTime}${m.cappedAtFridayNoon ? " (arrêté à ven 12h)" : ""}`}
          </span>
        </span>
        <VisibilityControl />
      </div>

      <div className="kpis">
        <div className="kpi hero">
          <div className="val">{fmt(c.actionsTotal)}</div>
          <div className="lbl">actions réalisées dans le CRM</div>
          <div className="sub">journal d’audit, imports &amp; automatismes exclus</div>
        </div>
        <div className="kpi">
          <div className="val">{fmt(c.interventionsCreees)}</div>
          <div className="lbl">interventions créées à la main</div>
        </div>
        <div className="kpi">
          <div className="val">{fmt(c.changementsStatut)}</div>
          <div className="lbl">changements de statut</div>
        </div>
        <div className="kpi">
          {m.screen ? (
            <div className="val">
              {frDecimal(m.screen.totalHours)}
              <span className="unit">h</span>
            </div>
          ) : (
            <div className="val">…</div>
          )}
          <div className="lbl">temps actif cumulé à l’écran</div>
          <div className="sub">
            {m.screen ? `sur ${m.screen.perUser.length} utilisateurs connectés` : "calcul en cours (prochain refresh)"}
          </div>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <div className="val">{fmt(c.commentaires)}</div>
          <div className="lbl">commentaires</div>
        </div>
        <div className="kpi">
          <div className="val">{fmt(c.documents)}</div>
          <div className="lbl">documents uploadés</div>
        </div>
        <div className="kpi">
          <div className="val">{fmt(c.emails)}</div>
          <div className="lbl">
            emails envoyés <span style={{ color: "var(--bs1-green)" }}>· 0 échec</span>
          </div>
        </div>
        <div className="kpi">
          <div className="val">{m.perUser.length || "—"}</div>
          <div className="lbl">utilisateurs actifs</div>
        </div>
      </div>

      <div className="charts">
        <div className="card">
          <h3>Actions par jour</h3>
          <div className="daybars">
            {m.perDay.map((d) => (
              <div key={d.day} className={d.day === todayLabel ? "daybar today" : "daybar"}>
                <div className="n">{fmt(d.actions)}</div>
                <div className="bar" style={{ height: `${Math.max(2, Math.round((d.actions / dayMax) * 100))}%` }} />
                <div className="d">{d.day}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>
            Activité par utilisateur <span className="h3-note">(actions · temps actif)</span>
          </h3>
          <div className="userrows">
            {users.map((u) => {
              const hours = hoursOf.get(u.user.split(" ")[0])
              return (
                <div key={u.user} className="urow">
                  <div className="name">{u.user}</div>
                  <div className="track">
                    <div className="fill" style={{ width: `${Math.round((u.actions / userMax) * 100)}%` }} />
                  </div>
                  <div className="meta">
                    <b>{fmt(u.actions)}</b>
                    {hours != null ? ` · ${frDecimal(hours)} h` : ""}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="footnote">
        « Action » = écriture métier tracée par le journal d’audit (création, modification, statut, commentaire,
        document, coût, email…) effectuée par un utilisateur identifié. Les 33 000 écritures des imports CSV et les
        automatismes sont exclus. Temps actif : algorithme officiel du monitoring (inactivité &gt; 90 s non comptée).
      </div>
    </section>
  )
}
