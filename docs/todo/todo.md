### Now

- Dashboard
        - Faire tests pour les calculs. Page dashboard et admin dashboard.

- Recherche :
        - Améliorer la recherche pour inclure les montants attente accompte
        - Meilleure gestion de la partie asynchrone. Un système cyclique sur le temps a été mis en place. Il faudrait un système évènementiel dans l'idéale

- Artisans
        - Modal vue impossible de scroller dans l'ajout des documents ou même sur la partie gauche entièrement. (Je suppose sur la partie droite également)  [Supprimer le modal oeuil ? ]   --> demander à André

- Interventions
        - Compteur adaptatif en fonction des filtres en place
        - Refacto / Fusionner INterventionEditForm et NewIntentionForm ou du moins communaliser le code pour éviter la duplication
        - A partir de ce qui a été fait avec FilterMapperContext.tsx voir si on peut étendre le design avec les autres données du contexte d'intervention
        -

- Réparations logs
        -
        image.png
        dimension du composant de filtrage par kilomètrage;

        - Mettre un artisan indisponible et chercher un artisan dans la zone pour voir si le 
        badge s'affiche bien 

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
