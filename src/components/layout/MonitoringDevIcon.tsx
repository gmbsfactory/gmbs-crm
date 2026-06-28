import { Activity } from "lucide-react"

/**
 * Icône de la sidebar pour la page « Monitoring DEV » : la même icône que
 * « Monitoring » (Activity) surchargée d'un petit badge « dev ». Reste lisible
 * en mode sidebar replié. Signature compatible avec NavItem.icon
 * (React.ComponentType<{ className?: string }>).
 */
export function MonitoringDevIcon({ className }: { className?: string }) {
  return (
    <span className="relative inline-flex shrink-0">
      <Activity className={className} />
      <span
        aria-hidden="true"
        className="absolute -bottom-1.5 -right-2 rounded-[3px] bg-primary px-0.5 text-[7px] font-bold uppercase leading-[1.15] tracking-tight text-primary-foreground ring-1 ring-background"
      >
        dev
      </span>
    </span>
  )
}
