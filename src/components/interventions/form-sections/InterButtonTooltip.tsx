"use client"

import type { ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface InterButtonTooltipProps {
  /** Labels des champs encore à compléter pour débloquer l'envoi de l'ordre d'intervention. */
  missingFields: string[]
  /** Classe appliquée au wrapper (typiquement `flex-1` pour conserver le partage de largeur). */
  className?: string
  children: ReactNode
}

/**
 * Enveloppe un bouton "Inter." désactivé d'un tooltip listant les champs manquants.
 *
 * Un `<button disabled>` ne reçoit pas les événements de survol (pointer-events:none),
 * d'où le `<span>` intermédiaire qui porte le déclencheur du tooltip. Quand aucun champ
 * ne manque, le wrapper reste présent (layout stable) mais aucun contenu n'est affiché.
 */
export function InterButtonTooltip({ missingFields, className, children }: InterButtonTooltipProps) {
  const hasMissing = missingFields.length > 0

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("flex min-w-0", className)} tabIndex={hasMissing ? 0 : -1}>
            {children}
          </span>
        </TooltipTrigger>
        {hasMissing && (
          <TooltipContent side="top" className="max-w-[240px]">
            <p className="mb-1 text-[11px] font-medium">À compléter pour débloquer l&apos;envoi :</p>
            <ul className="list-disc space-y-0.5 pl-4 text-[11px]">
              {missingFields.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}
