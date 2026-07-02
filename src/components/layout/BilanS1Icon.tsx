import { Gauge } from "lucide-react"

/**
 * Icône de la sidebar pour la page « Bilan S1 » (dashboard dev-only) : une
 * jauge surchargée d'un badge « dev », dans le même esprit que
 * MonitoringDevIcon. Signature compatible avec NavItem.icon
 * (React.ComponentType<{ className?: string }>).
 */
export function BilanS1Icon({ className }: { className?: string }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Gauge className={className} />
      <span
        aria-hidden="true"
        className="absolute -bottom-1.5 -right-2 rounded-[3px] bg-primary px-0.5 text-[7px] font-bold uppercase leading-[1.15] tracking-tight text-primary-foreground ring-1 ring-background"
      >
        dev
      </span>
    </span>
  )
}
