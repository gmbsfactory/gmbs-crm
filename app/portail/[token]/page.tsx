"use client"

import React, { useState, useEffect } from "react"
import { usePortalContext } from "@/lib/portail/portal-context"
import { 
  User, 
  Phone, 
  Mail, 
  Building2, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"

// Types de documents requis pour l'artisan
const REQUIRED_DOCUMENTS = [
  { kind: "kbis", label: "Extrait Kbis", description: "Extrait K-bis de moins de 3 mois" },
  { kind: "assurance", label: "Attestation d'assurance", description: "Attestation RC Pro en cours de validité" },
  { kind: "cni_recto_verso", label: "CNI recto/verso", description: "Carte d'identité du gérant" },
  { kind: "iban", label: "RIB / IBAN", description: "Relevé d'identité bancaire" },
  { kind: "decharge_partenariat", label: "Décharge partenariat", description: "Document de partenariat signé" },
]

type DocumentStatus = {
  kind: string
  uploaded: boolean
  filename?: string
  uploadedAt?: string
}

export default function PortailProfilPage() {
  const { artisanId, artisan, token } = usePortalContext()
  const [documents, setDocuments] = useState<DocumentStatus[]>([])
  const [isLoadingDocs, setIsLoadingDocs] = useState(true)
  const [uploadingKind, setUploadingKind] = useState<string | null>(null)

  // Charger les documents existants
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch(`/api/portail/documents?token=${token}`)
        if (response.ok) {
          const data = await response.json()
          setDocuments(data.documents || [])
        }
      } catch (error) {
        console.error("Erreur chargement documents:", error)
      } finally {
        setIsLoadingDocs(false)
      }
    }

    if (token) {
      fetchDocuments()
    }
  }, [token])

  // Upload d'un document
  const handleFileUpload = async (kind: string, file: File) => {
    setUploadingKind(kind)
    
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("kind", kind)
      formData.append("token", token)

      const response = await fetch("/api/portail/documents", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Erreur lors de l&apos;upload")
      }

      const data = await response.json()
      
      // Mettre à jour la liste des documents
      setDocuments(prev => {
        const existing = prev.find(d => d.kind === kind)
        if (existing) {
          return prev.map(d => d.kind === kind ? {
            kind,
            uploaded: true,
            filename: data.filename,
            uploadedAt: data.uploadedAt
          } : d)
        }
        return [...prev, {
          kind,
          uploaded: true,
          filename: data.filename,
          uploadedAt: data.uploadedAt
        }]
      })

    } catch (error: any) {
      console.error("Erreur upload:", error)
      alert(error.message || "Erreur lors de l&apos;upload du document")
    } finally {
      setUploadingKind(null)
    }
  }

  // Vérifier si un document est uploadé
  const getDocumentStatus = (kind: string): DocumentStatus | undefined => {
    return documents.find(d => d.kind === kind)
  }

  // Compter les documents uploadés
  const uploadedCount = REQUIRED_DOCUMENTS.filter(doc => 
    getDocumentStatus(doc.kind)?.uploaded
  ).length

  const completionPercentage = Math.round((uploadedCount / REQUIRED_DOCUMENTS.length) * 100)

  return (
    <div className="space-y-6">
      {/* Section Informations personnelles */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Mes informations
          </h2>
        </div>
        <div className="p-4 space-y-3">
          {artisan?.raison_sociale && (
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Entreprise</p>
                <p className="text-sm font-medium text-slate-900">{artisan.raison_sociale}</p>
              </div>
            </div>
          )}
          
          {(artisan?.prenom || artisan?.nom) && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Contact</p>
                <p className="text-sm font-medium text-slate-900">
                  {[artisan?.prenom, artisan?.nom].filter(Boolean).join(" ")}
                </p>
              </div>
            </div>
          )}

          {artisan?.telephone && (
            <a 
              href={`tel:${artisan.telephone}`}
              className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Phone className="h-4 w-4 text-slate-400" />
              <div className="flex-1">
                <p className="text-xs text-slate-500">Téléphone</p>
                <p className="text-sm font-medium text-primary">{artisan.telephone}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </a>
          )}

          {artisan?.email && (
            <a 
              href={`mailto:${artisan.email}`}
              className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Mail className="h-4 w-4 text-slate-400" />
              <div className="flex-1">
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-medium text-primary">{artisan.email}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </a>
          )}
        </div>
      </section>

      {/* Section Documents */}
      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Mes documents
            </h2>
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              completionPercentage === 100 
                ? "bg-green-100 text-green-700" 
                : "bg-amber-100 text-amber-700"
            )}>
              {uploadedCount}/{REQUIRED_DOCUMENTS.length}
            </span>
          </div>
          {/* Barre de progression */}
          <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500",
                completionPercentage === 100 ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {completionPercentage === 100 
              ? "Dossier complet !" 
              : "Complétez votre dossier pour être opérationnel"}
          </p>
        </div>
        
        <div className="divide-y divide-slate-100">
          {isLoadingDocs ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            REQUIRED_DOCUMENTS.map((doc) => {
              const status = getDocumentStatus(doc.kind)
              const isUploading = uploadingKind === doc.kind

              return (
                <div key={doc.kind} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                      status?.uploaded 
                        ? "bg-green-100" 
                        : "bg-slate-100"
                    )}>
                      {status?.uploaded ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900">{doc.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>
                      {status?.uploaded && status.filename && (
                        <p className="text-xs text-green-600 mt-1 truncate">
                          ✓ {status.filename}
                        </p>
                      )}
                    </div>
                    <label className={cn(
                      "shrink-0 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors",
                      status?.uploaded
                        ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        : "bg-primary text-white hover:bg-primary/90",
                      isUploading && "opacity-50 cursor-wait"
                    )}>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : status?.uploaded ? (
                        "Modifier"
                      ) : (
                        <>
                          <Upload className="h-3 w-3 inline mr-1" />
                          Ajouter
                        </>
                      )}
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        disabled={isUploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            handleFileUpload(doc.kind, file)
                          }
                          e.target.value = "" // Reset pour permettre re-upload du même fichier
                        }}
                      />
                    </label>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </section>

      {/* Note d'aide */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">
          <strong>Besoin d&apos;aide ?</strong> Contactez votre gestionnaire si vous avez des questions sur les documents à fournir.
        </p>
      </div>
    </div>
  )
}
