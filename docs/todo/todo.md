### Now

- Dashboard
        - Faire tests pour les calculs. Page dashboard et admin dashboard.
        - Test podium 
                Manual Verification
                Insert a test intervention with 
                date
                = 1 month ago.
                Insert an intervention_status_transition to INTER_TERMINEE for this intervention with transition_date = today.
                Call SELECT * FROM get_podium_ranking_by_period(now() - interval '1 week', now() + interval '1 week').
                Verify the intervention appears in the results.

- Recherche :
        - Améliorer la recherche pour inclure les montants attente accompt
        - Meilleure gestion de la partie asynchrone. Un système cyclique sur le temps a été mis en place. Il faudrait un système évènementiel dans l'idéale

- Interventions
        - Disposition NewModalINtervention même format que INterventionEditForm
        - Refacto / Fusionner INterventionEditForm et NewIntentionForm ou du moins communaliser le code pour éviter la duplication de code

- 

- A demander à DD
        - Calcul de marge /inter pourquoi ?
                Marge sur le prix de vente ou marge brute sans divisé par le coût de l'inter.
                Pour moi sur le modal, on doit afficher la marge brute mais dans le calcul de marge générale on doit calculer la marge sur le prix de vente
        - Quelles sont les différences entre le composant NewINterventionForm.tsx et InterventionEditForm.tsx ?? 

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
