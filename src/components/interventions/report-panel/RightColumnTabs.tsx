"use client"

import { useCallback } from "react"
import { PORTAL_REPORT_REVIEW_COLOR } from "@/lib/interventions/portal-report-status"
import { cn } from "@/lib/utils"

export type RightColumnTab = "infos" | "report"

export interface RightColumnTabsProps {
  value: RightColumnTab
  onChange: (tab: RightColumnTab) => void
  /** Pastille violette « rapport à vérifier » (`interventions.has_portal_report`). */
  hasPendingReport?: boolean
}

/**
 * Bascule « Infos » / « Rapport » de la colonne de droite du modal d'intervention.
 *
 * Trois contraintes, chacune pour une raison identifiée dans le code :
 *
 * 1. `div role="tab"`, jamais `<button>` ni `TabsTrigger` Radix : toute la
 *    colonne descend d'un `<fieldset disabled={readOnly}>`, et `readOnly` vaut
 *    vrai dès qu'un autre utilisateur est l'éditeur actif. Un bouton y devient
 *    incliquable — le gestionnaire en lecture seule ne pourrait plus consulter
 *    le rapport.
 * 2. `pointer-events-auto` explicite : le fieldset porte AUSSI
 *    `pointer-events-none`, qui neutralise n'importe quel descendant, `div`
 *    compris. Le `role="tab"` seul ne suffit pas.
 * 3. `sticky top-0` et non `flex-none` : le responsive du modal repose sur des
 *    container queries ; sous 640 px de conteneur, `.if-col-right` repasse en
 *    `overflow: visible` et un `flex-none` au-dessus d'un `overflow-y-auto` y
 *    casse. `sticky` marche dans les deux modes.
 *
 * Libellés volontairement courts : la colonne descend à 250 px.
 */
export function RightColumnTabs({ value, onChange, hasPendingReport = false }: RightColumnTabsProps) {
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, tab: RightColumnTab) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onChange(tab)
        return
      }
      if (event.key === "ArrowLeft") onChange("infos")
      if (event.key === "ArrowRight") onChange("report")
    },
    [onChange],
  )

  const tabClass = (tab: RightColumnTab) =>
    cn(
      "flex-1 h-7 cursor-pointer truncate rounded text-center text-[11px] leading-7",
      value === tab && "bg-background shadow-sm",
    )

  return (
    <div className="sticky top-0 z-10 flex-none bg-background px-1 pt-1 pb-1 pointer-events-auto">
      <div role="tablist" aria-label="Colonne de droite" className="flex gap-0.5 rounded-md bg-muted p-0.5">
        <div
          role="tab"
          tabIndex={0}
          aria-selected={value === "infos"}
          onClick={() => onChange("infos")}
          onKeyDown={(event) => onKeyDown(event, "infos")}
          className={tabClass("infos")}
        >
          Infos
        </div>
        <div
          role="tab"
          tabIndex={0}
          aria-selected={value === "report"}
          onClick={() => onChange("report")}
          onKeyDown={(event) => onKeyDown(event, "report")}
          className={tabClass("report")}
        >
          Rapport
          {hasPendingReport && (
            <span
              aria-label="Rapport à vérifier"
              className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ backgroundColor: PORTAL_REPORT_REVIEW_COLOR }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
