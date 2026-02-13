"use client"

import React, { useCallback, useRef, useState } from "react"
import { Upload, File, X, CheckCircle, Loader2 } from "lucide-react"
import { useDocumentUpload } from "@/hooks/useDocumentUpload"
import { cn } from "@/lib/utils"

interface AIStatusFileUploadProps {
  interventionId: string
  documentKind: string
  documentLabel: string
  onUploadComplete?: (url: string) => void
}

/**
 * Composant compact d'upload fichier pour les transitions de statut.
 * S'integre dans le panneau IA lateral sous les boutons d'action.
 */
export function AIStatusFileUpload({
  interventionId,
  documentKind,
  documentLabel,
  onUploadComplete,
}: AIStatusFileUploadProps) {
  const { uploadDocument, loading, error, progress } = useDocumentUpload()
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setUploadedFile(file)
    setUploadSuccess(false)
    const url = await uploadDocument(file, 'intervention', interventionId, documentKind)
    if (url) {
      setUploadSuccess(true)
      onUploadComplete?.(url)
    }
  }, [interventionId, documentKind, uploadDocument, onUploadComplete])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleRemove = useCallback(() => {
    setUploadedFile(null)
    setUploadSuccess(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  return (
    <div className="ml-1">
      {/* Zone de drop / input */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !loading && fileInputRef.current?.click()}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-md border border-dashed cursor-pointer transition-colors text-xs",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/50",
          loading && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept=".pdf,.jpg,.jpeg,.png,.gif,.heic,.heif,.doc,.docx,.xls,.xlsx,.zip"
          disabled={loading}
        />

        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span className="text-muted-foreground">Upload... {progress}%</span>
          </>
        ) : uploadSuccess ? (
          <>
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            <span className="text-green-600 font-medium">Document uploade</span>
          </>
        ) : (
          <>
            <Upload className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{documentLabel}</span>
          </>
        )}
      </div>

      {/* Progress bar */}
      {loading && (
        <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Fichier uploade avec option de supprimer */}
      {uploadedFile && !loading && (
        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
          <File className="w-3 h-3" />
          <span className="truncate max-w-[150px]">{uploadedFile.name}</span>
          <button onClick={handleRemove} className="ml-auto hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Erreur */}
      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
