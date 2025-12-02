/**
 * Formateur Excel pour l'export des données
 */

const ExcelJS = require('exceljs');

class ExcelFormatter {
  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.workbook.creator = 'GMBS CRM Export';
    this.workbook.created = new Date();
  }

  /**
   * Ajoute une feuille Artisans
   */
  addArtisansSheet(data) {
    const sheet = this.workbook.addWorksheet('Artisans');
    
    // Définir les colonnes
    sheet.columns = [
      { header: 'id', key: 'id', width: 36 },
      { header: 'prenom', key: 'prenom', width: 15 },
      { header: 'nom', key: 'nom', width: 15 },
      { header: 'plain_nom', key: 'plain_nom', width: 25 },
      { header: 'email', key: 'email', width: 30 },
      { header: 'telephone', key: 'telephone', width: 15 },
      { header: 'telephone2', key: 'telephone2', width: 15 },
      { header: 'departement', key: 'departement', width: 12 },
      { header: 'raison_sociale', key: 'raison_sociale', width: 30 },
      { header: 'siret', key: 'siret', width: 15 },
      { header: 'statut_juridique', key: 'statut_juridique', width: 20 },
      { header: 'adresse_siege_social', key: 'adresse_siege_social', width: 40 },
      { header: 'ville_siege_social', key: 'ville_siege_social', width: 20 },
      { header: 'code_postal_siege_social', key: 'code_postal_siege_social', width: 12 },
      { header: 'adresse_intervention', key: 'adresse_intervention', width: 40 },
      { header: 'ville_intervention', key: 'ville_intervention', width: 20 },
      { header: 'code_postal_intervention', key: 'code_postal_intervention', width: 12 },
      { header: 'intervention_latitude', key: 'intervention_latitude', width: 15 },
      { header: 'intervention_longitude', key: 'intervention_longitude', width: 15 },
      { header: 'numero_associe', key: 'numero_associe', width: 15 },
      { header: 'gestionnaire_username', key: 'gestionnaire_username', width: 20 },
      { header: 'gestionnaire_firstname', key: 'gestionnaire_firstname', width: 15 },
      { header: 'gestionnaire_lastname', key: 'gestionnaire_lastname', width: 15 },
      { header: 'statut_code', key: 'statut_code', width: 15 },
      { header: 'statut_label', key: 'statut_label', width: 20 },
      { header: 'metiers', key: 'metiers', width: 40 },
      { header: 'zones', key: 'zones', width: 40 },
      { header: 'suivi_relances_docs', key: 'suivi_relances_docs', width: 30 },
      { header: 'date_ajout', key: 'date_ajout', width: 12 },
      { header: 'is_active', key: 'is_active', width: 10 },
      { header: 'created_at', key: 'created_at', width: 20 },
      { header: 'updated_at', key: 'updated_at', width: 20 },
    ];

    // Style de l'en-tête
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Ajouter les données
    data.forEach(row => {
      const formattedRow = this.formatArtisanRow(row);
      sheet.addRow(formattedRow);
    });

    return sheet;
  }

  /**
   * Ajoute une feuille Interventions pour une année donnée
   */
  addInterventionsSheet(data, year) {
    const sheetName = `Interventions_${year}`;
    const sheet = this.workbook.addWorksheet(sheetName);
    
    // Définir les colonnes
    sheet.columns = [
      { header: 'id', key: 'id', width: 36 },
      { header: 'id_inter', key: 'id_inter', width: 15 },
      { header: 'agence_code', key: 'agence_code', width: 15 },
      { header: 'agence_label', key: 'agence_label', width: 25 },
      { header: 'tenant_external_ref', key: 'tenant_external_ref', width: 20 },
      { header: 'tenant_firstname', key: 'tenant_firstname', width: 15 },
      { header: 'tenant_lastname', key: 'tenant_lastname', width: 15 },
      { header: 'owner_external_ref', key: 'owner_external_ref', width: 20 },
      { header: 'owner_firstname', key: 'owner_firstname', width: 15 },
      { header: 'owner_lastname', key: 'owner_lastname', width: 15 },
      { header: 'assigned_user_username', key: 'assigned_user_username', width: 20 },
      { header: 'assigned_user_firstname', key: 'assigned_user_firstname', width: 15 },
      { header: 'assigned_user_lastname', key: 'assigned_user_lastname', width: 15 },
      { header: 'statut_code', key: 'statut_code', width: 15 },
      { header: 'statut_label', key: 'statut_label', width: 20 },
      { header: 'metier_code', key: 'metier_code', width: 15 },
      { header: 'metier_label', key: 'metier_label', width: 25 },
      { header: 'date', key: 'date', width: 20 },
      { header: 'date_termine', key: 'date_termine', width: 20 },
      { header: 'date_prevue', key: 'date_prevue', width: 20 },
      { header: 'due_date', key: 'due_date', width: 20 },
      { header: 'contexte_intervention', key: 'contexte_intervention', width: 40 },
      { header: 'consigne_intervention', key: 'consigne_intervention', width: 40 },
      { header: 'consigne_second_artisan', key: 'consigne_second_artisan', width: 40 },
      { header: 'commentaire_agent', key: 'commentaire_agent', width: 40 },
      { header: 'adresse', key: 'adresse', width: 40 },
      { header: 'code_postal', key: 'code_postal', width: 12 },
      { header: 'ville', key: 'ville', width: 20 },
      { header: 'latitude', key: 'latitude', width: 15 },
      { header: 'longitude', key: 'longitude', width: 15 },
      { header: 'is_active', key: 'is_active', width: 10 },
      { header: 'created_at', key: 'created_at', width: 20 },
      { header: 'updated_at', key: 'updated_at', width: 20 },
      { header: 'artisans_list', key: 'artisans_list', width: 40 },
      { header: 'costs_list', key: 'costs_list', width: 60 },
      { header: 'payments_list', key: 'payments_list', width: 60 },
    ];

    // Style de l'en-tête
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Ajouter les données
    data.forEach(row => {
      const formattedRow = this.formatInterventionRow(row);
      sheet.addRow(formattedRow);
    });

    return sheet;
  }

  /**
   * Formate une ligne d'artisan
   */
  formatArtisanRow(row) {
    return {
      id: row.id || '',
      prenom: row.prenom || '',
      nom: row.nom || '',
      plain_nom: row.plain_nom || '',
      email: row.email || '',
      telephone: row.telephone || '',
      telephone2: row.telephone2 || '',
      departement: row.departement ? String(row.departement) : '',
      raison_sociale: row.raison_sociale || '',
      siret: row.siret || '',
      statut_juridique: row.statut_juridique || '',
      adresse_siege_social: row.adresse_siege_social || '',
      ville_siege_social: row.ville_siege_social || '',
      code_postal_siege_social: row.code_postal_siege_social || '',
      adresse_intervention: row.adresse_intervention || '',
      ville_intervention: row.ville_intervention || '',
      code_postal_intervention: row.code_postal_intervention || '',
      intervention_latitude: row.intervention_latitude ? String(row.intervention_latitude) : '',
      intervention_longitude: row.intervention_longitude ? String(row.intervention_longitude) : '',
      numero_associe: row.numero_associe || '',
      gestionnaire_username: row.gestionnaire_username || '',
      gestionnaire_firstname: row.gestionnaire_firstname || '',
      gestionnaire_lastname: row.gestionnaire_lastname || '',
      statut_code: row.statut_code || '',
      statut_label: row.statut_label || '',
      metiers: row.metiers || '',
      zones: row.zones || '',
      suivi_relances_docs: row.suivi_relances_docs || '',
      date_ajout: row.date_ajout ? this.formatDate(row.date_ajout) : '',
      is_active: row.is_active ? 'Oui' : 'Non',
      created_at: row.created_at ? this.formatTimestamp(row.created_at) : '',
      updated_at: row.updated_at ? this.formatTimestamp(row.updated_at) : '',
    };
  }

  /**
   * Formate une ligne d'intervention
   */
  formatInterventionRow(row) {
    return {
      id: row.id || '',
      id_inter: row.id_inter || '',
      agence_code: row.agence_code || '',
      agence_label: row.agence_label || '',
      tenant_external_ref: row.tenant_external_ref || '',
      tenant_firstname: row.tenant_firstname || '',
      tenant_lastname: row.tenant_lastname || '',
      owner_external_ref: row.owner_external_ref || '',
      owner_firstname: row.owner_firstname || '',
      owner_lastname: row.owner_lastname || '',
      assigned_user_username: row.assigned_user_username || '',
      assigned_user_firstname: row.assigned_user_firstname || '',
      assigned_user_lastname: row.assigned_user_lastname || '',
      statut_code: row.statut_code || '',
      statut_label: row.statut_label || '',
      metier_code: row.metier_code || '',
      metier_label: row.metier_label || '',
      date: row.date ? this.formatTimestamp(row.date) : '',
      date_termine: row.date_termine ? this.formatTimestamp(row.date_termine) : '',
      date_prevue: row.date_prevue ? this.formatTimestamp(row.date_prevue) : '',
      due_date: row.due_date ? this.formatTimestamp(row.due_date) : '',
      contexte_intervention: row.contexte_intervention || '',
      consigne_intervention: row.consigne_intervention || '',
      consigne_second_artisan: row.consigne_second_artisan || '',
      commentaire_agent: row.commentaire_agent || '',
      adresse: row.adresse || '',
      code_postal: row.code_postal || '',
      ville: row.ville || '',
      latitude: row.latitude ? String(row.latitude) : '',
      longitude: row.longitude ? String(row.longitude) : '',
      is_active: row.is_active ? 'Oui' : 'Non',
      created_at: row.created_at ? this.formatTimestamp(row.created_at) : '',
      updated_at: row.updated_at ? this.formatTimestamp(row.updated_at) : '',
      artisans_list: row.artisans_list || '',
      costs_list: row.costs_list || '',
      payments_list: row.payments_list || '',
    };
  }

  /**
   * Formate une date au format ISO
   */
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Formate un timestamp au format ISO
   */
  formatTimestamp(timestamp) {
    if (!timestamp) return '';
    const d = new Date(timestamp);
    return d.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  }

  /**
   * Sauvegarde le workbook dans un fichier
   */
  async saveToFile(filepath) {
    await this.workbook.xlsx.writeFile(filepath);
    return filepath;
  }

  /**
   * Retourne le workbook (pour upload direct)
   */
  getWorkbook() {
    return this.workbook;
  }
}

module.exports = ExcelFormatter;


