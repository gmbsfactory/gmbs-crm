# Design v1.4 Updates – Interventions Page

- Date: 2025-10-16
- Raison principale: appliquer la refonte partielle demandée pour la page interventions conformément au design v1.4 tout en préservant le code existant.

## Éléments masqués
- 2025-10-16 – `app/interventions/page.tsx`: masquage temporaire du bloc « Actions & Modes » (ModeSelector, sélecteur de vues IA, bouton Demander à l'IA) via `{false && (...)}` commenté `DESIGN v1.4` afin de conserver le code sans l'afficher.
- 2025-10-16 – `src/components/interventions/FiltersBar.tsx`: masquage des boutons `Tous` et `Sélectionner` dans le cluster gauche au moyen d'une condition `{false && (...)}` annotée `DESIGN v1.4`.
- 2025-10-16 – `src/components/interventions/FiltersBar.tsx`: masquage du composant `<DateRangePicker />` dans le cluster droit via `{false && (...)}` avec un commentaire `DESIGN v1.4` pour signaler sa disponibilité future dans le menu "Plus".

## Masquage des vues Kanban, Chronologie et Galerie
- 2025-10-16 – `src/components/interventions/views/ViewTabs.tsx`: filtrage des onglets affichés pour ne conserver que `table`, `cards` et `calendar`, garantissant que les autres types restent configurables mais invisibles.
- 2025-10-16 – `src/hooks/useInterventionViews.ts`: restriction des vues par défaut et recentrage automatique sur une vue visible si une vue Kanban/Chronologie/Galerie était active.
- 2025-10-16 – `app/interventions/page.tsx`: limitation du sous-menu « Nouvelle vue » aux trois variantes visibles et garde-fou empêchant la création d’une vue masquée côté interface.
- Décision produit: les layouts Kanban/Chronologie/Galerie demeurent supportés dans le code et la base, mais restent temporairement indisponibles dans l’UI en attendant la prochaine itération design.

## Vues par défaut personnalisées
- Vues communes (table) partagées par tous :
  - « Liste générale » — aucun filtre; vision exhaustive.
  - « Market » — `statusValue = DEMANDE` et `attribueA` vide (opérateur `is_empty`).
- Vues utilisateur (table) recalées dynamiquement sur l’utilisateur courant :
  - « Mes demandes » — `statusValue = DEMANDE` + `attribueA = username connecté`.
  - « Ma liste en cours » — `statusValue = EN_COURS` + `attribueA = username connecté`.
  - « Mes visites technique » — `statusValue = VISITE_TECHNIQUE` + `attribueA = username connecté`.
  - « Ma liste accepté » — `statusValue = ACCEPTE` + `attribueA = username connecté`.
- Les 6 vues remplacent intégralement les anciens presets par défaut (table, cartes, calendrier, chronologie, etc.). Elles restent matérialisées en layout Table, taggées `isDefault`, et se re-synchronisent lorsqu’un changement de session Supabase est détecté (listener `onAuthStateChange`). Les filtres appliqués sur ces vues sont temporaires : ils ne sont pas persistés dans le stockage local, contrairement aux vues personnalisées créées par l’utilisateur.
- Fichiers impactés :
  - `src/hooks/useInterventionViews.ts` – définition des 6 vues par défaut, suppression des anciens layouts par défaut, logique de filtrage dynamique et non persistance des filtres.
  - `app/interventions/page.tsx` – conservation uniquement des layouts exposés côté UI (menu « Nouvelle vue » et rendu).
  - `src/components/interventions/views/ViewTabs.tsx` – affichage limité aux vues visibles (table, cards, calendar) en cohérence avec les layouts conservés.

## Éléments déplacés
- 2025-10-16 – `ModeSelector`: la logique de sélection de mode est désormais accessible depuis le menu contextuel des onglets (`SortableTab` dans `src/components/interventions/views/ViewTabs.tsx`). L'ancien déclencheur top-bar est masqué, tandis que le menu contextuel propose un sous-menu « Mode d'affichage » reprenant toutes les options.

## Modifications de layout / structure
- 2025-10-16 – `src/components/interventions/views/ViewTabs.tsx`: ajout d'un sous-menu « Mode d'affichage » après « Réinitialiser la vue » et avant « Supprimer » dans le menu contextuel, avec exposition du mode actif et accès direct aux préférences (`/settings/interface`).
- 2025-10-16 – `src/components/ui/mode-selector/ModeSelector.tsx`: export du tableau `MODE_OPTIONS` pour mutualiser la logique de rendu des modes entre le composant principal et le nouveau sous-menu.

## Notes complémentaires
- Tous les éléments masqués restent intacts dans le code afin de faciliter leur réactivation ultérieure.
- Le DateRangePicker reste accessible via le menu « Plus » comme demandé, garantissant que la fonctionnalité est conservée.
- Aucun composant de vue (tableau, kanban, galerie, etc.) ni modale n'a été modifié.
- Ajustement complémentaire : l’option « Tous les statuts » utilise désormais la valeur sentinelle `__ALL__` dans le `Select` avancé pour satisfaire la contrainte des composants Select (prévention d’une valeur vide).

______

## Modifications supplémentaires - 2025-10-16

### Layout principal
- Alignement de `ViewTabs` et du bouton « Plus » sur une même ligne via un conteneur flex avec `flex-1 overflow-x-auto` pour les onglets et un bouton fixe.
- Nouveau menu « Plus » positionné à droite ; déclenche un `DropdownMenu` dédié.
- Recalcul du mode d’affichage courant pour afficher l’icône correspondante dans le trigger du sous-menu.

### FiltersBar Status
- Introduction de l’état `showStatusFilter` pour gérer l’affichage des chips de statut.
- Masquage complet du composant `<FiltersBar />` via `{false && (...)}` (commentaire DESIGN v1.4).
- Ajout d’un bloc conditionnel reproduisant les chips de statut, leurs icônes et compteurs ; bouton `X` pour refermer rapidement.

### Menu « Plus »
- Entrée principale pour afficher/masquer les filtres de statut (icône `Filter`).
- Option « Configurer les colonnes… » seulement si la vue active est un tableau (ouvre `setColumnConfigViewId`).
- Sous-menu « Mode d’affichage » reprenant les trois modes du `ModeSelector` et le lien vers `/settings/interface`.
- Ancien contenu des filtres avancés conservé mais encapsulé dans `{false && (...)}` pour le garder inactif.

### ViewTabs - Interaction
- Remplacement du bouton `MoreHorizontal` par un `ContextMenu` (clic droit) autour de chaque onglet.
- Menu contextuel : Renommer, Dupliquer, Configurer les colonnes (si applicable), Mode d’affichage (sous-menu), Supprimer (avec styles destructifs).
- Ancien `DropdownMenu` des onglets conservé derrière `{false && (...)}` commenté DESIGN v1.4 pour référence.

### Imports / Hooks additionnels
- `app/interventions/page.tsx` : ajout de `Filter`, `MoreHorizontal`, `X`, `MODE_OPTIONS`, `ModeIcons`, `useModalDisplay`, `DropdownMenuSub*`, `INTERVENTION_STATUS`.
- `src/components/interventions/views/ViewTabs.tsx` : ajout des composants `ContextMenu`, des icônes `Pencil`, `Copy`, `Trash2`, et logique auxiliaire (`hasLeadingActions`).
- Création du fichier `src/components/ui/context-menu.tsx` reprenant l’implémentation shadcn/ui pour alimenter les menus contextuels.

______

## Modifications supplémentaires - 2025-10-16 (Changement 3 : Mode Réorganisation)

### Mode réorganisation avec effet shake
- Nouvel état `isReorderMode` dans `app/interventions/page.tsx` pour activer/désactiver la réorganisation des vues.
- Ajout d’un `useEffect` qui sort du mode réorganisation à la pression de la touche `Escape`.
- Animation CSS `animate-shake` déclarée dans `app/globals.css` pour imiter l’effet iOS lors du déplacement des vues.

### Bouton ESC
- Bouton « ESC » ajouté à droite du header quand `isReorderMode === true`, avec `animate-pulse` pour attirer l’attention.
- Le bouton déclenche `setIsReorderMode(false)` afin de quitter rapidement le mode réorganisation.
- Le menu « Plus » est masqué tant que le mode réorganisation est actif afin de réduire le bruit visuel.

### ViewTabs – nouvelle option « Réorganiser »
- `ViewTabs` expose désormais les props `isReorderMode`, `onEnterReorderMode`, `onExitReorderMode` et relaie `onEnterReorderMode` aux onglets.
- L’item « Réorganiser les vues » (icône `GripVertical`) est ajouté dans le menu contextuel et déclenche `onEnterReorderMode`.
- Les poignées de drag `GripVertical` et l’animation shake ne s’activent que lorsque `isReorderMode === true`.
- Le bouton « Nouvelle vue » est remplacé par un rappel textuel pendant la réorganisation (« Réorganisez vos vues, puis appuyez sur ESC »).

### Accessibilité et sortie de mode
- Listener clavier ESC déclaré dans `app/interventions/page.tsx` pour quitter le mode sans utiliser la souris.
- Bouton ESC persiste visible en mode réorganisation et disparaît automatiquement en mode normal.
- `useSortable` est désactivé hors mode réorganisation afin d’éviter les glissements involontaires.

______

## Modifications supplémentaires - 2025-10-16 (Changement 3.1 : Ajustement mode réorganisation)

- Suppression de l’animation `shake` appliquée aux onglets pendant la réorganisation (retirée de `app/interventions/page.tsx` & `app/globals.css`) car elle perturbait le drag and drop.
- Les styles associés (`@keyframes shake` / `.animate-shake`) ont été supprimés de `app/globals.css`.
- Le mode réorganisation conserve la poignée `GripVertical` et le bouton ESC, mais sans animation additionnelle pour garantir une interaction fluide.
- Texte d'aide repositionné au-dessus des onglets avec le bouton « ESC » à sa gauche (`app/interventions/page.tsx`) afin de clarifier la marche à suivre en mode réorganisation tout en gardant le menu « Plus » masqué.

## Modifications supplémentaires - 2025-10-16 (Changement 3.2 : Restructuration bouton ESC)

- Suppression du doublon du texte "Réorganisez vos vues, puis appuyez sur ESC" qui apparaissait à la fois au-dessus des onglets et sur la ligne des onglets.
- Le texte d'instruction reste uniquement au-dessus des onglets (`app/interventions/page.tsx`).
- Le bouton "ESC" est maintenant positionné sur la ligne des onglets à la place du texte dupliqué (`src/components/interventions/views/ViewTabs.tsx`).
- Le bouton "ESC" utilise les couleurs de surlignage (`bg-primary/10 text-primary border-primary/20 hover:bg-primary/20`) avec l'animation `animate-pulse` pour attirer l'attention.

## Modifications supplémentaires - 2025-10-16 (Changement 3.3 : Correction erreur onExitReorderMode)

- Correction de l'erreur "onExitReorderMode is not defined" en corrigeant le renommage de la prop dans `src/components/interventions/views/ViewTabs.tsx`.
- La prop `onExitReorderMode` était renommée en `_onExitReorderMode` (avec underscore), ce qui la rendait inutilisable.
- Restauration du nom original `onExitReorderMode` pour que le bouton ESC fonctionne correctement.

## Modifications supplémentaires - 2025-10-16 (Changement 3.4 : Amélioration navigation des vues)

- Correction de la navigation des flèches : les flèches vont maintenant directement au bout du scroll (début/fin) au lieu de faire un micro-scroll de 200px.
- Amélioration de la fonction `scrollToEnd()` qui utilise `scrollTo()` avec `behavior: "smooth"` pour une navigation fluide.
- Les flèches conservent leur taille `h-8 w-8` qui correspond aux boutons de vues (`py-1.5`).
- Suppression complète des styles `.shadcn-scroll-area` pour utiliser uniquement le scroll natif du navigateur.
- La barre de scroll personnalisée a été entièrement supprimée, améliorant l'apparence visuelle.

## Modifications supplémentaires - 2025-10-16 (Changement 3.5 : Corrections visuelles finales)

- Correction du centrage des flèches : utilisation de `top-1/2 -translate-y-1/2` au lieu de `inset-y-0` pour un alignement parfait avec les boutons de vues.
- Ajout de la classe CSS `.scrollbar-hide` pour masquer complètement la scrollbar horizontale des onglets de vues.
- Les flèches sont maintenant parfaitement centrées verticalement avec les boutons de vues.
- La scrollbar horizontale est invisible tout en conservant la fonctionnalité de scroll.

## Modifications supplémentaires - 2025-10-16 (Changement 3.6 : Centrage final des flèches)

- Ajustement final du centrage des flèches : ajout de `h-8` au conteneur des flèches pour qu'il ait exactement la même hauteur que les boutons de vues.
- Utilisation de `top-1/2 -translate-y-1/2` avec `flex h-8 items-center` pour un alignement parfait.
- Les flèches sont maintenant parfaitement centrées verticalement avec le contenu des boutons de vues (icône + texte).

## Modifications supplémentaires - 2025-10-16 (Changement 3.7 : Ajustements finaux de centrage)

- Ajustement de la hauteur des conteneurs à `h-11` pour correspondre à la hauteur des ViewTabs.
- Augmentation du gap entre les onglets à `gap-4` pour un meilleur espacement.
- Correction du centrage du bouton "Plus" en changeant `items-start` vers `items-center` dans le conteneur principal.
- Tous les éléments (onglets de vues, flèches de navigation, bouton "Plus") sont maintenant parfaitement alignés verticalement.

______

## Modifications supplémentaires - 2025-10-16 (Changement 4 : Menu « Plus » & navigation des vues)

### Menu « Plus »
- Migration du bouton « + » vers le menu principal : nouveau sous-menu « Nouvelle vue » avec toutes les variantes (`table`, `kanban`, `cartes`, `galerie`, `calendrier`, `chronologie`) dans `app/interventions/page.tsx`.
- Restructuration des filtres : sous-menu « Afficher les filtres » contenant un `DropdownMenuCheckboxItem` « Statut » pour activer/désactiver la barre de chips. (Préparation pour ajouter d'autres filtres ultérieurement.)
- Ordre final du menu : « Nouvelle vue » → « Afficher les filtres » → « Configurer les colonnes… » (si vue tableau) → « Mode d’affichage ».

### Navigation des onglets
- `src/components/interventions/views/ViewTabs.tsx` : suppression du bouton « + » et intégration de flèches `ChevronLeft` / `ChevronRight` avec fond semi-transparent et `backdrop-blur` pour indiquer le scroll horizontal.
- Ajout d’un suivi (`canScrollLeft` / `canScrollRight`) basé sur la position du scroll pour n’afficher les flèches que lorsqu’il reste des onglets masqués.
- Les boutons de défilement utilisent `scrollBy({ behavior: "smooth" })` pour une navigation fluide sans interrompre le drag & drop.
- Nettoyage de la zone de tabs : padding latéral (`px-8`) pour laisser l’espace visuel nécessaire aux flèches et passage au scroll natif (`overflow-x-auto`).
- `app/interventions/page.tsx` : la ligne contenant les onglets utilise désormais `flex-wrap` et un conteneur `min-w-0` pour rester à l’intérieur de la page quelle que soit la largeur ou le niveau de zoom.

### Styles globaux
- Suppression complète des styles `.shadcn-scroll-area` dans `app/globals.css` afin de revenir au scroll natif du navigateur pour cette zone (plus conforme au design demandé).

### Mode réorganisation
- Le bouton « ESC » et le texte d’aide restent gérés dans `app/interventions/page.tsx`; `ViewTabs` ne manipule plus la prop `onExitReorderMode`, l’échappement est centralisé côté page.
