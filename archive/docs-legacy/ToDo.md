# 📋 ToDo - Projet CRM GMBS

## ✅ Branche `feature/integration_orm` - Architecture API V2

### 🎯 État : Prêt pour le développement
- **Branche** : `feature/integration_orm`
- **Dernière mise à jour** : 20 octobre 2025
- **Statut** : ✅ Fonctionnel, quelques erreurs TypeScript mineures restantes

### ✅ Changements Majeurs Appliqués

#### 1. API V2 Modulaire Complète
- [x] Architecture modulaire par domaine (`src/lib/api/v2/`)
- [x] Types strictes et cohérents
- [x] Point d'entrée centralisé (`index.ts`)
- [x] Mapping automatique snake_case → camelCase
- [x] Documentation complète (`src/lib/api/v2/README.md`)

#### 2. Scripts d'Import Google Sheets V2
- [x] Architecture en 3 couches (DataMapper, DatabaseManager, Script)
- [x] Séparation parsing / insertion
- [x] Meilleure gestion d'erreurs
- [x] Documentation (`scripts/imports/README-V2.md`)

#### 3. Documentation Exhaustive
- [x] `AGENTS.md` - Guide complet pour les développeurs
- [x] `docs/MIGRATION_API_V2.md` - Guide de migration
- [x] `docs/baz/branche-orm-demarrage.md` - Guide de démarrage

#### 4. Corrections TypeScript (20 Oct 2025)
- [x] Suppression fichier artefact `i.id).join('`
- [x] Type `InterventionView` enrichi avec tous les champs mappés
- [x] `supabase-api-v2.ts` retourne `InterventionView`
- [x] `InterventionCard.tsx` utilise `InterventionView`
- [x] Réduction de 33 à ~15 erreurs TypeScript

### 📋 Actions Restantes

#### 1. Corrections TypeScript Mineures
- [ ] Corriger les 10 erreurs restantes dans les composants UI
- [ ] Corriger les erreurs de DropdownMenu (`align` prop)
- [ ] Corriger les refs nullables

#### 2. Tests et Validation
- [ ] Tester l'API V2 (`npx tsx scripts/tests/test-api-v2.js`)
- [ ] Tester les imports V2 en dry-run
- [ ] Valider le fonctionnement de l'UI

#### 3. Documentation
- [ ] Compléter les exemples d'utilisation de chaque API
- [ ] Guide de migration pour les anciens scripts

## 📁 Fichiers de référence

### Architecture Supabase existante
- `src/lib/supabase-client.ts` - Client côté navigateur
- `src/lib/supabase/server.ts` - Client côté serveur
- `supabase/migrations/` - 28 migrations SQL existantes
- `supabase/config.toml` - Configuration Supabase

### Schéma interventions Supabase
- Table : `interventions`
- Champs principaux : `contexte_intervention`, `adresse`, `statut`, `date_prevue`, `attribue_a`
- Déjà configuré et fonctionnel

## 🎯 Résultat attendu

Un système d'interventions utilisant **UNIQUEMENT Supabase** :
- ✅ Performance optimale (pas de couche supplémentaire)
- ✅ Architecture cohérente
- ✅ Bouton création d'interventions fonctionnel
- ✅ Vues cartes et tableau actives
- ✅ CRUD complet

## 📋 Prompts pour Codex

### ✅ Terminé
- `docs/baz/prompt-correction-prisma-supabase.md` - Correction architecture Prisma/Supabase

### 🚀 En cours
- `docs/baz/prompt-ajout-interactions-ui.md` - Ajout interactions UI (bouton + et double-clic)
- [ ] Finaliser les tests e2e IA (chat, outils, mini-modal)
- [ ] Compléter la documentation fonctionnelle de l'assistant IA

### ✅ IA CRM (Phases 1 à 4)
- [x] Contexte global `AIProvider` + hook `useAI`
- [x] Rendu unifié (`AIResponseRenderer`, table/cartes/markdown/csv/mermaid)
- [x] Intégration chat (ChatMessageList, bouton pleine page, `/ia/resultats/[id]`)
- [x] API `/api/chat` enrichie (outils IA, quotas, logs usage/audit)
- [x] Mini-modal Cmd+/ & boutons "Demander à l'IA" dans artisans/interventions/tâches
- [x] Persistance des vues IA (`ai_views`, `/api/views`, menu "Vues IA enregistrées")
- [x] Actions confirmables (statut intervention, création de vue) avec quotas/logs/audit
- [x] Switch rendu dans les réponses IA (table ↔ cartes ↔ CSV) + focus strict du mini-modal

## 🔮 ToDo futurs (après stabilisation)

### Architecture et sécurité
- [ ] Refactoriser pour utiliser les API routes au lieu d'accès direct Supabase
- [ ] Sécuriser les accès avec validation serveur
- [ ] Implémenter un cache côté serveur
- [ ] Configurer RLS (Row Level Security) strict

### Fonctionnalités avancées
- [ ] Intégrer Supabase Storage pour les documents
- [ ] Ajouter la géolocalisation (lat/lng)
- [ ] Implémenter la gestion des coûts et marges
- [ ] Connecter la table artisans avec les interventions

---

**Dernière mise à jour** : $(date)
**Statut** : En cours - Amélioration UX
