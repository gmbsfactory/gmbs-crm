# Échelle de superposition (z-index)

> Source de vérité : [`src/lib/ui/z-index.ts`](../../src/lib/ui/z-index.ts)
> Aucun `z-[…]` en dur dans un composant. On importe `Z_INDEX` (valeur numérique)
> ou `Z_CLASS` (classe Tailwind) et on choisit un étage nommé.

## Le problème que cette échelle résout

Les gros modals (fiche artisan, fiche intervention) sortaient à `z-70`, alors que
la primitive `Dialog` de shadcn sortait à `z-50`. Conséquence : **toute boîte de
dialogue ouverte depuis un gros modal passait derrière lui**. Le symptôme signalé
par le client : le dialogue « Refuser la pièce » du dossier artisan, invisible.

Trois appelants avaient contourné le problème à la main (`!z-[1300]` sur le
contenu, `!z-[1200]` sur le voile). Les autres, non. Le correctif est dans la
primitive : `Dialog` sort désormais au-dessus des gros modals **par défaut**, et
plus aucun appelant n'a besoin de surcharger quoi que ce soit.

## Les étages

| z-index | Nom | À quoi ça sert | Pourquoi au-dessus du précédent |
|---:|---|---|---|
| `< 50` | `contenuPage` | Contenu de la page, éléments empilés localement | — |
| `50` | `barreSuperieure` | Barre du haut, en-têtes de tableau collants | Reste visible pendant le défilement |
| `60` | `modalVoile` | Voile des gros modals (`GenericModal`) | Doit masquer la page et sa barre du haut |
| `70` | `modal` | Gros modals : fiche artisan, fiche intervention | Au-dessus de son propre voile |
| `80` | `surModal` | Modals secondaires hérités (journal des mises à jour) | Ouverts par-dessus la page, parfois par-dessus un modal |
| `110` | `panneauVoile` | Voile des panneaux latéraux (`Sheet`) | Un panneau s'ouvre **depuis** un gros modal |
| `120` | `panneau` | Panneaux latéraux : historique artisan, historique intervention, historique e-mails, activité | Au-dessus de son propre voile |
| `1000` | `flottantPage` | Infobulle d'une cellule tronquée, carte de survol d'une intervention | Au-dessus des panneaux, mais **sous** les dialogues : quand un dialogue est ouvert, plus rien de la page ne passe devant |
| `1200` | `dialogueVoile` | Voile des boîtes de dialogue (`Dialog`) | **Le correctif** : un dialogue s'ouvre presque toujours depuis un gros modal ou un panneau |
| `1300` | `dialogue` | Boîtes de dialogue : motif de refus d'une pièce, demande de correction d'un rapport, lien portail, édition d'e-mail | Au-dessus de son propre voile |
| `1320` | `dialogueImbriqueVoile` | Voile d'un dialogue ouvert depuis un dialogue | Ex. l'aperçu d'un document depuis la reclassification |
| `1350` | `dialogueImbrique` | Ce dialogue-là | Au-dessus de son parent, sous les confirmations |
| `1400` | `confirmationVoile` | Voile des confirmations (`AlertDialog`) | Une confirmation s'ouvre très souvent **depuis** un dialogue |
| `1500` | `confirmation` | « Voulez-vous vraiment ? », « Modifications non enregistrées », suppression | Dernier mot avant l'action irréversible |
| `1600` | `visionneuse` | Visionneuse de photos plein écran | S'ouvre depuis n'importe lequel des étages précédents |
| `1700` | `notification` | Messages éphémères (toasts) | La confirmation d'une action doit rester lisible même dialogue ouvert |
| `9999` | `pleinEcran` | Économiseur d'écran, tableau de bord développeur | Recouvrent tout le produit |
| `10000` | `flottant` | Menus, listes déroulantes, sélecteurs, infobulles, palette de recherche | **Inchangé.** Un sélecteur ouvert *dans* un dialogue doit rester devant lui. Jamais modal, se referme au premier clic : il ne peut pas piéger l'utilisateur |
| `10001` | `flottantImbrique` | Menu ou infobulle ouverts depuis un menu | Au-dessus de son parent flottant |

## Pourquoi les gros modals restent à 60/70

L'échelle aurait pu monter les gros modals à 600/700 pour « laisser de la
place ». On ne l'a pas fait, pour une raison simple : **ce qui manquait n'était
pas de la place sous les modals, mais un étage au-dessus.** Une dizaine de
composants se positionnent déjà relativement à 60/70 (en-têtes de tableau
redimensionnables, journal des mises à jour, barre du haut, aperçus de
documents). Les déplacer aurait multiplié les fichiers touchés et les risques de
régression, sans rien résoudre. L'étage manquant a donc été créé à 1200+, là où
il n'y avait rien.

## Comment ajouter une surface

1. Chercher l'étage qui décrit ce que la surface **est**, pas la valeur qui « marche ».
2. Utiliser `Z_CLASS.<étage>` (classe Tailwind) ou `Z_INDEX.<étage>` (nombre, pour un `style`).
3. Si aucun étage ne convient, en ajouter un **dans `src/lib/ui/z-index.ts`** et
   mettre à jour ce tableau. Jamais de `z-[…]` en dur dans un composant.

```tsx
import { Z_CLASS } from "@/lib/ui/z-index"

<div className={cn("fixed inset-0", Z_CLASS.dialogueVoile)} />
```

## Ce qui reste hors de l'échelle

Trois familles de valeurs n'ont volontairement pas été migrées, faute de
justification à changer leur comportement aujourd'hui :

| Où | Valeur | Pourquoi c'est resté |
|---|---|---|
| `ResizableTableHeader` (en-têtes de tableau collants) | `z-[60]` / `z-[55]` | Empilement interne au tableau ; les toucher change le rendu des colonnes figées sans rapport avec ce correctif |
| Modals maison des réglages (`AddUserModal`, `EnumManager`, `UserPermissionsDialog`…) | `z-50` | Surfaces plein écran écrites à la main, pas des `Dialog` ; un vrai `Dialog` ouvert par-dessus passe désormais devant |
| Petits empilements locaux (`z-10`, `z-20`) | — | Contenu de page, sans interaction avec les surfaces modales |

À migrer si l'un d'eux repose un problème d'ordre : la règle reste d'ajouter un
étage dans `src/lib/ui/z-index.ts`, pas une valeur locale.

## Ce qu'il ne faut plus faire

```tsx
// NON : rustine locale, invisible pour le prochain développeur
<DialogContent className="sm:max-w-md !z-[1300]" overlayClassName="!z-[1200]">

// OUI : le défaut de la primitive est déjà bon
<DialogContent className="sm:max-w-md">
```

Un `!z-[…]` dans un composant est le signe qu'un étage manque à l'échelle, ou
que la primitive a un mauvais défaut. Dans les deux cas, le correctif est ici,
pas dans l'appelant.
