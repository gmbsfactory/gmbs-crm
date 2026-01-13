"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Mail, 
  ExternalLink, 
  Hash,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  Save
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { supabase } from "@/lib/supabase-client"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function ProfileSettings() {
  const { toast } = useToast()
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  
  // États pour la configuration email
  const [emailSmtpField, setEmailSmtpField] = useState<string>('')
  const [emailPasswordField, setEmailPasswordField] = useState<string>('')
  const [showEmailConfig, setShowEmailConfig] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  
  // États pour le changement de mot de passe
  const [showPasswordSection, setShowPasswordSection] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordChanging, setPasswordChanging] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  
  const loading = userLoading

  // Synchroniser les champs avec l'utilisateur courant
  useEffect(() => {
    if (!currentUser) return
    setEmailSmtpField((currentUser as any)?.email_smtp || '')
  }, [currentUser])

  // Données utilisateur pour l'affichage
  const firstName = currentUser?.firstname || currentUser?.prenom || ''
  const lastName = currentUser?.lastname || currentUser?.nom || ''
  const surnom = currentUser?.code_gestionnaire || currentUser?.surnom || ''
  const email = currentUser?.email || ''
  const avatarUrl = currentUser?.avatar_url || null
  const userColor = currentUser?.color || '#6366f1'
  const initials = ((firstName?.[0] || 'U') + (lastName?.[0] || '')).toUpperCase()

  // Fonction pour changer le mot de passe
  async function handleChangePassword() {
    if (!currentPassword) {
      setPasswordError('Le mot de passe actuel est requis')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit faire au moins 8 caractères')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas')
      return
    }
    
    setPasswordError(null)
    setPasswordChanging(true)
    
    try {
      // Vérifier le mot de passe actuel en tentant de se réauthentifier
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword,
      })
      
      if (signInError) {
        setPasswordError('Mot de passe actuel incorrect')
        setPasswordChanging(false)
        return
      }
      
      // Mettre à jour le mot de passe
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      })
      
      if (updateError) {
        throw updateError
      }
      
      // Déconnecter l'utilisateur pour qu'il se reconnecte avec le nouveau mot de passe
      await supabase.auth.signOut()
      
      toast({ 
        title: 'Mot de passe modifié', 
        description: 'Vous allez être redirigé vers la page de connexion...' 
      })
      
      // Rediriger vers login après 2 secondes
      setTimeout(() => {
        window.location.href = '/login'
      }, 2000)
    } catch (e: any) {
      console.error('Erreur lors du changement de mot de passe:', e)
      setPasswordError(e?.message || 'Erreur lors du changement de mot de passe')
    } finally {
      setPasswordChanging(false)
    }
  }

  // Fonction pour sauvegarder la configuration email
  async function saveEmailConfig() {
    setSavingEmail(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const payload: Record<string, unknown> = {}
      
      if (emailSmtpField.trim().length > 0) {
        payload.email_smtp = emailSmtpField.trim()
      }
      if (emailPasswordField.trim().length > 0) {
        payload.email_password = emailPasswordField.trim()
      }
      
      if (Object.keys(payload).length === 0) {
        toast({ title: 'Aucune modification', description: 'Veuillez remplir au moins un champ' })
        setSavingEmail(false)
        return
      }
      
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      })
      
      if (!res.ok) throw new Error((await res.json())?.error || 'Erreur lors de la sauvegarde')
      
      setEmailPasswordField('') // Réinitialiser le mot de passe après sauvegarde
      toast({ title: 'Configuration email mise à jour' })
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de sauvegarder', variant: 'destructive' as any })
    } finally {
      setSavingEmail(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border bg-card/50 p-8">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Chargement du profil...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section Profil - Affichage en lecture seule */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <div className="relative px-8 py-8 bg-gradient-to-br from-primary/5 via-background to-background">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <Avatar
              className="h-24 w-24 border-[6px] shadow-lg"
              style={{ borderColor: userColor }}
            >
              {avatarUrl ? (
                <AvatarImage
                  src={avatarUrl}
                  alt={`${firstName} ${lastName}`.trim() || 'User'}
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback
                className="text-3xl font-semibold uppercase tracking-wide text-white"
                style={{
                  background: userColor,
                  color: '#ffffff',
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            
            {/* Infos utilisateur */}
            <div className="flex-1 pt-2">
              <h2 className="text-2xl font-bold">
                {firstName || 'Prénom'} {lastName || 'Nom'}
              </h2>
              <p className="text-muted-foreground">{email || 'email@exemple.com'}</p>
              {surnom && (
                <span 
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: userColor }}
                >
                  <Hash className="h-3.5 w-3.5" />
                  {surnom}
                </span>
              )}
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Section Configuration Email */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowEmailConfig(!showEmailConfig)}
          className="w-full px-8 py-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Configuration Email</h3>
              <p className="text-sm text-muted-foreground">
                Configurez votre compte Gmail pour l&apos;envoi d&apos;emails
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: showEmailConfig ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </button>
        
        <AnimatePresence>
          {showEmailConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-8 pb-8 pt-2 space-y-6 border-t">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" />
                      Email Gmail
                    </label>
                    <input
                      type="email"
                      value={emailSmtpField}
                      onChange={(e) => setEmailSmtpField(e.target.value)}
                      placeholder="votre.email@gmail.com"
                      disabled={loading}
                      className="w-full px-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Adresse Gmail utilisée pour l&apos;envoi d&apos;emails aux artisans
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <KeyRound className="h-3.5 w-3.5" />
                      Mot de passe d&apos;application Gmail
                    </label>
                    <input
                      type="password"
                      value={emailPasswordField}
                      onChange={(e) => setEmailPasswordField(e.target.value)}
                      placeholder="••••••••••••••••"
                      disabled={loading}
                      className="w-full px-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Mot de passe d&apos;application Gmail (pas votre mot de passe principal)
                      <a
                        href="https://support.google.com/accounts/answer/185833"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Comment créer un mot de passe d&apos;application
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                </div>
                
                {/* Bouton de sauvegarde email */}
                <motion.button
                  type="button"
                  onClick={saveEmailConfig}
                  disabled={savingEmail}
                  className="px-5 py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {savingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Enregistrer la configuration
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Section Modification Mot de Passe */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPasswordSection(!showPasswordSection)}
          className="w-full px-8 py-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Lock className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold">Modifier le mot de passe</h3>
              <p className="text-sm text-muted-foreground">
                Changez votre mot de passe de connexion
              </p>
            </div>
          </div>
          <motion.div
            animate={{ rotate: showPasswordSection ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </button>
        
        <AnimatePresence>
          {showPasswordSection && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-8 pb-8 pt-2 space-y-6 border-t">
                {/* Mot de passe actuel */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5" />
                    Mot de passe actuel
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={passwordChanging}
                      className="w-full px-4 py-3 pr-10 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Nouveau mot de passe */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                    <Lock className="h-3.5 w-3.5" />
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={passwordChanging}
                      className="w-full px-4 py-3 pr-10 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 caractères
                  </p>
                </div>
                
                {/* Confirmation mot de passe */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Confirmer le nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={passwordChanging}
                      className={cn(
                        "w-full px-4 py-3 pr-10 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none disabled:opacity-50",
                        confirmPassword && newPassword !== confirmPassword && "border-red-500 focus:border-red-500"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && newPassword === confirmPassword && (
                    <p className="text-xs text-emerald-500 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Les mots de passe correspondent
                    </p>
                  )}
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500">
                      Les mots de passe ne correspondent pas
                    </p>
                  )}
                </div>
                
                {/* Message d'erreur */}
                {passwordError && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-600">{passwordError}</p>
                  </div>
                )}
                
                {/* Bouton de validation */}
                <motion.button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={passwordChanging || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="px-5 py-2.5 rounded-xl font-medium bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {passwordChanging ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Modification en cours...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Modifier le mot de passe
                    </>
                  )}
                </motion.button>
                
                <p className="text-xs text-muted-foreground">
                  Après modification, vous serez automatiquement déconnecté et devrez vous reconnecter avec votre nouveau mot de passe.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
