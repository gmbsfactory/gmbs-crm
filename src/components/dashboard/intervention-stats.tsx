"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { interventionsApi } from "@/lib/api/v2"
import { supabase } from "@/lib/supabase-client"
import type { InterventionStatsByStatus } from "@/lib/api/v2"
import Loader from "@/components/ui/Loader"

interface InterventionStatsCardsProps {
  period?: {
    startDate?: string
    endDate?: string
  }
}

export function InterventionStatsCards({ period }: InterventionStatsCardsProps) {
  const [stats, setStats] = useState<InterventionStatsByStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Charger l'utilisateur actuel
  useEffect(() => {
    let cancelled = false

    const loadUser = async () => {
      try {
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token

        if (!token) {
          if (!cancelled) {
            setUserId(null)
            setLoading(false)
          }
          return
        }

        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok) {
          throw new Error("Impossible de récupérer l'utilisateur")
        }

        const payload = await response.json()
        const user = payload?.user ?? null

        if (!cancelled) {
          setUserId(user?.id ?? null)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Erreur lors du chargement de l'utilisateur")
          setLoading(false)
        }
      }
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [])

  // Charger les statistiques une fois l'utilisateur chargé
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    let cancelled = false

    const loadStats = async () => {
      try {
        setLoading(true)
        setError(null)

        // Calculer les dates si non fournies (mois en cours par défaut)
        let startDate = period?.startDate
        let endDate = period?.endDate

        if (!startDate || !endDate) {
          const now = new Date()
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

          startDate = startDate || startOfMonth.toISOString()
          endDate = endDate || endOfMonth.toISOString()
        }

        const statsData = await interventionsApi.getStatsByUser(userId, startDate, endDate)

        if (!cancelled) {
          setStats(statsData)
          setLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Erreur lors du chargement des statistiques")
          setLoading(false)
        }
      }
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [userId, period?.startDate, period?.endDate])

  // Fonction helper pour chercher plusieurs variantes de labels
  const getStatusCount = (labels: string[]): number => {
    if (!stats?.by_status_label) return 0
    for (const label of labels) {
      if (stats.by_status_label[label] !== undefined) {
        return stats.by_status_label[label]
      }
    }
    return 0
  }

  // Calculer les statistiques principales
  const activeInterventions = getStatusCount([
    "En cours",
    "Inter en cours",
    "INTER_EN_COURS",
  ])
  
  const finishedInterventions = getStatusCount([
    "Terminé",
    "Inter terminée",
    "INTER_TERMINEE",
  ])
  
  const pendingInterventions = getStatusCount([
    "Demandé",
    "DEMANDE",
  ])
  
  const standByInterventions = getStatusCount([
    "Stand by",
    "Stand-by",
    "STAND_BY",
  ])
  
  const totalInterventions = stats?.total || 0

  // Si en cours de chargement
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <div style={{ transform: 'scale(1.25)' }}>
                  <Loader />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Si erreur
  if (error) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card className="col-span-full">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Si pas d'utilisateur
  if (!userId) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <Card className="col-span-full">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Veuillez vous connecter pour voir vos statistiques
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Afficher les statistiques
  const statsCards = [
    {
      title: "Interventions actives",
      value: activeInterventions.toString(),
      description: "En cours",
    },
    {
      title: "Interventions terminées",
      value: finishedInterventions.toString(),
      description: "Ce mois",
    },
    {
      title: "Total interventions",
      value: totalInterventions.toString(),
      description: "Ce mois",
    },
    {
      title: "En attente",
      value: (pendingInterventions + standByInterventions).toString(),
      description: "Demandé / Stand-by",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {statsCards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.description && (
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

