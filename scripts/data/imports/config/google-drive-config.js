/**
 * Configuration des credentials Google Drive
 * 
 * Ce module gère la configuration des credentials Google Drive
 * en réutilisant la logique de google-sheets-config.js
 */

const fs = require('fs');
const path = require('path');

class GoogleDriveConfig {
  constructor() {
    this.credentials = null;
    this.rootFolderId = null;
    this.rootFolderPath = null;
    this.artisansRootFolderId = null;
    this.interventionsRootFolderId = null;
    this.loadConfig();
  }

  /**
   * Charge la configuration depuis les variables d'environnement ou un fichier
   */
  loadConfig() {
    // 1. Essayer de charger depuis les variables d'environnement
    if (this.loadFromEnv()) {
      console.log('✅ Configuration Google Drive chargée depuis les variables d\'environnement');
      return;
    }

    // 2. Essayer de charger depuis .env.local
    if (this.loadFromEnvFile()) {
      console.log('✅ Configuration Google Drive chargée depuis .env.local');
      return;
    }

    // 3. Essayer de charger depuis un fichier credentials.json
    if (this.loadFromCredentialsFile()) {
      console.log('✅ Configuration Google Drive chargée depuis credentials.json');
      return;
    }

    console.warn('⚠️  Aucune configuration Google Drive trouvée');
  }

  /**
   * Recharge la configuration (utile après le chargement de dotenv)
   */
  reloadConfig() {
    this.credentials = null;
    this.rootFolderId = null;
    this.rootFolderPath = null;
    this.artisansRootFolderId = null;
    this.interventionsRootFolderId = null;
    this.loadConfig();
  }

  /**
   * Charge la configuration depuis les variables d'environnement
   */
  loadFromEnv() {
    // Réutiliser les mêmes credentials que Google Sheets
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL || process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY || process.env.GOOGLE_DRIVE_PRIVATE_KEY;
    
    // Configuration spécifique Drive
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const rootFolderPath = process.env.GOOGLE_DRIVE_ROOT_FOLDER_PATH || 'artisans';
    const artisansRootFolderId = process.env.GOOGLE_DRIVE_GMBS_ARTISANS_ROOT_FOLDER;
    const interventionsRootFolderId = process.env.GOOGLE_DRIVE_GMBS_INTERVENTIONS_YEAR_ROOT_FOLDER;

    // Priorité 1: Fichier de credentials
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      try {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
        this.credentials = JSON.parse(credentialsContent);
        
        if (rootFolderId) {
          this.rootFolderId = rootFolderId;
        }
        if (rootFolderPath) {
          this.rootFolderPath = rootFolderPath;
        }
        if (artisansRootFolderId) {
          this.artisansRootFolderId = artisansRootFolderId;
        }
        if (interventionsRootFolderId) {
          this.interventionsRootFolderId = interventionsRootFolderId;
        }
        
        return true;
      } catch (error) {
        console.warn('⚠️  Erreur lors de la lecture du fichier de credentials:', error.message);
      }
    }
    
    // Priorité 2: Variables d'environnement directes
    if (clientEmail && privateKey) {
      this.credentials = {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'), // Décoder les \n
        type: 'service_account'
      };
      
      if (rootFolderId) {
        this.rootFolderId = rootFolderId;
      }
      if (rootFolderPath) {
        this.rootFolderPath = rootFolderPath;
      }
      if (artisansRootFolderId) {
        this.artisansRootFolderId = artisansRootFolderId;
      }
      if (interventionsRootFolderId) {
        this.interventionsRootFolderId = interventionsRootFolderId;
      }
      
      return true;
    }

    return false;
  }

  /**
   * Charge la configuration depuis .env.local
   */
  loadFromEnvFile() {
    const envLocalPath = path.join(process.cwd(), '.env.local');
    
    if (!fs.existsSync(envLocalPath)) {
      return false;
    }

    try {
      const envContent = fs.readFileSync(envLocalPath, 'utf8');
      const envVars = this.parseEnvFile(envContent);
      
      const clientEmail = envVars.GOOGLE_SHEETS_CLIENT_EMAIL || envVars.GOOGLE_DRIVE_CLIENT_EMAIL;
      const privateKey = envVars.GOOGLE_SHEETS_PRIVATE_KEY || envVars.GOOGLE_DRIVE_PRIVATE_KEY;
      const rootFolderId = envVars.GOOGLE_DRIVE_ROOT_FOLDER_ID;
      const rootFolderPath = envVars.GOOGLE_DRIVE_ROOT_FOLDER_PATH || 'artisans';
      const artisansRootFolderId = envVars.GOOGLE_DRIVE_GMBS_ARTISANS_ROOT_FOLDER;
      const interventionsRootFolderId = envVars.GOOGLE_DRIVE_GMBS_INTERVENTIONS_YEAR_ROOT_FOLDER;

      if (clientEmail && privateKey) {
        this.credentials = {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'), // Décoder les \n
          type: 'service_account'
        };
        
        if (rootFolderId) {
          this.rootFolderId = rootFolderId;
        }
        if (rootFolderPath) {
          this.rootFolderPath = rootFolderPath;
        }
        if (artisansRootFolderId) {
          this.artisansRootFolderId = artisansRootFolderId;
        }
        if (interventionsRootFolderId) {
          this.interventionsRootFolderId = interventionsRootFolderId;
        }
        
        return true;
      }
    } catch (error) {
      console.warn('⚠️  Erreur lors de la lecture de .env.local:', error.message);
    }

    return false;
  }

  /**
   * Charge la configuration depuis un fichier credentials.json
   */
  loadFromCredentialsFile(credentialsPath = './credentials.json') {
    if (!fs.existsSync(credentialsPath)) {
      return false;
    }

    try {
      const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
      this.credentials = JSON.parse(credentialsContent);
      return true;
    } catch (error) {
      console.warn('⚠️  Erreur lors de la lecture de credentials.json:', error.message);
    }

    return false;
  }

  /**
   * Parse un fichier .env
   */
  parseEnvFile(content) {
    const vars = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Supprimer les guillemets
          vars[key.trim()] = value;
        }
      }
    }
    
    return vars;
  }

  /**
   * Retourne les credentials
   */
  getCredentials() {
    return this.credentials;
  }

  /**
   * Retourne l'ID du dossier racine
   */
  getRootFolderId() {
    return this.rootFolderId;
  }

  /**
   * Retourne le chemin du dossier racine
   */
  getRootFolderPath() {
    return this.rootFolderPath;
  }

  /**
   * Retourne l'ID du dossier racine Artisans
   */
  getArtisansRootFolderId() {
    return this.artisansRootFolderId;
  }

  /**
   * Retourne l'ID du dossier racine Interventions
   */
  getInterventionsRootFolderId() {
    return this.interventionsRootFolderId;
  }

  /**
   * Vérifie si la configuration est valide
   */
  isValid() {
    return this.credentials && this.credentials.client_email && this.credentials.private_key;
  }

  /**
   * Affiche la configuration actuelle (sans les secrets)
   */
  displayConfig() {
    console.log('🔧 Configuration Google Drive:');
    console.log(`  Client Email: ${this.credentials?.client_email || 'Non défini'}`);
    console.log(`  Private Key: ${this.credentials?.private_key ? '✅ Définie' : '❌ Non définie'}`);
    console.log(`  Root Folder ID: ${this.rootFolderId || 'Non défini'}`);
    console.log(`  Root Folder Path: ${this.rootFolderPath || 'artisans'}`);
    console.log(`  Artisans Root Folder ID: ${this.artisansRootFolderId || 'Non défini'}`);
    console.log(`  Interventions Root Folder ID: ${this.interventionsRootFolderId || 'Non défini'}`);
    console.log(`  Configuration valide: ${this.isValid() ? '✅ Oui' : '❌ Non'}`);
  }
}

// Instance singleton
const googleDriveConfig = new GoogleDriveConfig();

module.exports = { GoogleDriveConfig, googleDriveConfig };

