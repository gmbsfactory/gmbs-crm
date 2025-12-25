"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { usersApi } from "@/lib/api/v2"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Mail, 
  ExternalLink, 
  User, 
  Hash, 
  Palette,
  Save,
  KeyRound,
  Camera,
  X
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useCurrentUser } from "@/hooks/useCurrentUser"
import { supabase } from "@/lib/supabase-client"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type TeamUser = {
  id: string
  firstname: string | null
  lastname: string | null
  prenom?: string | null
  name?: string | null
  email: string | null
  role: string | null
  status: string | null
  code_gestionnaire: string | null
  surnom?: string | null
  color: string | null
  avatar_url?: string | null
  username?: string | null
  last_seen_at?: string | null
  page_permissions?: Record<string, boolean>
}

// Composant pour le sélecteur de couleur moderne (badge rond)
function ColorSelector({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const presetColors = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
    "#ec4899", "#f43f5e", "#ef4444", "#f97316",
    "#eab308", "#84cc16", "#22c55e", "#10b981",
    "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
  ]
  
  return (
    <div className="flex flex-wrap gap-2">
      {presetColors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            "h-7 w-7 rounded-full transition-all duration-200 hover:scale-110",
            "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            value === color && "ring-2 ring-primary ring-offset-2 scale-110"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
      <label className="relative h-7 w-7 cursor-pointer">
        <input
          type="color"
          value={value || "#6366f1"}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div 
          className="h-full w-full rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-muted-foreground/50 transition-colors"
          style={{ backgroundColor: value && !presetColors.includes(value) ? value : 'transparent' }}
        >
          {(!value || presetColors.includes(value)) && (
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </label>
    </div>
  )
}

export function ProfileSettings() {
  const { toast } = useToast()
  const { data: currentUser, isLoading: userLoading } = useCurrentUser()
  const [me, setMe] = useState<TeamUser | null>(null)
  const [colorField, setColorField] = useState<string>('')
  const [lastNameField, setLastNameField] = useState<string>('')
  const [firstNameField, setFirstNameField] = useState<string>('')
  const [surnomField, setSurnomField] = useState<string>('')
  const [emailSmtpField, setEmailSmtpField] = useState<string>('')
  const [emailPasswordField, setEmailPasswordField] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [speedometerMarginAverageShowPercentage, setSpeedometerMarginAverageShowPercentage] = useState<boolean>(true)
  const [speedometerMarginTotalShowPercentage, setSpeedometerMarginTotalShowPercentage] = useState<boolean>(true)
  const [preferencesLoading, setPreferencesLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showEmailConfig, setShowEmailConfig] = useState(false)
  
  const loading = userLoading

  // Synchroniser les champs avec l'utilisateur courant via useCurrentUser
  useEffect(() => {
    if (!currentUser) {
      return
    }
    
    const u: TeamUser = {
      id: currentUser.id,
      firstname: currentUser.firstname ?? null,
      lastname: currentUser.lastname ?? null,
      prenom: currentUser.prenom ?? null,
      name: currentUser.nom ?? null,
      email: currentUser.email ?? null,
      role: null,
      status: currentUser.status ?? null,
      code_gestionnaire: currentUser.code_gestionnaire ?? null,
      surnom: currentUser.surnom ?? null,
      color: currentUser.color ?? null,
      avatar_url: currentUser.avatar_url ?? null,
      page_permissions: currentUser.page_permissions,
    }
    
    setMe(u)
    setColorField(u.color || '#6366f1')
    setFirstNameField(u.firstname || u.prenom || '')
    setLastNameField(u.lastname || u.name || '')
    setSurnomField(u.code_gestionnaire || u.surnom || '')
    setEmailSmtpField((currentUser as any)?.email_smtp || '')
    setAvatarUrl(u.avatar_url || null)
    
    // Charger les préférences utilisateur
    const loadPreferences = async () => {
      try {
        const preferences = await usersApi.getUserPreferences(currentUser.id)
        if (preferences) {
          setSpeedometerMarginAverageShowPercentage(preferences.speedometer_margin_average_show_percentage)
          setSpeedometerMarginTotalShowPercentage(preferences.speedometer_margin_total_show_percentage)
        }
      } catch (err) {
        console.error("Erreur lors du chargement des préférences:", err)
      } finally {
        setPreferencesLoading(false)
      }
    }
    loadPreferences()
  }, [currentUser, userLoading])

  const initials = ((firstNameField?.[0] || 'U') + (lastNameField?.[0] || '')).toUpperCase()

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file || !me?.id) return

    // Validation du type de fichier
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: 'Erreur', 
        description: 'Le fichier doit être une image', 
        variant: 'destructive' as any 
      })
      return
    }

    // Validation de la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: 'Erreur', 
        description: 'L\'image ne doit pas dépasser 5MB', 
        variant: 'destructive' as any 
      })
      return
    }

    setUploadingAvatar(true)

    try {
      // Générer un nom de fichier unique
      const timestamp = Date.now()
      const extension = file.name.split('.').pop() || 'jpg'
      const filename = `user_${me.id}_avatar_${timestamp}.${extension}`
      const storagePath = `users/${me.id}/${filename}`

      // Supprimer l'ancienne photo si elle existe
      if (avatarUrl) {
        try {
          // Extraire le chemin depuis l'URL complète
          const urlParts = avatarUrl.split('/')
          const oldPath = urlParts.slice(urlParts.indexOf('users')).join('/')
          await supabase.storage.from('documents').remove([oldPath])
        } catch (err) {
          console.warn('Erreur lors de la suppression de l\'ancienne photo:', err)
        }
      }

      // Upload vers Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        throw new Error(`Erreur lors de l'upload: ${uploadError.message}`)
      }

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(storagePath)

      // Mettre à jour l'avatar_url dans la base de données
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
        body: JSON.stringify({ avatar_url: publicUrl }),
      })

      if (!res.ok) {
        throw new Error((await res.json())?.error || 'Erreur lors de la sauvegarde')
      }

      setAvatarUrl(publicUrl)
      setMe((prev) => prev ? { ...prev, avatar_url: publicUrl } : null)
      toast({ title: 'Photo de profil mise à jour' })

      // Réinitialiser l'input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (e: any) {
      console.error('Erreur lors de l\'upload de la photo:', e)
      toast({ 
        title: 'Erreur', 
        description: e?.message || 'Impossible d\'uploader la photo', 
        variant: 'destructive' as any 
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleRemoveAvatar() {
    if (!avatarUrl || !me?.id) return

    try {
      // Supprimer le fichier du storage
      const urlParts = avatarUrl.split('/')
      const filename = urlParts[urlParts.length - 1]
      const storagePath = `users/${me.id}/${filename}`
      
      const { error: deleteError } = await supabase.storage
        .from('documents')
        .remove([storagePath])

      if (deleteError) {
        console.warn('Erreur lors de la suppression du fichier:', deleteError)
      }

      // Mettre à jour l'avatar_url dans la base de données
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
        body: JSON.stringify({ avatar_url: null }),
      })

      if (!res.ok) {
        throw new Error((await res.json())?.error || 'Erreur lors de la sauvegarde')
      }

      setAvatarUrl(null)
      setMe((prev) => prev ? { ...prev, avatar_url: null } : null)
      toast({ title: 'Photo de profil supprimée' })
    } catch (e: any) {
      console.error('Erreur lors de la suppression de la photo:', e)
      toast({ 
        title: 'Erreur', 
        description: e?.message || 'Impossible de supprimer la photo', 
        variant: 'destructive' as any 
      })
    }
  }

  async function saveProfile() {
    setSaving(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      const payload: Record<string, unknown> = {
        firstname: firstNameField,
        lastname: lastNameField,
        surnom: surnomField,
        color: colorField,
      }
      
      // Add email fields if provided
      if (emailSmtpField.trim().length > 0) {
        payload.email_smtp = emailSmtpField.trim()
      }
      if (emailPasswordField.trim().length > 0) {
        payload.email_password = emailPasswordField.trim()
      }
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json())?.error || 'Save failed')
      setMe((prev) => {
        if (!prev) return prev
        const next = {
          ...prev,
          firstname: firstNameField,
          lastname: lastNameField,
          prenom: firstNameField,
          name: lastNameField,
          color: colorField || null,
          code_gestionnaire: surnomField || null,
          surnom: surnomField || null,
        }
        return next
      })
      toast({ title: 'Profil mis à jour avec succès' })
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de sauvegarder', variant: 'destructive' as any })
    } finally {
      setSaving(false)
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
      {/* Section Profil Principal */}
      <div className="rounded-2xl border bg-card/50 overflow-hidden">
        {/* Header avec avatar */}
        <div className="relative px-8 py-8 bg-gradient-to-br from-primary/5 via-background to-background border-b">
          <div className="flex items-start gap-6">
            {/* Avatar avec upload */}
            <motion.div
              className="relative"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Avatar
                key={avatarUrl || 'no-avatar'}
                className="h-24 w-24 border-[6px] shadow-lg"
                style={{
                  borderColor: colorField || '#6366f1',
                }}
              >
                {avatarUrl ? (
                  <AvatarImage
                    key={avatarUrl}
                    src={avatarUrl}
                    alt={`${firstNameField} ${lastNameField}`.trim() || 'User'}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback
                  className="text-3xl font-semibold uppercase tracking-wide text-white"
                  style={{
                    background: colorField || '#6366f1',
                    color: '#ffffff',
                  }}
                >
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="absolute -bottom-2 -right-2 flex gap-1 z-10">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 rounded-full shadow-lg"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar || loading}
                  title="Changer la photo"
                >
                  <Camera className="h-4 w-4" />
                </Button>
                {avatarUrl && (
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="h-8 w-8 rounded-full shadow-lg"
                    onClick={handleRemoveAvatar}
                    disabled={uploadingAvatar || loading}
                    title="Supprimer la photo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar || loading}
              />

              <div 
                className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-background border-2 flex items-center justify-center z-0"
                style={{ borderColor: colorField || '#6366f1' }}
              >
                <Camera className="h-4 w-4" style={{ color: colorField || '#6366f1' }} />
              </div>
            </motion.div>
            
            {/* Infos utilisateur */}
            <div className="flex-1 pt-2">
              <h2 className="text-2xl font-bold">
                {firstNameField || 'Prénom'} {lastNameField || 'Nom'}
              </h2>
              <p className="text-muted-foreground">{me?.email || 'email@exemple.com'}</p>
              {surnomField && (
                <span 
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: colorField || '#6366f1' }}
                >
                  <Hash className="h-3.5 w-3.5" />
                  {surnomField}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Formulaire */}
        <div className="p-8 space-y-8">
          {/* Informations personnelles */}
          <div className="space-y-4">
            <label className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Informations personnelles
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Prénom</label>
                <input
                  type="text"
                  value={firstNameField}
                  onChange={(e) => setFirstNameField(e.target.value)}
                  placeholder="Votre prénom"
                  className="w-full px-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-medium">Nom</label>
                <input
                  type="text"
                  value={lastNameField}
                  onChange={(e) => setLastNameField(e.target.value)}
                  placeholder="Votre nom"
                  className="w-full px-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
            </div>
          </div>
          
          {/* Surnom / Code gestionnaire */}
          <div className="space-y-4">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              Surnom / Code gestionnaire
            </label>
            <input
              type="text"
              value={surnomField}
              onChange={(e) => setSurnomField(e.target.value)}
              placeholder="Ex: JD, Pierre..."
              className="w-full px-4 py-3 rounded-xl border bg-muted/30 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none"
            />
            <p className="text-xs text-muted-foreground">
              Ce code sera affiché sur vos interventions et dans les rapports.
            </p>
          </div>
          
          {/* Couleur du badge */}
          <div className="space-y-4">
            <label className="text-sm font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              Couleur du badge
            </label>
            <div className="flex items-center gap-6">
              <div 
                className="h-16 w-16 rounded-full border-4 flex items-center justify-center text-lg font-bold text-white shadow-md"
                style={{ 
                  backgroundColor: colorField || '#6366f1',
                  borderColor: colorField || '#6366f1'
                }}
              >
                {initials}
              </div>
              <div className="flex-1">
                <ColorSelector value={colorField} onChange={setColorField} />
              </div>
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Bouton de sauvegarde */}
      <div className="flex justify-end">
        <motion.button
          type="button"
          onClick={saveProfile}
          disabled={saving}
          className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {saving ? (
            <>
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Sauvegarder le profil
            </>
          )}
        </motion.button>
      </div>
    </div>
  )
}
