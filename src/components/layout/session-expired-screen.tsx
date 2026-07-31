"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { buildLoginUrl, type SessionExpiryReason } from "@/lib/auth/session-expiry"
import { LockKeyhole, RefreshCw } from "lucide-react"

interface SessionExpiredScreenProps {
  reason: SessionExpiryReason
}

/**
 * Écran substitué à l'interface quand la session n'est plus exploitable.
 *
 * Remplace le chargement sans fin que voyaient les utilisateurs le matin :
 * l'application attendait des requêtes déjà condamnées, sans jamais l'annoncer.
 */
export function SessionExpiredScreen({ reason }: SessionExpiredScreenProps) {
  const isDailyExpiry = reason === "daily-expired"

  const handleReconnect = () => {
    window.location.assign(buildLoginUrl(window.location.pathname, window.location.search))
  }

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            {isDailyExpiry ? (
              <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <CardTitle>
            {isDailyExpiry ? "Session expirée" : "Connexion au CRM interrompue"}
          </CardTitle>
          <CardDescription>
            {isDailyExpiry
              ? "Le CRM demande une reconnexion par jour. Votre session date d'hier : reconnectez-vous pour retrouver vos données."
              : "Votre session n'a pas pu être vérifiée. Rechargez la page pour reprendre là où vous en étiez."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isDailyExpiry ? (
            <Button onClick={handleReconnect} className="w-full">
              Se reconnecter
            </Button>
          ) : (
            <>
              <Button onClick={handleReload} className="w-full">
                Recharger la page
              </Button>
              <Button onClick={handleReconnect} variant="ghost" className="w-full">
                Se reconnecter
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
