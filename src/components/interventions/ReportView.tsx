"use client"

import { useState } from "react"
import { Printer, Sparkles, Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { PhotoGallery } from "./PhotoGallery"
import { toast } from "sonner"
import Image from "next/image"

interface ReportViewProps {
    intervention: {
        id: string
        name: string
        date: string
        address: string
        context: string
        clientName?: string
        clientPhone?: string
        statusLabel?: string
    }
}

export function ReportView({ intervention }: ReportViewProps) {
    const [reportContent, setReportContent] = useState<string>("")
    const [isGenerating, setIsGenerating] = useState(false)

    const handleGenerateAI = async () => {
        setIsGenerating(true)
        try {
            const response = await fetch(`/api/interventions/${intervention.id}/report`, {
                method: "POST",
            })

            if (!response.ok) {
                throw new Error("Erreur lors de la génération")
            }

            const data = await response.json()
            setReportContent(data.summary)
            toast.success("Rapport généré avec succès")
        } catch (error) {
            console.error(error)
            toast.error("Impossible de générer le rapport. Veuillez réessayer.")
        } finally {
            setIsGenerating(false)
        }
    }

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Actions Bar - Hidden on print */}
            <div className="flex justify-between items-center print:hidden bg-muted/30 p-4 rounded-lg border">
                <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Rapport d&apos;intervention
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Générez un résumé automatique et imprimez le rapport final.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleGenerateAI} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-purple-600" />}
                        Générer avec IA
                    </Button>
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimer / PDF
                    </Button>
                </div>
            </div>

            {/* Printable Area */}
            <div className="bg-white p-8 shadow-sm rounded-xl border print:border-none print:shadow-none print:p-0 min-h-[297mm]">

                {/* Header */}
                <div className="flex justify-between items-start mb-8 border-b pb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Rapport d&apos;Intervention</h1>
                        <div className="text-sm text-slate-600 space-y-1">
                            <p><span className="font-semibold">Client:</span> {intervention.clientName || "Non spécifié"}</p>
                            <p><span className="font-semibold">Adresse:</span> {intervention.address}</p>
                            <p><span className="font-semibold">Date:</span> {new Date(intervention.date).toLocaleDateString("fr-FR")}</p>
                            <p><span className="font-semibold">Intervention:</span> #{intervention.id.slice(0, 8)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        {/* Logo placeholder - assuming logo exists in public or using text */}
                        <div className="text-xl font-bold text-primary mb-2">GMBS</div>
                        <div className="text-xs text-muted-foreground">
                            Rapport généré le {new Date().toLocaleDateString("fr-FR")}
                        </div>
                    </div>
                </div>

                {/* Info Section */}
                <div className="mb-8 p-4 bg-slate-50 rounded-lg print:bg-slate-50">
                    <h3 className="font-semibold mb-2">Contexte de la demande</h3>
                    <p className="text-sm text-slate-700">{intervention.context}</p>
                </div>

                {/* AI Summary Editor */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        <h3 className="font-semibold">Compte-rendu</h3>
                    </div>

                    <div className="relative">
                        {/* Uses Textarea for editing, but for print we might want a div to expand fully */}
                        <Textarea
                            value={reportContent}
                            onChange={(e) => setReportContent(e.target.value)}
                            placeholder={isGenerating ? "Génération en cours..." : "Le résumé apparaîtra ici après génération via l'IA, ou vous pouvez le rédiger manuellement."}
                            className="min-h-[200px] text-base leading-relaxed print:hidden resize-y"
                        />
                        {/* Print-only exact content view */}
                        <div className="hidden print:block text-base leading-relaxed whitespace-pre-wrap text-justify">
                            {reportContent || "Aucun compte-rendu disponible."}
                        </div>
                    </div>
                </div>

                {/* Photos Section */}
                <div className="break-inside-avoid">
                    <h3 className="font-semibold mb-4 border-b pb-2">Photos & Observations</h3>
                    {/* We reuse PhotoGallery in read-only mode, but we might need specific print styling */}
                    <div className="print:block">
                        <PhotoGallery interventionId={intervention.id} readOnly={true} />
                    </div>
                </div>

            </div>

            {/* Global Print Styles */}
            <style jsx global>{`
        @media print {
          @page {
            margin: 15mm;
            size: A4;
          }
          body {
            background: white;
            color: black;
          }
          /* Hide non-printable elements */
          nav, header, footer, .fixed, .sticky, button {
            display: none !important;
          }
          /* Ensure backgrounds are printed */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
        </div>
    )
}
