/**
 * Utilitaire pour mapper les colonnes des Google Sheets
 * Gère les variations de noms de colonnes
 */

class ColumnMapper {
  /**
   * Configuration des alias de colonnes
   * Permet de supporter plusieurs noms possibles pour chaque colonne
   */
  static getColumnAliases() {
    return {
      statut: ['statut', 'diag fenetr', 'diagnostic fenetre', 'status'],
      date: ['Date', 'Date d\'intervention', 'Date d\'inter', '745', 'FErn', 'Date '],
      artisan: ['Artisan', 'Nom Artisan', 'artisan_name'],
      client: ['Client', 'Nom Client', 'client_name'],
      // Ajouter d'autres colonnes au besoin
    };
  }

  /**
   * Trouve l'index et le nom exact d'une colonne parmi plusieurs alias
   * @param {string[]} headers - Liste des headers du sheet
   * @param {string} columnKey - Clé du type de colonne (ex: 'statut', 'date')
   * @returns {object|null} - {index, headerName} ou null si non trouvée
   */
  static findColumnIndex(headers, columnKey) {
    const aliases = this.getColumnAliases()[columnKey];
    if (!aliases) return null;

    for (const alias of aliases) {
      const index = headers.findIndex(h =>
        h && h.toLowerCase().trim() === alias.toLowerCase().trim()
      );
      if (index >= 0) {
        return { index, headerName: headers[index] };
      }
    }
    return null;
  }

  /**
   * Extrait une valeur d'une ligne en cherchant la colonne par alias
   * @param {any[]} row - Ligne de données
   * @param {string[]} headers - Headers du sheet
   * @param {string} columnKey - Clé du type de colonne
   * @returns {string|null} - Valeur trouvée ou null
   */
  static extractColumnValue(row, headers, columnKey) {
    const result = this.findColumnIndex(headers, columnKey);
    if (result && result.index >= 0) {
      return row[result.index] || null;
    }
    return null;
  }

  /**
   * Normalise un objet d'intervention en utilisant les alias
   * Remplace les noms de colonnes variables par des clés standardisées
   * @param {object} interventionObj - Objet avec les colonnes du sheet
   * @param {string[]} headers - Headers du sheet
   * @returns {object} - Objet normalisé avec les clés standardisées
   */
  static normalizeInterventionObject(interventionObj, headers) {
    const normalized = { ...interventionObj };
    const columnMappings = {
      statut: 'statut_value',
      date: 'date_value',
      artisan: 'artisan_value',
      client: 'client_value',
    };

    Object.entries(columnMappings).forEach(([key, standardKey]) => {
      const result = this.findColumnIndex(headers, key);
      if (result) {
        const actualHeaderName = result.headerName;
        const value = interventionObj[actualHeaderName];
        if (value !== undefined) {
          normalized[standardKey] = value;
        }
      }
    });

    return normalized;
  }

  /**
   * Log détaillé des colonnes trouvées (pour debug)
   */
  static logFoundColumns(headers, verbose = false) {
    if (!verbose) return;

    console.log(`\n📋 Colonnes détectées dans le sheet:`);
    const columnKeys = Object.keys(this.getColumnAliases());

    columnKeys.forEach(colKey => {
      const result = this.findColumnIndex(headers, colKey);
      if (result) {
        console.log(`   ✅ ${colKey.padEnd(10)}: "${result.headerName}" (index ${result.index})`);
      } else {
        console.log(`   ❌ ${colKey.padEnd(10)}: aucune colonne trouvée`);
      }
    });
  }
}

module.exports = { ColumnMapper };
