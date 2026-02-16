"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-client"

export interface AnalyticsData {
    kpis: {
        revenue: number
        revenueGrowth: number
        revenueYear: number // CA annuel
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

export function useAnalyticsData() {
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function fetchData() {
            setIsLoading(true)
            setError(null)
            try {
                const now = new Date()
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
                const startOfYear = new Date(now.getFullYear(), 0, 1)
                const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
                const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const endOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
                
                // Convertir en ISO string avec timezone
                const startOfMonthISO = startOfMonth.toISOString()
                const endOfMonthISO = endOfMonth.toISOString()
                const startOfYearISO = startOfYear.toISOString()
                const endOfYearISO = endOfYear.toISOString()
                const startOfPreviousMonthISO = startOfPreviousMonth.toISOString()
                const endOfPreviousMonthISO = endOfPreviousMonth.toISOString()

                // 1. Fetch Stats via RPC
                const { data: statsData, error: statsError } = await supabase.rpc('get_admin_dashboard_stats', {
                    p_period_start: startOfMonthISO,
                    p_period_end: endOfMonthISO,
                    p_demande_status_code: 'DEMANDE',
                    p_devis_status_code: 'DEVIS_ENVOYE',
                    p_accepte_status_code: 'ACCEPTE',
                    p_en_cours_status_code: 'INTER_EN_COURS',
                    p_terminee_status_code: 'INTER_TERMINEE',
                    p_att_acompte_status_code: 'ATT_ACOMPTE',
                    p_valid_status_codes: ['INTER_TERMINEE', 'INTER_EN_COURS', 'ACCEPTE']
                })

                if (statsError) {
                    console.error("RPC Error:", statsError)
                    throw new Error(`Erreur RPC: ${statsError.message || JSON.stringify(statsError)}`)
                }

                if (!statsData) {
                    throw new Error("Aucune donnée retournée par la fonction RPC")
                }

                // 2. Calculer le CA réel depuis intervention_costs (cost_type = 'intervention')
                // CA du mois en cours
                const { data: caMonthData, error: caMonthError } = await supabase
                    .from('intervention_costs')
                    .select('amount, intervention_id, interventions!inner(date)')
                    .eq('cost_type', 'intervention')
                    .gte('interventions.date', startOfMonthISO)
                    .lte('interventions.date', endOfMonthISO)

                if (caMonthError) {
                    console.warn("Erreur lors du calcul du CA mensuel:", caMonthError)
                }

                // CA de l'année en cours
                const { data: caYearData, error: caYearError } = await supabase
                    .from('intervention_costs')
                    .select('amount, intervention_id, interventions!inner(date)')
                    .eq('cost_type', 'intervention')
                    .gte('interventions.date', startOfYearISO)
                    .lte('interventions.date', endOfYearISO)

                if (caYearError) {
                    console.warn("Erreur lors du calcul du CA annuel:", caYearError)
                }

                // CA du mois précédent (pour calcul de croissance)
                const { data: caPreviousMonthData, error: caPreviousMonthError } = await supabase
                    .from('intervention_costs')
                    .select('amount, intervention_id, interventions!inner(date)')
                    .eq('cost_type', 'intervention')
                    .gte('interventions.date', startOfPreviousMonthISO)
                    .lte('interventions.date', endOfPreviousMonthISO)

                if (caPreviousMonthError) {
                    console.warn("Erreur lors du calcul du CA du mois précédent:", caPreviousMonthError)
                }

                // Calculer les sommes
                const caMonth = caMonthData?.reduce((sum: number, item: { amount?: number | string | null }) => sum + Number(item.amount || 0), 0) || 0
                const caYear = caYearData?.reduce((sum: number, item: { amount?: number | string | null }) => sum + Number(item.amount || 0), 0) || 0
                const caPreviousMonth = caPreviousMonthData?.reduce((sum: number, item: { amount?: number | string | null }) => sum + Number(item.amount || 0), 0) || 0

                // Calculer la croissance en pourcentage
                const revenueGrowth = caPreviousMonth > 0 
                    ? ((caMonth - caPreviousMonth) / caPreviousMonth) * 100 
                    : 0

                // 3. Fetch Active Interventions for Map avec les bonnes jointures
                const { data: interventionsData, error: interError } = await supabase
                    .from('interventions')
                    .select(`
                        id,
                        adresse,
                        latitude,
                        longitude,
                        intervention_statuses!inner(code, label),
                        metiers!inner(label)
                    `)
                    .eq('is_active', true)
                    .not('adresse', 'is', null)
                    .limit(100)

                if (interError) {
                    console.error("Interventions Query Error:", interError)
                    throw new Error(`Erreur lors de la récupération des interventions: ${interError.message || JSON.stringify(interError)}`)
                }

                // 4. Récupérer les noms des métiers et agences pour les breakdowns
                const metierIds = (statsData.metierBreakdown || []).map((m: any) => m.metier_id).filter(Boolean)
                const agenceIds = (statsData.agencyBreakdown || []).map((a: any) => a.agence_id).filter(Boolean)

                // Récupérer les métiers
                let metiersMap: Record<string, string> = {}
                if (metierIds.length > 0) {
                    const { data: metiersData, error: metiersError } = await supabase
                        .from('metiers')
                        .select('id, label')
                        .in('id', metierIds)
                    
                    if (metiersError) {
                        console.warn("Erreur lors de la récupération des métiers:", metiersError)
                    } else if (metiersData) {
                        metiersMap = metiersData.reduce((acc: Record<string, string>, m: any) => {
                            acc[m.id] = m.label
                            return acc
                        }, {})
                    }
                }

                // Récupérer les agences
                let agenciesMap: Record<string, string> = {}
                if (agenceIds.length > 0) {
                    const { data: agenciesData, error: agenciesError } = await supabase
                        .from('agencies')
                        .select('id, label')
                        .in('id', agenceIds)
                    
                    if (agenciesError) {
                        console.warn("Erreur lors de la récupération des agences:", agenciesError)
                    } else if (agenciesData) {
                        agenciesMap = agenciesData.reduce((acc: Record<string, string>, a: any) => {
                            acc[a.id] = a.label
                            return acc
                        }, {})
                    }
                }

                // Transform Data - Utiliser les vrais noms de champs de la RPC
                const mainStats = statsData.mainStats || {}
                const statusBreakdown = statsData.statusBreakdown || []
                const metierBreakdown = statsData.metierBreakdown || []
                const agencyBreakdown = statsData.agencyBreakdown || []

                // Calculer les valeurs réelles à partir des données RPC
                // Utiliser le CA réel calculé depuis intervention_costs au lieu de celui de la RPC
                const revenue = caMonth // CA du mois depuis intervention_costs
                const margin = Number(mainStats.marge || 0)
                const nbValides = Number(mainStats.nbValides || 0)
                const nbDemandees = Number(mainStats.nbInterventionsDemandees || 0)

                // Map RPC result to AnalyticsData structure
                const transformedData: AnalyticsData = {
                    kpis: {
                        revenue: revenue, // CA réel du mois depuis intervention_costs
                        revenueGrowth: revenueGrowth, // Croissance calculée depuis intervention_costs
                        revenueYear: caYear, // CA annuel depuis intervention_costs
                        margin: margin,
                        marginGrowth: Number(mainStats.deltaMarge || 0), // Déjà en pourcentage
                        cac: 0, // Non disponible dans la RPC actuelle
                        cacGrowth: 0,
                        ltv: 0, // Non disponible dans la RPC actuelle
                        ltvGrowth: 0,
                        churn: 0, // Non disponible dans la RPC actuelle
                        churnGrowth: 0,
                        dealCount: nbValides,
                        winRate: nbDemandees > 0 ? (nbValides / nbDemandees) * 100 : 0,
                        avgBasket: nbValides > 0 ? revenue / nbValides : 0,
                    },
                    salesBySector: metierBreakdown.map((m: any) => ({
                        name: metiersMap[m.metier_id] || m.metier_id || 'Non défini',
                        value: m.count * 1000, // Estimation basée sur le nombre d'interventions
                        margin: m.count * 300 // Estimation
                    })),
                    salesByRegion: agencyBreakdown.map((a: any) => ({
                        name: agenciesMap[a.agence_id] || a.agence_id || 'Non défini',
                        value: Number(a.totalPaiements || 0),
                        growth: 0 // Non disponible dans la RPC actuelle
                    })),
                    pipeline: statusBreakdown.map((s: any) => ({
                        stage: s.statut_code || 'UNKNOWN',
                        count: Number(s.count || 0),
                        value: Number(s.count || 0) * 500 // Estimation
                    })),
                    predictions: {
                        revenueForecast: [], // À implémenter si nécessaire
                        churnRisk: []
                    },
                    mapInterventions: (interventionsData || []).map((i: any) => ({
                        id: i.id,
                        address: i.adresse || '',
                        status: i.intervention_statuses?.code || 'UNKNOWN',
                        metier: i.metiers?.label || 'Général',
                        lat: i.latitude ? Number(i.latitude) : undefined,
                        lng: i.longitude ? Number(i.longitude) : undefined
                    }))
                }

                setData(transformedData)
            } catch (err: any) {
                const errorMessage = err?.message || err?.toString() || 'Erreur inconnue lors du chargement des données'
                console.error("Failed to fetch analytics data:", err)
                setError(errorMessage)
                setData(null)
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [])

    return { data, isLoading, error }
}
