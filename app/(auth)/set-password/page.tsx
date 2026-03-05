"use client"

import { useState, useEffect, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase-client'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Eye, EyeOff, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Password strength calculation
function calculatePasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  let score = 0
  
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password)) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  
  if (score <= 2) return { score, label: 'Faible', color: 'bg-red-500' }
  if (score <= 4) return { score, label: 'Moyen', color: 'bg-amber-500' }
  return { score, label: 'Fort', color: 'bg-emerald-500' }
}

export default function SetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tokenValid, setTokenValid] = useState(false)
  
  // Calculate password strength
  const passwordStrength = useMemo(() => calculatePasswordStrength(password), [password])
  
  // Check if passwords match
  const passwordsMatch = password && confirmPassword && password === confirmPassword
  const passwordsDoNotMatch = confirmPassword && password !== confirmPassword
  
  // Form validation
  const isFormValid = password.length >= 8 && passwordsMatch
  
  // Verify token on mount
  useEffect(() => {
    async function verifyToken() {
      try {
        // Vérifier si on arrive avec une erreur du token custom
        const errorParam = searchParams.get('error')
        if (errorParam === 'expired') {
          throw new Error('Ce lien a expiré ou a déjà été utilisé.')
        }

        // Get the hash fragment (Supabase adds token info after #)
        const hash = window.location.hash

        if (hash && hash.includes('access_token')) {
          // Parse the hash
          const params = new URLSearchParams(hash.substring(1))
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')
          const type = params.get('type')

          if (accessToken && refreshToken && type === 'recovery') {
            // Set the session
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })

            if (error) throw error
            setTokenValid(true)
          } else {
            throw new Error('Invalid recovery link')
          }
        } else {
          // Check if there's a code parameter for PKCE flow
          const code = searchParams.get('code')

          if (code) {
            // Exchange code for session
            const { error } = await supabase.auth.exchangeCodeForSession(code)
            if (error) throw error
            setTokenValid(true)
          } else {
            // Pas de code ni hash : vérifier si une session recovery existe déjà
            // (posée par /auth/callback après échange PKCE)
            const { data: { user }, error: sessionError } = await supabase.auth.getUser()
            if (sessionError || !user) {
              throw new Error('Missing authentication token')
            }
            // Session valide trouvée dans les cookies
            setTokenValid(true)
          }
        }
      } catch (e: any) {
        console.error('[set-password] Token verification failed:', e)
        setError('Ce lien est invalide ou a expiré. Veuillez demander un nouveau lien d\'invitation.')
        setTokenValid(false)
      } finally {
        setVerifying(false)
      }
    }
    
    verifyToken()
  }, [searchParams])
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!isFormValid) return
    
    setError(null)
    setLoading(true)
    
    try {
      // Update the user's password
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      // Invalider tous les tokens de reset pour cet utilisateur
      try {
        await fetch('/api/auth/mark-token-used', { method: 'POST' })
      } catch (markError) {
        console.warn('[set-password] Failed to mark tokens as used:', markError)
      }

      // Sign out to clear the recovery session
      await supabase.auth.signOut()
      
      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } catch (e: any) {
      console.error('[set-password] Password update failed:', e)
      setError(e?.message || 'Erreur lors de la définition du mot de passe')
    } finally {
      setLoading(false)
    }
  }
  
  // Loading state
  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Vérification du lien...</p>
        </div>
      </div>
    )
  }
  
  // Success state
  if (success) {
    return (
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 relative">
        {/* Left brand / illustration */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-emerald-900 via-slate-900 to-black text-white relative overflow-hidden">
          <div className="z-10 flex flex-col items-center justify-center flex-1">
            <div className="flex flex-col items-center gap-6">
              <CheckCircle2 className="h-20 w-20 text-emerald-400" />
              <h1 className="text-3xl font-bold leading-tight text-center">Mot de passe défini</h1>
              <p className="text-lg text-center text-white/80">Vous pouvez maintenant vous connecter</p>
            </div>
          </div>
          <div className="absolute inset-0 opacity-20 pointer-events-none select-none">
            <Image src="/gmbs-logo.svg" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
          </div>
        </div>

        {/* Right success card */}
        <div className="flex items-center justify-center p-6 md:p-10 bg-background">
          <Card className="w-full max-w-sm shadow-lg relative overflow-visible">
            <motion.div 
              className="absolute -top-20 -right-0 -z-10 pointer-events-none"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Image src="/gmbs-logo.svg" alt="GMBS Logo" width={180} height={180} className="h-40 w-40 opacity-80" />
            </motion.div>
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
                Mot de passe créé
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <p className="text-muted-foreground">
                Votre mot de passe a été défini avec succès. Vous allez être redirigé vers la page de connexion...
              </p>
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
              <Button 
                className="w-full" 
                onClick={() => router.push('/login')}
              >
                Se connecter maintenant
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  
  // Error state (invalid token)
  if (!tokenValid) {
    return (
      <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 relative">
        {/* Left brand / illustration */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-red-900 via-slate-900 to-black text-white relative overflow-hidden">
          <div className="z-10 flex flex-col items-center justify-center flex-1">
            <div className="flex flex-col items-center gap-6">
              <AlertCircle className="h-20 w-20 text-red-400" />
              <h1 className="text-3xl font-bold leading-tight text-center">Lien invalide</h1>
              <p className="text-lg text-center text-white/80">Ce lien a expiré ou est invalide</p>
            </div>
          </div>
          <div className="absolute inset-0 opacity-20 pointer-events-none select-none">
            <Image src="/gmbs-logo.svg" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
          </div>
        </div>

        {/* Right error card */}
        <div className="flex items-center justify-center p-6 md:p-10 bg-background">
          <Card className="w-full max-w-sm shadow-lg relative overflow-visible">
            <motion.div 
              className="absolute -top-20 -right-0 -z-10 pointer-events-none"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Image src="/gmbs-logo.svg" alt="GMBS Logo" width={180} height={180} className="h-40 w-40 opacity-80" />
            </motion.div>
            <CardHeader className="relative z-10">
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-6 w-6" />
                Lien expiré
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              <p className="text-muted-foreground">
                {error || 'Ce lien d\'invitation a expiré ou est invalide. Veuillez contacter l\'administrateur pour obtenir un nouveau lien.'}
              </p>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => router.push('/login')}
              >
                Retour à la connexion
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-2 relative">
      {/* Left brand / illustration */}
      <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-indigo-900 via-slate-900 to-black text-white relative overflow-hidden">
        <div className="z-10 flex flex-col items-center justify-center flex-1">
          <div className="flex flex-col items-center gap-6">
            <Lock className="h-16 w-16 text-indigo-400" />
            <h1 className="text-3xl font-bold leading-tight text-center">Définir votre mot de passe</h1>
            <p className="text-lg text-center text-white/80">Bienvenue chez GMBS</p>
          </div>
        </div>
        <div className="absolute inset-0 opacity-20 pointer-events-none select-none">
          <Image src="/gmbs-logo.svg" alt="" fill priority sizes="100vw" style={{ objectFit: 'cover' }} />
        </div>
      </div>

      {/* Right form card */}
      <div className="flex items-center justify-center p-6 md:p-10 bg-background">
        <Card className="w-full max-w-sm shadow-lg relative overflow-visible">
          <motion.div 
            className="absolute -top-20 -right-0 -z-10 pointer-events-none"
            initial={{ opacity: 0, x: 100, scale: 0.6 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{
              duration: 1.5,
              ease: "easeOut"
            }}
          >
            <Image src="/gmbs-logo.svg" alt="GMBS Logo" width={180} height={180} className="h-40 w-40 opacity-80" />
          </motion.div>
          <CardHeader className="relative z-10">
            <CardTitle>Créer votre mot de passe</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choisissez un mot de passe sécurisé pour votre compte
            </p>
          </CardHeader>
          <CardContent className="relative z-10">
            <form className="space-y-4" onSubmit={handleSubmit}>
              {/* Password field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Nouveau mot de passe</label>
                <div className="relative">
                  <Input 
                    type={showPassword ? "text" : "password"}
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    autoFocus 
                    required 
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                
                {/* Password strength indicator */}
                {password && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            i <= passwordStrength.score ? passwordStrength.color : "bg-muted"
                          )}
                        />
                      ))}
                    </div>
                    <p className={cn(
                      "text-xs",
                      passwordStrength.score <= 2 ? "text-red-500" :
                      passwordStrength.score <= 4 ? "text-amber-500" : "text-emerald-500"
                    )}>
                      Force du mot de passe : {passwordStrength.label}
                    </p>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground">
                  Minimum 8 caractères. Utilisez des majuscules, chiffres et symboles pour plus de sécurité.
                </p>
              </div>
              
              {/* Confirm password field */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirmer le mot de passe</label>
                <div className="relative">
                  <Input 
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    required 
                    placeholder="••••••••"
                    className={cn(
                      "pr-10",
                      passwordsDoNotMatch && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordsDoNotMatch && (
                  <p className="text-xs text-red-500">Les mots de passe ne correspondent pas</p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Les mots de passe correspondent
                  </p>
                )}
              </div>
              
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              
              <Button 
                className="w-full" 
                type="submit" 
                disabled={loading || !isFormValid}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Définition en cours...
                  </>
                ) : (
                  'Définir mon mot de passe'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
