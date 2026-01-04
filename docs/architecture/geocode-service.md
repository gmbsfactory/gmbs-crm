# Architecture du Service de Géocodage

## Vue d'ensemble

Le service de géocodage utilise le **Strategy Pattern** pour permettre l'utilisation de différents providers de géocodage de manière interchangeable et configurable.

## Structure des fichiers

```
src/lib/geocode/
├── index.ts                    # Exports publics
├── types.ts                    # Types et interfaces
├── geocode-service.ts          # Service orchestrateur
├── providers/
│   ├── index.ts                # Export des providers
│   ├── base-provider.ts        # Classe abstraite commune
│   ├── french-address.ts       # API Adresse France (BAN) - GRATUIT
│   ├── opencage.ts             # OpenCage Data
│   └── nominatim.ts            # Nominatim (OpenStreetMap)
└── utils/
    ├── index.ts                # Export des utilitaires
    ├── normalize.ts            # Normalisation des requêtes
    └── france-bounds.ts        # Vérification géographique France
```

## Diagramme de classes

```
                    ┌─────────────────────────────┐
                    │    GeocodeProvider          │
                    │    <<interface>>            │
                    ├─────────────────────────────┤
                    │ + name: string              │
                    │ + priority: number          │
                    │ + isAvailable(): boolean    │
                    │ + geocode(): Promise<...>   │
                    └──────────────┬──────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
           ▼                       ▼                       ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ FrenchAddressProvider│ │  OpenCageProvider   │ │  NominatimProvider  │
├─────────────────────┤ ├─────────────────────┤ ├─────────────────────┤
│ priority: 0         │ │ priority: 10        │ │ priority: 20        │
│ (France uniquement) │ │ (mondial, payant)   │ │ (mondial, gratuit)  │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
           │                       │                       │
           └───────────────────────┼───────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │      GeocodeService         │
                    ├─────────────────────────────┤
                    │ - providers: GeocodeProvider│
                    │ - cache: Map<string, ...>   │
                    ├─────────────────────────────┤
                    │ + geocode()                 │
                    │ + suggest()                 │
                    │ + registerProvider()        │
                    └─────────────────────────────┘
```

## Stratégies d'exécution

Le `GeocodeService` supporte plusieurs modes d'exécution :

### 1. Mode CASCADE (Recommandé pour production)
```
Essayer le provider prioritaire → Si échec → Essayer le suivant → ...
```
- ✅ Moins d'appels API
- ✅ Économique
- ⚠️ Peut être plus lent si le premier provider échoue

### 2. Mode PARALLEL (Actuel)
```
Lancer tous les providers en parallèle → Fusionner les résultats
```
- ✅ Plus rapide (temps = max des providers)
- ⚠️ Plus d'appels API (coûteux)

### 3. Mode FIRST_SUCCESS
```
Lancer tous en parallèle → Retourner dès qu'un provider répond
```
- ✅ Très rapide
- ✅ Robuste (fallback automatique)
- ⚠️ Appels potentiellement inutiles

## Configuration des providers

### Variables d'environnement

```env
# API Adresse France (gratuit, pas de clé requise)
# Activé par défaut pour les adresses françaises

# OpenCage (optionnel, payant)
OPENCAGE_API_KEY=your_api_key

# Nominatim (gratuit, rate limited)
# Activé par défaut comme fallback
```

### Priorités par défaut

| Provider | Priorité | Conditions |
|----------|----------|------------|
| API Adresse France | 0 | Adresses françaises uniquement |
| OpenCage | 10 | Si `OPENCAGE_API_KEY` définie |
| Nominatim | 20 | Toujours disponible (fallback) |

## Flow de données

```
┌──────────────┐     ┌───────────────────┐     ┌─────────────────────┐
│   Requête    │────▶│  GeocodeService   │────▶│  Vérifier cache     │
│   "rue ..."  │     │                   │     │  (60s TTL)          │
└──────────────┘     └───────────────────┘     └──────────┬──────────┘
                                                          │
                              ┌────────────────────────────┘
                              ▼
                     ┌─────────────────┐
                     │ Cache HIT ?     │
                     └────────┬────────┘
                              │
              ┌───────────────┴───────────────┐
              │ OUI                           │ NON
              ▼                               ▼
     ┌─────────────────┐          ┌─────────────────────────┐
     │ Retourner cache │          │ shouldPreferFrance() ?  │
     └─────────────────┘          └───────────┬─────────────┘
                                              │
                          ┌───────────────────┴───────────────────┐
                          │ OUI (France)                          │ NON
                          ▼                                       ▼
              ┌─────────────────────┐               ┌─────────────────────┐
              │ FrenchAddressProvider│               │ OpenCage/Nominatim  │
              │ (priorité 0)        │               │ (cascade)           │
              └──────────┬──────────┘               └──────────┬──────────┘
                         │                                      │
                         │ Fallback si échec                    │
                         ▼                                      │
              ┌─────────────────────┐                           │
              │ OpenCage/Nominatim  │                           │
              └──────────┬──────────┘                           │
                         │                                      │
                         └──────────────┬───────────────────────┘
                                        ▼
                              ┌─────────────────┐
                              │ Dédupliquer     │
                              │ + Trier         │
                              │ + Mettre en     │
                              │   cache         │
                              └────────┬────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   Réponse       │
                              └─────────────────┘
```

## Avantages de cette architecture

1. **Extensibilité** : Ajouter un nouveau provider = implémenter l'interface
2. **Testabilité** : Chaque provider peut être testé isolément
3. **Configurabilité** : Activer/désactiver via env vars
4. **Maintenabilité** : Code séparé et responsabilités claires
5. **Performance** : Mode cascade économise les appels API
6. **Résilience** : Fallback automatique si un provider échoue

## Exemple d'ajout d'un nouveau provider

```typescript
// src/lib/geocode/providers/my-new-provider.ts
import { GeocodeProvider, GeocodeOptions, GeocodeResult } from "../types"

export class MyNewProvider implements GeocodeProvider {
  readonly name = "my-new-provider"
  readonly priority = 5 // Entre France (0) et OpenCage (10)

  isAvailable(): boolean {
    return Boolean(process.env.MY_NEW_PROVIDER_API_KEY)
  }

  async geocode(query: string, options: GeocodeOptions): Promise<GeocodeResult[]> {
    // Implémentation...
  }
}

// Puis dans geocode-service.ts, l'enregistrer :
// service.registerProvider(new MyNewProvider())
```

## API Adresse France (BAN)

L'API Adresse France est le provider recommandé pour les adresses françaises :

- **URL** : `https://api-adresse.data.gouv.fr/search/`
- **Gratuit** : Aucune limite, aucune clé requise
- **Performant** : ~50-100ms de latence
- **Fuzzy search** : Gère bien les fautes et variantes
- **Autocomplete** : Paramètre `autocomplete=1`

### Exemple de requête
```
GET https://api-adresse.data.gouv.fr/search/?q=rue+rivoli+paris&limit=5&autocomplete=1
```

### Réponse
```json
{
  "features": [
    {
      "properties": {
        "label": "Rue de Rivoli 75001 Paris",
        "score": 0.89,
        "postcode": "75001",
        "city": "Paris"
      },
      "geometry": {
        "coordinates": [2.3522, 48.8566]
      }
    }
  ]
}
```


