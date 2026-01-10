### Now

- Commentaires
        - Suppression Commentaire ??

- Dashboard
        - Faire tests pour les calculs. Page dashboard et admin dashboard.

- Recherche :
        - Améliorer la recherche pour inclure les montants attente accompt
        - Meilleure gestion de la partie asynchrone. Un système cyclique sur le temps a été mis en place. Il faudrait un système évènementiel dans l'idéale

- Artisans
        - Modal vue impossible de scroller dans l'ajout des documents ou même sur la partie gauche entièrement. (Je suppose sur la partie droite également)  [Supprimer le modal oeuil ? ]   --> demander à André

- Interventions
        - Disposition NewModalINtervention même format que INterventionEditForm
        - Refacto / Fusionner INterventionEditForm et NewIntentionForm ou du moins communaliser le code pour éviter la duplication de code

- Enlever le warning de build
        - ./src/components/ui/searchable-badge-select.tsx
105:13  Warning: Elements with the ARIA role "combobox" must have the following attributes defined: aria-controls,aria-expanded  jsx-a11y/role-has-required-aria-props

- A demander à DD
        - Calcul de marge /inter pourquoi ?
                Marge sur le prix de vente ou marge brute sans divisé par le coût de l'inter.
                Pour moi sur le modal, on doit afficher la marge brute mais dans le calcul de marge générale on doit calculer la marge sur le prix de vente

### Later

- Donner à Antigravity la gestion des vulnérabilités supabase

- Mettre en place OCR
        - Rcupération informations depuis appel d'offres
        - Estimation de marge à faire suivant les données en bdd
        -

- bouton import export Sheets <-> CRM

- faire une analyse des prix, analyse de la concurrence
        pour l'apisation
        pour le dépot de document
        pour l'optim IA

- OCR pour documents
