"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Intervention } from "@/lib/api"
import { supabase } from "@/lib/supabase-client"
import { useCallback, useEffect, useState } from "react"

export default function InterventionsCompatContainer() {
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)

  // Chargement des données depuis Supabase
  useEffect(() => {
    const loadInterventions = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Charger seulement les 50 premières interventions (lazy loading)
        const { data, error } = await supabase
          .from('interventions')
          .select(`
            *,
            agencies:agence_id(label),
            clients:client_id(firstname, lastname, email, telephone),
            users:assigned_user_id(username, firstname, lastname),
            intervention_statuses:statut_id(label, color),
            metiers:metier_id(code, label)
          `)
          .order('created_at', { ascending: false })
          .range(0, 34)
        
        if (error) throw error
        setInterventions(data || [])
        
        // Récupérer le total
        const { count } = await supabase
          .from('interventions')
          .select('*', { count: 'exact', head: true })
        
        setTotalCount(count || 0)
        setHasMore(data.length === 35)
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement')
        console.error('Erreur lors du chargement des interventions:', err)
      } finally {
        setLoading(false)
      }
    }

    loadInterventions()
  }, [])

  // Fonction pour charger plus d'interventions (lazy loading)
  const loadMoreInterventions = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      const currentOffset = interventions.length;
      const { data, error } = await supabase
        .from('interventions')
        .select(`
          *,
          agencies:agence_id(label),
          clients:client_id(firstname, lastname, email, telephone),
          users:assigned_user_id(username, firstname, lastname),
          intervention_statuses:statut_id(label, color),
          metiers:metier_id(code, label)
        `)
        .order('created_at', { ascending: false })
        .range(currentOffset, currentOffset + 34)
      
      if (error) throw error
      
      const newInterventions = data || [];
      
      setInterventions(prev => [...prev, ...newInterventions]);
      setHasMore(newInterventions.length === 35);
      
    } catch (err) {
      console.error('Erreur lors du chargement de plus d\'interventions:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [interventions.length, hasMore, loadingMore]);

  // Affichage de l'erreur
  if (error) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Erreur de chargement</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  // Affichage du loading
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des interventions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Interventions</h1>
          <p className="text-muted-foreground">
            Gérez vos interventions GMBS
            {totalCount !== null && (
              <span className="ml-2 text-sm text-muted-foreground">
                ({interventions.length} / {totalCount})
              </span>
            )}
          </p>
        </div>
        <Button>
          <span>Nouvelle Intervention</span>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {interventions.map((intervention: any) => {
          const client = intervention.clients || {}
          const status = intervention.intervention_statuses || {}
          return (
            <Card key={intervention.id}>
              <CardHeader>
                <CardTitle className="text-lg">{intervention.contexte_intervention || intervention.contexteIntervention || 'Intervention'}</CardTitle>
                <CardDescription>{client.firstname || ''} {client.lastname || ''}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{status.label || intervention.statut || 'N/A'}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {intervention.cout_intervention || intervention.coutIntervention || 0}€
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Bouton "Charger plus" pour le lazy loading */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button 
            onClick={loadMoreInterventions}
            disabled={loadingMore}
            variant="outline"
            className="w-full max-w-xs"
          >
            {loadingMore ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                Chargement...
              </>
            ) : (
              `Charger plus d'interventions (${interventions.length}${totalCount ? ` / ${totalCount}` : ''})`
            )}
          </Button>
        </div>
      )}

      {/* Message de fin */}
      {!hasMore && interventions.length > 0 && (
        <div className="text-center py-4 text-muted-foreground">
          <p>Toutes les interventions ont été chargées ({totalCount || interventions.length} interventions)</p>
        </div>
      )}
    </div>
  )
}


