"use client"

import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AnalyticsData } from "@/hooks/useAnalyticsData"

interface SalesChartsProps {
    data: AnalyticsData | undefined
    isLoading: boolean
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

export function SalesCharts({ data, isLoading }: SalesChartsProps) {
    if (isLoading || !data) {
        return <div className="h-[300px] w-full animate-pulse bg-muted rounded-xl" />
    }

    return (
        <div className="grid gap-4 md:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>Ventes par Secteur</CardTitle>
                    <CardDescription>Répartition du CA et de la marge par secteur d&apos;activité</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.salesBySector}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis dataKey="name" className="text-xs" />
                                <YAxis className="text-xs" tickFormatter={(value) => `${value / 1000}k`} />
                                <Tooltip
                                    formatter={(value) => [`${Number(value).toLocaleString()} €`, undefined]}
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                                />
                                <Legend />
                                <Bar dataKey="value" name="CA" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="margin" name="Marge" fill="#22c55e" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Croissance par Région</CardTitle>
                    <CardDescription>Top régions en termes de croissance</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={data.salesByRegion}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                                <XAxis type="number" unit="%" />
                                <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                                <Tooltip
                                    formatter={(value) => [`${Number(value)}%`, "Croissance"]}
                                    contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}
                                />
                                <Bar dataKey="growth" fill="#8884d8" radius={[0, 4, 4, 0]}>
                                    {data.salesByRegion.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
