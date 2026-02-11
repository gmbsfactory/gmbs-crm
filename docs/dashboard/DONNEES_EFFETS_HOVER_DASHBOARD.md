# Données des Effets Hover - Dashboard

Ce document explique les données présentées dans les effets hover (tooltips) de la page Dashboard, spécifiquement pour les sections **Mes Interventions** et **Mes Artisans**.

## Table des matières

1. [Mes Interventions](#mes-interventions)
2. [Mes Artisans](#mes-artisans)

---

## Mes Interventions

### Localisation
Les effets hover apparaissent lorsque l'utilisateur survole les segments du graphique dans la section "Mes Interventions".

### Données affichées

#### En-tête
- **Statut** : Le label du statut survolé (ex: "Demandé", "Inter en cours", "Visite technique", "Accepté", "Check")

#### Liste des interventions (maximum 5)
Pour chaque intervention, les informations suivantes sont affichées :

1. **Point coloré** : Un indicateur visuel rond de 2x2 pixels affichant la couleur du statut de l'intervention

2. **ID Intervention** : 
   - Format : `id_inter` (ex: "INT-2024-001")
   - Affiché en gras, tronqué si trop long
   - Cliquable : ouvre la modal de détails de l'intervention

3. **Informations détaillées** (ligne en petit texte) :
   
   **Pour le statut "Demandé"** :
   - **Métier** : Label du métier avec couleur spécifique au métier
   - **Agence** : Label de l'agence
   - **Due date** : Date d'échéance formatée en français (ex: "15 nov. 2024")
   
   **Pour tous les autres statuts** :
   - **Métier** : Label du métier avec couleur spécifique au métier
   - **Marge** : Montant formaté en euros (ex: "1 234,56 €")
   - **Due date** : Date d'échéance formatée en français (ex: "15 nov. 2024")

### Données récupérées depuis l'API

Les données suivantes sont récupérées pour chaque intervention :

- **Identifiants** : `id`, `id_inter`
- **Dates** : `due_date`, `date_prevue`, `date`
- **Relations** :
  - `status` : `id`, `code`, `label`, `color`
  - `agence` : `id`, `label`, `code`
  - `metier` : `id`, `label`, `code`
- **Coûts** : `intervention_costs` avec `cost_type` et `amount` (pour calculer la marge)

### Tri des données

Les interventions sont triées dans l'ordre suivant :

1. **Tri principal** : Par `due_date` décroissant (les plus récentes en premier)
   - Les interventions sans `due_date` sont placées en dernier (`nullsFirst: false`)
2. **Tri secondaire** : Par `date` décroissant (si `due_date` est identique ou null)
3. **Tri final côté client** : Après filtrage par statut, tri supplémentaire par `due_date` décroissant
4. **Limitation** : Seules les 5 premières interventions sont conservées

**Note** : Pour le statut spécial "Check", les interventions sont filtrées par `date_prevue` passée (date antérieure à maintenant).

### Comportement
- **Cache** : Les données sont mises en cache pendant 2 minutes pour optimiser les performances
- **Filtrage** : Les interventions sont filtrées par :
  - Statut survolé (filtrage côté client après récupération)
  - Utilisateur connecté (gestionnaire) : `assigned_user_id`
  - Période sélectionnée (si applicable) : `date` entre `startDate` et `endDate`
  - Interventions actives uniquement : `is_active = true`
- **Limite** : Maximum 5 interventions affichées par statut
- **Interactivité** : 
  - Clic sur une intervention → Ouvre la modal de détails
  - Scroll vertical si plus de 5 interventions

### Cas spéciaux
- **Aucune intervention** : Affiche "Aucune intervention pour ce statut"
- **Chargement** : Affiche un loader pendant le chargement des données
- **Erreur** : Affiche "Erreur de chargement" en cas d'échec

---

## Mes Artisans

### Localisation
Les effets hover apparaissent lorsque l'utilisateur survole les lignes de statut dans la liste "Mes Artisans".

### Données affichées pour les statuts

#### En-tête
- **Statut** : Le label du statut survolé (ex: "Actif", "En attente", etc.)

#### Liste des artisans
Pour chaque artisan, les informations suivantes sont affichées :

1. **Nom de l'artisan** :
   - Format : `{prénom} {nom}` (ex: "Jean Dupont")
   - Affiché en gras, taille moyenne
   - Cliquable : ouvre la modal de détails de l'artisan
   - Style : Souligné et change de couleur au survol

2. **Interventions récentes** (si disponibles) :
   
   Pour chaque intervention récente :
   - **Point coloré** : Un indicateur visuel rond de 2x2 pixels (couleur primaire)
   - **ID Intervention** : 
     - Format : `id_inter` (ex: "INT-2024-001")
     - Affiché en gras, tronqué si trop long
     - Cliquable : ouvre la modal de détails de l'intervention
   - **Informations détaillées** (ligne en petit texte) :
     - **Métier** : Label du métier avec couleur spécifique au métier (en gras)
     - **Marge** : Montant formaté en euros (ex: "1 234,56 €", en gras)
     - **Date** : Date formatée en français DD/MM/YYYY (ex: "15/11/2024", en gras)
   
   **Si aucune intervention récente** :
   - Affiche "Aucune intervention récente" en petit texte gris

### Données récupérées depuis l'API (pour les statuts)

#### Pour les artisans
Les données suivantes sont récupérées pour chaque artisan :

- **Identifiants** : `id`, `nom`, `prenom`
- **Date** : `created_at`
- **Relations** :
  - `status` : `id`, `code`, `label`

#### Pour les interventions de chaque artisan
Les données suivantes sont récupérées pour chaque intervention :

- **Identifiants** : `id`, `id_inter`
- **Dates** : `date`, `due_date`
- **Relations** :
  - `status` : `id`, `code`, `label`, `color`
  - `metier` : `id`, `label`, `code`
- **Coûts** : `intervention_costs` avec `cost_type` et `amount` (pour calculer la marge)

### Tri des données (pour les statuts)

#### Tri des artisans
1. **Tri principal** : Par `created_at` décroissant (les artisans les plus récemment créés en premier)
2. **Filtrage** : Par statut label (filtrage côté client)
3. **Limitation** : Seuls les 3 premiers artisans (`maxArtisans = 3`) sont conservés
4. **Filtrage final** : Seuls les artisans ayant au moins une intervention sont affichés

#### Tri des interventions par artisan
1. **Tri principal** : Par `date` décroissant (les interventions les plus récentes en premier)
2. **Limitation** : Seules les 3 premières interventions (`maxInterventions = 3`) sont conservées par artisan

### Données affichées pour "Dossiers à compléter"

#### En-tête
- **Titre** : "Dossiers à compléter"

#### Liste des artisans
Pour chaque artisan avec dossier incomplet :

1. **Point coloré** : Un indicateur visuel rond de 2x2 pixels (couleur ambre/orange)
2. **Nom de l'artisan** :
   - Format : `{prénom} {nom}` (ex: "Jean Dupont")
   - Affiché en gras
   - Cliquable : ouvre la modal de détails de l'artisan

### Données récupérées depuis l'API (pour "Dossiers à compléter")

Les données suivantes sont récupérées pour chaque artisan :

- **Identifiants** : `id`, `nom`, `prenom`
- **Statut** : `statut_id` (avec jointure sur `artisan_statuses` pour vérifier que le code n'est pas "ARCHIVE")

### Filtrage (pour "Dossiers à compléter")

Les artisans sont filtrés par :
- **Gestionnaire** : `gestionnaire_id` = utilisateur connecté
- **Statut dossier** : `statut_dossier = "À compléter"`
- **Statut actif** : `is_active = true`
- **Non archivé** : `artisan_statuses.code != "ARCHIVE"`

### Tri des données (pour "Dossiers à compléter")

Aucun tri spécifique n'est appliqué. Les artisans sont retournés dans l'ordre de la base de données.

### Comportement
- **Préchargement** : Toutes les données hover sont préchargées après le chargement initial des statistiques pour une meilleure performance
- **Filtrage** : Les artisans sont filtrés par :
  - Statut survolé (filtrage côté client par `status.label`)
  - Utilisateur connecté (gestionnaire) : `gestionnaire_id`
  - Interventions actives uniquement : `is_active = true`
  - Période sélectionnée (si applicable) : `date` entre `startDate` et `endDate` (filtrage côté client)
- **Interactivité** : 
  - Clic sur un artisan → Ouvre la modal de détails de l'artisan
  - Clic sur une intervention → Ouvre la modal de détails de l'intervention
  - Scroll vertical si beaucoup d'artisans/interventions

### Cas spéciaux
- **Aucun artisan** : Affiche "Aucun artisan avec interventions pour ce statut"
- **Chargement** : Affiche un loader pendant le chargement des données
- **Erreur** : Affiche un message d'erreur en cas d'échec

---

## Formatage des données

### Dates
- Format français : `DD MMM YYYY` (ex: "15 nov. 2024") pour les interventions
- Format français : `DD/MM/YYYY` (ex: "15/11/2024") pour les artisans
- Valeur par défaut : "N/A" si la date est absente ou invalide

### Devises
- Format : `X XXX,XX €` (ex: "1 234,56 €")
- Formatage : Utilise `Intl.NumberFormat` avec locale "fr-FR"
- Valeur par défaut : "0,00 €" si le montant est null ou undefined

### Couleurs
- **Statuts** : Couleurs définies dans la base de données ou via la configuration
- **Métiers** : Couleurs spécifiques par métier via `getMetierColor()`
- **Indicateurs** : Points colorés pour identifier visuellement les éléments

---

## Notes techniques

### Performance
- Les données hover sont mises en cache pour éviter les requêtes répétées
- Préchargement des données pour les artisans pour une meilleure réactivité
- Limitation à 5 interventions récentes par statut pour les interventions

### API utilisée
- **Interventions** : `interventionsApi.getRecentInterventionsByStatusAndUser()`
- **Artisans** : `artisansApi.getArtisansByStatusWithRecentInterventions()`
- **Dossiers à compléter** : `artisansApi.getArtisansWithDossiersACompleter()`

### Composants React
- **Interventions** : `InterventionStatusContent` dans `intervention-stats-piechart.tsx`
- **Artisans** : `ArtisanStatusContent` et `DossiersACompleterContent` dans `artisan-stats-list.tsx`
