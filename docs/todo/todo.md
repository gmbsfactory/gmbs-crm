### Now 


- Dashboard
        - implémenter les raccourcis clics sur la page dashboard 
                Mes Artisans --> page artisan, Mes Interventions  --> page intervention

        - mettre dans le cache les infos des menus hover dès le chargement
                si ce n'est pas déjà fait

- Dashboard admin
        - Espace tableau à bien formatter
        - Multi sélection sur les filtres au lieu de sélection unique 

- Dashboard 
        - Unifier les calculs pour le podium entre les Performances Gestionnaires du dashboard  admin et le podium côté Dashboard
        - 

- Chaîne des statuts à respecter 
        (au moins ceux qui sont présents dans l'entonnoir de conversion)

- Delete Artisan via API 

- Donner à Antigravity la gestion des vulnérabilités supabase

- Export 
        - merger sheet export
        - s'assurer du bon fonctionnement
        - mettre un bouton export en paramètre lorsque l'on est admin sur la page Settings (non prioritaire)


- Import 
        - vérifier les status transition
        - les prix voir si il y en a exorbitant
        - le calcul du CA 
        - le delta entre inter loggés et inter en bdd 


IN PROGRESS : 
        - status chain transition    [X]
        - podium uniformisé          []
        - tableau admin dashboard    [X]  dd
        - refaire architecture fonction rpc dashboard avec claude [X] 
        - funnel chart



psql -h localhost -p 54322 -U postgres -d postgres -f supabase/samples/sql/admin_dashboard_test/02_test_level1_cache.sql

 ### Later

- Mettre en place OCR
        - Rcupération informations depuis appel d'offres 
        - Estimation de marge à faire suivant les données en bdd
        - 

- bouton import export Sheets <-> CRM

- faire une analyse des prix, analyse de la concurrence
        pour l'apisation
        pour le dépot de document
        pour l'optim IA

- voir le coût vs le gain de migrer les appels côté serveur avec des edge function

- npx tsx scripts/geocode-artisans.ts à ajouter dans le package.json

- refacto migrations make one clean schema business operations, one for user

- refacto seed_mockup bien avoir des fichiers clairs

- OCR pour documents





--------------- Discussion 23/11/2025 with DD

- Tendance 
- Projections KPIs sur des périodes
- Prendre un pourcentage de l'augmentation des bénéfices suite à la livraison du CRM et des améliorations que l'on a apporté. En contrepartie nous sommes plus libre de la gestion et de l'amélioration de l'outil. On prend 15% des bénéfices liés à la suite. Ce pourcentage sera révalué chaque trimestre. 
- 
