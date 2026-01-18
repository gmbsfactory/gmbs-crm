"use client"

import React, { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { User, Briefcase, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PortalContext, type ArtisanPortalData } from "@/lib/portail/portal-context"

export default function PortailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ token: string }>
}) {
  const [token, setToken] = useState<string | null>(null)
  const [portalData, setPortalData] = useState<ArtisanPortalData>({
    artisanId: "",
    artisan: null,
    token: "",
    isLoading: true,
    error: null,
    refetch: async () => {},
  })
  
  const pathname = usePathname()
  const router = useRouter()

  // Extraire le token des params
  useEffect(() => {
    params.then((p) => setToken(p.token))
  }, [params])

  // Valider le token et charger les données de l'artisan
  const fetchArtisanData = async (tokenValue: string) => {
    try {
      const response = await fetch(`/api/portail/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenValue }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Token invalide ou expiré")
      }

      const data = await response.json()
      
      setPortalData({
        artisanId: data.artisanId,
        artisan: data.artisan,
        token: tokenValue,
        isLoading: false,
        error: null,
        refetch: () => fetchArtisanData(tokenValue),
      })
    } catch (error: any) {
      setPortalData({
        artisanId: "",
        artisan: null,
        token: tokenValue,
        isLoading: false,
        error: error.message || "Erreur de validation du token",
        refetch: () => fetchArtisanData(tokenValue),
      })
    }
  }

  useEffect(() => {
    if (token) {
      fetchArtisanData(token)
    }
  }, [token])

  // Déterminer l'onglet actif
  const getActiveTab = () => {
    if (pathname?.includes("/interventions")) return "interventions"
    return "profil"
  }

  const activeTab = getActiveTab()

  // Navigation
  const navigateTo = (tab: "profil" | "interventions") => {
    if (!token) return
    if (tab === "profil") {
      router.push(`/portail/${token}`)
    } else {
      router.push(`/portail/${token}/interventions`)
    }
  }

  // Écran de chargement
  if (portalData.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Chargement du portail...</p>
        </div>
      </div>
    )
  }

  // Écran d'erreur
  if (portalData.error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">
            Accès non autorisé
          </h1>
          <p className="text-muted-foreground">
            {portalData.error}
          </p>
          <p className="text-sm text-slate-500">
            Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, veuillez contacter votre gestionnaire.
          </p>
        </div>
      </div>
    )
  }

  const displayName = portalData.artisan?.raison_sociale || 
    [portalData.artisan?.prenom, portalData.artisan?.nom].filter(Boolean).join(" ") ||
    "Mon Portail"

  return (
    <PortalContext.Provider value={portalData}>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-primary font-semibold">
                  {displayName.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 text-sm leading-tight">
                  {displayName}
                </h1>
                <p className="text-xs text-slate-500">Portail Artisan</p>
              </div>
            </div>
            {/* Logo GMBS optionnel */}
            <div className="text-xs text-slate-400 font-medium">
              GMBS
            </div>
          </div>
        </header>

        {/* Contenu principal */}
        <main className="flex-1 overflow-auto pb-20">
          <div className="max-w-2xl mx-auto p-4">
            {children}
          </div>
        </main>

        {/* Navigation bas de page (style app mobile) */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg">
          <div className="max-w-2xl mx-auto flex">
            <button
              onClick={() => navigateTo("profil")}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
                activeTab === "profil"
                  ? "text-primary"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <User className={cn(
                "h-6 w-6",
                activeTab === "profil" && "fill-primary/20"
              )} />
              <span className="text-xs font-medium">Profil</span>
            </button>
            <button
              onClick={() => navigateTo("interventions")}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors",
                activeTab === "interventions"
                  ? "text-primary"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Briefcase className={cn(
                "h-6 w-6",
                activeTab === "interventions" && "fill-primary/20"
              )} />
              <span className="text-xs font-medium">Interventions</span>
            </button>
          </div>
        </nav>
      </div>
    </PortalContext.Provider>
  )
}
