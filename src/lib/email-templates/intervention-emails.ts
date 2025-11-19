/**
 * Email templates for intervention emails (devis and intervention requests)
 * 
 * These templates generate HTML emails with inline styles for maximum email client compatibility.
 * The logo GMBS is referenced via CID (Content-ID) and must be included as an inline attachment.
 */

export interface EmailTemplateData {
  nomClient: string;
  telephoneClient: string;
  telephoneClient2?: string;
  adresseComplete: string;
  datePrevue?: string;
  consigneArtisan?: string;
  coutSST?: string;
  commentaire?: string;
  idIntervention?: string;
}

/**
 * Applies default values for optional fields
 */
function applyDefaults(data: EmailTemplateData): Required<Omit<EmailTemplateData, 'nomClient' | 'telephoneClient' | 'adresseComplete'>> & Pick<EmailTemplateData, 'nomClient' | 'telephoneClient' | 'adresseComplete'> {
  return {
    nomClient: data.nomClient || '',
    telephoneClient: data.telephoneClient || '',
    telephoneClient2: data.telephoneClient2 || '',
    adresseComplete: data.adresseComplete || '',
    datePrevue: data.datePrevue || 'À définir',
    consigneArtisan: data.consigneArtisan || 'Aucune description fournie',
    coutSST: data.coutSST || 'Non spécifié',
    commentaire: data.commentaire || '',
    idIntervention: data.idIntervention || '',
  };
}

/**
 * Generates HTML email template for "Demande de devis" (visit request)
 */
export function generateDevisEmailTemplate(data: EmailTemplateData): string {
  const d = applyDefaults(data);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demande de devis</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 30px 40px; background-color: #f9f9f9; text-align: center;">
              <img src="cid:logoGM" alt="GMBS Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 14px; line-height: 1.6;">Bonjour,</p>
              
              <p style="margin: 0 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Merci d'effectuer une visite technique avant le <strong>${escapeHtml(d.datePrevue)}</strong> :
              </p>
              
              <!-- Client Information -->
              <p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Client :</strong> ${escapeHtml(d.nomClient)}
              </p>
              <p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Téléphone :</strong> ${escapeHtml(d.telephoneClient)}
                ${d.telephoneClient2 ? `<br /><strong>Téléphone 2 :</strong> ${escapeHtml(d.telephoneClient2)}` : ''}
              </p>
              <p style="margin: 8px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Adresse :</strong> ${escapeHtml(d.adresseComplete)}
              </p>
              
              <!-- Consignes de visite technique -->
              <p style="margin: 20px 0 10px 0; color: #333333; font-size: 16px; font-weight: bold; line-height: 1.6;">
                🛠 CONSIGNES DE VISITE TECHNIQUE :
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Devis à effectuer : ${escapeHtml(d.consigneArtisan)}
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Se présenter en tant que technicien GMBS, mandaté par l'agence du client
              </p>
              <p style="margin: 5px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Ne pas parler de prix avec le client
              </p>
              
              <!-- Commentaire -->
              ${d.commentaire ? `
              <p style="margin: 20px 0 10px 0; color: #333333; font-size: 16px; font-weight: bold; line-height: 1.6;">
                💬 COMMENTAIRE :
              </p>
              <p style="margin: 5px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(d.commentaire)}</p>
              ` : ''}
              
              <!-- À faire après la visite technique -->
              <p style="margin: 30px 0 10px 0; color: #333333; font-size: 16px; font-weight: bold; line-height: 1.6;">
                À FAIRE APRÈS LA VISITE TECHNIQUE
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                1️⃣ Envoyer le devis en réponse à ce mail
              </p>
              <p style="margin: 5px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                2️⃣ Envoyer les photos de la visite technique
              </p>
              
              <!-- Coordonnées GMBS -->
              <p style="margin: 30px 0 10px 0; color: #333333; font-size: 16px; font-weight: bold; line-height: 1.6;">
                📍 Coordonnées GMBS
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                GMBS<br />
                44 rue de la Faisanderie<br />
                75116 Paris<br />
                SIRET : 914 370 689 00012
              </p>
              
              <p style="margin: 30px 0 0 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Le suivi de cette chronologie permet un traitement rapide et efficace.
              </p>
              <p style="margin: 10px 0 0 0; color: #333333; font-size: 14px; line-height: 1.6;">
                L'équipe GMBS vous remercie pour votre collaboration !
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #666666; font-size: 12px; line-height: 1.6;">
                <span style="color: #999999;">___</span><br />
                footer
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates HTML email template for "Demande d'intervention" (intervention request)
 */
export function generateInterventionEmailTemplate(data: EmailTemplateData): string {
  const d = applyDefaults(data);
  const interventionId = d.idIntervention || 'XXXX';

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demande d'intervention</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 30px 40px; background-color: #f9f9f9; text-align: center;">
              <img src="cid:logoGM" alt="GMBS Logo" style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 14px; line-height: 1.6;">Bonjour,</p>
              
              <p style="margin: 0 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Merci d'intervenir dès que possible, avant le <strong>${escapeHtml(d.datePrevue)}</strong>, pour le client suivant :
              </p>
              
              <!-- Client Information -->
              <p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Client :</strong> ${escapeHtml(d.nomClient)}
              </p>
              <p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Téléphone :</strong> ${escapeHtml(d.telephoneClient)}
                ${d.telephoneClient2 ? `<br /><strong>Téléphone 2 :</strong> ${escapeHtml(d.telephoneClient2)}` : ''}
              </p>
              <p style="margin: 8px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Adresse :</strong> ${escapeHtml(d.adresseComplete)}
              </p>
              
              <!-- Consignes d'intervention -->
              <p style="margin: 20px 0 10px 0; color: #333333; font-size: 16px; font-weight: bold; line-height: 1.6;">
                🛠 CONSIGNES D'INTERVENTION :
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Intervention à réaliser : ${escapeHtml(d.consigneArtisan)}
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Budget maximum autorisé : <strong>${escapeHtml(d.coutSST)}</strong>
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Se présenter en tant que technicien GMBS, mandaté par l'agence du client
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Ne pas discuter le prix avec le client
              </p>
              <p style="margin: 5px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                En cas de dépassement du budget, avertir GMBS avant toute action supplémentaire
              </p>
              
              <!-- Commentaire -->
              ${d.commentaire ? `
              <p style="margin: 20px 0 10px 0; color: #333333; font-size: 16px; font-weight: bold; line-height: 1.6;">
                💬 COMMENTAIRE :
              </p>
              <p style="margin: 5px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(d.commentaire)}</p>
              ` : ''}
              
              <!-- À faire après l'intervention -->
              <p style="margin: 30px 0 10px 0; color: #333333; font-size: 16px; font-weight: bold; line-height: 1.6;">
                À FAIRE APRÈS L'INTERVENTION
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                1️⃣ Faire apparaître la référence GMBS (ID ${escapeHtml(interventionId)}) dans l'objet du mail et dans le corps de la facture
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                2️⃣ Photos de l'intervention : avant et après obligatoires
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                3️⃣ Envoyer la facture en autoliquidation
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                4️⃣ RIB : à joindre avec la facture
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                5️⃣ Envoyer l'ensemble des documents à : 📧 <a href="mailto:gmbs.compta@gmail.com" style="color: #0066cc;">gmbs.compta@gmail.com</a>
              </p>
              <p style="margin: 5px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                ⚠️ Tous les documents (photos, facture et RIB) doivent être envoyés dans le même mail
              </p>
              
              <!-- Coordonnées de facturation GMBS -->
              <p style="margin: 30px 0 10px 0; color: #333333; font-size: 16px; font-weight: bold; line-height: 1.6;">
                📍 Coordonnées de facturation GMBS
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                GMBS<br />
                44 rue de la Faisanderie<br />
                75116 Paris<br />
                SIRET : 914 370 689 00012
              </p>
              
              <p style="margin: 30px 0 0 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Le suivi de cette chronologie permet un traitement rapide et efficace.
              </p>
              <p style="margin: 10px 0 0 0; color: #333333; font-size: 14px; line-height: 1.6;">
                L'équipe GMBS vous remercie pour votre collaboration !
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #666666; font-size: 12px; line-height: 1.6;">
                <span style="color: #999999;">___</span><br />
                footer
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

/**
 * Validates required fields before generating template
 */
export function validateRequiredFields(data: EmailTemplateData): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!data.nomClient || data.nomClient.trim().length === 0) {
    missing.push('nomClient');
  }
  
  if (!data.telephoneClient || data.telephoneClient.trim().length === 0) {
    missing.push('telephoneClient');
  }
  
  if (!data.adresseComplete || data.adresseComplete.trim().length === 0) {
    missing.push('adresseComplete');
  }
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

