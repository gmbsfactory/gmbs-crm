# Modifications plain_nom pour les artisans

## Résumé des modifications

Ce document décrit les modifications apportées pour améliorer la recherche d'artisans SST en ajoutant le support du champ `plain_nom`.

## Modifications apportées

### 1. Types TypeScript (`src/lib/api/v2/common/types.ts`)

**Ajout du champ `plain_nom` dans les interfaces :**

- `Artisan` : Ajout de `plain_nom: string | null`
- `CreateArtisanData` : Ajout de `plain_nom?: string`
- `UpdateArtisanData` : Ajout de `plain_nom?: string`

### 2. API des artisans (`src/lib/api/v2/artisansApi.ts`)

**Nouvelle méthode de recherche :**

```typescript
async searchByPlainNom(searchTerm: string, params?: ArtisanQueryParams): Promise<PaginatedResponse<Artisan>>
```

Cette méthode recherche les artisans par correspondance partielle sur le champ `plain_nom` en utilisant `ilike`.

### 3. Data Mapper (`scripts/data-processing/data-mapper.js`)

**Modification de `mapArtisanFromCSV` :**

```javascript
const mapped = {
  // Informations personnelles (selon le schéma artisans)
  prenom: prenom,
  nom: nom,
  plain_nom: nomPrenom, // Sauvegarder la colonne originale "Nom Prénom"
  // ...
};
```

Le champ `plain_nom` est maintenant rempli avec la valeur brute de la colonne "Nom Prénom" du Google Sheets.

### 4. Database Manager (`scripts/imports/database/database-manager-v2.js`)

**Modification de `findArtisanSST` :**

1. **Nouvelle stratégie prioritaire** : Recherche d'abord par `plain_nom` avant les autres méthodes
2. **Mise à jour des statistiques** : Ajout de `plainNom: 0` dans `byMethod`
3. **Amélioration du rapport** : Affichage des résultats par `plain_nom` avec emoji ✨

**Ordre des stratégies de recherche :**

1. ✨ **Recherche par `plain_nom`** (NOUVELLE - PRIORITAIRE)
2. Recherche exacte par nom/prénom/raison sociale
3. Recherche "Prénom Nom"
4. Recherche "Nom Prénom"
5. Recherche par premier mot
6. Recherche par dernier mot
7. Recherche par mot unique
8. Recherche par email (dernier recours)

## Avantages

### 1. **Précision améliorée**
- La recherche par `plain_nom` correspond exactement à la colonne source
- Évite les problèmes de parsing et d'inversion nom/prénom

### 2. **Performance optimisée**
- Recherche directe sur un champ indexé
- Pas besoin de reconstruire le nom complet

### 3. **Traçabilité**
- Conservation de la donnée source originale
- Possibilité de debugger les problèmes de mapping

### 4. **Compatibilité**
- Les anciennes méthodes de recherche restent disponibles
- Fallback automatique si `plain_nom` ne donne pas de résultat

## Utilisation

### Import d'artisans
```bash
# L'import normal inclut maintenant plain_nom
node scripts/imports/google-sheets-import-clean-v2.js --artisans-only --verbose
```

### Recherche d'artisan SST
```javascript
// La fonction findArtisanSST utilise maintenant plain_nom en priorité
const artisanId = await databaseManager.findArtisanSST('Mehdy Pedron 33');
```

### API directe
```javascript
// Nouvelle méthode de recherche
const results = await artisansApi.searchByPlainNom('Mehdy Pedron');
```

## Tests

Un script de test a été créé : `scripts/tests/test-plain-nom.js`

```bash
# Exécuter les tests
node scripts/tests/test-plain-nom.js
```

## Base de données

Le champ `plain_nom` existe déjà dans le schéma (`supabase/migrations/20251005_clean_schema.sql`) :

```sql
plain_nom text,
```

## Impact sur les rapports

Les rapports d'import affichent maintenant :

```
🔍 Répartition par méthode de recherche:
  • ✨ Plain nom: 15
  • Match exact: 8
  • Prénom Nom: 3
  • ...
```

## Migration des données existantes

Pour les artisans déjà importés sans `plain_nom`, il est possible de les mettre à jour :

```sql
UPDATE artisans 
SET plain_nom = CONCAT(prenom, ' ', nom) 
WHERE plain_nom IS NULL 
AND prenom IS NOT NULL 
AND nom IS NOT NULL;
```

## Conclusion

Ces modifications améliorent significativement la précision de la recherche d'artisans SST tout en conservant la compatibilité avec l'existant. La recherche par `plain_nom` devient la méthode prioritaire, ce qui devrait réduire considérablement le nombre d'artisans non trouvés lors des imports d'interventions.
