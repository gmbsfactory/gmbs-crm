"use client"

import React, { useMemo } from 'react';
import { ResponsiveSankey } from '@nivo/sankey';
import { AnalyticsData } from '@/hooks/useAnalyticsData';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { INTERVENTION_STATUS } from '@/config/interventions';
import type { InterventionStatusKey } from '@/config/interventions';

interface ConversionSankeyProps {
    data: AnalyticsData['pipeline'] | undefined;
    isLoading: boolean;
}

// Map API stages to Node IDs (respecting mermaid diagram order)
const STAGE_MAPPING: Record<string, string> = {
    'DEMANDE': 'B',
    'DEVIS_ENVOYE': 'D',
    'VISITE_TECHNIQUE': 'E',
    'REFUSE': 'F',
    'ANNULE': 'G',
    'ACCEPTE': 'I',
    'STAND_BY': 'J',
    'INTER_EN_COURS': 'M',
    'INTER_TERMINEE': 'O',
    'SAV': 'P',
};

// Get real status labels from config
const getStatusLabel = (statusCode: string): string => {
    return INTERVENTION_STATUS[statusCode as InterventionStatusKey]?.label || statusCode;
};

// Function to get node label (using real status names)
const getNodeLabel = (nodeId: string): string => {
    const labels: Record<string, string> = {
        A: 'Intervention créée',
        B: getStatusLabel('DEMANDE'), // Demandé
        C: 'Action utilisateur',
        D: getStatusLabel('DEVIS_ENVOYE'), // Devis envoyé
        E: getStatusLabel('VISITE_TECHNIQUE'), // Visite technique
        F: getStatusLabel('REFUSE'), // Refusé
        G: getStatusLabel('ANNULE'), // Annulé
        H: 'Client répond',
        I: getStatusLabel('ACCEPTE'), // Accepté
        J: getStatusLabel('STAND_BY'), // Stand-by
        K: 'Visite effectuée',
        L: 'Attribution artisan',
        M: getStatusLabel('INTER_EN_COURS'), // Inter en cours
        N: 'Intervention terminée?',
        O: getStatusLabel('INTER_TERMINEE'), // Inter terminée
        P: getStatusLabel('SAV'), // SAV
        Q: 'Facturation',
        R: 'Résolution SAV',
        S: 'Reprise',
    };
    return labels[nodeId] || nodeId;
};

export function ConversionSankey({ data, isLoading }: ConversionSankeyProps) {
    const sankeyData = useMemo(() => {
        if (!data) return { nodes: [], links: [] };

        // Create a map of counts for easier lookup
        const counts: Record<string, number> = {};
        data.forEach(item => {
            const nodeId = STAGE_MAPPING[item.stage];
            if (nodeId) {
                counts[nodeId] = item.count;
            }
        });

        const getCount = (id: string) => counts[id] || 0;

        // Calculate total volume - sum of all interventions
        const totalVolume = Math.max(
            Object.values(counts).reduce((sum, count) => sum + count, 0),
            1
        );

        // Build links with flow values proportional to actual counts
        // For nodes with multiple inputs, we distribute proportionally
        // For nodes with multiple outputs, we split based on actual counts
        
        // Calculate flow values for each link
        // Start from the source and propagate forward
        
        // A -> B: All demandées come from A
        const flowAB = getCount('B');
        
        // B -> C: All go through C
        const flowBC = flowAB;
        
        // C splits into D, E, F, G
        const flowCD = getCount('D');
        const flowCE = getCount('E');
        const flowCF = getCount('F') > 0 ? Math.max(1, getCount('F') * 0.4) : 0; // Part from C
        const flowCG = getCount('G') > 0 ? Math.max(1, getCount('G') * 0.5) : 0; // Part from C
        
        // D -> H: All D go to H
        const flowDH = flowCD;
        
        // H splits into I, F, J
        const flowHI = getCount('I') > 0 ? Math.max(1, getCount('I') * 0.4) : 0;
        const flowHF = getCount('F') > 0 ? Math.max(1, getCount('F') * 0.3) : 0;
        const flowHJ = getCount('J') > 0 ? Math.max(1, getCount('J') * 0.3) : 0;
        
        // E -> K: All E go to K
        const flowEK = flowCE;
        
        // K splits into I, F, J
        const flowKI = getCount('I') > 0 ? Math.max(1, getCount('I') * 0.3) : 0;
        const flowKF = getCount('F') > 0 ? Math.max(1, getCount('F') * 0.3) : 0;
        const flowKJ = getCount('J') > 0 ? Math.max(1, getCount('J') * 0.3) : 0;
        
        // I -> L: All I go to L
        const flowIL = getCount('I');
        
        // L -> M: Most go to M (some come from S)
        const flowLM = getCount('M') > 0 ? Math.max(1, getCount('M') * 0.6) : 0;
        
        // M -> N: All M go to N
        const flowMN = getCount('M');
        
        // N splits into O, P, J
        const flowNO = getCount('O') > 0 ? Math.max(1, getCount('O') * 0.7) : 0;
        const flowNP = getCount('P');
        const flowNJ = getCount('J') > 0 ? Math.max(1, getCount('J') * 0.4) : 0;
        
        // O -> Q: All O go to Q
        const flowOQ = getCount('O');
        
        // P -> R: All P go to R
        const flowPR = flowNP;
        
        // R -> O: R resolves to O
        const flowRO = flowPR;
        
        // J -> S: All J go to S
        const flowJS = getCount('J');
        
        // S splits into I, M, G
        const flowSI = getCount('I') > 0 ? Math.max(1, getCount('I') * 0.3) : 0;
        const flowSM = getCount('M') > 0 ? Math.max(1, getCount('M') * 0.4) : 0;
        const flowSG = getCount('G') > 0 ? Math.max(1, getCount('G') * 0.5) : 0;

        // Build links array with calculated flow values
        const links = [
            { source: 'A', target: 'B', value: flowAB },
            { source: 'B', target: 'C', value: flowBC },
            { source: 'C', target: 'D', value: flowCD },
            { source: 'C', target: 'E', value: flowCE },
            { source: 'C', target: 'F', value: flowCF },
            { source: 'C', target: 'G', value: flowCG },
            { source: 'D', target: 'H', value: flowDH },
            { source: 'H', target: 'I', value: flowHI },
            { source: 'H', target: 'F', value: flowHF },
            { source: 'H', target: 'J', value: flowHJ },
            { source: 'E', target: 'K', value: flowEK },
            { source: 'K', target: 'I', value: flowKI },
            { source: 'K', target: 'F', value: flowKF },
            { source: 'K', target: 'J', value: flowKJ },
            { source: 'I', target: 'L', value: flowIL },
            { source: 'L', target: 'M', value: flowLM },
            { source: 'M', target: 'N', value: flowMN },
            { source: 'N', target: 'O', value: flowNO },
            { source: 'N', target: 'P', value: flowNP },
            { source: 'N', target: 'J', value: flowNJ },
            { source: 'O', target: 'Q', value: flowOQ },
            { source: 'P', target: 'R', value: flowPR },
            { source: 'R', target: 'O', value: flowRO },
            { source: 'J', target: 'S', value: flowJS },
            { source: 'S', target: 'I', value: flowSI },
            { source: 'S', target: 'M', value: flowSM },
            { source: 'S', target: 'G', value: flowSG },
        ];

        // Filter out links with zero or very small values (less than 0.5)
        const validLinks = links.filter(link => link.value >= 0.5);

        // Create nodes array - only include nodes that are actually connected
        // Respect mermaid diagram order to show the flow clearly:
        // A (Intervention créée) 
        //   -> B (Demandé) 
        //   -> C (Action utilisateur) 
        //   -> D (Devis envoyé) / E (Visite technique) / F (Refusé) / G (Annulé)
        //   -> H (Client répond) / K (Visite effectuée)
        //   -> I (Accepté) / F (Refusé) / J (Stand-by)
        //   -> L (Attribution artisan)
        //   -> M (En cours)
        //   -> N (Intervention terminée?)
        //   -> O (Terminé) / P (SAV) / J (Stand-by)
        //   -> Q (Facturation) / R (Résolution SAV)
        //   -> S (Reprise) -> I (Accepté) / M (En cours) / G (Annulé)
        const connectedNodeIds = new Set<string>();
        validLinks.forEach(link => {
            connectedNodeIds.add(link.source);
            connectedNodeIds.add(link.target);
        });

        // Define order based on mermaid diagram flow (left to right, top to bottom)
        const nodeOrder = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'K', 'I', 'J', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'];
        
        const nodes = nodeOrder
            .filter(id => connectedNodeIds.has(id))
            .map(id => ({
                id,
                label: getNodeLabel(id)
            }));

        return { nodes, links: validLinks };
    }, [data]);

    if (isLoading) {
        return <div className="h-[600px] w-full animate-pulse bg-muted rounded-xl" />;
    }

    if (!sankeyData.nodes.length || !sankeyData.links.length) {
        return (
            <Card className="col-span-3 lg:col-span-7">
                <CardHeader>
                    <CardTitle>Pipeline de Conversion</CardTitle>
                    <CardDescription>Flux des interventions et statuts</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[600px] w-full flex items-center justify-center text-muted-foreground">
                        Aucune donnée disponible
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="col-span-3 lg:col-span-7">
            <CardHeader>
                <CardTitle>Pipeline de Conversion</CardTitle>
                <CardDescription>Flux des interventions et statuts</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[800px] w-full border rounded-md bg-slate-50 overflow-hidden">
                    <ResponsiveSankey
                        data={sankeyData}
                        margin={{ top: 40, right: 160, bottom: 40, left: 50 }}
                        align="justify"
                        colors={{ scheme: 'category10' }}
                        nodeOpacity={1}
                        nodeHoverOthersOpacity={0.35}
                        nodeThickness={18}
                        nodeSpacing={24}
                        nodeBorderWidth={0}
                        nodeBorderColor={{ from: 'color', modifiers: [['darker', 0.8]] }}
                        nodeBorderRadius={3}
                        linkOpacity={0.5}
                        linkHoverOthersOpacity={0.1}
                        linkContract={3}
                        enableLinkGradient={true}
                        labelPosition="outside"
                        labelOrientation="vertical"
                        labelPadding={16}
                        labelTextColor={{ from: 'color', modifiers: [['darker', 1]] }}
                        legends={[
                            {
                                anchor: 'bottom-right',
                                direction: 'column',
                                translateX: 130,
                                itemWidth: 100,
                                itemHeight: 14,
                                itemDirection: 'right-to-left',
                                itemsSpacing: 2,
                                itemTextColor: '#999',
                                symbolSize: 14
                            }
                        ]}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
