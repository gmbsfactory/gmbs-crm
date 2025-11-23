"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase-client"

export interface AnalyticsData {
    kpis: {
        revenue: number
        revenueGrowth: number
        margin: number
        marginGrowth: number
        cac: number
        cacGrowth: number
        ltv: number
        ltvGrowth: number
        churn: number
        churnGrowth: number
        dealCount: number
        winRate: number
        avgBasket: number
    }
    salesBySector: { name: string; value: number; margin: number }[]
    salesByRegion: { name: string; value: number; growth: number }[]
    pipeline: { stage: string; count: number; value: number }[]
    predictions: {
        revenueForecast: { date: string; value: number; lower: number; upper: number }[]
        churnRisk: { segment: string; risk: number; count: number }[]
    }
    mapInterventions: {
        id: string
        address: string
        status: string
        metier: string
        lat?: number
        lng?: number
    }[]
}

interface UseAnalyticsDataReturn {
    data: AnalyticsData | null
    isLoading: boolean
    error: string | null
    refresh: () => Promise<void>
}

export function useAnalyticsData(): UseAnalyticsDataReturn {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async () => {
        setIsLoading(true)
        setError(null)

        try {
            const now = new Date()
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()

            // 1. Fetch Stats via RPC
            // Passer tous les paramètres comme dans interventionsApi.ts
            const { data: statsData, error: statsError } = await supabase.rpc('get_admin_dashboard_stats', {
                p_period_start: startOfMonth,
                p_period_end: endOfMonth,
                p_demande_status_code: 'DEMANDE',
                p_devis_status_code: 'DEVIS_ENVOYE',
                p_accepte_status_code: 'ACCEPTE',
                p_en_cours_status_code: 'EN_COURS',
                p_terminee_status_code: 'TERMINE',
                p_att_acompte_status_code: 'ATT_ACOMPTE',
                p_valid_status_codes: ['TERMINE', 'EN_COURS', 'ACCEPTE'],
                p_agence_id: null,
                p_gestionnaire_id: null,
                p_metier_id: null,
            })

            if (statsError) {
                const errorMessage = statsError.message || 'Erreur lors de la récupération des statistiques'
                
                // Vérifier si c'est une erreur de fonction non trouvée
                if (errorMessage.includes('Could not find the function') || errorMessage.includes('schema cache')) {
                    const detailedError = `La fonction RPC 'get_admin_dashboard_stats' n'a pas été trouvée dans le schéma Supabase.

SOLUTIONS POSSIBLES:
1. Vérifiez que la migration a été appliquée:
   - Migration: supabase/migrations/20251116000000_create_admin_dashboard_stats_function.sql
   - Commande: supabase db reset (local) ou appliquer la migration en production

2. Si vous êtes en local, redémarrez Supabase:
   - supabase stop
   - supabase start

3. Vérifiez les permissions de la fonction:
   - La fonction doit avoir GRANT EXECUTE ON FUNCTION pour le rôle 'authenticated'

Erreur originale: ${errorMessage}`
                    console.error("RPC Function Not Found:", {
                        message: detailedError,
                        originalError: errorMessage,
                        details: statsError.details,
                        hint: statsError.hint,
                        code: statsError.code
                    })
                    throw new Error(detailedError)
                }
                
                console.error("RPC Error:", {
                    message: errorMessage,
                    details: statsError.details,
                    hint: statsError.hint,
                    code: statsError.code
                })
                throw new Error(errorMessage)
            }

            if (!statsData) {
                throw new Error("Aucune donnée retournée par la fonction RPC")
            }

            // 2. Fetch Active Interventions for Map (avec coordonnées de géocodage)
            const { data: interventionsData, error: interError } = await supabase
                .from('interventions')
                .select(`
                    id,
                    adresse,
                    code_postal,
                    ville,
                    latitude,
                    longitude,
                    status:intervention_statuses(code),
                    metier:metiers(label)
                `)
                .eq('is_active', true)
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .limit(500)

            if (interError) {
                const errorMessage = interError.message || 'Erreur lors de la récupération des interventions'
                console.error("Interventions Query Error:", {
                    message: errorMessage,
                    details: interError.details,
                    hint: interError.hint,
                    code: interError.code
                })
                throw new Error(errorMessage)
            }

            // Transform Data
            const mainStats = statsData?.mainStats || {}
            const statusBreakdown = statsData?.statusBreakdown || []
            const metierBreakdown = statsData?.metierBreakdown || []
            const agencyBreakdown = statsData?.agencyBreakdown || []

            // Map RPC result to AnalyticsData structure
            // La fonction RPC retourne nbInterventionsDemandees, pas nbDemandees
            const nbDemandees = mainStats.nbInterventionsDemandees || 0
            const nbValides = mainStats.nbValides || 0
            const chiffreAffaires = mainStats.chiffreAffaires || 0

            const transformedData: AnalyticsData = {
                kpis: {
                    revenue: chiffreAffaires,
                    revenueGrowth: 0, // Needs comparison with previous period
                    margin: chiffreAffaires * 0.3, // Estimated margin
                    marginGrowth: 0,
                    cac: 0, // Not in RPC
                    cacGrowth: 0,
                    ltv: 0, // Not in RPC
                    ltvGrowth: 0,
                    churn: 0, // Not in RPC
                    churnGrowth: 0,
                    dealCount: nbValides,
                    winRate: nbDemandees > 0 ? (nbValides / nbDemandees) : 0,
                    avgBasket: nbValides > 0 ? (chiffreAffaires / nbValides) : 0,
                },
                salesBySector: metierBreakdown.map((m: any) => ({
                    name: m.metier_id || 'Inconnu',
                    value: m.count * 1000, // Mock value per count
                    margin: m.count * 300
                })),
                salesByRegion: agencyBreakdown.map((a: any) => ({
                    name: a.agence_id || 'Inconnu',
                    value: a.totalPaiements || 0,
                    growth: 0
                })),
                pipeline: statusBreakdown.map((s: any) => ({
                    stage: s.statut_code || 'UNKNOWN',
                    count: s.count || 0,
                    value: (s.count || 0) * 500 // Est value
                })),
                predictions: {
                    revenueForecast: [],
                    churnRisk: []
                },
                mapInterventions: interventionsData?.map((i: any) => {
                    // Construire l'adresse complète à partir des colonnes réelles
                    const addressParts = [
                        i.adresse,
                        i.code_postal,
                        i.ville
                    ].filter(Boolean)
                    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : ''
                    
                    return {
                        id: i.id,
                        address: fullAddress,
                        status: i.status?.code || 'UNKNOWN',
                        metier: i.metier?.label || 'Général',
                        lat: i.latitude || undefined,
                        lng: i.longitude || undefined
                    }
                }) || []
            }

            setData(transformedData)
        } catch (err) {
            const errorMessage = err instanceof Error 
                ? err.message 
                : typeof err === 'string' 
                    ? err 
                    : 'Erreur inconnue lors du chargement des données analytiques'
            
            setError(errorMessage)
            console.error("Failed to fetch analytics data:", errorMessage, err)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const refresh = useCallback(async () => {
        await fetchData()
    }, [fetchData])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return { data, isLoading, error, refresh }
}
