"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { 
  Users, 
  Check, 
  FileText, 
  Camera, 
  Smartphone,
  RefreshCw,
  Sparkles,
  Shield,
  Zap,
  ArrowLeft,
  Loader2,
  ExternalLink
} from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

type SubscriptionStatus = {
  active: boolean
  status?: string
  plan?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd?: boolean
}

const FEATURES = [
  {
    icon: Smartphone,
    title: "Portail Artisan Dédié",
    description: "Interface mobile-first accessible via un lien unique. Vos artisans peuvent y accéder depuis n'importe quel appareil."
  },
  {
    icon: FileText,
    title: "Dépôt de Documents",
    description: "Vos artisans peuvent déposer leurs documents légaux : KBIS, assurance, RIB, etc. Tout est centralisé et synchronisé."
  },
  {
    icon: Camera,
    title: "Rapport Photo",
    description: "À chaque intervention, l'artisan peut prendre des photos et générer un rapport automatique grâce à l'IA."
  },
  {
    icon: RefreshCw,
    title: "Synchronisation Automatique",
    description: "Toutes les données sont synchronisées avec votre CRM. Documents, photos et rapports apparaissent automatiquement."
  },
  {
    icon: Shield,
    title: "Sécurité Renforcée",
    description: "Liens à usage unique, tokens sécurisés et expiration automatique. Vos données sont protégées."
  },
  {
    icon: Zap,
    title: "IA Intégrée",
    description: "Génération automatique de rapports d'intervention à partir des photos. Gain de temps garanti."
  }
]

export default function PortalArtisansPluginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isCheckingOut, setIsCheckingOut] = useState(false)

  const { data: subscription, isLoading } = useQuery<SubscriptionStatus>({
    queryKey: ["plugin-status", "portal_artisans"],
    queryFn: async () => {
      const res = await fetch("/api/plugins/portal_artisans/status")
      if (!res.ok) return { active: false }
      return res.json()
    }
  })

  const activateMutation = useMutation({
    mutationFn: async () => {
      setIsCheckingOut(true)
      const res = await fetch("/api/plugins/portal_artisans/checkout", {
        method: "POST"
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur lors de l'activation")
      }
      return res.json()
    },
    onSuccess: (data) => {
      if (data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url
      } else if (data.activated) {
        // Free plan activated directly
        queryClient.invalidateQueries({ queryKey: ["plugin-status", "portal_artisans"] })
        toast.success("Plugin activé !")
      }
    },
    onError: (error: Error) => {
      setIsCheckingOut(false)
      toast.error(error.message)
    }
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/plugins/portal_artisans/cancel", {
        method: "POST"
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur lors de l'annulation")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plugin-status", "portal_artisans"] })
      toast.success("Abonnement annulé")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const isActive = subscription?.active && subscription?.status === "active"

  return (
    <div className="container max-w-4xl py-8">
      {/* Back button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/settings/plugins">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour aux plugins
        </Link>
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <Users className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Portal Artisans</h1>
            <p className="text-muted-foreground">
              Offrez à vos artisans un espace dédié
            </p>
          </div>
        </div>
        {isActive && (
          <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">
            <Check className="h-4 w-4 mr-1" />
            Actif
          </Badge>
        )}
      </div>

      {/* Status Card */}
      {isActive ? (
        <Card className="mb-8 border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Plugin Activé
            </CardTitle>
            <CardDescription className="text-green-700">
              Le portail artisan est disponible. Vous pouvez maintenant générer des liens 
              depuis les fiches artisans.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Button asChild>
                <Link href="/artisans">
                  Voir les artisans
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Désactiver
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Activez Portal Artisans
            </CardTitle>
            <CardDescription>
              Commencez dès maintenant avec notre offre gratuite de lancement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-bold">0 €</span>
              <span className="text-muted-foreground">/mois</span>
              <Badge variant="secondary" className="ml-2">Offre de lancement</Badge>
            </div>
            <ul className="space-y-2 mb-6 text-sm">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Jusqu&apos;à 10 artisans
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Toutes les fonctionnalités incluses
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                Sans engagement
              </li>
            </ul>
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => activateMutation.mutate()}
              disabled={isLoading || isCheckingOut || activateMutation.isPending}
            >
              {(isCheckingOut || activateMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activation en cours...
                </>
              ) : (
                <>
                  Activer gratuitement
                  <Sparkles className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator className="my-8" />

      {/* Features */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-6">Fonctionnalités</h2>
        <div className="grid gap-6 md:grid-cols-2">
          {FEATURES.map((feature, index) => (
            <Card key={index}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{feature.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Comment ça marche ?</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h3 className="font-semibold">Générez un lien</h3>
              <p className="text-sm text-muted-foreground">
                Depuis la fiche d&apos;un artisan, cliquez sur &quot;Lien Portail&quot; pour générer un lien unique.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h3 className="font-semibold">Partagez avec l&apos;artisan</h3>
              <p className="text-sm text-muted-foreground">
                Envoyez le lien par SMS ou email. L&apos;artisan accède directement à son portail.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
              3
            </div>
            <div>
              <h3 className="font-semibold">Recevez les données</h3>
              <p className="text-sm text-muted-foreground">
                Documents et rapports sont automatiquement synchronisés dans votre CRM.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
