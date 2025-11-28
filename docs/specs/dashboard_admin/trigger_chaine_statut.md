Solutions proposées
Solution 1 : Unifier la création de transitions (priorité haute)
Coût : 4-6h
Complexité : Moyenne
Actions :
Désactiver les triggers SQL automatiques pour les transitions via API
Centraliser la création dans AutomaticTransitionService
Utiliser log_status_transition_from_api uniquement depuis le service
Garder les triggers uniquement pour les modifications directes en DB
Bénéfice : Élimine les doublons et les race conditions.
Solution 2 : Validation côté backend (priorité haute)
Coût : 3-4h
Complexité : Moyenne
Actions :
Créer une fonction RPC validate_status_transition(intervention_id, to_status_code)
Appeler cette fonction depuis l'API route avant la transition
Retourner les erreurs détaillées au frontend
Synchroniser les règles avec AUTHORIZED_TRANSITIONS
Bénéfice : Source de vérité unique, validation fiable.
Solution 3 : Améliorer la gestion d'erreur (priorité moyenne)
Coût : 2-3h
Complexité : Faible
Actions :
Ajouter une invalidation explicite après succès
Gérer les erreurs réseau vs erreurs métier
Ajouter un retry avec backoff
Logger les erreurs pour le debugging
Bénéfice : Meilleure UX, debugging facilité.
Solution 4 : Débounce et protection contre les doubles clics (priorité moyenne)
Coût : 1-2h
Complexité : Faible
Actions :
Ajouter un état isTransitioning dans handleStatusChange
Désactiver le bouton pendant la transition
Ajouter un debounce de 300ms
Bénéfice : Évite les transitions multiples accidentelles.
Solution 5 : Synchronisation frontend/backend (priorité basse)
Coût : 4-5h
Complexité : Moyenne
Actions :
Après une transition réussie, invalider et refetch les données
Utiliser useInterventionsRealtime pour synchroniser automatiquement
Ajouter un indicateur de synchronisation
Bénéfice : UI toujours à jour.
Plan d'action recommandé
Phase 1 (urgent - 1 jour) :
Solution 1 : Unifier la création de transitions
Solution 2 : Validation côté backend
Phase 2 (important - 0.5 jour) :
Solution 3 : Améliorer la gestion d'erreur
Solution 4 : Débounce
Phase 3 (amélioration - 0.5 jour) :
Solution 5 : Synchronisation
Estimation totale
Temps : 2 jours (14-18h)
Complexité : Moyenne
Risque : Faible (changements isolés, tests possibles)