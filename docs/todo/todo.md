### Now

- Dashboard
        - Faire tests pour les calculs. Page dashboard et admin dashboard.

- Recherche :
        - Améliorer la recherche pour inclure les montants attente accompte
        - Meilleure gestion de la partie asynchrone. Un système cyclique sur le temps a été mis en place. Il faudrait un système évènementiel dans l'absolue

- Artisans
        - Mettre une pastille ou un élément visuel marquant qui permet de voir
                que le dossier artisan est à compléter
                Mettre les éléments quelque part qui sont à compléter
                Quand le dosier est complété, voir si il passe plus en dossier incomplet

        - Gestion des compteurs avec les filtres statuts métiers

        - Modal vue impossible de scroller dans l'ajout des documents ou même sur la partie gauche entièrement. (Je suppose sur la partie droite également)  [Supprimer le modal oeuil ? ]   --> demander à André
        
- Interventions
        - TableView dans le sélecteur de filtres mettre un compteur comme dans la table artisans
        - Refaire un check

- Refacto
        - refacto supabase-api-v2 appelé les différents endpoint api plutôt que de dupliquer du code. Unique point de responsabilité.

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
