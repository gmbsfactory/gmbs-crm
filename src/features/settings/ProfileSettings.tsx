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
  Save,
  Clock,
  Send,
  MessageSquare,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { usePermissions } from "@/hooks/usePermissions"
import { supabase } from "@/lib/supabase-client"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

interface LatenessEmailConfig {
  configured: boolean
  email_smtp: string | null
  is_enabled: boolean
  motivation_message: string
  updated_at?: string
}

export function ProfileSettings() {
  const { toast } = useToast()
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  const { can } = usePermissions()
  
  // Vérifier si l'utilisateur est admin (peut gérer les settings)
  const isAdmin = can("manage_settings")
  
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
  
  // États pour la configuration email des retards (admin only)
  const [showLatenessEmailConfig, setShowLatenessEmailConfig] = useState(false)
  const [latenessConfig, setLatenessConfig] = useState<LatenessEmailConfig>({
    configured: false,
    email_smtp: null,
    is_enabled: true,
    motivation_message: "Ne t'inquiète pas, demain sera meilleur ! 💪"
  })
  const [latenessEmailSmtp, setLatenessEmailSmtp] = useState('')
  const [latenessEmailPassword, setLatenessEmailPassword] = useState('')
  const [latenessIsEnabled, setLatenessIsEnabled] = useState(true)
  const [latenessMotivationMessage, setLatenessMotivationMessage] = useState("Ne t'inquiète pas, demain sera meilleur ! 💪")
  const [savingLatenessEmail, setSavingLatenessEmail] = useState(false)
  const [testingLatenessEmail, setTestingLatenessEmail] = useState(false)
  const [latenessConfigLoading, setLatenessConfigLoading] = useState(false)
  
  const loading = userLoading

  // Synchroniser les champs avec l'utilisateur courant
  useEffect(() => {
    if (!currentUser) return
    setEmailSmtpField((currentUser as any)?.email_smtp || '')
  }, [currentUser])

  // Charger la configuration email des retards (admin only)
  useEffect(() => {
    if (!isAdmin) return
    loadLatenessEmailConfig()
  }, [isAdmin])

  async function loadLatenessEmailConfig() {
    setLatenessConfigLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const res = await fetch('/api/settings/lateness-email', {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      if (!res.ok) return

      const data: LatenessEmailConfig = await res.json()
      setLatenessConfig(data)
      setLatenessEmailSmtp(data.email_smtp || '')
      setLatenessIsEnabled(data.is_enabled)
      setLatenessMotivationMessage(data.motivation_message)
    } catch (error) {
      console.error('[ProfileSettings] Error loading lateness config:', error)
    } finally {
      setLatenessConfigLoading(false)
    }
  }

  async function saveLatenessEmailConfig() {
    setSavingLatenessEmail(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const payload: Record<string, unknown> = {}
      
      if (latenessEmailSmtp.trim()) {
        payload.email_smtp = latenessEmailSmtp.trim()
      }
      if (latenessEmailPassword.trim()) {
        payload.email_password = latenessEmailPassword.trim()
      }
      payload.is_enabled = latenessIsEnabled
      payload.motivation_message = latenessMotivationMessage.trim()

      const res = await fetch('/api/settings/lateness-email', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de la sauvegarde')
      }

      setLatenessEmailPassword('')
      await loadLatenessEmailConfig()
      
      toast({
        title: 'Configuration sauvegardée',
        description: 'La configuration email des retards a été mise à jour'
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder',
        variant: 'destructive' as any
      })
    } finally {
      setSavingLatenessEmail(false)
    }
  }

  async function sendTestLatenessEmail() {
    setTestingLatenessEmail(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token

      const res = await fetch('/api/settings/lateness-email', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Échec de l'envoi du test")
      }

      toast({
        title: 'Email de test envoyé',
        description: data.message || 'Vérifiez votre boîte de réception'
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || "Impossible d'envoyer l'email de test",
        variant: 'destructive' as any
      })
    } finally {
      setTestingLatenessEmail(false)
    }
  }

  // Données utilisateur pour l'affichage
  const firstName = currentUser?.firstname || currentUser?.prenom || ''
  const lastName = currentUser?.lastname || currentUser?.nom || ''
  const surnom = currentUser?.code_gestionnaire || currentUser?.surnom || ''
  const email = currentUser?.email || ''
  const avatarUrl = currentUser?.avatar_url || null
  const userColor = currentUser?.color || 'hsl(var(--primary))'
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

      {/* Section Configuration Email des Retards (Admin Only) */}
      {isAdmin && (
        <div className="rounded-2xl border bg-card/50 overflow-hidden border-amber-500/30">
          <button
            type="button"
            onClick={() => setShowLatenessEmailConfig(!showLatenessEmailConfig)}
            className="w-full px-8 py-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Configuration Email des Retards</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                    Admin
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configurez l&apos;envoi automatique d&apos;emails aux utilisateurs en retard
                </p>
              </div>
            </div>
            <motion.div
              animate={{ rotate: showLatenessEmailConfig ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </motion.div>
          </button>
          
          <AnimatePresence>
            {showLatenessEmailConfig && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-8 pb-8 pt-2 space-y-6 border-t">
                  {latenessConfigLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {/* Status et Switch */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
                        <div className="flex items-center gap-3">
                          {latenessConfig.configured ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-amber-500" />
                          )}
                          <div>
                            <p className="font-medium text-sm">
                              {latenessConfig.configured ? 'Configuration active' : 'Non configuré'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {latenessConfig.configured
                                ? `Mise à jour: ${latenessConfig.updated_at ? new Date(latenessConfig.updated_at).toLocaleDateString('fr-FR') : 'N/A'}`
                                : "Aucune configuration définie"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Actif</span>
                          <Switch
                            checked={latenessIsEnabled}
                            onCheckedChange={setLatenessIsEnabled}
                          />
                        </div>
                      </div>

                      {/* Email SMTP */}
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          Email Gmail d&apos;envoi
                        </label>
                        <input
                          type="email"
                          value={latenessEmailSmtp}
                          onChange={(e) => setLatenessEmailSmtp(e.target.value)}
                          placeholder="notifications.retards@gmail.com"
                          className="w-full px-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                        <p className="text-xs text-muted-foreground">
                          Adresse Gmail utilisée pour envoyer les notifications de retard
                        </p>
                      </div>

                      {/* Mot de passe */}
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                          <KeyRound className="h-3.5 w-3.5" />
                          Mot de passe d&apos;application Gmail
                        </label>
                        <input
                          type="password"
                          value={latenessEmailPassword}
                          onChange={(e) => setLatenessEmailPassword(e.target.value)}
                          placeholder={latenessConfig.configured ? "••••••••••••••••" : "Entrez le mot de passe d'application"}
                          className="w-full px-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                        <p className="text-xs text-muted-foreground">
                          {latenessConfig.configured ? 'Laissez vide pour conserver le mot de passe actuel. ' : ''}
                          <a
                            href="https://support.google.com/accounts/answer/185833"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                          >
                            Comment créer un mot de passe d&apos;application
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </p>
                      </div>

                      {/* Message de motivation */}
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Message de motivation
                        </label>
                        <textarea
                          value={latenessMotivationMessage}
                          onChange={(e) => setLatenessMotivationMessage(e.target.value)}
                          placeholder="Ne t'inquiète pas, demain sera meilleur ! 💪"
                          rows={2}
                          className="w-full px-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                        />
                        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                          <p className="text-xs text-muted-foreground mb-1">Aperçu :</p>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium italic">
                            &quot;{latenessMotivationMessage || "Ne t'inquiète pas, demain sera meilleur ! 💪"}&quot;
                          </p>
                        </div>
                      </div>

                      {/* Info box */}
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          <strong>Info :</strong> Un email est envoyé automatiquement à chaque utilisateur qui se connecte après 10h00 un jour ouvré.
                          Les admins et managers sont exemptés.
                        </p>
                      </div>

                      {/* Boutons */}
                      <div className="flex flex-wrap items-center gap-3">
                        <motion.button
                          type="button"
                          onClick={saveLatenessEmailConfig}
                          disabled={savingLatenessEmail || (!latenessEmailSmtp && !latenessConfig.configured)}
                          className="px-5 py-2.5 rounded-xl font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {savingLatenessEmail ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Enregistrement...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              Enregistrer
                            </>
                          )}
                        </motion.button>

                        {latenessConfig.configured && (
                          <motion.button
                            type="button"
                            onClick={sendTestLatenessEmail}
                            disabled={testingLatenessEmail}
                            className="px-5 py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {testingLatenessEmail ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Envoi...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4" />
                                Envoyer un test
                              </>
                            )}
                          </motion.button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
