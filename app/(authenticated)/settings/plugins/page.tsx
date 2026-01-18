"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { 
  Users, 
  Building2, 
  FileText, 
  Sparkles,
  Check,
  ArrowRight
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type PluginStatus = {
  active: boolean
  status?: string
}

type Plugin = {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  features: string[]
  href: string
  comingSoon?: boolean
}

const PLUGINS: Plugin[] = [
  {
    id: "portal_artisans",
    name: "Portal Artisans",
    description: "Offrez à vos artisans un portail dédié pour gérer leurs documents, consulter leurs interventions et soumettre des rapports photos.",
    icon: Users,
    features: [
      "Portail artisan personnalisé",
      "Dépôt de documents légaux",
      "Consultation des interventions",
      "Rapport photo avec IA"
    ],
    href: "/settings/plugins/portal-artisans"
  },
  {
    id: "agences_gmbs",
    name: "Portal Agences",
    description: "Permettez aux agences immobilières de créer des demandes d'intervention directement depuis leur interface dédiée.",
    icon: Building2,
    features: [
      "Formulaire de demande",
      "Suivi des interventions",
      "Notifications automatiques"
    ],
    href: "/settings/plugins/agences",
    comingSoon: true
  },
  {
    id: "comptabilite_gmbs",
    name: "Export Comptable",
    description: "Exportez vos factures et données vers votre logiciel de comptabilité (Sage, EBP, etc.).",
    icon: FileText,
    features: [
      "Export automatique",
      "Rapprochement bancaire",
      "Formats multiples"
    ],
    href: "/settings/plugins/comptabilite",
    comingSoon: true
  }
]

function PluginCard({ plugin }: { plugin: Plugin }) {
  const { data: status, isLoading } = useQuery<PluginStatus>({
    queryKey: ["plugin-status", plugin.id],
    queryFn: async () => {
      const res = await fetch(`/api/plugins/${plugin.id}/status`)
      if (!res.ok) return { active: false }
      return res.json()
    },
    enabled: !plugin.comingSoon
  })

  const isActive = status?.active && status?.status === "active"
  const Icon = plugin.icon

  return (
    <Card className={plugin.comingSoon ? "opacity-60" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {plugin.name}
                {plugin.comingSoon && (
                  <Badge variant="secondary" className="text-xs">
                    Bientôt
                  </Badge>
                )}
              </CardTitle>
            </div>
          </div>
          {!plugin.comingSoon && (
            isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : isActive ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <Check className="h-3 w-3 mr-1" />
                Actif
              </Badge>
            ) : (
              <Badge variant="outline">Inactif</Badge>
            )
          )}
        </div>
        <CardDescription className="mt-2">
          {plugin.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 mb-4">
          {plugin.features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
        
        {plugin.comingSoon ? (
          <Button variant="outline" disabled className="w-full">
            Disponible prochainement
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link href={plugin.href}>
              {isActive ? "Gérer" : "Découvrir"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default function PluginsPage() {
  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Plugins</h1>
        <p className="text-muted-foreground mt-2">
          Étendez les fonctionnalités de votre CRM avec nos plugins premium.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {PLUGINS.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} />
        ))}
      </div>
    </div>
  )
}
