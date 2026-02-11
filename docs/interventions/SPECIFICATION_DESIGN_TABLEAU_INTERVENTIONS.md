# Spécification Design - Tableau des Interventions

## Vue d'ensemble
Le tableau des interventions est un composant principal de l'application CRM GMBS qui affiche une liste paginée et filtrable des interventions avec des lignes extensibles pour afficher les détails.

## Structure du Tableau

### En-têtes des Colonnes (14 colonnes)

| Position | Nom de la Colonne | Largeur | Type de Filtre | Triable |
|----------|-------------------|---------|----------------|---------|
| 1 | **#** | 50px | - | Non |
| 2 | **Date** | 70px | Date picker | Oui |
| 3 | **Agence** | 80px | Dropdown (20 options) | Oui |
| 4 | **Attribué à** | 80px | Dropdown (Utilisateurs + "Non attribué") | Oui |
| 5 | **ID** | 70px | Champ texte | Oui |
| 6 | **Métier** | 80px | Dropdown (16 types) | Oui |
| 7 | **Code postal + Ville** | 100px | Champ texte | Oui |
| 8 | **Artisan select** | 85px | Champ texte | Oui |
| 9 | **Prix** | 65px | Champ texte | Oui |
| 10 | **Date prévu** | 110px | Date picker | Oui |
| 11 | **Statut** | 70px | Dropdown multi-sélection | Oui |
| 12 | **Sous-statut** | 100px | - | Non |
| 13 | **Actions** | 60px | - | Non |
| 14 | **🔔** | 17px | - | Oui (dépassement) |

### Options de Filtres par Colonne

#### Agence (Dropdown)
- Toutes
- Flatlooker, HomePilot, Agence Blue, ImoDirect, GererSeul
- Beanstock, Particulier, Site GMBS, Century21, SAV
- AFEDIM, Oqoro, Cabinet grainville, Gesty, ZeRent
- Allianz, Atrium gestion, Homeassur, Remi

#### Métier (Dropdown)
- Tous
- Vitrerie, Chauffage, Electroménager, Plomberie, Renovation
- Ménage, Electricite, Serrurerie, Bricolage, Volet/Store
- Nuisible, Climatisation, Peinture, RDF, Jardinage, Camion

#### Statut (Multi-sélection)
- Demandé, Devis Envoyé, Accepté, En cours, Annulé
- Terminé, Visite Technique, Refusé, STAND BY, SAV

## Design Visuel

### Couleurs et Styles

#### Statuts (Badges colorés)
- **Demandé** : Bleu (#0953a8)
- **Devis Envoyé** : Jaune (#fcbc00)
- **Accepté** : Cyan (#02ffff) - texte noir
- **En cours** : Jaune vif (#ffff00) - texte noir
- **Annulé** : Rouge (#ff0000)
- **Terminé** : Vert (#02ff00)
- **Visite Technique** : Bleu clair (#a0c5e8)
- **Refusé** : Rouge foncé (#b10202)
- **STAND BY** : Gris
- **SAV** : Violet (#a64d78)

#### Types de Métier (Badges colorés)
- **Renovation** : Gris clair (#e8eaed)
- **Ménage** : Magenta (#fe40ff)
- **Vitrerie** : Vert (#008f51)
- **Climatisation** : Bleu (#0096ff)
- **Chauffage** : Rouge (#f44336)
- **Plomberie** : Bleu clair (#2097f2)
- **Serrurerie** : Marron (#785449)
- **Electricite** : Jaune (#fed604)
- **Bricolage** : Gris (#d5d5d5)
- **Volet/Store** : Orange (#935201)
- **Nuisible** : Vert foncé (#028f51)
- **Electroménager** : Violet (#9436ff)
- **Peinture** : Gris clair (#e9eaee)
- **RDF** : Bleu clair (#bee1f4)
- **Jardinage** : Vert clair (#d2edc0)
- **Camion** : Violet foncé (#5a3385)

#### Statuts Artisan (Badges colorés)
- **Expert** : Bleu (#0a53a8)
- **Confirmé** : Vert (#0aac14)
- **Formation** : Orange (#ff9300)
- **Novice** : Jaune clair (#ffe5a0)
- **Potentiel/Candidat** : Bleu clair (#bfe1f6)
- **Oneshot** : Gris (#e6e6e6)
- **Archivé** : Gris clair (#e0e0e0)

### Lignes du Tableau
- **Lignes paires** : Fond blanc
- **Lignes impaires** : Fond gris clair (rgba(0, 0, 0, 0.05))
- **Hauteur** : 35px
- **Police** : 9px pour le contenu, 11px pour les en-têtes
- **Alternance** : Visuelle avec transition de 0.3s

## Comportement des Lignes Extensibles

### Déclenchement
- **Clic sur une ligne** : Ouvre/ferme les détails
- **Animation** : SlideToggle avec transition de 300ms
- **État** : Une seule ligne peut être ouverte à la fois

### Contenu de la Ligne Étendue

#### Structure en 3 Colonnes

**Colonne 1 - Informations Générales**
- **Contexte** : `intervention.contexteIntervention`
- **Consigne** : `intervention.consigneIntervention`
- **Coût Artisan** : `intervention.coutSST` €

**Colonne 2 - Informations Client**
- **Adresse** : `intervention.adresse`, `intervention.ville`, `intervention.codePostal`
- **Prénom Nom Client** : `intervention.prenomClient` `intervention.nomClient`
- **Téléphone** : `intervention.telephoneClient` | `intervention.telephone2Client`

**Colonne 3 - Commentaires et Actions**
- **Historique des commentaires** (scrollable, max-height: 150px)
  - Format : `(dd/MM/yyyy HH:mm) Utilisateur : Commentaire`
  - Tri : Plus récent en premier
- **Zone d'ajout de commentaire**
  - Champ texte : "Ajouter un commentaire..."
  - Bouton : Icône avion (fas fa-paper-plane)

### Styles de la Ligne Étendue
- **Fond** : Bleu clair (#eff7ff)
- **Padding** : 10px
- **Bordure** : Aucune
- **Largeur** : 100% (colspan="14")

## Fonctionnalités Interactives

### Actions par Ligne
- **Voir** : Bouton bleu clair avec icône œil
- **Modifier** : Bouton jaune avec icône crayon
- **Supprimer** : Bouton rouge avec icône poubelle (si autorisé)

### Indicateurs Visuels
- **Cloche rouge** : Date prévue dépassée
- **Texte "Check !"** : Alerte de dépassement
- **Tooltip** : Sur le nom de l'artisan (raison sociale complète)

### Filtres et Recherche
- **Recherche générale** : Champ en haut à droite (250px de large)
- **Filtres par colonne** : Champs intégrés dans l'en-tête
- **Tri** : Icônes de tri sur les colonnes triables
- **Pagination virtuelle** : Scroll infini avec chargement par lots

## Responsive et Performance

### Virtual Scrolling
- **Hauteur viewport** : calc(100vh - 280px)
- **Taille d'élément** : 35px
- **Chargement** : 500 éléments par page
- **Buffer** : 400 éléments avant la fin

### Largeurs Fixes
- **Table-layout** : Fixed
- **Colonnes** : Largeurs définies en pixels
- **Overflow** : Ellipsis avec hover pour affichage complet

## Animations et Transitions

### SlideToggle Animation
```css
@keyframes slideToggle {
  from: { height: 0px, opacity: 0 }
  to: { height: auto, opacity: 1 }
}
```

### Transitions CSS
- **Lignes** : background-color 0.3s ease
- **Boutons** : hover effects
- **Menu contextuel** : fadeInScale 0.2s

## États et Permissions

### Permissions
- **Suppression** : Rôle 'suppression' requis
- **Comptabilité** : Rôle 'comptabilite-intervention' requis

### États des Données
- **Valeurs vides** : Affichage de chaînes vides
- **N/A** : Remplacement des valeurs undefined
- **Couleurs attribuées** : Basées sur les utilisateurs

## Menu Contextuel
- **Déclenchement** : Clic droit sur une ligne
- **Position** : Fixed avec z-index 1000
- **Animation** : fadeIn 150ms
- **Style** : Fond blanc, ombre, coins arrondis
- **Actions** : Boutons avec hover effects

Cette spécification couvre tous les aspects visuels et fonctionnels du tableau des interventions pour permettre une reproduction fidèle du design.
