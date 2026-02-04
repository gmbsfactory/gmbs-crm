"use client"

import { useState, useRef, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase-client'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useQueryClient } from "@tanstack/react-query"
import { preloadCriticalDataAsync } from "@/lib/preload-critical-data"

export default function LoginPage() {
  const queryClient = useQueryClient()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Précharger le dashboard au chargement
  useEffect(() => {
    router.prefetch('/dashboard')
  }, [router])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      let email = identifier
      if (!identifier.includes('@')) {
        const r = await fetch('/api/auth/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier }) })
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j?.error || 'Identifiant introuvable')
        email = j.email
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)

      // @supabase/ssr gère automatiquement les cookies de session après signIn
      // Mettre le statut à "connected" (credentials: 'include' envoie les cookies automatiquement)
      await fetch('/api/auth/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'connected' }),
      }).catch(() => { /* Non-bloquant */ })
      
      // Invalider le cache pour forcer un refetch avec le nouvel utilisateur
      queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      
      // Précharger les données critiques avant la navigation pour une réactivité optimale
      // On utilise une fonction async non-bloquante pour ne pas ralentir la redirection
      preloadCriticalDataAsync(queryClient)
      
      // Calculer la position du bouton AVANT navigation
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        const buttonPosition = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        }
        
        // Stocker la position dans sessionStorage pour la page dashboard
        sessionStorage.setItem('revealTransition', JSON.stringify({
          from: 'login',
          buttonPosition,
          timestamp: Date.now()
        }))
      }
      
      // Rechargement complet pour que le middleware lise les cookies SSR
      const url = new URL(window.location.href)
      const redirect = url.searchParams.get('redirect') || '/dashboard'
      window.location.href = redirect
    } catch (e: any) {
      setError(e?.message || 'Erreur inconnue')
      setLoading(false)
    }
  }

  return (
    <>
      {/* Iframe cachée pour précharger la page login - sera utilisée sur le dashboard */}
      <iframe
        src="/login"
        className="absolute opacity-0 pointer-events-none"
        style={{
          position: 'fixed',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          border: 'none',
          visibility: 'hidden',
        }}
        aria-hidden="true"
        title="Login preload"
        loading="eager"
      />
      
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 relative">
        {/* Left brand / illustration */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white relative overflow-hidden">
          <div className="z-10 flex flex-col items-center justify-center flex-1">
            <div className="flex flex-col items-center gap-6">
              <h1 className="text-4xl font-bold leading-tight text-center">Portail de connexion</h1>
              <div className="text-2xl font-semibold tracking-wide text-center">GMBS Gestion</div>
            </div>
          </div>
          <div className="absolute inset-0 opacity-20 pointer-events-none select-none">
            <Image src="/gmbs-logo.svg" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
          </div>
        </div>

        {/* Right login card */}
        <div className="flex items-center justify-center p-6 md:p-10 bg-background">
          <Card className="w-full max-w-sm shadow-lg relative">
            <motion.div 
              className="absolute -top-20 -right-0"
              initial={{ opacity: 0, x: 100, scale: 0.6 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{
                duration: 1.5,
                ease: "easeOut"
              }}
            >
              <Image src="/gmbs-logo.svg" alt="GMBS Logo" width={180} height={180} className="h-40 w-40" />
            </motion.div>
            <CardHeader>
              <CardTitle>Connexion</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-1">
                  <label className="text-sm">Email ou nom d&apos;utilisateur</label>
                  <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoFocus required placeholder="ex: alice@gmbs.fr" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm">Mot de passe</label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <Button ref={buttonRef} className="w-full" type="submit" disabled={loading}>
                  {loading ? 'Connexion…' : 'Se connecter'}
                </Button>
              </form>
              <div className="mt-4 text-xs text-muted-foreground">
                Besoin d&apos;un accès ? Contactez l&apos;administrateur.
              </div>
              <div className="mt-6 text-xs text-muted-foreground">
                <Link href="#" className="hover:underline">Mot de passe oublié</Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
