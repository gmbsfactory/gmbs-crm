"use client"

import { AdminGuard } from "@/components/admin-dashboard/AdminGuard"
import { AnalyticsFilterBar } from "@/components/admin-analytics/AnalyticsFilterBar"
import { KPIGrid } from "@/components/admin-analytics/KPIGrid"
import { SalesCharts } from "@/components/admin-analytics/SalesCharts"
import { PipelineFunnel } from "@/components/admin-analytics/PipelineFunnel"
import { MLPredictions } from "@/components/admin-analytics/MLPredictions"
import { AskAI } from "@/components/admin-analytics/AskAI"
import { InterventionMap } from "@/components/admin-analytics/InterventionMap"
import { useAnalyticsData } from "@/hooks/useAnalyticsData"

export default function AdminAnalyticsPage() {
    const { data, isLoading, error } = useAnalyticsData()

    return (
        <AdminGuard>
            <div className="flex flex-col min-h-screen bg-background">
                <div className="flex-1 space-y-4 p-8 pt-6">
                    <div className="flex items-center justify-between space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight">Dashboard Analytics</h2>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
                            <p className="font-semibold">Erreur lors du chargement des données</p>
                            <p className="text-sm mt-1">{error.message}</p>
                        </div>
                    )}

                    <AnalyticsFilterBar />

                    <KPIGrid data={data?.kpis} isLoading={isLoading} />

                    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-7">
                        <div className="col-span-4">
                            <SalesCharts data={data || undefined} isLoading={isLoading} />
                        </div>
                        <PipelineFunnel data={data?.pipeline} isLoading={isLoading} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <MLPredictions data={data?.predictions} isLoading={isLoading} />
                        </div>
                        <div className="lg:col-span-1">
                            <AskAI analyticsData={data || undefined} />
                        </div>
                    </div>

                    <div className="grid gap-4">
                        <InterventionMap interventions={data?.mapInterventions} isLoading={isLoading} />
                    </div>
                </div>
            </div>
        </AdminGuard>
    )
}
