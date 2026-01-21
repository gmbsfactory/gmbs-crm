'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, FileText, Image, Loader2, AlertCircle, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface PortalReport {
  id: string
  content: string
  status: string
  createdAt: string
  submittedAt: string
}

interface PortalPhoto {
  id: string
  url: string
  filename: string
  comment: string | null
}

interface PortalReportSectionProps {
  interventionId: string
  artisanId: string | null
  currentStatusCode: string | null
  hasPortalReport: boolean  // Flag pour savoir si un rapport existe
  onValidateReport: () => Promise<void>
  onRefresh?: () => void
}

export function PortalReportSection({
  interventionId,
  artisanId,
  currentStatusCode,
  hasPortalReport,
  onValidateReport,
  onRefresh
}: PortalReportSectionProps) {
  const [report, setReport] = useState<PortalReport | null>(null)
  const [photos, setPhotos] = useState<PortalPhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isValidating, setIsValidating] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  // Afficher le bouton de validation si INTER_EN_COURS + rapport soumis
  const canValidate = currentStatusCode === 'INTER_EN_COURS' && hasPortalReport && report !== null
  const isCompleted = currentStatusCode === 'INTER_TERMINEE'

  useEffect(() => {
    if (!artisanId) {
      setIsLoading(false)
      return
    }

    const fetchReport = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/portal-external/intervention/${interventionId}/report?artisanId=${artisanId}`
        )

        if (response.ok) {
          const data = await response.json()
          setReport(data.report)
          setPhotos(data.photos || [])
        } else if (response.status !== 404) {
          console.error('Failed to fetch report:', await response.text())
        }
      } catch (error) {
        console.error('Failed to fetch portal report:', error)
        toast.error('Erreur lors de la récupération du rapport')
      } finally {
        setIsLoading(false)
      }
    }

    fetchReport()
  }, [interventionId, artisanId])

  const handleValidate = async () => {
    setIsValidating(true)
    try {
      await onValidateReport()
      // Le toast est géré par onValidateReport
      onRefresh?.()
    } catch (error) {
      console.error('Validation error:', error)
      toast.error('Erreur lors de la validation du rapport')
    } finally {
      setIsValidating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Chargement du rapport...</span>
      </div>
    )
  }

  if (!artisanId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucun artisan assigné à cette intervention</p>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Aucun rapport soumis par l&apos;artisan</p>
        <p className="text-xs mt-1 opacity-70">
          Le rapport apparaîtra ici une fois que l&apos;artisan l&apos;aura transmis
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Validation Banner - Afficher si EN COURS + rapport soumis */}
      {canValidate && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-purple-900">Rapport en attente de validation</p>
              <p className="text-sm text-purple-700">
                Soumis le {format(new Date(report.submittedAt), 'PPP à HH:mm', { locale: fr })}
              </p>
            </div>
          </div>
          <Button
            onClick={handleValidate}
            disabled={isValidating}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isValidating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Validation...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Valider le rapport
              </>
            )}
          </Button>
        </div>
      )}

      {/* Info: Rapport déjà validé (intervention terminée) */}
      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          <div className="text-sm text-green-900">
            <p className="font-medium">Rapport validé</p>
            <p className="opacity-80">Ce rapport a été validé et l&apos;intervention est terminée.</p>
          </div>
        </div>
      )}

      {/* Tabs: Rapport / Photos */}
      <Tabs defaultValue="rapport" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rapport" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Rapport
          </TabsTrigger>
          <TabsTrigger value="photos" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Photos ({photos.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rapport" className="mt-4">
          <ScrollArea className="h-[500px] rounded-lg border bg-muted/30 p-6">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
                {report.content}
              </pre>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          {photos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/30">
              <Image className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Aucune photo jointe au rapport</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                  onClick={() => setSelectedPhoto(photo.url)}
                >
                  <img
                    src={photo.url}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                  />
                  {photo.comment && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                      <p className="text-white text-xs line-clamp-2">{photo.comment}</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Image className="h-8 w-8 text-white" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={selectedPhoto}
            alt="Photo agrandie"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
