'use strict';

const fs = require('fs');
const path = require('path');

class ErrorLogger {
  constructor(options = {}) {
    const importType = options.importType || 'parsing';
    const logFileName = importType === 'artisans'
      ? `erreurs-artisans-${new Date().toISOString().split('T')[0]}.log`
      : importType === 'interventions'
        ? `erreurs-interventions-${new Date().toISOString().split('T')[0]}.log`
        : `erreurs-parsing-${new Date().toISOString().split('T')[0]}.log`;

    this.errorLogPath = path.join(process.cwd(), 'logs', logFileName);
    this.initErrorLog();
  }

  initErrorLog() {
    try {
      const logDir = path.dirname(this.errorLogPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.writeFileSync(
        this.errorLogPath,
        `=== LOG DES ERREURS DE PARSING - ${new Date().toISOString()} ===\n\n`,
        'utf8'
      );
    } catch (error) {
      console.error("Erreur lors de l'initialisation du fichier de log:", error);
    }
  }

  logParsingError(idInter, reason, rawData = null, lineNumber = null) {
    try {
      let logId = 'N/A';
      if (idInter && /^\d+$/.test(idInter)) logId = idInter;

      let rawDataStr = 'null';
      if (rawData !== null && rawData !== undefined) {
        try {
          rawDataStr = JSON.stringify(rawData, null, 2);
        } catch (e) {
          rawDataStr = String(rawData);
        }
      }

      const lineInfo = lineNumber !== null ? `Ligne ${lineNumber}: ` : '';
      const logEntry = `${lineInfo}${logId}, \tNot inserted reason \t{${reason}} \n rawData: \t${rawDataStr} \n  \n`;
      fs.appendFileSync(this.errorLogPath, logEntry, 'utf8');
    } catch (error) {
      console.error("Erreur lors de l'écriture dans le fichier de log:", error);
    }
  }

  getErrorLogPath() {
    return this.errorLogPath;
  }
}

module.exports = { ErrorLogger };
