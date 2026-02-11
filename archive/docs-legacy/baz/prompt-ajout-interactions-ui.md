# 🎨 PROMPT - Ajout d'interactions UI pour les interventions

## 🎯 OBJECTIF
Améliorer l'expérience utilisateur en ajoutant deux interactions clés pour la gestion des interventions.

## 📋 TÂCHES À EFFECTUER

### 1. **AJOUTER LE BOUTON "NOUVELLE INTERVENTION"**

**Localisation :** Dans `app/interventions/page.tsx`
**Position :** À côté du titre "Interventions" et du compteur

**Modifications à apporter :**
- Ajouter un bouton avec l'icône `+` (Plus)
- Positionner à côté du texte "Toutes les interventions (nombre)"
- Rediriger vers `/interventions/new` au clic
- Style cohérent avec le design existant

**Code à ajouter :**
```tsx
<Button asChild size="sm" className="ml-2">
  <Link href="/interventions/new">
    <Plus className="h-4 w-4 mr-1" />
    Nouvelle intervention
  </Link>
</Button>
```

### 2. **ACTIVER LE DOUBLE-CLIC SUR LES CARTES**

**Localisation :** Dans `app/interventions/page.tsx`
**Composant :** `InterventionCard`

**Modifications à apporter :**
- Ajouter un gestionnaire `onDoubleClick` sur les cartes
- Rediriger vers `/interventions/${intervention.id}` au double-clic
- Maintenir les interactions existantes (clic simple)

**Code à ajouter :**
```tsx
<InterventionCard
  key={intervention.id}
  intervention={intervention}
  onOpen={(id) => router.push(`/interventions/${id}`)}
  onStatusClick={(id) => router.push(`/interventions/${id}`)}
  onDoubleClick={(id) => router.push(`/interventions/${id}`)} // ← NOUVEAU
/>
```

### 3. **ACTIVER LE DOUBLE-CLIC SUR LES LIGNES DU TABLEAU**

**Localisation :** Dans `app/interventions/page.tsx`
**Composant :** `InterventionTable`

**Modifications à apporter :**
- Ajouter un gestionnaire `onDoubleClick` sur les lignes du tableau
- Rediriger vers `/interventions/${intervention.id}` au double-clic
- Maintenir les interactions existantes (clic simple)

**Code à ajouter :**
```tsx
<InterventionTable
  interventions={interventions}
  onRowClick={(intervention) => router.push(`/interventions/${intervention.id}`)}
  onRowDoubleClick={(intervention) => router.push(`/interventions/${intervention.id}`)} // ← NOUVEAU
/>
```

## 🔧 MODIFICATIONS TECHNIQUES

### **Imports nécessaires :**
```tsx
import { Plus } from "lucide-react"
import Link from "next/link"
```

### **Props à ajouter aux composants :**
- `InterventionCard` : `onDoubleClick?: (id: string) => void`
- `InterventionTable` : `onRowDoubleClick?: (intervention: InterventionWithDocuments) => void`

## 🎨 DESIGN ATTENDU

### **Bouton "Nouvelle intervention" :**
- Icône `+` avec texte "Nouvelle intervention"
- Taille `sm` pour ne pas surcharger l'interface
- Position à droite du titre, aligné avec le compteur
- Style cohérent avec les autres boutons

### **Double-clic :**
- Fonctionne sur les cartes ET les lignes du tableau
- Redirection immédiate vers la page de détail
- Pas de conflit avec les clics simples existants

## ✅ VALIDATION

**Vérifier que :**
1. Le bouton "Nouvelle intervention" est visible et fonctionnel
2. Le double-clic sur les cartes redirige vers la bonne page
3. Le double-clic sur les lignes du tableau redirige vers la bonne page
4. Les interactions existantes (clic simple) continuent de fonctionner
5. Le design reste cohérent et professionnel

## 🚀 RÉSULTAT ATTENDU

Une interface plus intuitive avec :
- ✅ Accès rapide à la création d'interventions
- ✅ Navigation fluide vers les détails (double-clic)
- ✅ Expérience utilisateur améliorée
- ✅ Design cohérent et professionnel

---

**Priorité :** HAUTE - Amélioration UX immédiate
**Complexité :** FAIBLE - Modifications simples d'interface


