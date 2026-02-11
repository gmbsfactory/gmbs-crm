# Module IA Global - CRM GMBS

## 🎯 Vue d'ensemble

Le module IA global transforme le CRM GMBS en assistant intelligent capable d'interactions naturelles, d'actions directes sur les données et de création de vues personnalisées. L'IA est intégrée de manière transparente dans toute l'interface utilisateur.

## 🚀 Fonctionnalités principales

### 1. Chat IA centralisé (`/chat`)
- **Historique persistant** : Toutes les conversations sont sauvegardées dans la base de données
- **Rendu riche** : Affichage des résultats en Table, Cartes, ou CSV avec switch instantané
- **Actions directes** : Possibilité de modifier le statut des interventions directement depuis le chat
- **Vue plein écran** : Bouton pour ouvrir les résultats dans une page dédiée
- **DeepSearch** : Recherche web externe (Google/Local) pour trouver des prestataires

### 2. Mini-modal IA globale (Cmd+/)
- **Raccourci universel** : Cmd+/ (Mac) ou Ctrl+/ (Windows/Linux) depuis n'importe quelle page
- **Focus intelligent** : Capture du focus et blocage des interactions d'arrière-plan
- **Contexte adaptatif** : L'IA comprend automatiquement le contexte (interventions, artisans, tâches)
- **Réponses instantanées** : Affichage des résultats sans quitter la page courante

### 3. Actions IA sécurisées
- **Changement de statut** : Modification du statut des interventions avec confirmations
- **Création de vues** : Sauvegarde de vues personnalisées avec filtres et layout
- **Audit complet** : Traçabilité de toutes les actions dans les logs
- **Contrôle des quotas** : Gestion automatique des requêtes restantes

### 4. Vues dynamiques persistées
- **Sauvegarde intelligente** : Les vues créées sont stockées en base de données
- **Réutilisation** : Accès rapide aux vues sauvegardées depuis l'interface
- **Filtres avancés** : Support de tous les filtres disponibles (statut, assigné, coût, etc.)
- **Layouts multiples** : Table, Cartes, ou vue détaillée

## 🏗️ Architecture technique

### Structure des fichiers
```
src/features/ai/
├── components/
│   ├── AIQuickModal.tsx          # Mini-modal Cmd+/
│   ├── AIResponseRenderer.tsx    # Rendu unifié des réponses
│   ├── InterventionTable.tsx     # Tableau des interventions
│   ├── InterventionCards.tsx     # Grille de cartes
│   └── ExpandableCard.tsx        # Carte dépliable
├── context/
│   └── AIContext.tsx             # État global IA
├── hooks/
│   └── useAI.ts                  # Hook principal IA
├── lib/
│   ├── execute-tool.ts           # Exécution des actions
│   └── view-signature.ts         # Signature des vues
└── types.ts                      # Types TypeScript

app/api/
├── chat/
│   ├── route.ts                  # API chat principal
│   ├── actions/route.ts          # Exécution des actions
│   └── responses/[id]/route.ts   # Récupération des réponses
└── views/
    ├── route.ts                  # CRUD des vues
    └── [id]/route.ts             # Vue spécifique

app/ia/
└── resultats/[id]/page.tsx       # Page plein écran
```

### Base de données
```sql
-- Table des vues IA persistées
CREATE TABLE ai_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES users(id),
  context TEXT NOT NULL, -- 'interventions', 'artisans', etc.
  filters JSONB NOT NULL,
  layout TEXT NOT NULL, -- 'table', 'cards', 'csv'
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 🎮 Utilisation

### Chat IA
1. Aller sur `/chat`
2. Poser une question naturelle : "Montre-moi les interventions en cours"
3. Utiliser les boutons de switch pour changer la vue (Table/Cartes/CSV)
4. Cliquer sur "Ouvrir en pleine page" pour une vue dédiée
5. Utiliser les actions proposées (changer statut, sauvegarder vue)

### Mini-modal (Cmd+/)
1. Appuyer sur Cmd+/ depuis n'importe quelle page
2. Taper la question dans l'input qui apparaît
3. Appuyer sur Entrée ou cliquer "Lancer la requête"
4. Les résultats s'affichent dans la modal
5. Fermer avec Escape ou le bouton "Fermer"

### Actions IA
1. Dans le chat, demander une action : "Change le statut de l'intervention 12345 en accepté"
2. L'IA propose un bouton d'action
3. Cliquer et confirmer dans la modal
4. L'action est exécutée et tracée

### Création de vues
1. Demander : "Crée une vue des interventions EN_COURS assignées à admin"
2. L'IA propose de sauvegarder la vue
3. Donner un nom à la vue
4. La vue est accessible depuis le menu des interventions

## 🔧 Configuration

### Variables d'environnement
```env
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL_GPT5_NANO=gpt-4o-mini
OPENAI_MODEL_GPT5_MINI=gpt-4o
OPENAI_MODEL_GPT5=gpt-4o

# DeepSearch (optionnel)
SERPAPI_API_KEY=...
SERPAPI_ENGINE=google

# Supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Quotas et limites
- **Requêtes** : Gérées via `billing_state.requests_remaining`
- **DeepSearch** : Limité à 5 requêtes par semaine
- **Actions** : Confirmations obligatoires pour les modifications
- **Audit** : Toutes les actions sont tracées

## 🧪 Tests

### Tests unitaires
```bash
# Tests des composants IA
npx vitest run tests/ai-response-builder.test.ts
npx vitest run tests/view-signature.test.ts

# Vérification TypeScript
npx tsc --noEmit
```

### Tests manuels
1. **Focus modal** : Cmd+/ → taper espace → vérifier que l'arrière-plan ne réagit pas
2. **Actions** : Demander un changement de statut → vérifier la confirmation et l'effet
3. **Vues** : Créer une vue → vérifier qu'elle apparaît dans le menu
4. **Switch** : Changer de vue (Table/Cartes/CSV) → vérifier qu'il n'y a pas de re-requête

## 📚 Documentation

### Guides disponibles
- `docs/baz/ia-module.md` : Guide technique complet
- `docs/ToDo.md` : Liste des tâches et priorités
- `docs/baz/interventions-ui-flow-mermaid.md` : Flux des interventions

### API Reference
- `POST /api/chat` : Chat principal avec outils
- `POST /api/chat/actions` : Exécution des actions IA
- `GET /api/chat/responses/[id]` : Récupération d'une réponse
- `GET /api/views` : Liste des vues
- `POST /api/views` : Création d'une vue
- `DELETE /api/views/[id]` : Suppression d'une vue

## 🔒 Sécurité

### Contrôles implémentés
- **RLS Supabase** : Row Level Security sur toutes les tables
- **Permissions** : Vérification des droits utilisateur
- **Confirmations** : Actions sensibles nécessitent une confirmation
- **Audit** : Traçabilité complète des modifications
- **Quotas** : Limitation des requêtes par utilisateur

### Bonnes pratiques
- Toujours confirmer les actions destructrices
- Vérifier les permissions avant exécution
- Logger toutes les actions sensibles
- Respecter les quotas utilisateur

## 🚧 Prochaines étapes

### Améliorations prévues
- [ ] Tests e2e Playwright pour les flux complets
- [ ] Interface de gestion des vues IA
- [ ] Suggestions automatiques de vues
- [ ] Export des vues en PDF/Excel
- [ ] Intégration avec d'autres modules (artisans, tâches)

### Optimisations
- [ ] Cache des réponses fréquentes
- [ ] Pagination des résultats volumineux
- [ ] Compression des vues sauvegardées
- [ ] Indexation des filtres pour des recherches rapides

## 🤝 Contribution

### Développement
1. Créer une branche depuis `feat/inter/ia`
2. Implémenter les fonctionnalités
3. Ajouter les tests correspondants
4. Mettre à jour la documentation
5. Créer une Pull Request

### Standards
- Code en français (commentaires, messages d'erreur)
- Tests unitaires pour les nouvelles fonctionnalités
- Documentation mise à jour
- Respect des conventions du projet

## 📞 Support

Pour toute question ou problème :
1. Vérifier la documentation dans `docs/baz/`
2. Consulter les tests pour des exemples d'usage
3. Vérifier les logs dans la console navigateur
4. Contacter l'équipe de développement

---

**Version** : 1.0.0  
**Dernière mise à jour** : $(date)  
**Branche** : feat/inter/ia
