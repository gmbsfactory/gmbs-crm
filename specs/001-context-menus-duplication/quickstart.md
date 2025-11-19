# Quick Start: Menus contextuels et duplication "Devis supp"

**Date**: 2025-01-16  
**Phase**: Phase 1 - Design & Contracts  
**Status**: ✅ Complete

## Vue d'ensemble

Ce guide fournit un démarrage rapide pour l'implémentation des menus contextuels et de la duplication "Devis supp". Il couvre les étapes principales, les fichiers à créer/modifier, et les patterns à suivre.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Composants UI                           │
│  (InterventionTable, InterventionCard, ArtisanTable)        │
│                    + ContextMenu                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Hooks Personnalisés                            │
│  useInterventionContextMenu                                 │
│  useArtisanContextMenu                                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              APIs v2 + Fonctions                            │
│  interventionsApiV2, commentsApi, transitionStatus          │
│  duplicateIntervention (nouveau)                            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              Supabase PostgreSQL                            │
│  tables: interventions, comments, artisans                  │
└─────────────────────────────────────────────────────────────┘
```

## Étapes d'Implémentation

### Phase 1: Créer les fonctions API

#### 1.1 Fonction de duplication d'intervention

**Fichier**: `src/lib/api/interventions.ts`

```typescript
/**
 * Duplique une intervention pour créer un "Devis supp"
 * @param id ID de l'intervention à dupliquer
 * @returns Nouvelle intervention créée avec commentaire système
 */
export async function duplicateIntervention(id: string): Promise<{
  intervention: InterventionWithDocuments;
  comment: Comment;
}> {
  // 1. Récupérer l'intervention originale
  const original = await getIntervention({ id });
  
  // 2. Créer le payload de duplication (exclure contexte et consignes)
  const duplicatePayload: CreateInterventionInput = {
    // Copier tous les champs sauf id, contexte_intervention, consigne_intervention
    id_inter: original.id_inter,
    statut_id: original.statut_id ?? "DEMANDE", // Statut par défaut si null
    assigned_user_id: original.assigned_user_id,
    // ... autres champs
    contexte_intervention: null, // FORCÉ à null
    consigne_intervention: null,  // FORCÉ à null
  };
  
  // 3. Créer la nouvelle intervention
  const { intervention } = await createIntervention(duplicatePayload);
  
  // 4. Créer le commentaire système
  const currentUser = await getCurrentUser(); // À implémenter
  const comment = await commentsApi.create({
    entity_type: 'intervention',
    entity_id: intervention.id,
    content: `devis supp avec l'ancien ID ${original.id}`,
    comment_type: 'system',
    author_id: currentUser.id,
    is_internal: true,
  });
  
  return { intervention, comment };
}
```

#### 1.2 Endpoint API pour la duplication

**Fichier**: `app/api/interventions/[id]/duplicate/route.ts`

```typescript
import { duplicateIntervention } from '@/lib/api/interventions';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await duplicateIntervention(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message },
      { status: 400 }
    );
  }
}
```

#### 1.3 Endpoint API pour l'assignation "Je gère"

**Fichier**: `app/api/interventions/[id]/assign/route.ts`

```typescript
import { createServerSupabase } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ message: 'Non authentifié' }, { status: 401 });
    }
    
    const { data, error } = await supabase
      .from('interventions')
      .update({ assigned_user_id: user.id })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: (error as Error).message },
      { status: 400 }
    );
  }
}
```

### Phase 2: Créer les hooks React Query

#### 2.1 Hook pour les menus contextuels d'interventions

**Fichier**: `src/hooks/useInterventionContextMenu.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useInterventionModal } from '@/hooks/useInterventionModal';
import { transitionStatus } from '@/lib/api/interventions';

export function useInterventionContextMenu(
  intervention: Intervention,
  viewType?: 'market' | 'list' | 'card'
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const interventionModal = useInterventionModal();
  
  // Mutation pour transition de statut
  const transitionMutation = useMutation({
    mutationFn: async (newStatus: 'DEVIS_ENVOYE' | 'ACCEPTE') => {
      return transitionStatus(intervention.id, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast({ title: 'Statut mis à jour' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erreur', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
  
  // Mutation pour duplication
  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/interventions/${intervention.id}/duplicate`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Échec de la duplication');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      interventionModal.open(data.intervention.id);
      toast({ title: 'Devis supp créé' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erreur', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
  
  // Mutation pour assignation "Je gère"
  const assignMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/interventions/${intervention.id}/assign`, {
        method: 'PATCH',
      });
      if (!response.ok) throw new Error('Échec de l\'assignation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interventions'] });
      toast({ title: 'Intervention assignée' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erreur', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
  
  // Déterminer les actions disponibles
  const canTransitionToDevisEnvoye = 
    intervention.status?.value === 'DEMANDE' && 
    Boolean(intervention.id_inter);
  
  const canTransitionToAccepte = 
    intervention.status?.value === 'DEVIS_ENVOYE';
  
  const canAssignToMe = viewType === 'market';
  
  return {
    // Actions
    open: () => interventionModal.open(intervention.id),
    openInNewTab: () => window.open(`/interventions/${intervention.id}`, '_blank'),
    transitionToDevisEnvoye: canTransitionToDevisEnvoye 
      ? () => transitionMutation.mutate('DEVIS_ENVOYE')
      : undefined,
    transitionToAccepte: canTransitionToAccepte
      ? () => transitionMutation.mutate('ACCEPTE')
      : undefined,
    duplicateDevisSupp: () => duplicateMutation.mutate(),
    assignToMe: canAssignToMe
      ? () => assignMutation.mutate()
      : undefined,
    // États de chargement
    isTransitioning: transitionMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
    isAssigning: assignMutation.isPending,
  };
}
```

#### 2.2 Hook pour les menus contextuels d'artisans

**Fichier**: `src/hooks/useArtisanContextMenu.ts`

```typescript
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useArtisanModal } from '@/hooks/useArtisanModal';
import { StatusReasonModal } from '@/components/shared/StatusReasonModal';

export function useArtisanContextMenu(artisan: Artisan) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const artisanModal = useArtisanModal();
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  
  // Mutation pour archivage
  const archiveMutation = useMutation({
    mutationFn: async (reason: string) => {
      // Appel API d'archivage (à implémenter)
      const response = await fetch(`/api/artisans/${artisan.id}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Échec de l\'archivage');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['artisans'] });
      setShowArchiveModal(false);
      toast({ title: 'Artisan archivé' });
    },
    onError: (error) => {
      toast({ 
        title: 'Erreur', 
        description: error.message,
        variant: 'destructive' 
      });
    },
  });
  
  return {
    // Actions
    open: () => artisanModal.open(artisan.id),
    edit: () => artisanModal.open(artisan.id, { mode: 'edit' }),
    archive: () => setShowArchiveModal(true),
    // Composants modaux
    ArchiveModal: (
      <StatusReasonModal
        open={showArchiveModal}
        type="archive"
        onConfirm={(reason) => archiveMutation.mutate(reason)}
        onCancel={() => setShowArchiveModal(false)}
        isSubmitting={archiveMutation.isPending}
      />
    ),
    // États
    isArchiving: archiveMutation.isPending,
  };
}
```

### Phase 3: Intégrer les menus contextuels dans les composants

#### 3.1 Menu contextuel pour InterventionTable

**Fichier**: `src/components/interventions/InterventionTable.tsx`

```typescript
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useInterventionContextMenu } from '@/hooks/useInterventionContextMenu';

export default function InterventionTable({ interventions, onRowClick }: Props) {
  return (
    <Table>
      <TableBody>
        {interventions.map((intervention) => (
          <ContextMenu key={intervention.id}>
            <ContextMenuTrigger asChild>
              <TableRow
                onClick={() => onRowClick?.(intervention)}
              >
                {/* ... cellules ... */}
              </TableRow>
            </ContextMenuTrigger>
            <InterventionContextMenuContent 
              intervention={intervention} 
            />
          </ContextMenu>
        ))}
      </TableBody>
    </Table>
  );
}

function InterventionContextMenuContent({ 
  intervention,
  viewType 
}: { 
  intervention: Intervention;
  viewType?: 'market' | 'list' | 'card';
}) {
  const menu = useInterventionContextMenu(intervention, viewType);
  
  return (
    <ContextMenuContent>
      <ContextMenuItem onSelect={menu.open}>
        <FileText className="mr-2 h-4 w-4" />
        Ouvrir
      </ContextMenuItem>
      <ContextMenuItem onSelect={menu.openInNewTab}>
        <ExternalLink className="mr-2 h-4 w-4" />
        Ouvrir dans un nouvel onglet
      </ContextMenuItem>
      
      {menu.canTransitionToDevisEnvoye && (
        <ContextMenuItem 
          onSelect={menu.transitionToDevisEnvoye}
          disabled={menu.isTransitioning}
        >
          <ArrowRight className="mr-2 h-4 w-4" />
          Passer à Devis envoyé
        </ContextMenuItem>
      )}
      
      {menu.canTransitionToAccepte && (
        <ContextMenuItem 
          onSelect={menu.transitionToAccepte}
          disabled={menu.isTransitioning}
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Passer à Accepté
        </ContextMenuItem>
      )}
      
      <ContextMenuSeparator />
      
      <ContextMenuItem 
        onSelect={menu.duplicateDevisSupp}
        disabled={menu.isDuplicating}
      >
        <Copy className="mr-2 h-4 w-4" />
        Devis supp
      </ContextMenuItem>
      
      {menu.canAssignToMe && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem 
            onSelect={menu.assignToMe}
            disabled={menu.isAssigning}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Je gère
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
```

#### 3.2 Menu contextuel pour ArtisanTable

**Fichier**: `src/components/artisans/ArtisanTable.tsx`

```typescript
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useArtisanContextMenu } from '@/hooks/useArtisanContextMenu';

export default function ArtisanTable({ artisans }: Props) {
  return (
    <Table>
      <TableBody>
        {artisans.map((artisan) => (
          <ArtisanTableRow key={artisan.id} artisan={artisan} />
        ))}
      </TableBody>
    </Table>
  );
}

function ArtisanTableRow({ artisan }: { artisan: Artisan }) {
  const menu = useArtisanContextMenu(artisan);
  
  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <TableRow>
            {/* ... cellules ... */}
          </TableRow>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={menu.open}>
            <FileText className="mr-2 h-4 w-4" />
            Ouvrir fiche artisan
          </ContextMenuItem>
          <ContextMenuItem onSelect={menu.edit}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifier fiche artisan
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem 
            onSelect={menu.archive}
            disabled={menu.isArchiving}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archiver
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {menu.ArchiveModal}
    </>
  );
}
```

## Checklist d'Implémentation

### Backend (APIs)

- [ ] Créer `duplicateIntervention` dans `src/lib/api/interventions.ts`
- [ ] Créer endpoint `/api/interventions/[id]/duplicate/route.ts`
- [ ] Créer endpoint `/api/interventions/[id]/assign/route.ts`
- [ ] Vérifier/créer endpoint `/api/artisans/[id]/archive/route.ts`

### Frontend (Hooks)

- [ ] Créer `useInterventionContextMenu.ts`
- [ ] Créer `useArtisanContextMenu.ts`
- [ ] Créer types dans `src/types/context-menu.ts`

### Frontend (Composants)

- [ ] Intégrer menu contextuel dans `InterventionTable.tsx`
- [ ] Intégrer menu contextuel dans `InterventionCard.tsx`
- [ ] Intégrer menu contextuel dans `TableView.tsx`
- [ ] Intégrer menu contextuel dans `MarketView.tsx`
- [ ] Intégrer menu contextuel dans `ArtisanTable.tsx`

### Tests

- [ ] Tests unitaires pour `duplicateIntervention`
- [ ] Tests unitaires pour les hooks
- [ ] Tests d'intégration pour les endpoints API
- [ ] Tests E2E pour les menus contextuels

## Patterns à Suivre

1. **Imports**: Toujours utiliser l'alias `@/` (jamais d'imports relatifs)
2. **Types**: Réutiliser les types existants de `src/lib/api/v2/common/types.ts`
3. **Erreurs**: Utiliser `useToast` pour afficher les erreurs
4. **Queries**: Invalider les queries React Query après chaque mutation
5. **Performance**: Utiliser les mutations optimistes quand approprié

## Références

- **Composant ContextMenu**: `src/components/ui/context-menu.tsx`
- **API Interventions**: `src/lib/api/interventions.ts`
- **API Comments**: `src/lib/api/v2/commentsApi.ts`
- **StatusReasonModal**: `src/components/shared/StatusReasonModal.tsx`
- **Exemple d'utilisation**: `src/components/interventions/views/ViewTabs.tsx`

## Prochaines Étapes

1. Implémenter les fonctions API (Phase 1)
2. Créer les hooks React Query (Phase 2)
3. Intégrer les menus contextuels dans les composants (Phase 3)
4. Tester et valider (Phase 4)
5. Documenter et déployer (Phase 5)

**Status**: ✅ **READY FOR IMPLEMENTATION** - Guide complet, tous les patterns documentés




