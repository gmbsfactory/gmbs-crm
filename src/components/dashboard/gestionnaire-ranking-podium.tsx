"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { interventionsApi } from "@/lib/api/v2"
import type { MarginRankingResult } from "@/lib/api/v2"
import { Trophy } from "lucide-react"
import Loader from "@/components/ui/Loader"
import { PodiumCard } from "@/components/dashboard/leaderboard/PodiumCard"
import { BottomCard } from "@/components/dashboard/leaderboard/BottomCard"

interface GestionnaireRankingPodiumProps {
  period?: {
    startDate?: string
    endDate?: string
  }
}

export function GestionnaireRankingPodium({ period }: GestionnaireRankingPodiumProps) {
  const [ranking, setRanking] = useState<MarginRankingResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'margin' | 'revenue'>('margin')

  useEffect(() => {
    let cancelled = false

    const loadRanking = async () => {
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

        const rankingData = await interventionsApi.getMarginRankingByPeriod(startDate, endDate)

        if (!cancelled) {
          setRanking(rankingData)
          setLoading(false)
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Erreur lors du chargement du classement")
          setLoading(false)
        }
      }
    }

    loadRanking()

    return () => {
      cancelled = true
    }
  }, [period?.startDate, period?.endDate])

  // IMPORTANT: useMemo doit être appelé AVANT les early returns pour respecter les règles des Hooks
  const sortedRankings = useMemo(() => {
    if (!ranking || ranking.rankings.length === 0) {
      return []
    }
    const sorted = [...ranking.rankings].sort((a, b) => {
      if (sortBy === 'revenue') {
        return b.total_revenue - a.total_revenue
      }
      // Par défaut, trier par marge
      return b.total_margin - a.total_margin
    })
    
    // Réassigner les rangs après le tri
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1
    }))
  }, [ranking, sortBy])

  const top3 = sortedRankings.slice(0, 3)
  const bottom3 = sortedRankings.length > 3 ? sortedRankings.slice(-3) : []
  const totalRankings = sortedRankings.length

  if (loading) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30">
        <CardHeader>
          <CardTitle>Podium</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px]">
            <div style={{ transform: 'scale(1.25)' }}>
              <Loader />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30">
        <CardHeader>
          <CardTitle>Podium</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!ranking || ranking.rankings.length === 0) {
    return (
      <Card className="bg-background border-border/5 shadow-sm/30">
        <CardHeader>
          <CardTitle>Podium</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Aucun gestionnaire avec des interventions sur cette période
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-background border-border/5 shadow-sm/30 h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center gap-3">
            <Trophy className="w-6 h-6 text-gold" />
            <CardTitle className="text-xl font-bold">Podium</CardTitle>
            <Trophy className="w-6 h-6 text-gold" />
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="sort-switch" className="text-sm text-muted-foreground cursor-pointer">
              Marge
            </Label>
            <Switch
              id="sort-switch"
              checked={sortBy === 'revenue'}
              onCheckedChange={(checked) => setSortBy(checked ? 'revenue' : 'margin')}
            />
            <Label htmlFor="sort-switch" className="text-sm text-muted-foreground cursor-pointer">
              CA
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 flex-1 overflow-auto pb-[30px]">
        {/* Podium - Top 3 */}
        {top3.length > 0 && (
          <div className="relative">
            <div className="flex items-end justify-center gap-2 md:gap-4 pt-12">
              {top3[1] && <PodiumCard entry={top3[1]} position={2} displayMetric={sortBy} />}
              {top3[0] && <PodiumCard entry={top3[0]} position={1} displayMetric={sortBy} />}
              {top3[2] && <PodiumCard entry={top3[2]} position={3} displayMetric={sortBy} />}
            </div>
          </div>
        )}

        {/* Bottom 3 */}
        {bottom3.length > 0 && totalRankings > 3 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground text-center">
              Reste du classement
            </h2>
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              {bottom3.map((entry) => (
                <BottomCard
                  key={entry.user_id}
                  entry={entry}
                  position={entry.rank}
                  totalRankings={totalRankings}
                  displayMetric={sortBy}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

