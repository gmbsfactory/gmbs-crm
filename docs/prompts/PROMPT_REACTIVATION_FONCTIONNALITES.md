# Prompt de Réactivation des Fonctionnalités Désactivées

## 📋 Contexte

Ce document contient les instructions pour **réactiver** les fonctionnalités qui ont été désactivées le 28 novembre 2025 sur la branche `preview`.

## 🎯 Fonctionnalités Désactivées

Les fonctionnalités suivantes ont été désactivées mais conservées dans le code :

1. **Vérification SIRET via API** dans la création d'artisan
2. **Envoi automatique vers WhatsApp** depuis le modal d'intervention (footer)
3. **Boutons d'envoi WhatsApp** pour les artisans depuis le formulaire d'intervention

---

## 🔄 Prompt de Réactivation

```
Sur la branche preview, je souhaite réactiver les fonctionnalités suivantes qui ont été désactivées :

1. **Vérification SIRET dans la création d'artisan** :
   - Fichier : `src/components/ui/artisan-modal/NewArtisanModalContent.tsx`
   - Réactiver le bouton "Vérifier" (ligne ~496-511)
   - Réactiver la fonction `handleSiretComplete` pour qu'elle vérifie le SIRET via l'API et pré-remplisse les champs

2. **Bouton WhatsApp dans le modal d'intervention** :
   - Fichier : `src/components/ui/intervention-modal/InterventionModalContent.tsx`
   - Réactiver le bouton "Envoyer sur WhatsApp" (ligne ~503-511)
   - Le bouton doit appeler `handleOpenWhatsApp` au clic

3. **Boutons WhatsApp pour les artisans** :
   - Fichier : `src/components/interventions/InterventionEditForm.tsx`
   - Réactiver les deux boutons WhatsApp (lignes ~1813-1831) :
     - "WhatsApp demande de devis"
     - "WhatsApp demande d'intervention"
   - Les boutons doivent appeler `handleOpenWhatsApp` avec les bons paramètres

Pour chaque fonctionnalité :
- Retirer les propriétés `disabled={true}`
- Retirer les classes d'opacité et curseur (`opacity-50`, `cursor-not-allowed`)
- Rétablir les handlers `onClick` d'origine
- Rétablir les classes de couleur/hover d'origine
- Retirer les tooltips "Fonctionnalité désactivée"

Vérifie qu'il n'y a pas d'erreurs de lint après les modifications.
```

---

## 📝 Détails Techniques des Modifications à Annuler

### 1. NewArtisanModalContent.tsx

**État actuel (désactivé) :**
```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => {}}
  disabled={true}
  className="shrink-0 opacity-50 cursor-not-allowed"
  title="Fonctionnalité désactivée"
>
  Vérifier
</Button>

const handleSiretComplete = async (siret: string) => {
  // Fonctionnalité désactivée - ne rien faire
  return
}
```

**À rétablir (actif) :**
```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => handleSiretComplete(siretValue)}
  disabled={!canVerify}
  className="shrink-0"
>
  {isVerifyingSiret ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Vérification...
    </>
  ) : (
    "Vérifier"
  )}
</Button>

const handleSiretComplete = async (siret: string) => {
  // Ne pas vérifier si service indisponible
  if (isUnavailable) return

  if (siret.length === 14) {
    const result = await verifySiret(siret)
    if (result) {
      // Pré-remplir UNIQUEMENT les champs vides
      if (result.raison_sociale && !watch("raison_sociale")) {
        setValue("raison_sociale", result.raison_sociale)
      }
      if (result.nom && !watch("nom")) {
        setValue("nom", result.nom)
      }
      if (result.prenom && !watch("prenom")) {
        setValue("prenom", result.prenom)
      }
      if (result.statut_juridique && !watch("statut_juridique")) {
        setValue("statut_juridique", result.statut_juridique)
      }
      // Ne JAMAIS toucher à l'email (API Sirene ne le fournit pas)

      // Pré-remplir l'adresse si disponible et vide
      if (result.adresse) {
        if (!watch("adresse_siege_social")) {
          const adresseComplete = [
            result.adresse.numero,
            result.adresse.type_voie,
            result.adresse.voie,
          ]
            .filter(Boolean)
            .join(" ")
          setValue("adresse_siege_social", adresseComplete)
        }
        if (!watch("code_postal_siege_social")) {
          setValue("code_postal_siege_social", result.adresse.code_postal)
        }
        if (!watch("ville_siege_social")) {
          setValue("ville_siege_social", result.adresse.ville)
        }
      }
    }
  }
}
```

---

### 2. InterventionModalContent.tsx

**État actuel (désactivé) :**
```tsx
{clientPhone && clientPhone.trim() !== "" && (
  <Button
    onClick={() => {}}
    disabled={true}
    className="flex items-center gap-2 bg-[#25D366]/50 text-white cursor-not-allowed opacity-50"
    title="Fonctionnalité désactivée"
  >
    <MessageCircle className="h-4 w-4" />
    Envoyer sur WhatsApp
  </Button>
)}
```

**À rétablir (actif) :**
```tsx
{clientPhone && clientPhone.trim() !== "" && (
  <Button
    onClick={handleOpenWhatsApp}
    className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20BA5A] text-white"
  >
    <MessageCircle className="h-4 w-4" />
    Envoyer sur WhatsApp
  </Button>
)}
```

---

### 3. InterventionEditForm.tsx

**État actuel (désactivé) :**
```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => {}}
  disabled={true}
  className="flex-1 text-xs bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]/50 cursor-not-allowed opacity-50"
  title="Fonctionnalité désactivée"
>
  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
  WhatsApp demande de devis
</Button>
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => {}}
  disabled={true}
  className="flex-1 text-xs bg-[#25D366]/10 border-[#25D366]/30 text-[#25D366]/50 cursor-not-allowed opacity-50"
  title="Fonctionnalité désactivée"
>
  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
  WhatsApp demande d&apos;intervention
</Button>
```

**À rétablir (actif) :**
```tsx
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => handleOpenWhatsApp('devis', artisanId, artisanPhone)}
  className="flex-1 text-xs bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]"
>
  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
  WhatsApp demande de devis
</Button>
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => handleOpenWhatsApp('intervention', artisanId, artisanPhone)}
  className="flex-1 text-xs bg-[#25D366]/10 hover:bg-[#25D366]/20 border-[#25D366]/30 text-[#25D366]"
>
  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
  WhatsApp demande d&apos;intervention
</Button>
```

---

## ✅ Checklist de Réactivation

Après avoir appliqué les modifications, vérifier :

- [ ] Le bouton "Vérifier" du SIRET est cliquable dans la création d'artisan
- [ ] La vérification SIRET pré-remplit automatiquement les champs
- [ ] Le bouton WhatsApp du modal d'intervention est cliquable et ouvre WhatsApp
- [ ] Les 2 boutons WhatsApp du formulaire d'intervention sont cliquables
- [ ] Les boutons WhatsApp ont les bonnes couleurs (vert WhatsApp)
- [ ] Les effets hover fonctionnent correctement
- [ ] Aucune erreur de lint n'est présente
- [ ] Les fonctionnalités ont été testées manuellement

---

## 📅 Historique

- **28 novembre 2025** : Désactivation initiale des fonctionnalités
- **Date de réactivation** : _À compléter lors de la réactivation_

---

## 💡 Notes

- Toutes les fonctions `handleOpenWhatsApp`, `handleSiretComplete`, etc. sont toujours présentes dans le code
- Seules les propriétés des boutons ont été modifiées (disabled, onClick, className)
- La logique métier n'a pas été supprimée, seulement désactivée
- Les imports nécessaires (Loader2, etc.) sont toujours présents

