# 🎯 Prompt pour Codex - COM-001 : Gestion complète des commentaires

**Sous-tâche de ARC-001** | **Pré-requis pour l'archivage**

---

## 📋 Contexte

La fonctionnalité d'archivage (ARC-001) nécessite un système de commentaires fonctionnel. Actuellement :
- ✅ Table `comments` existe en BDD
- ✅ Edge Function `/comments` existe
- ✅ Interfaces TypeScript définies
- ❌ **Mais l'UI ne fonctionne pas** dans les fiches artisans et interventions

Cette tâche doit implémenter la **gestion complète des commentaires** dans les deux pages.

---

## 🎯 Objectif

Rendre fonctionnelle la section "Commentaires" dans **2 contextes** (artisans et interventions), répartis sur **4 endroits** :

### Contexte 1 : Artisans (1 endroit)
1. **Fiche Artisan** (`src/components/ui/artisan-modal/ArtisanModalContent.tsx`)

### Contexte 2 : Interventions (3 endroits - mêmes données)
2. **Modal Édition** (`src/components/interventions/InterventionEditForm.tsx`)
3. **Vue étendue** (`src/components/interventions/views/TableView.tsx` - `ExpandedRowContent` en colonne 3)
4. **Modal Création** (`src/components/interventions/LegacyInterventionForm.tsx`)

**Note** : Les 3 endroits "Interventions" affichent **exactement les mêmes données** (même `entity_type='intervention'` + même `entity_id`). C'est juste une copie conforme dans 3 emplacements UI différents.

**Approche** :
- S'inspirer de la logique du projet legacy (/Users/andrebertea/Desktop/abWebCraft/Mission/GMBS/code/crm-gmbs)
- **UI simple** : Avatar + Commentaire + Date/heure (petit, grisé, italique)
- **Utiliser la table `comments` existante** qui fait la distinction via :
  - `entity_type` : `'artisan'` ou `'intervention'`
  - `entity_id` : UUID de l'artisan ou de l'intervention
- **2 logiques** : une pour artisans, une pour interventions (réutilisée dans 3 endroits)
- Assurer la traçabilité (auteur, date, historique)

---

## 📊 Structure BDD existante

### Table `comments` (polyvalente)

La table `comments` est **unique et partagée** entre toutes les entités.

**Types supportés en BDD** :
- `'artisan'` ✅ (à implémenter dans COM-001)
- `'intervention'` ✅ (à implémenter dans COM-001)
- `'task'` ⏸️ (extension future)
- `'client'` ⏸️ (extension future)

**Logique de distinction** :
- `entity_type` : Type d'entité
- `entity_id` : UUID de l'entité concernée

**Exemples pour COM-001** :
- Commentaire sur un artisan : `entity_type = 'artisan'` + `entity_id = artisan.id`
- Commentaire sur une intervention : `entity_type = 'intervention'` + `entity_id = intervention.id`

```sql
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type text NOT NULL CHECK (entity_type IN ('artisan','intervention','task','client')),
  entity_id uuid NOT NULL,
  author_id uuid REFERENCES public.users(id),
  content text NOT NULL,
  comment_type text CHECK (comment_type IN ('internal','external','system')),
  is_internal boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Index pour performance** :
```sql
CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
```

### Interfaces TypeScript existantes

```typescript
// src/lib/api/v2/common/types.ts
export interface Comment {
  id: string;
  entity_id: string;
  entity_type: "intervention" | "artisan" | "client";
  content: string;
  comment_type: string;
  is_internal: boolean | null;
  author_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  users?: {
    id: string;
    firstname: string | null;
    lastname: string | null;
    username: string;
  };
}
```

---

## 🔧 Implémentation

### Étape 1 : Créer l'API Client pour les commentaires

**Fichier** : `src/lib/api/v2/commentsApi.ts` (existe déjà, vérifier et améliorer si nécessaire)

**⚠️ Important** : Pour COM-001, utiliser uniquement :
- `'artisan'` pour les commentaires d'artisans
- `'intervention'` pour les commentaires d'interventions

(La table supporte aussi `'task'` et `'client'`, mais ce sont des extensions futures non implémentées)

```typescript
import { Comment, CreateCommentData } from './common/types';

const COMMENTS_API_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/comments`;

export const commentsApi = {
  // Récupérer les commentaires d'une entité (artisan OU intervention)
  async getByEntity(entityType: 'artisan' | 'intervention', entityId: string): Promise<Comment[]> {
    const response = await fetch(
      `${COMMENTS_API_URL}/comments?entity_type=${entityType}&entity_id=${entityId}`,
      {
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch comments');
    }
    
    return response.json();
  },

  // Créer un commentaire
  async create(data: CreateCommentData): Promise<Comment> {
    const response = await fetch(`${COMMENTS_API_URL}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Failed to create comment');
    }
    
    return response.json();
  },

  // Supprimer un commentaire (optionnel)
  async delete(commentId: string): Promise<void> {
    const response = await fetch(`${COMMENTS_API_URL}/comments/${commentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete comment');
    }
  },
};
```

---

### Étape 2 : Créer un composant réutilisable `CommentSection`

**Nouveau fichier** : `src/components/shared/CommentSection.tsx`

```tsx
"use client"

import React, { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { commentsApi } from "@/lib/api/v2/commentsApi"
import type { Comment } from "@/lib/api/v2/common/types"

interface CommentSectionProps {
  entityType: "artisan" | "intervention"  // Type d'entité (correspond à comments.entity_type)
  entityId: string                         // UUID de l'artisan ou intervention (correspond à comments.entity_id)
  currentUserId?: string                   // ID de l'utilisateur connecté
}

const formatDate = (value: string | null | undefined, withTime = false) => {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  try {
    return new Intl.DateTimeFormat("fr-FR", 
      withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }
    ).format(date)
  } catch {
    return value
  }
}

export function CommentSection({ entityType, entityId, currentUserId }: CommentSectionProps) {
  const [newComment, setNewComment] = useState("")
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Récupérer les commentaires
  const { data: comments, isLoading } = useQuery<Comment[]>({
    queryKey: ["comments", entityType, entityId],
    queryFn: () => commentsApi.getByEntity(entityType, entityId),
    enabled: Boolean(entityId),
  })

  // Mutation pour créer un commentaire
  const createComment = useMutation({
    mutationFn: (content: string) => 
      commentsApi.create({
        entity_id: entityId,
        entity_type: entityType,
        content,
        comment_type: "internal",
        is_internal: true,
        author_id: currentUserId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", entityType, entityId] })
      setNewComment("")
      toast({
        title: "Commentaire ajouté",
        description: "Votre commentaire a été enregistré avec succès.",
      })
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'ajouter le commentaire",
        variant: "destructive",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    createComment.mutate(newComment)
  }

  return (
    <div className="space-y-4">
      {/* Historique des commentaires */}
      {isLoading ? (
        <div className="space-y-3">
          <div className="h-20 rounded bg-muted animate-pulse" />
          <div className="h-20 rounded bg-muted animate-pulse" />
        </div>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((comment) => {
            const author = comment.users
              ? [comment.users.firstname, comment.users.lastname].filter(Boolean).join(" ") || comment.users.username
              : "Utilisateur"
            
            // Initiales pour l'avatar (ex: "Jean Dupont" → "JD")
            const initials = author
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)

            return (
              <div key={comment.id} className="flex gap-3">
                {/* Avatar (bulle) */}
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    {initials}
                  </div>
                </div>
                
                {/* Contenu */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-sm">{author}</span>
                    <span className="text-xs text-muted-foreground italic">
                      {formatDate(comment.created_at, true)}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {comment.content}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucun commentaire pour le moment.
        </p>
      )}

      {/* Formulaire d'ajout */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <Label htmlFor="new-comment">Ajouter un commentaire</Label>
        <Textarea
          id="new-comment"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={4}
          placeholder="Écrivez votre commentaire ici..."
          disabled={createComment.isPending}
        />
        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={!newComment.trim() || createComment.isPending}
            size="sm"
          >
            {createComment.isPending ? "Envoi..." : "Envoyer"}
          </Button>
        </div>
      </form>
    </div>
  )
}
```

---

### Étape 3 : Intégrer dans `ArtisanModalContent`

**Fichier** : `src/components/ui/artisan-modal/ArtisanModalContent.tsx`

**Remplacer** la section Commentaires (lignes 692-727) par :

```tsx
import { CommentSection } from "@/components/shared/CommentSection"

// Dans le renderContent(), remplacer la Card "Commentaires" :

<Card>
  <CardHeader>
    <CardTitle>Commentaires</CardTitle>
  </CardHeader>
  <CardContent>
    <CommentSection 
      entityType="artisan" 
      entityId={artisanId}
      currentUserId={currentUser?.id}
    />
  </CardContent>
</Card>
```

**Note** : Supprimer l'ancien code qui utilisait `commentHistoryList` et le champ `commentaire` lié à `suivi_relances_docs`.

---

### Étape 4 : Intégrer dans `InterventionEditForm`

**Fichier** : `src/components/interventions/InterventionEditForm.tsx`

Ajouter une nouvelle section (après Documents) :

```tsx
import { CommentSection } from "@/components/shared/CommentSection"

// Ajouter un nouvel état Collapsible pour les commentaires
const [isCommentsOpen, setIsCommentsOpen] = useState(false)

// Dans le JSX, après la section Documents :

<Collapsible open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
  <Card>
    <CollapsibleTrigger asChild>
      <CardHeader className="cursor-pointer pb-3 hover:bg-muted/50">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquare className="h-4 w-4" />
          Commentaires
          <ChevronDown className={cn(
            "ml-auto h-4 w-4 transition-transform",
            isCommentsOpen && "rotate-180"
          )} />
        </CardTitle>
      </CardHeader>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <CardContent className="pt-0">
        <CommentSection 
          entityType="intervention" 
          entityId={intervention.id}
          currentUserId={currentUser?.id}
        />
      </CardContent>
    </CollapsibleContent>
  </Card>
</Collapsible>
```

---

### Étape 5 : Vérifier l'Edge Function

**Fichier** : `supabase/functions/comments/index.ts`

S'assurer que l'Edge Function répond correctement aux requêtes :

**Endpoints à vérifier** :
- `GET /comments?entity_type=artisan&entity_id={uuid}` → Liste des commentaires
- `POST /comments` → Créer un commentaire
- `DELETE /comments/{id}` → Supprimer un commentaire (optionnel)

**Ajout important** : L'Edge Function doit joindre les informations utilisateur :

```sql
SELECT 
  c.id,
  c.entity_id,
  c.entity_type,
  c.content,
  c.comment_type,
  c.is_internal,
  c.author_id,
  c.created_at,
  c.updated_at,
  json_build_object(
    'id', u.id,
    'firstname', u.firstname,
    'lastname', u.lastname,
    'username', u.username
  ) as users
FROM comments c
LEFT JOIN users u ON u.id = c.author_id
WHERE c.entity_type = $1 AND c.entity_id = $2
ORDER BY c.created_at DESC;
```

---

## 📝 Checklist d'implémentation

### Backend
- [ ] Vérifier Edge Function `/comments` (GET, POST, DELETE)
- [ ] S'assurer que les commentaires incluent les infos utilisateur (JOIN)
- [ ] Tester les endpoints avec Postman ou `curl`

### Frontend - Composant partagé
- [ ] Créer `src/components/shared/CommentSection.tsx` avec UI simple :
  - [ ] Avatar (bulle avec initiales) + Date/heure (petit, grisé, italique)
  - [ ] Commentaire (texte simple)
- [ ] Implémenter `commentsApi` dans `src/lib/api/v2/commentsApi.ts`
- [ ] Gérer les états de chargement et erreurs
- [ ] Formulaire d'ajout avec validation

### Frontend - Artisans (1 endroit)
- [ ] Intégrer `CommentSection` dans `ArtisanModalContent.tsx`
- [ ] Supprimer l'ancien code `suivi_relances_docs`
- [ ] Utiliser `entityType="artisan"` + `entityId={artisan.id}`

### Frontend - Interventions (3 endroits - même logique)
- [ ] **Modal Édition** : Intégrer dans `InterventionEditForm.tsx`
- [ ] **Vue étendue** : Intégrer dans `TableView.tsx` (`ExpandedRowContent`, colonne 3)
- [ ] **Modal Création** : Intégrer dans `LegacyInterventionForm.tsx` (optionnel)
- [ ] Utiliser `entityType="intervention"` + `entityId={intervention.id}` (même données pour les 3)

### Tests
- [ ] Test manuel : Ajouter commentaire sur un artisan → Visible immédiatement
- [ ] Test manuel : Ajouter commentaire sur une intervention (modal édition) → Visible immédiatement
- [ ] Test manuel : Vérifier que vue étendue + modal création affichent les **mêmes données**
- [ ] Test manuel : Vérifier auteur + date/heure (petit, grisé, italique)
- [ ] Test manuel : Recharger la page → Commentaires persistent

---

## 🎯 Résultat attendu

### 1. Artisan (1 endroit)
1. Ouvrir une fiche artisan
2. Section "Commentaires" affiche l'historique avec :
   - Avatar (bulle avec initiales)
   - Nom de l'auteur
   - Commentaire
   - Date + heure (petit, grisé, italique)
3. Ajouter un commentaire → Envoyé avec succès
4. Commentaire apparaît immédiatement dans l'historique

### 2. Interventions (3 endroits - mêmes données)

**Modal Édition** :
1. Ouvrir une fiche intervention en édition
2. Section "Commentaires" (collapsible) affiche l'historique avec UI simple
3. Ajouter un commentaire → Visible immédiatement

**Vue étendue (TableView, colonne 3)** :
1. Cliquer sur une ligne d'intervention dans le tableau
2. La vue étendue s'affiche en colonne 3
3. Section "Commentaires" affiche **les mêmes données** que le modal édition
4. Même UI : Avatar + Nom + Commentaire + Date/heure (italique)

**Modal Création** :
1. Ouvrir le formulaire de création d'intervention
2. Section "Commentaires" (collapsible, optionnelle)
3. Ajouter un commentaire initial (facultatif)
4. Le commentaire est créé automatiquement après la création de l'intervention

---

## 🔗 Lien avec ARC-001

Une fois COM-001 terminé, l'implémentation de ARC-001 sera triviale :

**ARC-001 pourra simplement** :
1. Ajouter un commentaire système lors de l'archivage :
```typescript
await commentsApi.create({
  entity_id: artisanId,
  entity_type: "artisan",
  content: `Artisan archivé.\nMotif : ${archived_reason}`,
  comment_type: "system",
  is_internal: true,
  author_id: currentUserId,
})
```

2. Mettre à jour les champs BDD :
```sql
UPDATE artisans SET
  archived_at = NOW(),
  archived_by = {user_id},
  archived_reason = {reason}
WHERE id = {artisan_id};
```

3. Afficher le statut archivé dans l'UI avec badge + commentaire système

---

## 📚 Fichiers à modifier

### Nouveaux fichiers
- `src/components/shared/CommentSection.tsx`

### Fichiers à modifier (4 endroits)
- `src/lib/api/v2/commentsApi.ts` (vérifier/améliorer)
- `src/components/ui/artisan-modal/ArtisanModalContent.tsx` (lignes 692-727)
- `src/components/interventions/InterventionEditForm.tsx` (ajouter section)
- `src/components/interventions/views/TableView.tsx` (ExpandedRowContent, colonne 3)
- `src/components/interventions/LegacyInterventionForm.tsx` (ajouter section optionnelle)
- `supabase/functions/comments/index.ts` (vérifier JOIN users)

### Fichiers à vérifier
- `src/lib/api/v2/common/types.ts` (interfaces déjà définies ✅)
- `supabase/migrations/20251005_clean_schema.sql` (table comments existe ✅)

---

## ⚠️ Points d'attention

1. **Ne pas confondre** `suivi_relances_docs` (champ texte simple) et `comments` (table relationnelle avec historique)
2. **Supprimer** l'ancien code qui utilisait `commentaire` dans le formulaire artisan
3. **Unifier** la logique entre artisans et interventions via `CommentSection`
4. **Traçabilité** : Toujours afficher l'auteur + date + heure
5. **Temps réel** : Utiliser React Query pour invalidation automatique après ajout

---

## 🎯 Estimation

**Durée** : 1.5-2j
- Backend vérification : 0.5j
- Composant CommentSection avec UI simple : 0.5j
- Intégration artisans (1 endroit) : 0.25j
- Intégration interventions (3 endroits - copier-coller) : 0.5j
  - Modal édition : 0.2j
  - Vue étendue : 0.15j (copie)
  - Modal création : 0.15j (copie)
- Tests manuels (4 endroits) : 0.25j

**Complexité** : 🟡 Moyenne

---

**Une fois COM-001 terminé, ARC-001 ne prendra que 0.5j supplémentaire !** 🚀

