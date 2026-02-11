# Guide d'Installation Complet - CRM GMBS

Ce guide vous accompagne étape par étape pour installer et configurer l'application CRM GMBS depuis zéro.

## 📋 Prérequis

### Logiciels requis
- **Node.js** : version 18 ou supérieure
- **npm** : version 9 ou supérieure  
- **Git** : pour cloner le repository
- **Docker** : pour Supabase local (optionnel mais recommandé)

### Comptes et services externes
- **Compte Supabase** : pour la base de données
- **Compte Google Cloud** : pour l'API Google Sheets (si import de données)

---

## 🚀 Étape 1 : Installation des outils de base

### 1.1 Installation de Node.js et npm
```bash
# Vérifier les versions installées
node --version
npm --version

# Si non installé, télécharger depuis https://nodejs.org/
# ou via un gestionnaire de paquets :
# macOS (Homebrew)
brew install node

# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# Windows
# Télécharger l'installateur depuis nodejs.org
```

### 1.2 Installation de Git
```bash
# Vérifier l'installation
git --version

# Si non installé :
# macOS (Homebrew)
brew install git

# Ubuntu/Debian
sudo apt install git

# Windows : télécharger depuis https://git-scm.com/
```

### 1.3 Installation de Docker (optionnel pour Supabase local)
```bash
# Vérifier l'installation
docker --version

# Si non installé, télécharger depuis https://www.docker.com/
```

---

## 📦 Étape 2 : Clonage et installation du projet

### 2.1 Cloner le repository
```bash
# Naviguer vers votre répertoire de travail
cd ~/Desktop/abWebCraft/Mission/GMBS/newbase/

# Cloner le projet
git clone [URL_DU_REPOSITORY] CRM_template
cd CRM_template

# Vérifier la branche
git branch
# S'assurer d'être sur la branche GMBS
git checkout GMBS
```

### 2.2 Installation des dépendances
```bash
# Installer toutes les dépendances
npm install

# Vérifier l'installation
npm list --depth=0
```

---

## 🗄️ Étape 3 : Configuration de Supabase

### 3.1 Installation de Supabase CLI
```bash
# Installation via npm (recommandé)
npm install -g supabase

# Vérifier l'installation
supabase --version
# or npx supasbase --version

# Alternative : installation via Homebrew (macOS)
brew install supabase/tap/supabase
```

### 3.2 Configuration Supabase locale

#### 3.2.1 Initialiser Supabase
```bash
# Dans le répertoire du projet
supabase init

# Démarrer les services locaux
supabase start
```

Cette commande va :
- Télécharger et démarrer Docker
- Créer une base de données locale PostgreSQL
- Démarrer l'API Supabase locale
- Démarrer Supabase Studio (interface web)

#### 3.2.2 Récupérer les clés de configuration
```bash
# Afficher les informations de connexion
supabase status
```

Notez les informations importantes :
- **API URL** : `http://127.0.0.1:54321`
- **DB URL** : `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **Studio URL** : `http://127.0.0.1:54323`
- **Inbucket URL** : `http://127.0.0.1:54324`
- **anon key** : clé publique
- **service_role key** : clé privée

### 3.3 Configuration Supabase production (optionnel)

#### 3.3.1 Créer un projet Supabase
1. Aller sur [supabase.com](https://supabase.com)
2. Créer un compte et un nouveau projet
3. Noter l'URL et les clés API

#### 3.3.2 Lier le projet local au projet distant
```bash
# Se connecter à Supabase
supabase login

# Lier le projet local au projet distant
supabase link --project-ref [PROJECT_REF]

# Appliquer les migrations sur le projet distant
supabase db push
```

---

## 🔧 Étape 4 : Configuration de l'environnement

### 4.1 Créer le fichier .env.local
```bash
# Créer le fichier de configuration
touch .env.local
```

### 4.2 Configurer les variables d'environnement

Éditer le fichier `.env.local` avec le contenu suivant :

```env
# Configuration Supabase (locale)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=[VOTRE_ANON_KEY_LOCALE]
SUPABASE_SERVICE_ROLE_KEY=[VOTRE_SERVICE_ROLE_KEY_LOCALE]

# Configuration de l'environnement
NODE_ENV=development
NEXT_PUBLIC_ENVIRONMENT=development

# URLs de redirection pour l'authentification
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_ADDITIONAL_REDIRECT_URLS=http://localhost:3000

# Configuration Google Sheets (si import de données)
GOOGLE_SHEETS_ID=[ID_DE_VOTRE_SHEET]
GOOGLE_SERVICE_ACCOUNT_EMAIL=[EMAIL_DU_COMPTE_SERVICE]
GOOGLE_PRIVATE_KEY=[CLE_PRIVEE_GOOGLE]

# Configuration production (si applicable)
# NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_REF].supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=[ANON_KEY_PRODUCTION]
# SUPABASE_SERVICE_ROLE_KEY=[SERVICE_ROLE_KEY_PRODUCTION]
```

### 4.3 Remplacer les valeurs entre crochets
- Récupérer les clés depuis `supabase status`
- Configurer Google Sheets si nécessaire

---

## 🗃️ Étape 5 : Initialisation de la base de données

### 5.1 Appliquer les migrations
```bash
# Appliquer toutes les migrations sur la base locale
supabase db reset

# Vérifier l'état des migrations
supabase migration list
```

### 5.2 Vérifier la structure de la base
```bash
# Ouvrir Supabase Studio
# Aller sur http://127.0.0.1:54323
# Vérifier que toutes les tables sont créées
```

Tables principales à vérifier :
- `users` - Utilisateurs du système
- `artisans` - Artisans
- `interventions` - Interventions
- `metiers` - Métiers
- `artisan_metiers` - Relations artisans/métiers
- `intervention_artisans` - Relations interventions/artisans

---

## 👥 Étape 6 : Création des utilisateurs

### 6.1 Créer des utilisateurs de test
```bash
# Exécuter le script de création d'utilisateurs
node scripts/create-auth-users.js
```

Ce script va :
- Créer des utilisateurs d'authentification
- Générer des mots de passe aléatoires
- Sauvegarder les credentials dans un fichier JSON

### 6.2 Vérifier la création des utilisateurs
```bash
# Consulter le fichier de credentials généré
cat user-credentials-[TIMESTAMP].json

# Noter les emails et mots de passe pour la connexion
```

---

## 📊 Étape 7 : Import des données (optionnel)

### 7.1 Configuration Google Sheets
Si vous avez des données à importer depuis Google Sheets :

#### 7.1.1 Créer un compte de service Google
1. Aller sur [Google Cloud Console](https://console.cloud.google.com)
2. Créer un nouveau projet ou sélectionner un existant
3. Activer l'API Google Sheets
4. Créer un compte de service
5. Télécharger le fichier JSON de credentials

#### 7.1.2 Partager la feuille Google Sheets
1. Ouvrir votre Google Sheet
2. Cliquer sur "Partager"
3. Ajouter l'email du compte de service avec les droits "Lecteur"

### 7.2 Configuration interactive (recommandé)
```bash
# Lancer la configuration interactive
npm run import:setup

# Ou directement
node scripts/setup-google-import.js
```

### 7.3 Tester la connexion Google Sheets
```bash
# Tester la configuration Google Sheets
npm run import:test

# Test avec affichage détaillé
npm run import:test:verbose
```

### 7.4 Exécuter l'import
```bash
# Mode dry-run (test sans écriture)
node scripts/import-google-sheets-complete.js --dry-run

# Import réel
node scripts/import-google-sheets-complete.js

# Avec options avancées
node scripts/import-google-sheets-complete.js --batch-size=50 --verbose

# Importer uniquement les artisans
node scripts/import-google-sheets-complete.js --artisans-only

# Importer uniquement les interventions
node scripts/import-google-sheets-complete.js --interventions-only
```

### 7.5 Guide détaillé des credentials Google
Pour une configuration complète des credentials Google Cloud, consultez le guide détaillé :
[Guide de Configuration des Credentials Google Cloud](./google-credentials-setup.md)

---

## 🚀 Étape 8 : Lancement de l'application

### 8.1 Démarrer l'application de développement
```bash
# Démarrer le serveur de développement
npm run dev

# L'application sera accessible sur http://localhost:3000
```

### 8.2 Vérifier le bon fonctionnement
1. Ouvrir http://localhost:3000 dans votre navigateur
2. Vous devriez être redirigé vers la page de connexion
3. Utiliser les credentials générés à l'étape 6
4. Vérifier que vous accédez au dashboard

---

## 🧪 Étape 9 : Tests et vérifications

### 9.1 Tests unitaires
```bash
# Exécuter les tests unitaires
npm run test

# Tests avec interface
npm run test:ui
```

### 9.2 Tests end-to-end
```bash
# Installer Playwright si pas déjà fait
npx playwright install

# Exécuter les tests E2E
npm run test:e2e

# Tests E2E avec interface
npm run test:e2e:ui
```

### 9.3 Vérifications manuelles
- [ ] Page de connexion fonctionnelle
- [ ] Authentification avec les utilisateurs créés
- [ ] Dashboard accessible après connexion
- [ ] Navigation entre les sections
- [ ] Affichage des données (si import effectué)

---

## 🔧 Étape 10 : Configuration avancée

### 10.1 Configuration de production
```bash
# Build de production
npm run build

# Test du build local
npm run start
```

### 10.2 Déploiement
```bash
# Déployer sur Supabase
npm run supabase:deploy

# Build et déploiement complet
npm run build:prod
```

### 10.3 Monitoring et logs
```bash
# Vérifier les logs Supabase
supabase logs

# Status des services
supabase status
```

---

## 🆘 Résolution de problèmes courants

### Problème : Erreur de connexion à la base de données
```bash
# Vérifier que Supabase est démarré
supabase status

# Redémarrer les services
supabase stop
supabase start
```

### Problème : Migrations en échec
```bash
# Réinitialiser la base de données
supabase db reset

# Vérifier les migrations
supabase migration list
```

### Problème : Erreur de permissions Google Sheets
- Vérifier que l'email du compte de service est bien partagé
- Vérifier que l'API Google Sheets est activée
- Vérifier le format de la clé privée dans `.env.local`

### Problème : Port déjà utilisé
```bash
# Vérifier les ports utilisés
lsof -i :3000
lsof -i :54321

# Tuer les processus si nécessaire
kill -9 [PID]
```

---

## 📚 Ressources utiles

### Documentation
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### Commandes utiles
```bash
# Nettoyer le cache npm
npm cache clean --force

# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install

# Vérifier la configuration TypeScript
npm run typecheck

# Linting
npm run lint
```

### Fichiers importants
- `package.json` - Dépendances et scripts
- `supabase/config.toml` - Configuration Supabase
- `.env.local` - Variables d'environnement
- `docs/ToDo.md` - Liste des tâches du projet

---

## ✅ Checklist finale

- [ ] Node.js et npm installés
- [ ] Git installé et configuré
- [ ] Projet cloné depuis le repository
- [ ] Dépendances installées (`npm install`)
- [ ] Supabase CLI installé
- [ ] Supabase local démarré (`supabase start`)
- [ ] Fichier `.env.local` créé et configuré
- [ ] Migrations appliquées (`supabase db reset`)
- [ ] Utilisateurs créés (`node scripts/create-auth-users.js`)
- [ ] Données importées (si nécessaire)
- [ ] Application démarrée (`npm run dev`)
- [ ] Tests exécutés et passent
- [ ] Application accessible sur http://localhost:3000

---

## 📞 Support

En cas de problème :
1. Vérifier les logs avec `supabase logs`
2. Consulter la documentation Supabase
3. Vérifier que tous les prérequis sont installés
4. Contacter l'équipe de développement

---

*Guide créé le $(date) - Version 1.0*
