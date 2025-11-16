"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Skeleton } from "@/components/ui/skeleton"
import type { AdminDashboardStats } from "@/lib/api/v2"

interface StatusChartProps {
  data?: AdminDashboardStats["statusStats"]
  isLoading?: boolean
}

export function StatusChart({ data, isLoading }: StatusChartProps) {
  // Transformer les données pour le graphique (memoized pour éviter les recalculs)
  const statusData = useMemo(() => {
    if (!data) return []
    return [
      { status: "Demandes reçues", count: data.nbDemandesRecues },
      { status: "Devis envoyés", count: data.nbDevisEnvoye },
      { status: "En cours", count: data.nbEnCours },
      { status: "Attente acompte", count: data.nbAttAcompte },
      { status: "Accepté", count: data.nbAccepte },
      { status: "Terminé", count: data.nbTermine },
    ]
  }, [data])

  if (isLoading) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Statistiques par Statuts</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">Statistiques par Statuts</CardTitle>
      </CardHeader>
      <CardContent>
        {statusData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={statusData} layout="vertical" margin={{ left: 100, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
              <YAxis 
                dataKey="status" 
                type="category" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem"
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Aucune donnée disponible
          </div>
        )}
      </CardContent>
    </Card>
  )
}

