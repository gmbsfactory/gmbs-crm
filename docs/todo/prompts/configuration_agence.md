Plan: Gestion des Agences dans Settings
Vue d'ensemble
Ajouter un onglet "Agence" dans la page Settings (entre Teams et Perf) permettant aux managers et admins de configurer les agences sélectionnables dans le système. Les utilisateurs pourront ajouter, masquer (soft delete via is_active) et créer des agences. Architecture choisie : Composant séparé (comme TargetsSettings.tsx) pour meilleure maintenabilité.
Architecture Actuelle
Base de données
Table agencies : id, code, label, region, is_active (boolean)
Table agency_config : agency_id, requires_reference (pour ImoDirect, AFEDIM, Oqoro)
Actuellement : pas de soft delete pour les agences (contrairement aux users qui utilisent hard delete)
APIs existantes
src/lib/reference-api.ts : getAgencies() - récupère toutes les agences triées par label
src/lib/api/v2/enumsApi.ts : findOrCreateAgency() - cherche ou crée une agence
Composants de sélection
LegacyInterventionForm.tsx - Select avec toutes les agences
InterventionEditForm.tsx - Select pour édition
FilterBar.tsx - Multi-select pour filtrer
Pattern Settings existant
app/settings/layout.tsx - Container avec navigation
src/features/settings/SettingsRoot.tsx - Composant principal (5 onglets)
src/features/settings/SettingsNav.tsx - Navigation avec filtrage par rôles
Onglet Team : gestion CRUD avec inline add + modal edit
Changements Nécessaires
1. Base de Données
Migration SQL Obligatoire
Fichier : supabase/migrations/YYYYMMDDHHMMSS_agencies_set_active_default.sql
-- Migration: Set default is_active for existing agencies

-- 1. Ensure column exists with default
ALTER TABLE agencies
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Update existing NULL values
UPDATE agencies
SET is_active = true
WHERE is_active IS NULL;

-- 3. Make column NOT NULL
ALTER TABLE agencies
ALTER COLUMN is_active SET NOT NULL;

-- 4. Create index for performance (important pour les filtres)
CREATE INDEX IF NOT EXISTS idx_agencies_is_active
ON agencies(is_active);

-- Verify
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = true) as active,
  COUNT(*) FILTER (WHERE is_active = false) as inactive
FROM agencies;
Justification :
Empêche les NULL dans les filtres
Index améliore les performances des requêtes
Constraint NOT NULL garantit la cohérence des données
2. RLS Policies (Sécurité Supabase)
Fichier : supabase/migrations/YYYYMMDDHHMMSS_agencies_rls_policies.sql
-- Enable RLS on agencies table
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Policy: Tous les utilisateurs authentifiés peuvent lire
CREATE POLICY "Agencies are viewable by authenticated users"
ON agencies FOR SELECT
TO authenticated
USING (true);

-- Policy: Seuls admin et manager peuvent insérer
CREATE POLICY "Agencies are insertable by admins and managers"
ON agencies FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'manager')
  )
);

-- Policy: Seuls admin et manager peuvent modifier
CREATE POLICY "Agencies are modifiable by admins and managers"
ON agencies FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('admin', 'manager')
  )
);

-- Policy: Seuls admin peuvent supprimer (hard delete, normalement pas utilisé)
CREATE POLICY "Agencies are deletable by admins only"
ON agencies FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = 'admin'
  )
);
Justification : Defense in Depth - même si l'API est bypassée, RLS protège.
3. Backend - Nouvelles API Routes
A. Route principale : /app/api/settings/agencies/route.ts
GET - Récupérer toutes les agences (actives ET inactives pour l'admin)
export async function GET(req: Request) {
  // Vérifier permissions: admin OU manager
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRoles } = await supabaseAdmin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId)

  const roles = userRoles?.map(ur => ur.roles.name.toLowerCase()) || []
  const canManageAgencies = roles.includes('admin') || roles.includes('manager')

  if (!canManageAgencies) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Query param: ?include_inactive=true (default: false)
  const url = new URL(req.url)
  const includeInactive = url.searchParams.get('include_inactive') === 'true'

  let query = supabase
    .from('agencies')
    .select('id, code, label, region, is_active, created_at, updated_at')
    .order('label')

  if (!includeInactive) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ agencies: data })
}
POST - Créer une nouvelle agence
export async function POST(req: Request) {
  // Vérifier permissions: admin OU manager
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRoles } = await supabaseAdmin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId)

  const roles = userRoles?.map(ur => ur.roles.name.toLowerCase()) || []
  const canManageAgencies = roles.includes('admin') || roles.includes('manager')

  if (!canManageAgencies) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Body: { code?, label, region?, is_active: true }
  const body = await req.json()

  // Validation
  if (!body.label?.trim()) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 })
  }

  // Générer code depuis label si non fourni
  let code = body.code?.trim() ||
    body.label.trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '')
      .slice(0, 20)

  // Vérifier unicité du code et ajouter suffix si nécessaire
  let finalCode = code
  let counter = 1
  while (true) {
    const { data: existing } = await supabaseAdmin
      .from('agencies')
      .select('id')
      .eq('code', finalCode)
      .single()

    if (!existing) break
    finalCode = `${code}_${counter++}`
  }

  const newAgency = {
    code: finalCode,
    label: body.label.trim(),
    region: body.region?.trim() || null,
    is_active: true
  }

  const { data, error } = await supabaseAdmin
    .from('agencies')
    .insert([newAgency])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ agency: data })
}
PATCH - Modifier une agence (label, region, code)
export async function PATCH(req: Request) {
  // Permissions: admin OU manager
  // Body: { id, label?, region?, code? }

  const { data, error } = await supabase
    .from('agencies')
    .update(updates)
    .eq('id', agencyId)
    .select()

  return NextResponse.json({ agency: data[0] })
}
B. Route soft delete : /app/api/settings/agencies/[agencyId]/toggle-active/route.ts
POST - Basculer le statut is_active (soft delete/restore)
export async function POST(req: Request, { params }: { params: { agencyId: string } }) {
  // Vérifier permissions: admin OU manager
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userRoles } = await supabaseAdmin
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId)

  const roles = userRoles?.map(ur => ur.roles.name.toLowerCase()) || []
  const canManageAgencies = roles.includes('admin') || roles.includes('manager')

  if (!canManageAgencies) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { agencyId } = params
  const body = await req.json()
  const isActive = body.is_active

  // PROTECTION: Empêcher le masquage des agences protégées (requires_reference)
  if (!isActive) {
    const { data: agencyConfig } = await supabaseAdmin
      .from('agency_config')
      .select('requires_reference')
      .eq('agency_id', agencyId)
      .single()

    if (agencyConfig?.requires_reference) {
      return NextResponse.json({
        error: 'protected_agency',
        message: 'Cette agence est protégée car elle nécessite une référence obligatoire pour les interventions. Elle ne peut pas être masquée.'
      }, { status: 403 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('agencies')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString()
    })
    .eq('id', agencyId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ agency: data })
}
4. Frontend - Nouveau Composant Principal
A. Créer le composant : src/features/settings/AgenciesSettings.tsx
Pourquoi un composant séparé ?
SettingsRoot.tsx fait déjà 1444 lignes
Suit le pattern de TargetsSettings.tsx (573 lignes)
Meilleure maintenabilité et réutilisabilité
Structure du composant :
'use client'

import { useState, useEffect } from 'react'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Pencil, Eye, EyeOff, Check, X, Shield } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

type Agency = {
  id: string
  code: string | null
  label: string
  region: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export default function AgenciesSettings() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // État
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [protectedAgencies, setProtectedAgencies] = useState<Set<string>>(new Set())
  const [addingNew, setAddingNew] = useState(false)
  const [editAgency, setEditAgency] = useState<Agency | null>(null)

  // Form state pour ajout
  const [newLabel, setNewLabel] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newRegion, setNewRegion] = useState('')

  // Charger les agences (avec inactives pour l'admin)
  useEffect(() => {
    fetchAgencies()
    fetchProtectedAgencies()
  }, [])

  const fetchAgencies = async () => {
    const res = await fetch('/api/settings/agencies?include_inactive=true', {
      cache: 'no-store'
    })
    const data = await res.json()
    setAgencies(data?.agencies || [])
  }

  const fetchProtectedAgencies = async () => {
    const res = await fetch('/api/settings/agencies/protected', {
      cache: 'no-store'
    })
    const data = await res.json()
    setProtectedAgencies(new Set(data?.protectedIds || []))
  }

  // Mutations
  const handleAddAgency = async () => {
    if (!newLabel.trim()) {
      toast({ title: 'Erreur', description: 'Le nom est obligatoire', variant: 'destructive' })
      return
    }

    try {
      const res = await fetch('/api/settings/agencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: newLabel.trim(),
          code: newCode.trim() || null,
          region: newRegion.trim() || null
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Erreur lors de la création')
      }

      const data = await res.json()
      setAgencies([...agencies, data.agency])

      // Reset form
      setNewLabel('')
      setNewCode('')
      setNewRegion('')
      setAddingNew(false)

      // Invalider cache
      queryClient.invalidateQueries({ queryKey: ['agences'] })
      queryClient.invalidateQueries({ queryKey: ['reference-data'] })

      toast({ title: 'Succès', description: 'Agence créée avec succès' })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    }
  }

  const handleUpdateAgency = async () => {
    if (!editAgency) return

    try {
      const res = await fetch('/api/settings/agencies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editAgency.id,
          label: editAgency.label,
          code: editAgency.code,
          region: editAgency.region
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Erreur lors de la modification')
      }

      const data = await res.json()
      setAgencies(agencies.map(a => a.id === data.agency.id ? data.agency : a))
      setEditAgency(null)

      // Invalider cache
      queryClient.invalidateQueries({ queryKey: ['agences'] })
      queryClient.invalidateQueries({ queryKey: ['reference-data'] })

      toast({ title: 'Succès', description: 'Agence modifiée avec succès' })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    }
  }

  const handleToggleActive = async (agency: Agency) => {
    try {
      const res = await fetch(`/api/settings/agencies/${agency.id}/toggle-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !agency.is_active })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Erreur lors du changement de statut')
      }

      const data = await res.json()
      setAgencies(agencies.map(a => a.id === data.agency.id ? data.agency : a))

      // Invalider cache
      queryClient.invalidateQueries({ queryKey: ['agences'] })
      queryClient.invalidateQueries({ queryKey: ['reference-data'] })

      toast({
        title: 'Succès',
        description: agency.is_active ? 'Agence masquée' : 'Agence réactivée'
      })
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestion des Agences</CardTitle>
            <CardDescription>
              Configurer les agences sélectionnables dans le système
            </CardDescription>
          </div>
          <Button onClick={() => setAddingNew(true)} disabled={addingNew}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une agence
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Région</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Ligne d'ajout inline */}
            {addingNew && (
              <TableRow className="bg-muted/50">
                <TableCell>
                  <Input
                    placeholder="Nom de l'agence"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddAgency()}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Code (optionnel)"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    placeholder="Région (optionnel)"
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant="outline">Active</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" onClick={handleAddAgency} disabled={!newLabel.trim()}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddingNew(false)
                        setNewLabel('')
                        setNewCode('')
                        setNewRegion('')
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Liste des agences */}
            {agencies.map((agency) => {
              const isProtected = protectedAgencies.has(agency.id)

              return (
                <TableRow key={agency.id} className={!agency.is_active ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {agency.label}
                      {isProtected && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Protégée
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{agency.code || '—'}</TableCell>
                  <TableCell>{agency.region || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={agency.is_active ? 'default' : 'secondary'}>
                      {agency.is_active ? 'Active' : 'Masquée'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditAgency(agency)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={agency.is_active ? 'ghost' : 'outline'}
                        onClick={() => handleToggleActive(agency)}
                        disabled={isProtected && agency.is_active}
                        title={isProtected && agency.is_active ? 'Agence protégée - ne peut pas être masquée' : ''}
                      >
                        {agency.is_active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>

      {/* Modal d'édition */}
      <Dialog open={!!editAgency} onOpenChange={(open) => { if (!open) setEditAgency(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'agence</DialogTitle>
            <DialogDescription>
              Modifier les informations de l'agence
            </DialogDescription>
          </DialogHeader>
          {editAgency && (
            <div className="space-y-4">
              <div>
                <Label>Nom</Label>
                <Input
                  value={editAgency.label}
                  onChange={(e) => setEditAgency({ ...editAgency, label: e.target.value })}
                />
              </div>
              <div>
                <Label>Code</Label>
                <Input
                  value={editAgency.code || ''}
                  onChange={(e) => setEditAgency({ ...editAgency, code: e.target.value })}
                />
              </div>
              <div>
                <Label>Région</Label>
                <Input
                  value={editAgency.region || ''}
                  onChange={(e) => setEditAgency({ ...editAgency, region: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditAgency(null)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateAgency}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
B. Ajouter la page : /app/settings/agencies/page.tsx
import SettingsRoot from "@/features/settings/SettingsRoot"

export default function AgenciesPage() {
  return <SettingsRoot activeTab="agencies" />
}
C. Modifier la navigation : src/features/settings/SettingsNav.tsx
Ajouter l'onglet "Agence" dans ALL_TABS entre "team" et "targets":
const ALL_TABS = [
  { key: "profile", label: "Profile", requiresRole: null },
  { key: "interface", label: "Interface", requiresRole: null },
  { key: "team", label: "Team", requiresRole: "admin" },
  { key: "agencies", label: "Agence", requiresRole: ["admin", "manager"] }, // NOUVEAU
  { key: "targets", label: "Perf", requiresRole: ["admin", "manager"] },
  { key: "security", label: "Security", requiresRole: null },
]
D. Intégrer dans le composant principal : src/features/settings/SettingsRoot.tsx
Changements minimaux requis :
Ajouter le type :
type SettingsTab = "profile" | "interface" | "team" | "agencies" | "targets" | "security"
Ajouter l'import :
import AgenciesSettings from './AgenciesSettings'
Ajouter le TabsContent :
{canManageAgencies && (
  <TabsContent value="agencies" className="space-y-6">
    <AgenciesSettings />
  </TabsContent>
)}
Calculer la permission :
const canManageAgencies = currentUserRoles.some(role =>
  ['admin', 'manager'].includes(role.toLowerCase())
)
5. API Helper pour Agences Protégées
Nouvelle route : /app/api/settings/agencies/protected/route.ts
export async function GET(req: Request) {
  const { data, error } = await supabaseAdmin
    .from('agency_config')
    .select('agency_id')
    .eq('requires_reference', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const protectedIds = data?.map(ac => ac.agency_id) || []
  return NextResponse.json({ protectedIds })
}
6. Mise à Jour des APIs Existantes
A. Modifier src/lib/reference-api.ts
Actuel :
async getAgencies() {
  const { data, error } = await supabase
    .from('agencies')
    .select('id, code, label')
    .order('label');
  return data || [];
}
Nouveau (filtrer les agences inactives) :
async getAgencies() {
  const { data, error } = await supabase
    .from('agencies')
    .select('id, code, label')
    .eq('is_active', true)  // NOUVEAU - filtrer uniquement les actives
    .order('label');
  return data || [];
}
B. Vérifier les composants de sélection
Fichiers concernés :
src/components/interventions/LegacyInterventionForm.tsx
src/components/interventions/InterventionEditForm.tsx
src/components/admin-dashboard/FilterBar.tsx
Action : Ces composants utilisent déjà useReferenceData() ou referenceApi.getAgencies(), donc ils afficheront automatiquement uniquement les agences actives après la modification de l'API.
7. Invalidation du Cache
A. Invalidation dans SettingsRoot.tsx
Après chaque mutation (add/update/toggle), invalider le cache React Query pour forcer le refresh des selects :
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

// Après succès de la mutation
queryClient.invalidateQueries({ queryKey: ['agences'] })
queryClient.invalidateQueries({ queryKey: ['reference-data'] })
8. Permissions et Sécurité
A. Vérifications côté serveur
Chaque route API doit vérifier que l'utilisateur est Admin OU Manager :
// /app/api/settings/agencies/route.ts
import { getServerSession } from 'next-auth/next'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  // Récupérer les rôles de l'utilisateur
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role:roles(name)')
    .eq('user_id', userId)

  const roles = userRoles?.map(ur => ur.role.name.toLowerCase()) || []
  const canManageAgencies = roles.includes('admin') || roles.includes('manager')

  if (!canManageAgencies) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ... suite de la logique
}
B. Vérifications côté client
Réutiliser le pattern existant dans SettingsNav :
const { hasAnyRole } = useUserRoles()
const canManageAgencies = hasAnyRole(['admin', 'manager'])

// Dans le rendu
{canManageAgencies && (
  <TabsTrigger value="agencies">
    <Building className="h-4 w-4" />
    Agence
  </TabsTrigger>
)}
Récapitulatif des Fichiers à Modifier/Créer
Migrations SQL
✅ supabase/migrations/YYYYMMDDHHMMSS_agencies_set_active_default.sql - Garantir is_active NOT NULL + index
✅ supabase/migrations/YYYYMMDDHHMMSS_agencies_rls_policies.sql - Policies RLS
Nouveaux fichiers Backend
✅ /app/api/settings/agencies/route.ts - API GET/POST/PATCH
✅ /app/api/settings/agencies/[agencyId]/toggle-active/route.ts - API toggle
✅ /app/api/settings/agencies/protected/route.ts - API helper pour agences protégées
Nouveaux fichiers Frontend
✅ src/features/settings/AgenciesSettings.tsx - Composant principal (comme TargetsSettings)
✅ /app/settings/agencies/page.tsx - Page route
Fichiers à modifier
✅ src/features/settings/SettingsNav.tsx - Ajouter onglet "Agence" (1 ligne)
✅ src/features/settings/SettingsRoot.tsx - Ajouter TabsContent + import (10 lignes)
✅ src/lib/reference-api.ts - Filtrer is_active=true dans getAgencies() (1 ligne)
Fichiers impactés (auto-update via cache)
src/components/interventions/LegacyInterventionForm.tsx
src/components/interventions/InterventionEditForm.tsx
src/components/admin-dashboard/FilterBar.tsx
Décisions Architecturales Validées
1. Composant séparé vs intégré dans SettingsRoot
✅ DÉCISION : Composant séparé (AgenciesSettings.tsx)
Suit le pattern de TargetsSettings (573 lignes)
Évite de surcharger SettingsRoot (déjà 1444 lignes)
Meilleure maintenabilité et réutilisabilité
2. Validation du code unique
✅ DÉCISION : Auto-génération avec suffix si collision
Génération depuis label si non fourni
Vérification d'unicité côté backend
Ajout de suffix _1, _2, etc. en cas de doublon
3. Agences protégées (ImoDirect, AFEDIM, Oqoro)
✅ DÉCISION : Bloquer le masquage avec message d'erreur
Vérification via agency_config.requires_reference
Erreur 403 avec message explicatif
Badge "Protégée" dans l'UI
Bouton "Masquer" disabled avec tooltip
4. Invalidation du cache
✅ DÉCISION : Hybrid - Optimistic UI + Rollback
Optimistic update pour UX fluide
Rollback automatique en cas d'erreur
Invalidation de ['agences'] et ['reference-data']
Toast de confirmation/erreur
5. Sécurité
✅ DÉCISION : Defense in Depth (RLS + API checks)
RLS Supabase (première ligne de défense)
Vérifications de rôles dans chaque route API
Pattern existant utilisé dans Team API
6. Migration SQL
✅ DÉCISION : Migration obligatoire
Garantir is_active NOT NULL avec default true
Créer index sur is_active pour performance
Vérification après migration
Points de Test Critiques
Tests Fonctionnels
TC-1 : Permissions
✅ Admin voit l'onglet Agence
✅ Manager voit l'onglet Agence
✅ Gestionnaire ne voit PAS l'onglet Agence
✅ URL directe /settings/agencies vérifie permissions
TC-2 : CRUD Basique
✅ Créer agence avec label + code
✅ Créer agence avec label uniquement (code auto-généré)
✅ Créer agence avec code en doublon → erreur
✅ Modifier label d'une agence existante
✅ Modifier code → validation unicité
✅ Masquer agence standard → succès
✅ Réactiver agence masquée → succès
TC-3 : Agences Protégées
✅ Masquer ImoDirect → erreur 403
✅ Masquer AFEDIM → erreur 403
✅ Masquer Oqoro → erreur 403
✅ Bouton "Masquer" disabled pour agences protégées
✅ Badge "Protégée" visible dans l'UI
TC-4 : Cache & Synchronisation
✅ Créer agence → apparaît sans refresh
✅ Modifier agence → changement immédiat
✅ Masquer agence → disparaît des dropdowns
✅ Ouvrir onglet Team puis revenir → données à jour
TC-5 : Edge Cases
✅ Label avec caractères spéciaux (é, ñ, ü)
✅ Code avec espaces → auto-trim
✅ Label vide → erreur
✅ Créer 2 agences simultanément avec même code → une échoue
Tests Techniques
Performance
✅ Chargement initial < 500ms (50 agences)
✅ Optimistic update < 50ms
✅ Index is_active utilisé (EXPLAIN ANALYZE)
Sécurité
✅ Token JWT invalide → 401
✅ Gestionnaire tente POST → 403
✅ Manager tente masquer agence protégée → 403
✅ SQL injection dans label → échappé
Intégration
✅ Agence masquée n'apparaît pas dans création intervention
✅ Intervention existante avec agence masquée affiche le label
✅ Filtres interventions montrent agences masquées avec badge
Ordre d'Implémentation Recommandé
PHASE 1 : Fondations (Backend + DB) 🔴 Critique
✅ Migration SQL is_active (avec index et NOT NULL)
✅ Migration RLS policies
✅ Créer /app/api/settings/agencies/route.ts (GET/POST/PATCH)
✅ Créer /app/api/settings/agencies/[agencyId]/toggle-active/route.ts
✅ Créer /app/api/settings/agencies/protected/route.ts
✅ Tests manuels des routes API (Postman/Insomnia)
PHASE 2 : Frontend Core 🟡 Important 7. ✅ Créer src/features/settings/AgenciesSettings.tsx (composant complet) 8. ✅ Créer app/settings/agencies/page.tsx (wrapper) 9. ✅ Modifier SettingsNav.tsx (ajouter onglet) 10. ✅ Modifier SettingsRoot.tsx (ajouter TabsContent + import) PHASE 3 : Filtrage & Cache 🟢 Essentiel 11. ✅ Modifier src/lib/reference-api.ts pour filtrer is_active 12. ✅ Tester invalidation cache après mutations 13. ✅ Vérifier impact sur sélecteurs existants (LegacyInterventionForm, FilterBar) PHASE 4 : Tests & Validation ⚪ Final 14. ✅ Tester permissions (Admin, Manager, Gestionnaire) 15. ✅ Tester CRUD complet 16. ✅ Tester agences protégées (ImoDirect, AFEDIM, Oqoro) 17. ✅ Vérifier cache et synchronisation 18. ✅ Tests edge cases (caractères spéciaux, doublons, etc.)
Risques Identifiés et Mitigations
RISQUE 1 : Impact sur les interventions existantes
Problème : Les interventions avec agences masquées doivent toujours afficher le label. Mitigation :
Modifier getAgencyLabel dans useReferenceData.ts pour fetch les agences inactives si nécessaire
Dans les filtres, utiliser ?include_inactive=true pour l'historique
RISQUE 2 : Concurrence dans les updates
Problème : Deux managers modifient la même agence simultanément. Mitigation :
Implémenter optimistic locking avec champ version (optionnel)
Alternative : Last-write-wins avec toast d'avertissement
RISQUE 3 : Import/Export de données
Problème : Scripts d'import pourraient réactiver des agences masquées. Mitigation :
Modifier script d'import pour préserver is_active existant
Documenter le comportement dans le README
Améliorations Futures (Optionnelles)
Compteur d'utilisation
Afficher le nombre d'interventions par agence
Empêcher le masquage si interventions actives
Historique des modifications
Ajouter une colonne updated_by dans agencies
Logger les changements (qui a masqué/réactivé)
Import/Export
Bouton pour importer des agences via CSV
Export de la liste pour backup
Agences par défaut
Permettre de définir une agence par défaut par utilisateur
Fichiers Critiques de Référence
Pour comprendre les patterns :
src/features/settings/TargetsSettings.tsx - Architecture du composant séparé
src/features/settings/SettingsRoot.tsx - Intégration dans Settings
app/api/settings/team/user/route.ts - Pattern API CRUD avec validation
src/lib/reference-api.ts - Cache et filtrage
src/hooks/useReferenceData.ts - Hook de données de référence
Conclusion
Ce plan implémente une gestion complète des agences avec soft delete (via is_active), en suivant exactement les patterns existants du système Settings. Points clés :
✅ Composant séparé pour meilleure maintenabilité
✅ Defense in Depth (RLS + API checks)
✅ Protection des agences critiques (ImoDirect, AFEDIM, Oqoro)
✅ Optimistic UI avec rollback automatique
✅ Invalidation cache complète
✅ Migration SQL pour garantir l'intégrité
L'intégration est minimale (10 lignes dans SettingsRoot, 1 ligne dans SettingsNav, 1 ligne dans reference-api), tout en garantissant la cohérence avec les composants de sélection existants.