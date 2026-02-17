"use client"

import { Users, PlusCircle, CheckCircle2, Clock } from "lucide-react"
import { KPICard } from "@/components/admin-dashboard/KPICard"

interface KPIRowProps {
  onlineCount: number
}

export function KPIRow({ onlineCount }: KPIRowProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="En ligne"
        value={onlineCount}
        icon={Users}
        className="border-l-emerald-500"
      />
      <KPICard
        title="Creees aujourd'hui"
        value="\u2014"
        icon={PlusCircle}
        className="border-l-blue-500"
        description="Bientot disponible"
      />
      {/* TODO: Connecter aux hooks de stats quand useTeamStats sera pret */}
      <KPICard
        title="Terminees aujourd'hui"
        value="\u2014"
        icon={CheckCircle2}
        className="border-l-violet-500"
        description="Bientot disponible"
      />
      <KPICard
        title="Temps moyen"
        value="\u2014"
        icon={Clock}
        className="border-l-amber-500"
        description="Bientot disponible"
      />
    </div>
  )
}
