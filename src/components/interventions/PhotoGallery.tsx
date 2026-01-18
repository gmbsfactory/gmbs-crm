"use client"

import { useState, useEffect, useRef, useCallback } from "react"

// Web Speech API type (browser-specific)
interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}
import { Upload, X, Mic, MicOff, Image as ImageIcon, Save, Loader2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
    uploadInterventionDocument,
    listInterventionDocuments,
    removeInterventionDocument,
    updateDocumentMetadata
} from "@/lib/api/documents"
import type { InterventionDocumentDTO } from "@/types/interventions"
import Image from "next/image"

interface PhotoGalleryProps {
    interventionId: string
    readOnly?: boolean
}

interface PhotoCardProps {
    document: InterventionDocumentDTO
    onDelete: (id: string) => void
    onUpdateMetadata: (id: string, metadata: Record<string, unknown>) => void
    readOnly?: boolean
}

function PhotoCard({ document, onDelete, onUpdateMetadata, readOnly }: PhotoCardProps) {
    const [comment, setComment] = useState((document.metadata?.comment as string) || "")
    const [isListening, setIsListening] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

    // Debounce save logic could be added, but for now we use onBlur or explicit save button/icon status
    // Let's autosave on blur
    const handleBlur = async () => {
        if (comment !== (document.metadata?.comment as string)) {
            setIsSaving(true)
            try {
                await onUpdateMetadata(document.id, { ...document.metadata, comment })
                toast.success("Commentaire enregistré")
            } catch (error) {
                toast.error("Erreur lors de l'enregistrement du commentaire")
            } finally {
                setIsSaving(false)
            }
        }
    }

    const toggleListening = () => {
        if (isListening) {
            recognitionRef.current?.stop()
            setIsListening(false)
        } else {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            if (!SpeechRecognition) {
                toast.error("La reconnaissance vocale n'est pas supportée par votre navigateur.")
                return
            }

            const recognition = new SpeechRecognition()
            recognition.lang = "fr-FR"
            recognition.continuous = false
            recognition.interimResults = false

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript
                setComment((prev) => (prev ? `${prev} ${transcript}` : transcript))
            }

            recognition.onerror = (event) => {
                console.error("Speech recognition error", event.error)
                setIsListening(false)
            }

            recognition.onend = () => {
                setIsListening(false)
            }

            recognitionRef.current = recognition
            recognition.start()
            setIsListening(true)
        }
    }

    return (
        <Card className="overflow-hidden group">
            <div className="relative aspect-video bg-muted flex items-center justify-center">
                {document.publicUrl ? (
                    <Image
                        src={document.publicUrl}
                        alt={document.name}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                    />
                ) : (
                    <ImageIcon className="h-10 w-10 text-muted-foreground" />
                )}

                {!readOnly && (
                    <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => onDelete(document.id)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={`comment-${document.id}`} className="text-xs font-medium text-muted-foreground">
                        Commentaire
                    </Label>
                    {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>

                <div className="relative">
                    <Textarea
                        id={`comment-${document.id}`}
                        placeholder="Ajouter une observation..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        onBlur={handleBlur}
                        readOnly={readOnly}
                        className="min-h-[80px] text-sm resize-none pr-10"
                    />
                    {!readOnly && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={`absolute bottom-1 right-1 h-8 w-8 ${isListening ? "text-red-500 animate-pulse" : "text-muted-foreground"}`}
                            onClick={toggleListening}
                        >
                            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export function PhotoGallery({ interventionId, readOnly = false }: PhotoGalleryProps) {
    const [documents, setDocuments] = useState<InterventionDocumentDTO[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const loadDocuments = useCallback(async () => {
        try {
            setIsLoading(true)
            const docs = await listInterventionDocuments(interventionId)
            // Filter for images only for this view, or show all? 
            // For Photo-to-Report, we mainly care about images.
            // But let's show all for now, maybe filter logic later.
            const images = docs.filter(d => d.mimeType?.startsWith('image/'))
            setDocuments(images)
        } catch (error) {
            console.error(error)
            toast.error("Impossible de charger les photos")
        } finally {
            setIsLoading(false)
        }
    }, [interventionId])

    useEffect(() => {
        loadDocuments()
    }, [loadDocuments])

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setIsUploading(true)
            const files = Array.from(e.target.files)

            let successCount = 0

            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    toast.warning(`Le fichier ${file.name} n'est pas une image. Ignoré.`)
                    continue
                }

                try {
                    // Read file as ArrayBuffer
                    const buffer = await file.arrayBuffer()

                    await uploadInterventionDocument({
                        interventionId,
                        fileName: file.name,
                        mimeType: file.type,
                        buffer,
                        metadata: {
                            comment: "",
                            source: "gallery_upload"
                        }
                    })
                    successCount++
                } catch (error) {
                    console.error(`Erreur upload ${file.name}:`, error)
                    toast.error(`Erreur lors de l'envoi de ${file.name}`)
                }
            }

            if (successCount > 0) {
                toast.success(`${successCount} photo(s) ajoutée(s)`)
                loadDocuments()
            }
            setIsUploading(false)
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Êtes-vous sûr de vouloir supprimer cette photo ?")) {
            try {
                await removeInterventionDocument({ documentId: id })
                setDocuments(prev => prev.filter(d => d.id !== id))
                toast.success("Photo supprimée")
            } catch (error) {
                toast.error("Erreur lors de la suppression")
            }
        }
    }

    const handleUpdateMetadata = async (id: string, metadata: Record<string, unknown>) => {
        // Optimistic update in local state (optional but good for UX)
        // But here we just wait for API mostly as it's triggered on blur
        await updateDocumentMetadata(id, metadata)
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, metadata } : d))
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
    }

    return (
        <div className="space-y-6">
            {!readOnly && (
                <div className="flex justify-end">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept="image/*"
                        onChange={handleFileSelect}
                    />
                    <Button disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Ajouter des photos
                    </Button>
                </div>
            )}

            {documents.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                    <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-2 text-lg font-medium">Aucune photo</h3>
                    <p className="text-sm text-muted-foreground">Prenez des photos pour commencer le rapport</p>
                    {!readOnly && (
                        <Button variant="link" onClick={() => fileInputRef.current?.click()} className="mt-2">
                            Ajouter maintenant
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {documents.map(doc => (
                        <PhotoCard
                            key={doc.id}
                            document={doc}
                            onDelete={handleDelete}
                            onUpdateMetadata={handleUpdateMetadata}
                            readOnly={readOnly}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
