"use client"

import React, { useState, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { 
  Link2, 
  Copy, 
  Check, 
  RefreshCw, 
  ExternalLink,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type Props = {
  artisanId: string
  artisanName?: string
  className?: string
}

type PluginStatus = {
  active: boolean
  status?: string
  plan?: string
}

type GeneratedLink = {
  token: string
  portal_url: string
  expires_at: string
}

export function ArtisanPortalLink({ artisanId, artisanName, className }: Props) {
  const [copied, setCopied] = useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null)

  // Check if plugin is active
  const { data: pluginStatus, isLoading: isLoadingStatus } = useQuery<PluginStatus>({
    queryKey: ["plugin-status", "portal_artisans"],
    queryFn: async () => {
      const res = await fetch("/api/plugins/portal_artisans/status")
      if (!res.ok) return { active: false }
      return res.json()
    },
    staleTime: 5 * 60 * 1000, // Cache 5 min
  })

  // Generate link mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/plugins/portal/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artisanId })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Erreur génération")
      }
      return res.json()
    },
    onSuccess: (data) => {
      setGeneratedLink(data)
      toast.success("Lien portail généré !")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const handleCopy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success("Lien copié !")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Impossible de copier le lien")
    }
  }, [])

  // Don't render anything if plugin is not active or still loading
  if (isLoadingStatus) {
    return null
  }

  const isPluginActive = pluginStatus?.active && pluginStatus?.status === 'active'
  
  if (!isPluginActive) {
    // Plugin not active - don't show the button at all
    return null
  }

  // Plugin is active - show the portal link button
  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-2", className)}>
          <Link2 className="h-4 w-4" />
          Lien Portail
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Portail Artisan</h4>
            {pluginStatus?.plan && (
              <Badge variant="outline" className="text-[10px]">
                {pluginStatus.plan}
              </Badge>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            Générez un lien unique pour {artisanName || "cet artisan"}.
          </p>

          {generatedLink ? (
            <div className="space-y-2">
              {/* URL with copy button */}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-md px-3 py-2 text-xs font-mono truncate">
                  {generatedLink.portal_url}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => handleCopy(generatedLink.portal_url)}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => window.open(generatedLink.portal_url, "_blank")}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Tester
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                >
                  <RefreshCw className={cn(
                    "h-3 w-3 mr-1",
                    generateMutation.isPending && "animate-spin"
                  )} />
                  Régénérer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Important :</strong> N&apos;envoyez ce lien qu&apos;après avoir obtenu l&apos;accord 
                  de l&apos;artisan. Ce lien lui donnera accès à ses informations et interventions.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4 mr-2" />
                    Générer le lien
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Plan info */}
          {pluginStatus?.plan && (
            <p className="text-[10px] text-muted-foreground text-center pt-2 border-t">
              Plan: {pluginStatus.plan}
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default ArtisanPortalLink
