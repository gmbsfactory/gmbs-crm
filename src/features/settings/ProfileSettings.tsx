"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Mail, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase-client"
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

export function ProfileSettings() {
  const { toast } = useToast()
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






