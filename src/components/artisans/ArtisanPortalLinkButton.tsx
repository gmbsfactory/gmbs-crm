"use client"

import { useCallback, useState } from "react"
import { Check, Copy, ExternalLink, Link2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface PortalLink {
  url: string
  expires_at: string | null
}

interface ArtisanPortalLinkButtonProps {
  artisanId: string
  artisanName?: string | null
  disabled?: boolean
  className?: string
}

/** POST /api/artisans/{id}/portal-link (contrat §3) */
export async function generateArtisanPortalLink(artisanId: string): Promise<PortalLink> {
  const response = await fetch(`/api/artisans/${artisanId}/portal-link`, { method: "POST" })
  if (response.status === 503) {
    throw new Error("Le portail artisans n'est pas configuré sur ce serveur.")
  }
  if (!response.ok) {
    let message = "Impossible de générer le lien portail"
    try {
      const body = (await response.json()) as { error?: string }
      if (body?.error) message = body.error
    } catch {
      // corps non JSON : message par défaut
    }
    throw new Error(message)
  }
  const data = (await response.json()) as Partial<PortalLink>
  if (!data.url) throw new Error("Réponse invalide du serveur (lien manquant)")
  return { url: data.url, expires_at: data.expires_at ?? null }
}

function formatExpiration(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return format(date, "d MMMM yyyy 'à' HH:mm", { locale: fr })
}

/**
 * Bouton « Lien portail » de la fiche artisan : génère un lien personnel
 * (jeton à usage de l'artisan) et l'affiche dans une boîte de dialogue
 * avec copie et ouverture dans un nouvel onglet.
 */
export function ArtisanPortalLinkButton({ artisanId, artisanName, disabled, className }: ArtisanPortalLinkButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [link, setLink] = useState<PortalLink | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    try {
      const generated = await generateArtisanPortalLink(artisanId)
      setLink(generated)
      setCopied(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de générer le lien portail")
    } finally {
      setIsGenerating(false)
    }
  }, [artisanId])

  const handleCopy = useCallback(async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
      toast.success("Lien copié")
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Impossible de copier le lien")
    }
  }, [link])

  const handleOpen = useCallback(() => {
    if (!link) return
    window.open(link.url, "_blank", "noopener,noreferrer")
  }, [link])

  const expiration = formatExpiration(link?.expires_at ?? null)

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("gap-1.5", className)}
        onClick={handleGenerate}
        disabled={disabled || isGenerating}
        title="Générer le lien personnel du portail artisans"
      >
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        Lien portail
      </Button>

      <Dialog open={link !== null} onOpenChange={(open) => { if (!open) setLink(null) }} modal>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lien portail{artisanName ? ` — ${artisanName}` : ""}</DialogTitle>
            <DialogDescription>
              Lien personnel de l&apos;artisan, à lui transmettre (SMS, WhatsApp ou e-mail). Il lui donne accès à
              ses missions et à son dossier ; ne le partagez pas à un tiers.
            </DialogDescription>
          </DialogHeader>
          {link && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="artisan-portal-link-url">Adresse du portail</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="artisan-portal-link-url"
                    value={link.url}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={handleCopy} title="Copier le lien">
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {expiration ? `Valable jusqu'au ${expiration}.` : "Durée de validité inconnue."}{" "}
                Générer un nouveau lien désactive les précédents.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setLink(null)}>
              Fermer
            </Button>
            <Button type="button" variant="outline" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copier
            </Button>
            <Button type="button" onClick={handleOpen}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Ouvrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
