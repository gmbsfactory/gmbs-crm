"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
  import {
    User,
    Shield,
    Users,
    Plus,
    Trash2,
    Cog,
    Palette,
    PanelLeft,
    PanelLeftClose,
    PanelLeftOpen,
    Sun,
    Moon,
    Monitor,
    Workflow,
    Target,
    Settings,
    Mail,
    ExternalLink,
  } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useInterface } from "@/contexts/interface-context"
import { ACCENT_PRESETS, type ColorMode, type AccentOption, type AccentPresetName, applyTheme } from "@/lib/themes"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase-client"
import { TargetsSettings } from "./TargetsSettings"
import { usersApi } from "@/lib/api/v2"

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
  username?: string | null
  last_seen_at?: string | null
  page_permissions?: Record<string, boolean>
}

const ACCENT_ORDER: AccentOption[] = ["indigo", "emerald", "violet", "amber", "rose", "custom"]

export type SettingsTab = "profile" | "interface" | "team" | "security" | "targets"

export default function SettingsPage({ activeTab = "profile", embedHeader = true }: { activeTab?: SettingsTab; embedHeader?: boolean }) {
  const { toast } = useToast()
  const { sidebarMode, setSidebarMode, sidebarEnabled, setSidebarEnabled, colorMode, setColorMode, accent, customAccent, setAccent, saveSettings } = useInterface()
  const router = useRouter()

  const [tempSidebarMode, setTempSidebarMode] = useState<"collapsed" | "hybrid" | "expanded">(sidebarMode)
  const [tempSidebarEnabled, setTempSidebarEnabled] = useState<boolean>(sidebarEnabled)
  const [tempColorMode, setTempColorMode] = useState<ColorMode>(colorMode)
  const [tempAccent, setTempAccent] = useState<AccentOption>(accent)
  const [tempCustomAccent, setTempCustomAccent] = useState<string>(customAccent ?? "#6366f1")
  const [currentUserRoles, setCurrentUserRoles] = useState<string[]>([])
  const [rolesLoading, setRolesLoading] = useState(true)

  // Charger les rôles de l'utilisateur actuel
  useEffect(() => {
    const loadUserRoles = async () => {
      try {
        setRolesLoading(true)
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        const res = await fetch("/api/auth/me", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const json = await res.json()
        const user = json?.user || null
        if (user) {
          console.log("[SettingsRoot] Rôles de l'utilisateur:", user.roles)
          setCurrentUserRoles(user.roles || [])
        }
      } catch (error) {
        console.error("Erreur lors du chargement des rôles:", error)
      } finally {
        setRolesLoading(false)
      }
    }
    loadUserRoles()
  }, [])

  // Vérifier si l'utilisateur est admin
  const isAdmin = !rolesLoading && currentUserRoles.some(
    (role) => (role || "").toLowerCase().trim() === "admin"
  )
  
  // Vérifier si l'utilisateur a les permissions (admin ou manager)
  // Comparaison insensible à la casse pour gérer "admin", "ADMIN", "manager", "MANAGER", etc.
  const canManageTargets = !rolesLoading && currentUserRoles.some(
    (role) => {
      const roleLower = (role || "").toLowerCase().trim()
      const hasPermission = roleLower === "admin" || roleLower === "manager"
      if (hasPermission) {
        console.log("[SettingsRoot] Permission accordée pour le rôle:", role)
      }
      return hasPermission
    }
  )
  
  console.log("[SettingsRoot] isAdmin:", isAdmin, "canManageTargets:", canManageTargets, "roles:", currentUserRoles, "loading:", rolesLoading)

  // Synchroniser les états temporaires avec les valeurs persistées
  useEffect(() => {
    setTempSidebarMode(sidebarMode)
    setTempSidebarEnabled(sidebarEnabled)
    setTempAccent(accent)
    if (accent === "custom" && customAccent) {
      setTempCustomAccent(customAccent)
    }
  }, [sidebarMode, sidebarEnabled, accent, customAccent])

  // Profile: load current user and allow editing personal info + badge color + email config
  function ProfileSettings() {
    const [me, setMe] = useState<TeamUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [colorField, setColorField] = useState<string>('')
    const [lastNameField, setLastNameField] = useState<string>('')
    const [firstNameField, setFirstNameField] = useState<string>('')
    const [surnomField, setSurnomField] = useState<string>('')
    const [emailSmtpField, setEmailSmtpField] = useState<string>('')
    const [emailPasswordField, setEmailPasswordField] = useState<string>('')
    const [speedometerMarginAverageShowPercentage, setSpeedometerMarginAverageShowPercentage] = useState<boolean>(true)
    const [speedometerMarginTotalShowPercentage, setSpeedometerMarginTotalShowPercentage] = useState<boolean>(true)
    const [preferencesLoading, setPreferencesLoading] = useState(true)

    useEffect(() => {
      const run = async () => {
        try {
          const { data: session } = await supabase.auth.getSession()
          const token = session?.session?.access_token
          const res = await fetch('/api/auth/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
          const j = await res.json()
          const u: TeamUser | null = j?.user || null
          setMe(u)
          setColorField(u?.color || '')
          setFirstNameField(u?.firstname || u?.prenom || '')
          setLastNameField(u?.lastname || u?.name || '')
          setSurnomField(u?.code_gestionnaire || u?.surnom || '')
          // Load email_smtp if available (email_password_encrypted is never loaded for security)
          setEmailSmtpField((u as any)?.email_smtp || '')
          
          // Charger les préférences utilisateur
          if (u?.id) {
            try {
              const preferences = await usersApi.getUserPreferences(u.id)
              if (preferences) {
                setSpeedometerMarginAverageShowPercentage(preferences.speedometer_margin_average_show_percentage)
                setSpeedometerMarginTotalShowPercentage(preferences.speedometer_margin_total_show_percentage)
              }
            } catch (err) {
              console.error("Erreur lors du chargement des préférences:", err)
            }
          }
        } finally {
          setLoading(false)
          setPreferencesLoading(false)
        }
      }
      run()
    }, [])

    const initials = ((firstNameField?.[0] || 'U') + (lastNameField?.[0] || '')).toUpperCase()

    async function saveProfile() {
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
        toast({ title: 'Profil mis à jour' })
      } catch (e: any) {
        toast({ title: 'Erreur', description: e?.message || 'Impossible de sauvegarder', variant: 'destructive' as any })
      }
    }

    async function savePreferences() {
      if (!me?.id) return
      try {
        await usersApi.updateUserPreferences(me.id, {
          speedometer_margin_average_show_percentage: speedometerMarginAverageShowPercentage,
          speedometer_margin_total_show_percentage: speedometerMarginTotalShowPercentage,
        })
        toast({ title: 'Préférences sauvegardées' })
      } catch (e: any) {
        toast({ title: 'Erreur', description: e?.message || 'Impossible de sauvegarder les préférences', variant: 'destructive' as any })
      }
    }

    return (
      <TabsContent value="profile" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Gérez vos informations et la couleur de votre badge.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div
                className="relative flex h-20 w-20 select-none items-center justify-center rounded-full border-[6px] text-3xl font-semibold uppercase tracking-wide text-white"
                style={{
                  borderColor: colorField || '#e5e7eb',
                  background: colorField || undefined,
                  color: colorField ? '#ffffff' : '#1f2937',
                }}
                aria-hidden="true"
              >
                {initials}
              </div>
              <div className="flex-1 grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Prénom</Label>
                    <Input value={firstNameField} onChange={(e) => setFirstNameField(e.target.value)} />
                  </div>
                  <div>
                    <Label>Nom</Label>
                    <Input value={lastNameField} onChange={(e) => setLastNameField(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Surnom</Label>
                  <Input value={surnomField} onChange={(e) => setSurnomField(e.target.value)} placeholder="Code gestionnaire" />
                </div>
                <div>
                  <Label>Couleur du badge</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input type="color" className="w-12 p-1" value={colorField || '#ffffff'} onChange={(e) => setColorField(e.target.value)} />
                    <Input placeholder="#RRGGBB" value={colorField} onChange={(e) => setColorField(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Email Configuration Section */}
            <div className="border-t pt-6 mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-4 w-4" />
                <CardTitle className="text-base">Configuration Email</CardTitle>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email_smtp">Email Gmail</Label>
                  <Input
                    id="email_smtp"
                    type="email"
                    value={emailSmtpField}
                    onChange={(e) => setEmailSmtpField(e.target.value)}
                    placeholder="votre.email@gmail.com"
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Adresse Gmail utilisée pour l&apos;envoi d&apos;emails aux artisans
                  </p>
                </div>
                <div>
                  <Label htmlFor="email_password">Mot de passe d&apos;application Gmail</Label>
                  <Input
                    id="email_password"
                    type="password"
                    value={emailPasswordField}
                    onChange={(e) => setEmailPasswordField(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
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
            
            <div className="flex justify-end">
              <Button onClick={saveProfile} disabled={loading}>Sauvegarder</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Préférences du tableau de bord</CardTitle>
            <CardDescription>Personnalisez l&apos;affichage des speedometers sur votre tableau de bord.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="speedometer-margin-average">Speedometer marge moyenne visible</Label>
                <p className="text-sm text-muted-foreground">
                  Afficher le pourcentage sous le speedometer de marge moyenne
                </p>
              </div>
              <Switch
                id="speedometer-margin-average"
                checked={speedometerMarginAverageShowPercentage}
                onCheckedChange={setSpeedometerMarginAverageShowPercentage}
                disabled={preferencesLoading}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="speedometer-margin-total">Speedometer marge totale visible</Label>
                <p className="text-sm text-muted-foreground">
                  Afficher le pourcentage sous le speedometer de marge totale
                </p>
              </div>
              <Switch
                id="speedometer-margin-total"
                checked={speedometerMarginTotalShowPercentage}
                onCheckedChange={setSpeedometerMarginTotalShowPercentage}
                disabled={preferencesLoading}
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={savePreferences} disabled={preferencesLoading || !me?.id}>
                Sauvegarder les préférences
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    )
  }

  const handleSaveInterfaceSettings = () => {
    // Mettre à jour les states du contexte
    setSidebarMode(tempSidebarMode)
    setSidebarEnabled(tempSidebarEnabled)
    setColorMode(tempColorMode)
    if (tempAccent === "custom") {
      setAccent("custom", tempCustomAccent)
    } else {
      setAccent(tempAccent)
    }

    // Pré-applique les préférences pour éviter un flash en attendant la persistance
    applyTheme(
      tempColorMode,
      tempAccent,
      tempAccent === "custom" ? tempCustomAccent : undefined,
    )

    localStorage.setItem("sidebar-mode", tempSidebarMode)

    const accentLabel =
      tempAccent === "custom"
        ? `personnalisé (${tempCustomAccent})`
        : ACCENT_PRESETS[tempAccent as AccentPresetName]?.displayName ?? tempAccent

    toast({
      title: "Interface settings saved",
      description: `Sidebar: ${tempSidebarMode}, Mode: ${
        tempColorMode === "dark" ? "sombre" : tempColorMode === "system" ? "système" : "clair"
      }, Accent: ${accentLabel}`,
    })
  }

  // Team data from API (Supabase-backed)
  const [team, setTeam] = useState<TeamUser[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [newPrenom, setNewPrenom] = useState('')
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newSurnom, setNewSurnom] = useState('')
  const [newRole, setNewRole] = useState('gestionnaire')
  const [editUser, setEditUser] = useState<TeamUser | null>(null)
  const [editRole, setEditRole] = useState<string | null>(null)
  const [editSurnom, setEditSurnom] = useState<string>('')
  const [editColor, setEditColor] = useState<string>('')
  const [editPagePermissions, setEditPagePermissions] = useState<Record<string, boolean>>({})
  const [editPagePermissionsLoading, setEditPagePermissionsLoading] = useState(false)
  const [deletingUser, setDeletingUser] = useState<TeamUser | null>(null)
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState<string>('')
  useEffect(() => {
    if (activeTab !== 'team') return
    let ignore = false
    const run = async () => {
      setTeamLoading(true)
      try {
        const res = await fetch('/api/settings/team', { cache: 'no-store' })
        const data = await res.json()
        if (!ignore) {
          setTeam(data?.users || [])
          setLastSync(new Date())
        }
      } catch (e) {
        if (!ignore) setTeam([])
      } finally {
        if (!ignore) setTeamLoading(false)
      }
    }
    run()
    return () => { ignore = true }
  }, [activeTab])

  const defaultPagePermissions = (role: string | null | undefined) => {
    const normalizedRole = (role || '').toLowerCase()
    const isPrivileged = normalizedRole === 'admin' || normalizedRole === 'manager'
    return { comptabilite: isPrivileged }
  }

  useEffect(() => {
    if (!editUser) return
    setEditPagePermissions((prev) => {
      const normalizedRole = (editRole || '').toLowerCase()
      const isPrivileged = normalizedRole === 'admin' || normalizedRole === 'manager'
      if (!isPrivileged) {
        if (prev.comptabilite === false) return prev
        return { ...prev, comptabilite: false }
      }
      if (prev.comptabilite === undefined) {
        return { ...prev, comptabilite: true }
      }
      return prev
    })
  }, [editRole, editUser])

  useEffect(() => {
    if (!editUser?.id) return
    let ignore = false
    const loadPermissions = async () => {
      const defaults = defaultPagePermissions(editRole || editUser.role || null)
      setEditPagePermissions((prev) => (Object.keys(prev).length === 0 ? defaults : prev))
      setEditPagePermissionsLoading(true)
      try {
        const res = await fetch(`/api/settings/team/user/${editUser.id}/page-permissions`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (ignore) return
        const perms = data?.permissions
        if (perms && typeof perms === 'object' && Object.keys(perms).length > 0) {
          setEditPagePermissions(perms)
        } else {
          setEditPagePermissions(defaults)
        }
      } catch (error) {
        if (!ignore) setEditPagePermissions(defaults)
      } finally {
        if (!ignore) setEditPagePermissionsLoading(false)
      }
    }
    loadPermissions()
    return () => { ignore = true }
  }, [editUser?.id, editRole, editUser?.role])

  const handleSidebarModeChange = (mode: "collapsed" | "hybrid" | "expanded") => {
    setTempSidebarMode(mode)
  }

  const handleColorModeChange = (mode: ColorMode) => {
    setTempColorMode(mode)
    applyTheme(
      mode,
      tempAccent,
      tempAccent === "custom" ? tempCustomAccent : undefined,
    )
  }

  const handleAccentChange = (value: AccentOption) => {
    setTempAccent(value)
    if (value === "custom") {
      applyTheme(tempColorMode, "custom", tempCustomAccent)
    } else {
      applyTheme(tempColorMode, value)
    }
  }

  const handleCustomAccentChange = (value: string) => {
    setTempAccent("custom")
    setTempCustomAccent(value)
    applyTheme(tempColorMode, "custom", value)
  }

  const hasUnsavedChanges =
    tempSidebarMode !== sidebarMode ||
    tempSidebarEnabled !== sidebarEnabled ||
    tempColorMode !== colorMode ||
    tempAccent !== accent ||
    (tempAccent === "custom" &&
      accent === "custom" &&
      tempCustomAccent.toLowerCase() !== (customAccent ?? "").toLowerCase())

  // Helpers: role/status labels
  function roleLabel(r: string) {
    const key = r.toLowerCase()
    if (key.includes('admin')) return 'Admin'
    if (key.includes('manager')) return 'Manager'
    if (key.includes('gestion')) return 'Gestionnaire'
    return r
  }

  function statusBadge(status: string | null) {
    const s = (status || '').toLowerCase()
    const cls = s === 'connected'
      ? 'bg-green-100 text-green-800'
      : s === 'busy'
      ? 'bg-orange-100 text-orange-800'
      : s === 'dnd'
      ? 'bg-red-100 text-red-800'
      : 'bg-gray-100 text-gray-800'
    const label = s === 'connected' ? 'Connecté' : s === 'busy' ? 'Occupé' : s === 'dnd' ? 'Ne pas déranger' : 'Hors ligne'
    return <Badge className={cls}>{label}</Badge>
  }

  function resetNewUser() {
    setNewPrenom(''); setNewName(''); setNewEmail(''); setNewSurnom(''); setNewRole('gestionnaire')
  }

  async function handleCreateUser() {
    if (!newPrenom || !newName || !newEmail || !newSurnom || !newRole) {
      setAddingNew(false)
      resetNewUser()
      return
    }
    const payload = { firstname: newPrenom, lastname: newName, email: newEmail, surnom: newSurnom, role: newRole }
    const resp = await fetch('/api/settings/team/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const j = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      if (j?.error === 'email_taken') {
        toast({ title: 'Utilisateur existant', description: 'Cette adresse email est déjà utilisée.', variant: 'destructive' as any })
      } else {
        toast({ title: 'Erreur', description: j?.error || 'Impossible de créer l’utilisateur', variant: 'destructive' as any })
      }
      return
    }
    const res = await fetch('/api/settings/team', { cache: 'no-store' })
    const data = await res.json()
    setTeam(data?.users || [])
    setLastSync(new Date())
    setAddingNew(false)
    resetNewUser()
  }

  return (
    <div className="flex flex-col min-h-[1px]">
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const val = v as SettingsTab
          const target = val === "profile" ? "/settings/profile" : `/settings/${val}`
          router.push(target)
        }}
        className="space-y-6"
      >
        {embedHeader && (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
              <p className="text-muted-foreground">Manage your account settings and preferences</p>
            </div>
            <TabsList className={`grid w-full ${isAdmin && canManageTargets ? "grid-cols-5" : isAdmin || canManageTargets ? "grid-cols-4" : "grid-cols-3"}`}>
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="interface" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Interface
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="team" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team
                </TabsTrigger>
              )}
              {canManageTargets && (
                <TabsTrigger value="targets" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Objectifs
                </TabsTrigger>
              )}
              <TabsTrigger value="security" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Security
              </TabsTrigger>
            </TabsList>
          </>
        )}

          <TabsContent value="profile" className="space-y-6">
            <ProfileSettings />
          </TabsContent>

          <TabsContent value="interface" className="space-y-6">
            {hasUnsavedChanges && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse"></div>
                      <p className="text-sm font-medium text-orange-800">You have unsaved interface changes</p>
                    </div>
                    <Button onClick={handleSaveInterfaceSettings} className="bg-orange-600 hover:bg-orange-700">
                      Save Interface Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Workflow des interventions - Masqué selon exigences client */}
            {/* <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="h-5 w-5" />
                  Workflow des interventions
                </CardTitle>
                <CardDescription>
                  Gérez les statuts, transitions et règles métier du cycle de vie des interventions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configurez le workflow complet des interventions : statuts, prérequis, transitions autorisées et
                  actions automatiques pour une orchestration fluide entre équipes.
                </p>
                <Button asChild className="gap-2">
                  <Link href="/settings/interface/workflow">
                    <Settings className="h-4 w-4" />
                    Ouvrir l'éditeur de workflow
                  </Link>
                </Button>
              </CardContent>
            </Card> */}

            {/* Theme Configuration - Position 1 */}
            <Card>
              <CardHeader>
                <CardTitle>Theme Configuration</CardTitle>
                <CardDescription>Personnalisez le mode d&apos;affichage et la couleur d&apos;accent du CRM.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* --- Mode d'affichage (clair / sombre / système) --- */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Mode d&apos;affichage</Label>
                  <RadioGroup
                    value={tempColorMode}
                    onValueChange={(value) => handleColorModeChange(value as ColorMode)}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="light" id="light" />
                          <Label htmlFor="light" className="font-medium flex items-center gap-2">
                            <Sun className="h-4 w-4" />
                            Mode Clair
                          </Label>
                        </div>
                        <div
                          className="border rounded-lg p-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleColorModeChange("light")}
                        >
                          <div className="flex flex-col gap-2 h-16">
                            <div className="flex gap-2 h-4">
                              <div className="w-12 bg-white border border-gray-200 rounded flex items-center justify-center">
                                <Sun className="h-2 w-2 text-gray-600" />
                              </div>
                              <div className="flex-1 bg-gray-50 border border-gray-200 rounded"></div>
                            </div>
                            <div className="flex gap-1">
                              <div className="w-8 h-3 bg-blue-500 rounded"></div>
                              <div className="w-8 h-3 bg-gray-200 rounded"></div>
                              <div className="w-8 h-3 bg-gray-200 rounded"></div>
                            </div>
                            <div className="flex-1 bg-white border border-gray-200 rounded"></div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Interface claire et lumineuse</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="dark" id="dark" />
                          <Label htmlFor="dark" className="font-medium flex items-center gap-2">
                            <Moon className="h-4 w-4" />
                            Mode Sombre
                          </Label>
                        </div>
                        <div
                          className="border rounded-lg p-4 bg-gray-900 hover:bg-gray-800 transition-colors cursor-pointer"
                          onClick={() => handleColorModeChange("dark")}
                        >
                          <div className="flex flex-col gap-2 h-16">
                            <div className="flex gap-2 h-4">
                              <div className="w-12 bg-gray-800 border border-gray-600 rounded flex items-center justify-center">
                                <Moon className="h-2 w-2 text-gray-300" />
                              </div>
                              <div className="flex-1 bg-gray-700 border border-gray-600 rounded"></div>
                            </div>
                            <div className="flex gap-1">
                              <div className="w-8 h-3 bg-blue-400 rounded"></div>
                              <div className="w-8 h-3 bg-gray-600 rounded"></div>
                              <div className="w-8 h-3 bg-gray-600 rounded"></div>
                            </div>
                            <div className="flex-1 bg-gray-800 border border-gray-600 rounded"></div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Interface sombre pour les yeux</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="system" id="system" />
                          <Label htmlFor="system" className="font-medium flex items-center gap-2">
                            <Monitor className="h-4 w-4" />
                            Système
                          </Label>
                        </div>
                        <div
                          className="border rounded-lg p-4 bg-gradient-to-br from-gray-50 to-gray-900 hover:from-gray-100 hover:to-gray-800 transition-colors cursor-pointer"
                          onClick={() => handleColorModeChange("system")}
                        >
                          <div className="flex flex-col gap-2 h-16 relative">
                            {/* Moitié claire */}
                            <div className="absolute left-0 top-0 w-1/2 h-full bg-white rounded-l border-r">
                              <div className="flex flex-col gap-1 p-2 h-full">
                                <div className="flex gap-1 h-3">
                                  <div className="w-6 bg-gray-100 border border-gray-200 rounded flex items-center justify-center">
                                    <Sun className="h-1 w-1 text-gray-600" />
                                  </div>
                                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded"></div>
                                </div>
                                <div className="flex gap-1">
                                  <div className="w-4 h-2 bg-blue-500 rounded"></div>
                                  <div className="w-4 h-2 bg-gray-200 rounded"></div>
                                </div>
                                <div className="flex-1 bg-white border border-gray-200 rounded"></div>
                              </div>
                            </div>
                            {/* Moitié sombre */}
                            <div className="absolute right-0 top-0 w-1/2 h-full bg-gray-900 rounded-r border-l border-gray-600">
                              <div className="flex flex-col gap-1 p-2 h-full">
                                <div className="flex gap-1 h-3">
                                  <div className="w-6 bg-gray-800 border border-gray-600 rounded flex items-center justify-center">
                                    <Moon className="h-1 w-1 text-gray-300" />
                                  </div>
                                  <div className="flex-1 bg-gray-700 border border-gray-600 rounded"></div>
                                </div>
                                <div className="flex gap-1">
                                  <div className="w-4 h-2 bg-blue-400 rounded"></div>
                                  <div className="w-4 h-2 bg-gray-600 rounded"></div>
                                </div>
                                <div className="flex-1 bg-gray-800 border border-gray-600 rounded"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">S&apos;adapte à votre système</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>

                {/* --- Couleur d'accent (présets + personnalisée) --- */}
                <div className="space-y-4 pt-6 border-t">
                  <Label className="text-base font-medium">Couleur d&apos;accent</Label>
                  <RadioGroup
                    value={tempAccent}
                    onValueChange={(value) => handleAccentChange(value as AccentOption)}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {ACCENT_ORDER.map((option) => {
                        if (option === "custom") {
                          const isActive = tempAccent === "custom"
                          const accentPreview = tempCustomAccent
                          return (
                            <div key="custom" className="space-y-3">
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="custom" id="accent-custom" />
                                <Label htmlFor="accent-custom" className="font-medium">
                                  Personnalisée
                                </Label>
                              </div>
                              <div
                                className={`border rounded-lg p-4 transition-colors ${
                                  isActive ? "bg-background" : "bg-muted/30 hover:bg-muted/50"
                                } cursor-pointer`}
                                onClick={() => handleAccentChange("custom")}
                                style={
                                  isActive
                                    ? { borderColor: accentPreview, boxShadow: `0 0 0 2px ${accentPreview}` }
                                    : undefined
                                }
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className="h-10 w-10 rounded-full border shadow-sm"
                                    style={{ background: accentPreview, borderColor: accentPreview }}
                                  ></span>
                                  <div className="flex flex-col gap-2 flex-1">
                                    <div className="flex items-center gap-3">
                                      <input
                                        type="color"
                                        aria-label="Choisir une couleur personnalisée"
                                        value={tempCustomAccent}
                                        onChange={(event) => handleCustomAccentChange(event.target.value)}
                                        className="h-10 w-16 cursor-pointer rounded border bg-transparent p-1"
                                      />
                                      <span className="text-xs text-muted-foreground uppercase tracking-wide">
                                        {tempCustomAccent.toUpperCase()}
                                      </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-tight">
                                      Sélectionnez n&apos;importe quelle couleur pour l&apos;accent global.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        }
                        const accentKey = option as AccentPresetName
                        const preset = ACCENT_PRESETS[accentKey]
                        const isActive = tempAccent === accentKey
                        const accentPreview = `hsl(${preset.light.accentHsl})`
                        const accentPreviewDark = `hsl(${preset.dark.accentHsl})`
                        return (
                          <div key={accentKey} className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value={accentKey} id={`accent-${accentKey}`} />
                              <Label htmlFor={`accent-${accentKey}`} className="font-medium">
                                {preset.displayName}
                              </Label>
                            </div>
                            <div
                              className={`border rounded-lg p-4 transition-colors ${
                                isActive ? "bg-background" : "bg-muted/30 hover:bg-muted/50"
                              } cursor-pointer`}
                              onClick={() => handleAccentChange(accentKey)}
                              style={
                                isActive
                                  ? { borderColor: accentPreview, boxShadow: `0 0 0 2px ${accentPreview}` }
                                  : undefined
                              }
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className="h-10 w-10 rounded-full border shadow-sm"
                                  style={{ background: accentPreview, borderColor: accentPreview }}
                                ></span>
                                <div className="flex flex-col gap-2 flex-1">
                                  <div className="h-6 rounded-md shadow-inner" style={{ background: accentPreviewDark }}></div>
                                  <div className="flex gap-2">
                                    <div className="h-2 w-12 rounded-full" style={{ background: accentPreview }}></div>
                                    <div className="h-2 w-12 rounded-full bg-muted"></div>
                                  </div>
                                  <p className="text-xs text-muted-foreground leading-tight">{preset.description}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Cette couleur s&apos;applique aux boutons primaires, survols, focus et autres éléments interactifs.
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={handleSaveInterfaceSettings} className="w-full" disabled={!hasUnsavedChanges}>
                    {hasUnsavedChanges ? "Save Interface Settings" : "Settings Saved"}
                  </Button>
                  {hasUnsavedChanges && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Click to apply your interface changes
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sidebar Configuration - Position 2 */}
            <Card>
              <CardHeader>
                <CardTitle>Sidebar Configuration</CardTitle>
                <CardDescription>Choose how you want the sidebar to behave</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div className="space-y-0.5">
                    <Label htmlFor="sidebar-enabled" className="text-base font-medium">Sidebar active</Label>
                    <p className="text-sm text-muted-foreground">
                      {tempSidebarEnabled ? "La sidebar est affichée" : "La sidebar est masquée, navigation via le logo"}
                    </p>
                  </div>
                  <Switch
                    id="sidebar-enabled"
                    checked={tempSidebarEnabled}
                    onCheckedChange={setTempSidebarEnabled}
                  />
                </div>
                {tempSidebarEnabled && (
                <div className="space-y-4">
                  <Label className="text-base font-medium">Sidebar Mode</Label>
                  <RadioGroup
                    value={tempSidebarMode}
                    onValueChange={(value) => handleSidebarModeChange(value as "collapsed" | "hybrid" | "expanded")}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="collapsed" id="collapsed" />
                          <Label htmlFor="collapsed" className="font-medium">
                            Collapsed
                          </Label>
                        </div>
                        <div
                          className="border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleSidebarModeChange("collapsed")}
                        >
                          <div className="flex gap-2 h-24">
                            <div className="w-8 bg-sidebar border rounded flex flex-col items-center py-2 gap-1 animate-pulse">
                              <PanelLeftClose className="h-3 w-3 text-muted-foreground" />
                              <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                              <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                              <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                              <div className="flex-1"></div>
                              <div className="w-4 h-4 bg-muted-foreground/40 rounded-full"></div>
                            </div>
                            <div className="flex-1 bg-background border rounded p-2">
                              <div className="w-full h-2 bg-muted-foreground/20 rounded mb-2"></div>
                              <div className="w-3/4 h-2 bg-muted-foreground/20 rounded"></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Icons only, always collapsed</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="hybrid" id="hybrid" />
                          <Label htmlFor="hybrid" className="font-medium">
                            Hybrid (Default)
                          </Label>
                        </div>
                        <div
                          className="border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleSidebarModeChange("hybrid")}
                        >
                          <div className="flex gap-2 h-24">
                            <div className="w-8 bg-sidebar border rounded flex flex-col items-center py-2 gap-1 relative overflow-hidden animate-[expand-contract_2s_ease-in-out_infinite]">
                              <PanelLeft className="h-3 w-3 text-muted-foreground" />
                              <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                              <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                              <div className="w-4 h-1 bg-muted-foreground/40 rounded"></div>
                              <div className="flex-1"></div>
                              <div className="w-4 h-4 bg-muted-foreground/40 rounded-full"></div>
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent to-sidebar/50 opacity-30 animate-[shimmer_2s_ease-in-out_infinite]"></div>
                            </div>
                            <div className="flex-1 bg-background border rounded p-2">
                              <div className="w-full h-2 bg-muted-foreground/20 rounded mb-2"></div>
                              <div className="w-3/4 h-2 bg-muted-foreground/20 rounded"></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Expands on hover, collapses when not in use</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="expanded" id="expanded" />
                          <Label htmlFor="expanded" className="font-medium">
                            Expanded
                          </Label>
                        </div>
                        <div
                          className="border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleSidebarModeChange("expanded")}
                        >
                          <div className="flex gap-2 h-24">
                            <div className="w-16 bg-sidebar border rounded flex flex-col py-2 px-2 gap-1 animate-[breathing_3s_ease-in-out_infinite]">
                              <div className="flex items-center gap-1 mb-1">
                                <PanelLeftOpen className="h-3 w-3 text-muted-foreground" />
                                <div className="w-8 h-1 bg-muted-foreground/40 rounded"></div>
                              </div>
                              <div className="w-full h-1 bg-muted-foreground/40 rounded"></div>
                              <div className="w-full h-1 bg-muted-foreground/40 rounded"></div>
                              <div className="w-full h-1 bg-muted-foreground/40 rounded"></div>
                              <div className="flex-1"></div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-muted-foreground/40 rounded-full"></div>
                                <div className="w-6 h-1 bg-muted-foreground/40 rounded"></div>
                              </div>
                            </div>
                            <div className="flex-1 bg-background border rounded p-2">
                              <div className="w-full h-2 bg-muted-foreground/20 rounded mb-2"></div>
                              <div className="w-3/4 h-2 bg-muted-foreground/20 rounded"></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Always expanded with full text labels</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle>Team Members</CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setAddingNew(true)} aria-label="Ajouter un utilisateur">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <CardDescription>
                      {lastSync ? `dernière synchronisation ${('0'+lastSync.getDate()).slice(-2)}-${('0'+(lastSync.getMonth()+1)).slice(-2)}-${lastSync.getFullYear()}` : ''}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Surnom</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamLoading && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Chargement…</TableCell>
                      </TableRow>
                    )}
                    {!teamLoading && team.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Aucun utilisateur</TableCell>
                      </TableRow>
                    )}
                    {!teamLoading && team.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full border-4 overflow-hidden" style={{ borderColor: u.color || '#e5e7eb', background: u.color || undefined }}>
                              <Avatar className="h-full w-full" style={{ background: u.color || undefined }}>
                                <AvatarFallback style={{ background: u.color || undefined }}>
                                  {(u.firstname?.[0] || u.prenom?.[0] || '').toUpperCase()}{(u.lastname?.[0] || u.name?.[0] || '').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </div>
                            <div>
                              <p className="font-medium">
                                <span className="px-2 py-0.5 rounded-full border-2" style={{ borderColor: u.color || '#e5e7eb', background: u.color || undefined }}>
                                  {u.firstname || u.prenom} {u.lastname || u.name}
                                </span>
                              </p>
                              {u.email && <p className="text-sm text-muted-foreground">{u.email}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{u.code_gestionnaire || u.surnom || '—'}</TableCell>
                        <TableCell>{u.role ? roleLabel(u.role) : '—'}</TableCell>
                        <TableCell>
                          {statusBadge(u.status)}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditUser(u)
                            setEditRole(u.role || 'gestionnaire')
                            setEditSurnom(u.code_gestionnaire || u.surnom || '')
                            setEditColor(u.color || '')
                            const defaults = defaultPagePermissions(u.role || null)
                            setEditPagePermissions(
                              u.page_permissions && Object.keys(u.page_permissions).length > 0
                                ? u.page_permissions
                                : defaults
                            )
                          }}>
                            <Cog className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeletingUser(u); setDeleteEmailConfirm('') }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Inline add row */}
                    {addingNew && (
                      <TableRow>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full border-2 overflow-hidden">
                              <Avatar className="h-full w-full">
                                <AvatarFallback>NV</AvatarFallback>
                              </Avatar>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input placeholder="Prénom" value={newPrenom} onChange={(e) => setNewPrenom(e.target.value)} />
                              <Input placeholder="Nom" value={newName} onChange={(e) => setNewName(e.target.value)} />
                              <Input className="col-span-2" placeholder="email@exemple.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input placeholder="Surnom" value={newSurnom} onChange={(e) => setNewSurnom(e.target.value)} />
                        </TableCell>
                        <TableCell>
                          <Select value={newRole} onValueChange={(v) => setNewRole(v)}>
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Rôle" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>—</TableCell>
                        <TableCell className="flex gap-2">
                          <Button variant="secondary" onClick={() => { setAddingNew(false); resetNewUser() }}>Annuler</Button>
                          <Button onClick={handleCreateUser}>Enregistrer</Button>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Edit dialog */}
            <Dialog
              open={!!editUser}
              onOpenChange={(o) => {
                if (!o) {
                  setEditUser(null)
                  setEditRole(null)
                  setEditSurnom('')
                  setEditColor('')
                  setEditPagePermissions({})
                  setEditPagePermissionsLoading(false)
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Modifier l’utilisateur</DialogTitle>
                  <DialogDescription>{editUser ? `${editUser.firstname || editUser.prenom || ''} ${editUser.lastname || editUser.name || ''}`.trim() : ''}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Rôle</Label>
                      <Select value={editRole || undefined} onValueChange={setEditRole as any}>
                        <SelectTrigger className="w-full mt-1">
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Surnom</Label>
                      <Input className="mt-1" value={editSurnom} onChange={(e) => setEditSurnom(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="text-base font-medium">Permissions d&apos;accès aux pages</Label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="page-comptabilite" className="text-sm font-normal">
                            Page Comptabilité
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Accès à la page comptabilité (admins et managers uniquement)
                          </p>
                        </div>
                        <Switch
                          id="page-comptabilite"
                          checked={editPagePermissions.comptabilite ?? false}
                          disabled={(editRole || '').toLowerCase() === 'gestionnaire' || editPagePermissionsLoading}
                          onCheckedChange={(checked) =>
                            setEditPagePermissions((prev) => ({ ...prev, comptabilite: checked }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Couleur du badge</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input type="color" className="w-12 p-1" value={editColor || '#ffffff'} onChange={(e) => setEditColor(e.target.value)} />
                      <Input placeholder="#RRGGBB" value={editColor} onChange={(e) => setEditColor(e.target.value)} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setEditUser(null)}>Annuler</Button>
                  <Button onClick={async () => {
                    if (!editUser) return
                    await fetch('/api/settings/team/user', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: editUser.id, surnom: editSurnom, color: editColor })
                    })
                    if (editRole) {
                      await fetch('/api/settings/team/role', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: editUser.id, role: editRole })
                      })
                    }
                    await fetch(`/api/settings/team/user/${editUser.id}/page-permissions`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ permissions: editPagePermissions })
                    })
                    const res = await fetch('/api/settings/team', { cache: 'no-store' })
                    const data = await res.json()
                    setTeam(data?.users || [])
                    setEditUser(null)
                    setEditRole(null)
                    setEditSurnom('')
                    setEditColor('')
                    setEditPagePermissions({})
                  }}>Enregistrer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete confirm dialog */}
            <Dialog
              open={!!deletingUser}
              onOpenChange={(o) => {
                if (!o) {
                  setDeletingUser(null)
                  setDeleteEmailConfirm('')
                }
              }}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Supprimer l’utilisateur</DialogTitle>
                  <DialogDescription>
                    Tapez l’adresse email de l’utilisateur pour confirmer la suppression définitive.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <p className="text-sm">{`${deletingUser?.firstname || deletingUser?.prenom || ''} ${deletingUser?.lastname || deletingUser?.name || ''}`.trim()}</p>
                  <p className="text-sm text-muted-foreground">{deletingUser?.email || '—'}</p>
                  <Input placeholder="email@exemple.com" value={deleteEmailConfirm} onChange={(e) => setDeleteEmailConfirm(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button variant="secondary" onClick={() => setDeletingUser(null)}>Annuler</Button>
                  <Button variant="destructive" disabled={!deletingUser?.email || (deletingUser?.email || '').toLowerCase() !== deleteEmailConfirm.toLowerCase()} onClick={async () => {
                    if (!deletingUser) return
                    await fetch('/api/settings/team/user', {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: deletingUser.id, emailConfirm: deleteEmailConfirm })
                    })
                    const res = await fetch('/api/settings/team', { cache: 'no-store' })
                    const data = await res.json()
                    setTeam(data?.users || [])
                    setDeletingUser(null)
                    setDeleteEmailConfirm('')
                  }}>Supprimer définitivement</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </TabsContent>
          )}

          {canManageTargets && (
            <TabsContent value="targets" className="space-y-6">
              <TargetsSettings />
            </TabsContent>
          )}

          <TabsContent value="security" className="space-y-6 relative">
            {/* Filigrane DEMO PAGE en mosaïque */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {/* Grille de filigranes répétés */}
              <div className="grid grid-cols-3 gap-8 absolute inset-0">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="transform -rotate-45 text-6xl font-bold text-gray-400/60 select-none whitespace-nowrap flex items-center justify-center">
                    DEMO PAGE
                  </div>
                ))}
              </div>
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Update your password to keep your account secure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" />
                </div>
                <Button>Update Password</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>Add an extra layer of security to your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Authenticator App</p>
                    <p className="text-sm text-muted-foreground">
                      Use an authenticator app to generate verification codes
                    </p>
                  </div>
                  <Button variant="outline">Setup</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">SMS Verification</p>
                    <p className="text-sm text-muted-foreground">Receive verification codes via SMS</p>
                  </div>
                  <Button variant="outline">Setup</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Sessions</CardTitle>
                <CardDescription>Manage your active sessions across devices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Current Session</p>
                      <p className="text-sm text-muted-foreground">Chrome on MacOS • San Francisco, CA</p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">Mobile App</p>
                      <p className="text-sm text-muted-foreground">iPhone • Last active 2 hours ago</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Revoke
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }
