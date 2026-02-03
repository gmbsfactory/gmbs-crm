module.exports = {
  // Configuration Google Sheets
  googleSheets: {
    credentialsPath: process.env.GOOGLE_SHEETS_CREDENTIALS_PATH || './credentials/google-sheets-credentials.json',
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || 'your-spreadsheet-id',
    sheets: {
      artisans: 'Artisans',
      interventions: 'Interventions',
      clients: 'Clients',
      documents: 'Documents'
    }
  },

  // Configuration Base de données
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres',
    supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'your-anon-key'
  },

  // Configuration Import
  import: {
    batchSize: parseInt(process.env.IMPORT_BATCH_SIZE) || 50,
    dryRun: process.env.IMPORT_DRY_RUN === 'true',
    verbose: process.env.IMPORT_VERBOSE === 'true',
    skipValidation: process.env.IMPORT_SKIP_VALIDATION === 'true',
    skipMapping: process.env.IMPORT_SKIP_MAPPING === 'true',
    skipProcessing: process.env.IMPORT_SKIP_PROCESSING === 'true'
  },

  // Configuration Logs
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    output: process.env.LOG_OUTPUT || 'console'
  }
};
