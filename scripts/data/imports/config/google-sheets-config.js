/**
 * Configuration des credentials Google Sheets
 * 
 * Ce module gère la configuration des credentials Google Sheets
 * en utilisant les variables d'environnement ou un fichier de credentials.
 */

const fs = require('fs');
const path = require('path');

class GoogleSheetsConfig {
  constructor() {
    this.credentials = null;
    this.spreadsheetId = null;
    this.loadConfig();
  }

  /**
   * Charge la configuration depuis les variables d'environnement ou un fichier
   */
  loadConfig() {
    // 1. Essayer de charger depuis les variables d'environnement
    if (this.loadFromEnv()) {
      console.log('✅ Configuration Google Sheets chargée depuis les variables d\'environnement');
      return;
    }

    // 2. Essayer de charger depuis .env.local
    if (this.loadFromEnvFile()) {
      console.log('✅ Configuration Google Sheets chargée depuis .env.local');
      return;
    }

    // 3. Essayer de charger depuis un fichier credentials.json
    if (this.loadFromCredentialsFile()) {
      console.log('✅ Configuration Google Sheets chargée depuis credentials.json');
      return;
    }

    // Afficher un message d'erreur détaillé
    this.displayDiagnosticInfo();
  }

  /**
   * Affiche des informations de diagnostic pour aider à résoudre les problèmes de configuration
   */
  displayDiagnosticInfo() {
    console.warn('⚠️  Aucune configuration Google Sheets trouvée');
    console.log('\n📋 Diagnostic de configuration:');
    
    // Vérifier les variables d'environnement
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    const altSpreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    console.log('\n🔍 Variables d\'environnement détectées:');
    console.log(`  GOOGLE_CREDENTIALS_PATH: ${credentialsPath || '❌ Non définie'}`);
    if (credentialsPath) {
      console.log(`    Fichier existe: ${fs.existsSync(credentialsPath) ? '✅ Oui' : '❌ Non'}`);
    }
    console.log(`  GOOGLE_SHEETS_ID: ${spreadsheetId || '❌ Non définie'}`);
    console.log(`  GOOGLE_SHEETS_CLIENT_EMAIL: ${clientEmail || '❌ Non définie'}`);
    console.log(`  GOOGLE_SHEETS_PRIVATE_KEY: ${privateKey ? '✅ Définie (' + privateKey.length + ' caractères)' : '❌ Non définie'}`);
    console.log(`  GOOGLE_SHEETS_SPREADSHEET_ID: ${altSpreadsheetId || '❌ Non définie'}`);
    
    // Vérifier les fichiers
    const envLocalPath = path.join(process.cwd(), '.env.local');
    const credentialsJsonPath = './credentials.json';
    
    console.log('\n📁 Fichiers de configuration:');
    console.log(`  .env.local: ${fs.existsSync(envLocalPath) ? '✅ Existe' : '❌ N\'existe pas'}`);
    console.log(`  credentials.json: ${fs.existsSync(credentialsJsonPath) ? '✅ Existe' : '❌ N\'existe pas'}`);
    
    console.log('\n💡 Solutions possibles:');
    console.log('  1. Définir GOOGLE_CREDENTIALS_PATH pointant vers un fichier credentials.json valide');
    console.log('  2. OU définir GOOGLE_SHEETS_CLIENT_EMAIL et GOOGLE_SHEETS_PRIVATE_KEY');
    console.log('  3. Vérifier que le fichier .env.local contient les bonnes variables');
    console.log('  4. Voir env.example pour un exemple de configuration');
  }

  /**
   * Recharge la configuration (utile après le chargement de dotenv)
   */
  reloadConfig() {
    this.credentials = null;
    this.spreadsheetId = null;
    this.loadConfig();
  }

  /**
   * Charge la configuration depuis les variables d'environnement
   */
  loadFromEnv() {
    // Vérifier les variables d'environnement spécifiques du projet
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    
    // Variables alternatives (pour compatibilité)
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    const altSpreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    // Priorité 1: Fichier de credentials
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      try {
        const credentialsContent = fs.readFileSync(credentialsPath, 'utf8');
        this.credentials = JSON.parse(credentialsContent);
        
        if (spreadsheetId) {
          this.spreadsheetId = spreadsheetId;
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
      
      if (spreadsheetId || altSpreadsheetId) {
        this.spreadsheetId = spreadsheetId || altSpreadsheetId;
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
      
      const clientEmail = envVars.GOOGLE_SHEETS_CLIENT_EMAIL;
      const privateKey = envVars.GOOGLE_SHEETS_PRIVATE_KEY;
      const spreadsheetId = envVars.GOOGLE_SHEETS_SPREADSHEET_ID;

      if (clientEmail && privateKey) {
        this.credentials = {
          client_email: clientEmail,
          private_key: privateKey.replace(/\\n/g, '\n'), // Décoder les \n
          type: 'service_account'
        };
        
        if (spreadsheetId) {
          this.spreadsheetId = spreadsheetId;
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
   * Retourne l'ID du spreadsheet
   */
  getSpreadsheetId() {
    return this.spreadsheetId;
  }

  /**
   * Vérifie si la configuration est valide
   */
  isValid() {
    return this.credentials && this.credentials.client_email && this.credentials.private_key;
  }

  /**
   * Génère un exemple de configuration pour .env.local
   */
  generateEnvExample() {
    return `# Configuration Google Sheets pour GMBS CRM
# Copiez ces variables dans votre fichier .env.local

# Méthode 1: Fichier de credentials (recommandé)
GOOGLE_CREDENTIALS_PATH=./supabase/functions/credentials.json
GOOGLE_SHEETS_ID=your_spreadsheet_id_here

# Méthode 2: Variables d'environnement directes
# GOOGLE_SHEETS_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
# GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----"
# GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here

# Ranges spécifiques (optionnel)
GOOGLE_SHEETS_ARTISANS_RANGE=BASE de DONNÉE SST ARTISANS!A1:Z
GOOGLE_SHEETS_INTERVENTIONS_RANGE=SUIVI_INTER_GMBS_2025!A1:Z
`;
  }

  /**
   * Affiche la configuration actuelle (sans les secrets)
   */
  displayConfig() {
    console.log('🔧 Configuration Google Sheets:');
    console.log(`  Client Email: ${this.credentials?.client_email || 'Non défini'}`);
    console.log(`  Private Key: ${this.credentials?.private_key ? '✅ Définie' : '❌ Non définie'}`);
    console.log(`  Spreadsheet ID: ${this.spreadsheetId || 'Non défini'}`);
    console.log(`  Configuration valide: ${this.isValid() ? '✅ Oui' : '❌ Non'}`);
  }
}

// Instance singleton
const googleSheetsConfig = new GoogleSheetsConfig();

module.exports = { GoogleSheetsConfig, googleSheetsConfig };
