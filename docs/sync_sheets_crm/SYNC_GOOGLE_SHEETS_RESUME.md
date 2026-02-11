# 🔄 Synchronisation CRM ↔ Google Sheets - Résumé Exécutif

## 🎯 Vue d'ensemble en 30 secondes

Créer une **synchronisation bidirectionnelle automatique** entre votre CRM GMBS et Google Sheets :
- 🔐 **Interface utilisateur** pour connecter Google Sheets (OAuth)
- 📥 **Import automatique** : Google Sheets → Supabase
- 📤 **Export automatique** : Supabase → Google Sheets
- 💾 **Backup en temps réel** de toutes les données du CRM

---

## 🏗️ Architecture Simplifiée

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│              │◄─────►│              │◄─────►│              │
│   CRM UI     │       │   Supabase   │       │ Google       │
│   (Next.js)  │       │   + Edge Fn  │       │ Sheets API   │
│              │       │              │       │              │
└──────────────┘       └──────────────┘       └──────────────┘
```

### Composants principaux

1. **Interface CRM** (`/settings/google-sheets`)
   - Connexion OAuth Google
   - Sélection du spreadsheet et feuilles
   - Configuration du mapping des colonnes
   - Monitoring des synchronisations

2. **Base de données Supabase**
   - 3 nouvelles tables : `google_sheets_configs`, `sync_logs`, `sync_queue`
   - Triggers PostgreSQL pour capturer les changements
   - Edge Functions pour la synchronisation

3. **Synchronisation**
   - **Export** : Changements CRM → Queue → Google Sheets
   - **Import** : Cron job lit Google Sheets → Applique dans Supabase
   - **Conflits** : Stratégies configurables (CRM wins / Sheets wins / Newest wins)

---

## 🔑 Fonctionnalités clés

### Phase 1 - MVP (10 semaines)

✅ **Authentification OAuth Google**
- Connexion sécurisée avec compte Google
- Gestion automatique des tokens (refresh)

✅ **Configuration intuitive**
- Sélection du spreadsheet dans la liste
- Sélection des feuilles (Artisans, Interventions)
- Auto-détection intelligente des colonnes
- Drag & drop pour le mapping manuel

✅ **Synchronisation bidirectionnelle**
- Export automatique : CRM → Sheets (temps réel)
- Import périodique : Sheets → CRM (configurable, ex: toutes les 5 min)
- Gestion de la queue pour éviter la perte de données

✅ **Gestion des conflits**
- Détection automatique
- Stratégies de résolution :
  - CRM prioritaire
  - Sheets prioritaire  
  - Plus récent prioritaire
- Interface de résolution manuelle

✅ **Monitoring et logs**
- Dashboard temps réel
- Historique des synchronisations
- Alertes en cas d'erreur
- Statistiques de performance

---

## 💡 Avantages pour l'utilisateur

### Pour l'équipe

🚀 **Productivité**
- Import/export automatique = plus de scripts manuels
- Backup automatique en continu
- Travail possible dans Google Sheets (familier)

🔒 **Sécurité**
- Backup automatique de toutes les données
- Historique des changements
- Récupération facile en cas de problème

📊 **Flexibilité**
- Édition en masse dans Sheets
- Formules et outils Google Sheets disponibles
- Partage facile avec des tiers (lecture seule)

### Pour les gestionnaires

📈 **Visibilité**
- Vue claire de l'état de synchronisation
- Logs détaillés de toutes les opérations
- Alertes proactives

⚙️ **Contrôle**
- Configuration par utilisateur
- Choix de la fréquence de sync
- Stratégie de conflit personnalisable

---

## 🛠️ Technologies utilisées

### Frontend
- **Next.js 15** : Interface utilisateur
- **React Query** : Gestion du state et cache
- **Radix UI** : Composants UI accessibles
- **Tailwind CSS** : Styling

### Backend
- **Supabase** : Base de données PostgreSQL + Auth + Edge Functions
- **Google Sheets API v4** : Lecture/écriture des spreadsheets
- **Google OAuth 2.0** : Authentification sécurisée

### Infrastructure
- **PostgreSQL Triggers** : Capture automatique des changements
- **Edge Functions (Deno)** : Logique de synchronisation
- **Cron Jobs** : Synchronisation périodique
- **Queue System** : Gestion fiable des exports

---

## 📋 Plan de développement

### Sprint 1-2 : Fondations (4 semaines)
- ✅ Base de données (tables, triggers)
- ✅ Authentification OAuth Google
- ✅ Interface de configuration basique
- ✅ Sélection de spreadsheet et feuilles

### Sprint 3-4 : Mapping et transformation (4 semaines)
- ✅ Auto-détection des colonnes
- ✅ Interface de mapping drag & drop
- ✅ Transformation données DB ↔ Sheets
- ✅ Prévisualisation

### Sprint 5-6 : Synchronisation (4 semaines)
- ✅ Export : CRM → Sheets (queue + worker)
- ✅ Import : Sheets → CRM (cron job)
- ✅ Gestion des conflits
- ✅ Retry logic

### Sprint 7 : Monitoring et polish (2 semaines)
- ✅ Dashboard de monitoring
- ✅ Logs et statistiques
- ✅ Tests end-to-end
- ✅ Documentation

**Durée totale estimée** : 10 semaines (2-3 développeurs)

---

## 🚦 Étapes de mise en œuvre

### 1. Configuration Google Cloud

```bash
# 1. Créer un projet sur Google Cloud Console
# 2. Activer Google Sheets API
# 3. Créer des identifiants OAuth 2.0
# 4. Ajouter les variables d'environnement

GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=https://your-app.com/api/google-sheets/auth/callback
```

### 2. Créer les tables Supabase

```sql
-- Exécuter la migration
supabase migration new google_sheets_sync
-- Copier le SQL depuis le document de conception
supabase db push
```

### 3. Déployer les Edge Functions

```bash
# Déployer la fonction d'export
supabase functions deploy sync-to-sheets

# Déployer la fonction d'import
supabase functions deploy sync-from-sheets

# Configurer les cron jobs
# (via Supabase Dashboard > Database > Cron)
```

### 4. Configurer l'application

```typescript
// Ajouter les routes API
app/api/google-sheets/
  ├── auth/connect/route.ts
  ├── auth/callback/route.ts
  ├── spreadsheets/list/route.ts
  └── config/route.ts

// Créer la page de settings
app/settings/google-sheets/page.tsx
```

### 5. Tester

```bash
# Tests unitaires
npm test

# Tests d'intégration
npm run test:integration

# Test manuel dans le CRM
# 1. Aller sur /settings/google-sheets
# 2. Cliquer "Connecter Google Sheets"
# 3. Autoriser l'accès
# 4. Sélectionner un spreadsheet
# 5. Configurer le mapping
# 6. Activer la sync
```

---

## 🎓 Guide d'utilisation

### Pour l'utilisateur final

#### Première configuration (5 minutes)

1. **Aller dans Paramètres > Google Sheets**
   - Cliquer sur "Connecter à Google"
   - Autoriser l'accès (popup Google)

2. **Sélectionner votre spreadsheet**
   - Choisir dans la liste de vos spreadsheets
   - Ou créer un nouveau spreadsheet

3. **Configurer les feuilles**
   - Feuille Artisans : Sélectionner "Artisans" ou nom de la feuille
   - Feuille Interventions : Sélectionner "Interventions"

4. **Vérifier le mapping**
   - Le système détecte automatiquement les colonnes
   - Ajuster si nécessaire en glissant-déposant

5. **Configurer la synchronisation**
   - Fréquence : Toutes les 5 minutes (recommandé)
   - Direction : Bidirectionnelle (recommandé)
   - Conflits : CRM prioritaire (recommandé)

6. **Activer**
   - Basculer le switch "Synchronisation active"
   - ✅ C'est fait ! Vos données sont maintenant synchronisées

#### Utilisation quotidienne

**Éditer dans le CRM**
- Toutes vos modifications sont automatiquement envoyées à Google Sheets
- Délai : < 2 minutes

**Éditer dans Google Sheets**
- Vos modifications seront importées dans le CRM
- Délai : Selon votre fréquence de sync (ex: 5 min)

**Voir les logs**
- Onglet "Monitoring" dans les paramètres
- Voir toutes les synchronisations réussies/échouées

**En cas de conflit**
- Vous serez notifié
- Choisir quelle version garder
- Ou fusionner manuellement

---

## ⚠️ Points d'attention

### Limitations Google Sheets

- **100 requêtes par 100 secondes par utilisateur**
  - Gestion automatique du rate limiting
  - Queue pour respecter les quotas

- **10 millions de cellules maximum par spreadsheet**
  - Surveillance de la taille
  - Alerte si proche de la limite

### Performance

- **Temps de sync** : Dépend du volume
  - 100 artisans : ~30 secondes
  - 1000 artisans : ~5 minutes

- **Optimisations** :
  - Batch updates (100 lignes à la fois)
  - Cache des tokens
  - Queue asynchrone

### Sécurité

- **Tokens Google** chiffrés en base
- **Row-Level Security** activée
- **Validation** de toutes les données
- **Rate limiting** sur les API

---

## 🔮 Évolutions futures (Phase 2)

### Fonctionnalités avancées

1. **Synchronisation en temps réel**
   - Webhooks Google Sheets
   - Mise à jour instantanée

2. **Synchronisation sélective**
   - Choisir les colonnes à synchroniser
   - Filtres conditionnels

3. **Historique et versioning**
   - Voir l'historique des changements
   - Rollback possible

4. **Transformations personnalisées**
   - Formules de transformation
   - Scripts custom

5. **Multi-spreadsheet**
   - Synchroniser avec plusieurs sheets
   - Intégration Airtable, Notion

6. **AI-powered**
   - Détection d'anomalies
   - Suggestions de résolution de conflits
   - Nettoyage automatique des données

---

## 📞 Support et documentation

### Documentation complète

📖 [Voir le document de conception détaillé](./CONCEPTION_SYNC_GOOGLE_SHEETS.md)

### Questions fréquentes

**Q : Que se passe-t-il si je perds la connexion Internet ?**
R : Les changements dans le CRM sont mis en queue et seront synchronisés dès que la connexion est rétablie.

**Q : Puis-je avoir plusieurs utilisateurs avec leur propre configuration ?**
R : Oui, chaque utilisateur peut connecter son propre Google Sheets.

**Q : Les données sensibles sont-elles en sécurité ?**
R : Oui, les tokens sont chiffrés et le RLS est activé. Seul l'utilisateur peut accéder à ses données.

**Q : Que se passe-t-il si je modifie la même ligne simultanément dans le CRM et Sheets ?**
R : Le système détecte le conflit et applique votre stratégie de résolution (CRM wins par défaut).

**Q : Puis-je désactiver temporairement la synchronisation ?**
R : Oui, vous pouvez désactiver la sync à tout moment dans les paramètres.

---

## ✅ Checklist de lancement

### Avant de démarrer le développement

- [ ] Créer un projet Google Cloud
- [ ] Activer Google Sheets API
- [ ] Créer les identifiants OAuth 2.0
- [ ] Configurer les variables d'environnement
- [ ] Planifier les sprints avec l'équipe

### Avant le déploiement en production

- [ ] Tests unitaires > 80% de couverture
- [ ] Tests d'intégration complets
- [ ] Tests de charge (1000+ artisans)
- [ ] Documentation utilisateur
- [ ] Formation de l'équipe
- [ ] Plan de rollback

### Après le déploiement

- [ ] Monitoring actif (logs, erreurs)
- [ ] Support utilisateur disponible
- [ ] Collecte des feedbacks
- [ ] Itérations rapides

---

**Date** : 30 octobre 2025  
**Version** : 1.0  
**Statut** : Prêt pour développement

---

## 🎉 Conclusion

Cette solution de synchronisation bidirectionnelle transformera votre workflow :

✅ **Plus de scripts manuels** - Tout est automatique  
✅ **Backup permanent** - Sécurité totale de vos données  
✅ **Flexibilité maximale** - Travaillez où vous voulez (CRM ou Sheets)  
✅ **Scalable** - Peut gérer des milliers d'entités  
✅ **User-friendly** - Interface intuitive, configuration en 5 minutes  

**Prêt à démarrer ? Consultez le [document de conception détaillé](./CONCEPTION_SYNC_GOOGLE_SHEETS.md) pour l'implémentation technique complète !**



