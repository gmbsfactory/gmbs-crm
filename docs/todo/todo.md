### Now

- Dashboard
        - Faire tests pour les calculs. Page dashboard et admin dashboard.

- Recherche :
        - Améliorer la recherche pour inclure les montants attente accompte
        - Meilleure gestion de la partie asynchrone. Un système cyclique sur le temps a été mis en place. Il faudrait un système évènementiel dans l'absolue

- Artisans
        - Modal vue impossible de scroller dans l'ajout des documents ou même sur la partie gauche entièrement. (Je suppose sur la partie droite également)  [Supprimer le modal oeuil ? ]   --> demander à André

- Interventions
        - Compteur adaptatif en fonction des filtres en place

- Refacto
        - refacto supabase-api-v2 appelé les différents endpoint api plutôt que de dupliquer du code. Unique point de responsabilité.

- Gestion
        - vérifier supabase db reset passe avec nouvelles migrations

- Réparations logs
        - Ne pas modifier le champ adresse de l'intervention lorsque l'on remplit l'adresse entrée sur Google
        - Quand pas d'adresse saisi sur Google = pas d'affichage artisans
        - Dans la partie recherche d'artisan mettre une proposition filtré par métier et agence dans la loupe. En faire un menu scrollable dans lequel on peut aussi faire des recherches.
        -
        image.png
        dimension du composant de filtrage par kilomètrage;

        - La date dans les mail n'est pas dans l'ordre il faut 01/12/2025 pas 2025-12-29

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
