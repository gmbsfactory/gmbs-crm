# Spec — CRM CSV import/export

> Statut : **Export livré** (commit `4123c8d`) — **Import livré** (feat/hybrid-integration).
> Public : utilisateurs finaux du CRM (gestionnaires, admins agence), pas l'équipe de dev.

---

## 1. Intent

Permettre aux utilisateurs du CRM de **faire un aller-retour de leurs données interventions au format CSV**, dans la forme exacte que le client utilise déjà (Google Sheets / Excel).

Ce mécanisme est distinct du **pipeline d'import Google Sheets** (`docs/import/import-google-sheets.md`), qui est un outil interne lancé par un dev avec la clé service-role pour migrer/refresh la base. Le CRM CSV est :

- **In-app** — exposé dans Settings, soumis aux RLS, exécuté avec les droits de l'utilisateur.
- **User-facing** — UI, validation lisible, pas de credentials, pas de dépendance Google.
- **Symétrique** — même format CSV en entrée et en sortie, donc round-trip sans perte.
- **Interopérable** — partage le module `src/utils/import-export/intervention-csv.ts` avec le script admin `scripts/data/exports/export-interventions-csv.js` pour garantir un format unique.

### Cas d'usage cibles

1. Un gestionnaire veut envoyer une liste d'interventions à un comptable / propriétaire / assureur dans un fichier Excel familier.
2. Un admin agence veut faire une sauvegarde locale du périmètre d'une période.
3. Un client réinjecte un CSV (édité hors-ligne, fourni par un partenaire, exporté d'un autre outil) dans le CRM sans passer par le pipeline Sheets.
4. Migration ponctuelle d'une nouvelle agence depuis un Excel existant, sans intervention dev.

---

## 2. Format CSV (source unique de vérité)

Le format est figé par les attentes du client. Toute évolution doit passer par `src/utils/import-export/intervention-csv.ts`, qui définit l'ordre des colonnes, l'échappement et le format de date.

### Colonnes (ordre figé)

L'ordre et l'orthographe (accents, espaces, ✅) reproduisent **exactement** le fichier Excel maître du client, pour qu'il puisse réinjecter l'export dans son outil interne sans retraitement.

| # | En-tête CSV | Champ DB / dérivation |
|---|---|---|
| 1 | `Date` | `interventions.created_at` formaté `DD/MM/YYYY` |
| 2 | `Agence` | `agencies.label` |
| 3 | `Adresse` | `interventions.adresse` |
| 4 | `ID` | `interventions.id_inter` — fait partie du format client ; sert aussi de clé d'upsert à l'import (cf. §2.1). |
| 5 | `Statut` | `intervention_statuses.label` |
| 6 | `Contexte d'intervention` | `interventions.contexte_intervention` |
| 7 | `Métier` | `metiers.label` |
| 8 | `Gest.` | `users.username` (assigné) |
| 9 | `SST` | `intervention_artisans` (primaire) → `artisans.plain_nom` |
| 10 | `COUT SST` | `intervention_costs` où `cost_type = 'sst'` et artisan = primaire |
| 11 | `COÛT MATERIEL` | `intervention_costs` où `cost_type = 'materiel'` et artisan = primaire |
| 12 | `Numéro SST` | `intervention_artisans` (primaire) → `artisans.telephone` — **pas une colonne sur `interventions`**. À l'export : téléphone de l'artisan primaire. À l'import : ignoré (l'artisan est résolu par nom via la colonne `SST`). |
| 13 | `COUT INTER` | `intervention_costs` où `cost_type = 'intervention'` |
| 14 | `% SST` | **Calculé** — marge de l'artisan principal, identique au modal d'intervention : `((COUT INTER − (COUT SST + COUT SST 2 + COÛT MATERIEL + COÛT MATERIEL 2)) / COUT INTER) × 100`, arrondi à 1 décimale. Vide si `COUT INTER ≤ 0`. N'utilise plus `interventions.pourcentage_sst` (champ non alimenté). À l'import : ignoré (warning si hors plage [0, 100]). |
| 15 | `PROPRIO` | `owner.owner_firstname` + `owner.owner_lastname` |
| 16 | `Date d'intervention` | `interventions.date_prevue` formaté `DD/MM/YYYY` |
| 17 | `TEL LOC` | `tenants.telephone` |
| 18 | `Locataire` | `tenants.firstname` + `tenants.lastname` |
| 19 | `Em@il Locataire` | `tenants.email` |
| 20 | `COMMENTAIRE` | Commentaires internes agrégés `[DD/MM/YYYY] contenu` séparés par ` || ` (ordre desc). Vide si aucun commentaire interne. |
| 21 | `Truspilot` | *rien* — toujours vide à l'export (décidé §8.6 : pas de champ DB équivalent, colonne réservée au client). |
| 22 | `Demande d'intervention ✅` | *rien* — toujours vide à l'export (cf. §8.6). |
| 23 | `Demande Devis  ✅` | *rien* — toujours vide à l'export (cf. §8.6). **NB : double espace avant `✅` conservé tel quel — c'est le format client.** |
| 24 | `Demande TrustPilot  ✅` | *rien* — toujours vide à l'export (cf. §8.6). **NB : double espace avant `✅` conservé.** |

#### Colonnes additionnelles — mode étendu uniquement (positions 25-27)

| # | En-tête CSV | Champ DB / dérivation |
|---|---|---|
| 25 | `SST 2` | `intervention_artisans` (secondaire, position 2) → `artisans.plain_nom`. Si une intervention a plus de 2 artisans (cas anormal), les suivants sont ignorés silencieusement — même comportement à l'import. |
| 26 | `COUT SST 2` | `intervention_costs` où `cost_type = 'sst'` et artisan = secondaire |
| 27 | `COÛT MATERIEL 2` | `intervention_costs` où `cost_type = 'materiel'` et artisan = secondaire |

> **Évolutions par rapport à la première version livrée de l'export** : `Technicien` renommé `SST`, ajout des colonnes vides `Truspilot` / `Demande *`. `ID`, `Statut`, `Gest.` et `COMMENTAIRE` font désormais partie du gabarit client (le client les a réintégrés à son Excel — `COMMENTAIRE` en position #20, entre `Em@il Locataire` et `Truspilot`). Les colonnes `SST 2` / `COUT SST 2` / `COÛT MATERIEL 2` sont désormais réservées au mode étendu (cf. §2.1).

### 2.1 Conséquences sur l'import / round-trip

`ID` (= `interventions.id_inter`) faisant désormais partie du format client (position #4), il sert directement de clé d'upsert à l'import. Une cellule `ID` vide bascule la ligne en mode création stricte.

**Mode export étendu** (cf. §8.7, validé) — case à cocher UI « Inclure le deuxième artisan » qui ajoute en **positions #25-27** les colonnes `SST 2`, `COUT SST 2`, `COÛT MATERIEL 2`. Désactivé par défaut : la majorité des interventions n'ont qu'un seul artisan, et les colonnes additionnelles cassent le gabarit du client si présentes inutilement. À activer pour la sauvegarde admin ou les échanges entre instances CRM.

### Conventions de fichier

- **Encodage** : UTF-8 avec BOM (`﻿`) — requis pour Excel.
- **Séparateur** : virgule `,`.
- **Échappement** : valeurs contenant `"`, `,`, `\n` ou `\r` entourées de `"…"` avec `"` doublés.
- **Format date** : `DD/MM/YYYY` (jamais d'ISO côté CSV).
- **Cellules vides** : chaîne vide (jamais `null`, `NULL`, `N/A`).
- **Nom du fichier export** : `Export_Interventions_YYYY-MM-DD.csv` (date locale utilisateur).

---

## 3. Export — état actuel (livré)

### Entrée UI

`src/features/settings/ExportInterventionsCard.tsx` dans la page Settings :

- Carte dépliable « Exporter mes interventions ».
- `DateRangePicker` (start/end optionnels — vide = toutes les interventions).
- Avertissement visuel si la plage > 365 jours.
- Bouton qui télécharge un blob CSV.

### Endpoint

`GET /api/exports/interventions?start=YYYY-MM-DD&end=YYYY-MM-DD`

- Auth obligatoire (Supabase SSR client).
- RLS appliquées — l'utilisateur n'exporte que ce qu'il peut lire.
- Filtre sur `created_at` (la borne `end` est inclusive du jour).
- Récupère interventions + relations en une requête, puis batch :
  - artisans (via `intervention_artisans`, primaire puis secondaire — colonnes `SST` / `SST 2`, ce dernier en mode étendu uniquement),
  - coûts (via `intervention_costs`, ventilés par artisan pour `COUT SST` / `COÛT MATERIEL` toujours, et `COUT SST 2` / `COÛT MATERIEL 2` en mode étendu),
  - commentaires internes (toujours inclus — colonne `COMMENTAIRE` en position #20 du format de base).
- Retourne `text/csv; charset=utf-8` avec BOM, `Content-Disposition: attachment`.

### Garanties

- Format identique au script admin `scripts/data/exports/export-interventions-csv.js` (tous deux passent par `convertToCSV`).
- Une intervention sans coûts/commentaires/artisan exporte des cellules vides (jamais d'erreur).

---

## 4. Import — à concevoir

> ⚠ Non implémenté à ce jour. Cette section est la spec proposée à valider avant développement.

### 4.1 UX cible

Une carte symétrique « Importer des interventions » dans Settings, à côté de l'export :

1. **Upload** — drop-zone + bouton, `.csv` uniquement, taille max 10 Mo (≈ 50 000 lignes).
2. **Prévisualisation** — table des 20 premières lignes après parsing, avec mapping des colonnes détectées.
3. **Validation** — rapport pré-import : `N lignes valides`, `M erreurs`, listées avec le numéro de ligne CSV et la raison.
4. **Choix du mode** :
   - `Créer uniquement` : ignorer les lignes dont `ID` existe déjà.
   - `Mettre à jour uniquement` : ignorer les lignes dont `ID` n'existe pas.
   - `Upsert` : créer ou mettre à jour (clé = `id_inter`).
5. **Confirmation** — récap avant écriture, bouton « Importer ».
6. **Rapport post-import** — `X créées, Y mises à jour, Z ignorées, W en erreur`, téléchargeable en CSV.

> **Inspection ligne par ligne (ordre canonique).** Dans la modale d'aperçu d'un
> bucket, chaque ligne dépliée affiche côte à côte « CSV brut » et « Mapping base
> de données ». Les deux colonnes sont triées selon une **séquence canonique
> unique** (`src/utils/import-export/preview-field-order.ts`) de sorte que la
> ligne N de gauche corresponde à la ligne N de droite (`ID → id_inter`,
> `Agence → agence`, `Adresse → adresse`, `Date → date`, `Métier → metier`,
> `Statut → statut`, `Gest. → gestionnaire`, …). Les colonnes locataire
> (`Locataire` + `TEL LOC` + `Em@il Locataire`) sont regroupées face à l'objet
> `locataire`. Les colonnes CSV sans pendant en base (`Numéro SST`, `% SST`,
> `COMMENTAIRE`, `Truspilot`…) tombent en queue, dans leur ordre d'origine. Ce
> même ordre s'applique aux diffs (`update`) et aux cartes de conflit. Toute
> évolution du mapping doit être répercutée dans `CSV_DB_PAIRS`.

### 4.2 Endpoint

`POST /api/imports/interventions`

- Auth obligatoire, RLS-bound.
- Multipart : `file` (CSV) + `mode` (par défaut `upsert`, cf. §8.1) + `dry_run` (bool).
- Si `dry_run=true` : valide et retourne le rapport sans écrire.
- Réponse : `{ inserted, updated, skipped, errors: [{line, id_inter, reason}] }`.
- **Permission** (cf. §8.3) : `interventions.import` (et symétriquement `interventions.export` côté export), gérée via le système existant `src/hooks/usePermissions.ts` + table `permissions`. Assignée par défaut au rôle admin agence uniquement. La carte UI et l'endpoint sont gatés sur cette permission.

### 4.3 Parsing & mapping

#### Stratégie de réutilisation

La logique de parsing/mapping existe déjà dans les scripts d'import Google Sheets. Elle est réutilisée selon deux couches distinctes :

**Parseurs purs** (`scripts/data-processing/parsers/`) → portés en TypeScript dans `src/utils/import-export/parsers/`

Ces fonctions n'ont aucune dépendance infrastructure (pas de DB, pas de Supabase). Elles sont portées telles quelles :

| Fichier source | Fonctions réutilisées |
|---|---|
| `csv-parser.js` | `cleanCSVKeys`, `getCSVValue`, `getStatutValue`, `isValidRow` |
| `date-number-parser.js` | `parseDate`, `parseNumber` |
| `person-parser.js` | `parseTenantInfo`, `parseOwnerInfo` |
| `cost-extractor.js` | `extractCostsData` |
| `address-parser.js` | `extractInterventionAddress`, `extractInterventionId` |
| `string-cleaner.js` | `cleanString`, `truncateString` |

**Mapper** (`scripts/data-processing/mappers/intervention-mapper.js`) → porté en TypeScript à `src/utils/import-export/intervention-mapper.ts`

Le mapper prend des dépendances injectées (`enumResolver`, `entityFinder`, `errorLogger`). Dans le contexte web, ces interfaces sont satisfaites par des adaptateurs qui s'appuient sur `src/lib/api/` (RLS-bound, client SSR utilisateur) au lieu du client service-role du script. La logique de mapping elle-même ne change pas.

```
scripts/data-processing/                  →  src/utils/import-export/
  parsers/*.js          (purs)                 parsers/*.ts              (port direct)
  mappers/intervention-mapper.js               intervention-mapper.ts    (port + injection web)
                                               enum-resolver.ts          (adaptateur → src/lib/api/)
```

> ⚠️ Ne pas importer les scripts directement dans les routes API : la frontière CommonJS/ESM et l'usage du client service-role les rendent incompatibles avec le contexte web.

#### Contrat des interfaces injectées

```typescript
interface EnumResolver {
  getMetierId(label: string): Promise<string | null>
  getAgencyId(label: string): Promise<string | null>
  getInterventionStatusId(label: string): Promise<string | null>
  getUserId(username: string): Promise<string | null>
}

interface EntityFinder {
  findArtisanByName(plainNom: string): Promise<string | null>
}
```

#### Autres points

- `parseCSV(content: string): Record<string, string>[]` — parsing brut (BOM retiré, séparateur `,`, RFC 4180). Pas de dépendance papaparse — `csv-parser.js` porté suffit.
- `CSV_HEADERS_REQUIRED` — sous-ensemble minimal pour qu'une ligne soit insérable (`ID`, `Date`, `Statut`, `Métier`, `Adresse d'intervention`).
- Tolérance : en-têtes case-insensitive, accents tolérés (`COÛT MATERIEL` ≡ `COUT MATERIEL`), espaces de bord trimés.
- Refus : colonne inconnue → erreur claire (pas de drop silencieux).

### 4.4 Validation par ligne

| Champ | Règle |
|---|---|
| `ID` (`id_inter`) | Clé d'upsert (cf. §2.1). Si présente : non vide, unique dans le fichier, format conforme. Si absente : ligne traitée en création stricte (refus si `id_inter` généré entre en collision avec un existant). |
| Référentiels (`Métier`, `Agence`) | Doivent matcher un `metiers.label` / `agencies.label` accessible. **Inconnu → ligne skippée et remontée dans le rapport** (refus strict, cf. §8.4 : pas d'auto-création). |
| `Date` | `DD/MM/YYYY`, parse strict. Refus si invalide. |
| `Métier` | Doit matcher un `metiers.label`. Refus sinon. |
| `Agence` | Doit matcher une agence accessible à l'utilisateur. Refus sinon. |
| `Date d'intervention` | `DD/MM/YYYY` ou vide. |
| `% SST` | Numérique 0–100 ou vide. |
| `COUT *` (incl. `COUT SST 2`, `COÛT MATERIEL 2`) | Numérique ≥ 0 ou vide. Limite haute (ex : 100 000 €) → warning mais accepté. |
| `SST` / `SST 2` | Lookup `artisans.plain_nom` (insensible à la casse, accents tolérés). Inconnu → warning, intervention créée sans rattachement. `SST 2` non vide alors que `SST` est vide → erreur ligne. |
| `Em@il Locataire` | Format email valide ou vide. |
| `TEL LOC` | Normalisation FR : `0X XX XX XX XX`, `+33…` et 10 chiffres bruts reconnus. **Récupération Excel** : un numéro de 9 chiffres commençant par `[1-9]` se voit restituer le `0` de tête (Excel ampute parfois le zéro). Une valeur non standard (ex. tronquée `056777`, ≥ 4 chiffres) est **conservée telle quelle** plutôt que perdue — cohérent avec le reste du CRM qui n'impose aucun format. |
| `Truspilot`, `Demande d'intervention ✅`, `Demande Devis  ✅`, `Demande TrustPilot  ✅` | Tant que les champs DB ne sont pas définis (cf. §2 et §8.6) : valeur ignorée à l'import (lue mais non écrite), warning soft « colonne pas encore mappée ». |

Toute erreur est non-bloquante au niveau du fichier : on continue, on rapporte ligne par ligne.

### 4.5 Écriture

- Une transaction par batch (≤ 500 lignes) pour ne pas bloquer.
- Ordre : `interventions` → `intervention_costs` → `intervention_artisans`.
- **`intervention_costs`** : delete + reinsert complet par intervention (intentionnel — les coûts saisis dans le CRM après export sont écrasés, c'est le comportement voulu). Ventilation par artisan primaire/secondaire pour `COUT SST` vs `COUT SST 2` et `COÛT MATERIEL` vs `COÛT MATERIEL 2`.
- **`intervention_artisans`** : lookup `plain_nom` pour `SST` puis `SST 2`, position 1/2. Inconnu → warning, intervention créée sans artisan. Plus de 2 artisans en DB → les suivants sont ignorés silencieusement à l'export (et non représentés dans le CSV importé).
- `created_at` issu de la colonne `Date` (pour respecter le tri UI, comme l'import Sheets).
- Audit : chaque insert/update logué dans `audit_log` avec `source = 'csv_import'` + `user_id`.

### 4.6 Cas-limites & garde-fous

- **CSV vide / sans en-têtes** → erreur avant tout traitement.
- **Doublons sur la clé d'upsert dans le fichier** → erreur, on refuse le fichier entier (pas d'ambigüité possible).
- **Clé d'upsert existe en DB mais pas accessible (RLS)** → erreur ligne « non autorisé ».
- **Locataire/propriétaire/artisan inconnus** → warning, intervention créée sans rattachement plutôt que refusée (le user complétera dans l'UI).
- **Plus de 50 000 lignes** → refus avec message explicatif (utiliser le pipeline Sheets ou contacter le support).

---

## 5. Tests

| Niveau | Cible | Fichier |
|---|---|---|
| Unit | `convertToCSV`, `escapeCSV`, `formatDate`, `getCostByType` | `tests/unit/utils/import-export/intervention-csv.test.ts` (existe) |
| Unit | `parseCSV`, validations par ligne, parsing commentaires | à créer dans le même dossier |
| Integration | `GET /api/exports/interventions` (auth, RLS, plage) | à créer |
| Integration | `POST /api/imports/interventions` (modes, dry-run, erreurs) | à créer |
| E2E | Settings → Export → fichier téléchargé conforme | `tests/e2e/settings/export-interventions-csv.playwright.ts` (existe) |
| E2E | Settings → Import → preview → confirm → rapport | à créer |
| Round-trip | Export N interventions → import du même fichier en mode upsert → 0 changement effectif | à créer (test d'intégration) |

Le test round-trip est la garantie principale que les deux côtés respectent le même format.

---

## 6. Hors-périmètre

- Import/export d'**artisans** ou de **clients** — autre spec si le besoin se confirme.
- Format Excel `.xlsx` natif — on reste sur CSV (Excel l'ouvre nativement avec le BOM).
- Synchronisation continue avec un Sheet — ce serait un connecteur, pas un import CSV.
- Édition assistée du CSV dans l'UI — le user édite hors-ligne.

---

## 7. Fichiers concernés

| Rôle | Chemin |
|---|---|
| Source unique du format CSV | `src/utils/import-export/intervention-csv.ts` |
| Endpoint export | `app/api/exports/interventions/route.ts` |
| UI export | `src/features/settings/ExportInterventionsCard.tsx` |
| Script admin export | `scripts/data/exports/export-interventions-csv.js` |
| Endpoint import | `app/api/imports/interventions/route.ts` *(à créer)* |
| UI import | `src/features/settings/ImportInterventionsCard.tsx` *(à créer)* |
| Tests | `tests/unit/utils/import-export/`, `tests/e2e/settings/` |

---

## 8. Journal des décisions

| # | Sujet | Décision |
|---|---|---|
| 1 | Mode import par défaut | `upsert` |
| 2 | Volume max | 10 Mo / 50 000 lignes |
| 3 | Permission import | `interventions.import` — admin agence uniquement, via le système `usePermissions` + table `permissions` existant |
| 4 | Référentiel inconnu (métier, agence) | Refus strict : ligne skippée + remontée dans le rapport d'erreurs |
| 5 | Clé d'upsert | Colonne `ID` (= `id_inter`) en position #4 du gabarit client ; absente → création stricte |
| 6 | Colonnes client sans équivalent DB (`Truspilot`, `Demande *`) | Vides à l'export, ignorées à l'import (warning soft) — pas de champ DB créé |
| 7 | Mode export étendu | Validé — case « Inclure le deuxième artisan » ajoute `SST 2`, `COUT SST 2`, `COÛT MATERIEL 2` en fin de fichier (positions #25-27). `COMMENTAIRE` est désormais dans le format de base (position #20) — le client l'a réintégré à son gabarit. |
| 8 | Plus de 2 artisans par intervention | Troncature silencieuse à 2 (import et export) |
| 9 | Update coûts en mode upsert | Delete + reinsert complet — comportement intentionnel (les coûts du CSV priment) |
