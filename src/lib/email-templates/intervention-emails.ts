/**
 * Email templates for intervention emails (devis and intervention requests)
 *
 * These templates generate HTML emails with inline styles for maximum email client compatibility.
 * The logo GMBS is referenced via CID (Content-ID) and must be included as an inline attachment.
 */

/**
 * WhatsApp emoji constants using Unicode escape sequences.
 * Using escapes instead of literal emoji characters prevents file-encoding corruption
 * through the build pipeline — the emoji is constructed at runtime from its codepoint.
 */
const WA = {
  TOOLS:    '\u{1F6E0}',  // 🛠
  SPEECH:   '\u{1F4AC}',  // 💬
  PIN:      '\u{1F4CD}',  // 📍
  EMAIL:    '\u{1F4E7}',  // 📧
  WARNING:  '\u26A0',     // ⚠
} as const;

/**
 * Encodes a WhatsApp message for use in a wa.me or whatsapp:// URL.
 * - Emojis are handled correctly by encodeURIComponent (UTF-8 percent-encoding)
 * - Asterisks (*) are left unencoded by encodeURIComponent, so WhatsApp bold is preserved
 */
export function encodeWhatsAppUrl(phone: string, message: string): string {
  const encoded = encodeURIComponent(message);
  return phone
    ? `https://wa.me/${phone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export interface EmailTemplateData {
  nomClient: string;
  telephoneClient: string;
  telephoneClient2?: string;
  adresse: string;
  datePrevue?: string;
  consigneArtisan?: string;
  coutSST?: string;
  commentaire?: string;
  idIntervention?: string;
  isVacant?: boolean;
  keyCode?: string;
  floor?: string;
  apartmentNumber?: string;
  vacantHousingInstructions?: string;
}

/**
 * Formats a date string from ISO format (YYYY-MM-DD) to French format (DD/MM/YYYY)
 * If the date is already in text format or not in ISO format, returns it as-is
 */
function formatDateToFrench(dateStr: string | undefined): string {
  if (!dateStr) return 'À définir';

  // If the date is already in text format (ex: "15 janvier 2024"), return it as-is
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Convert YYYY-MM-DD to DD/MM/YYYY
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Applies default values for optional fields
 */
function applyDefaults(data: EmailTemplateData) {
  return {
    nomClient: data.nomClient || '',
    telephoneClient: data.telephoneClient || '',
    telephoneClient2: data.telephoneClient2 || '',
    adresse: data.adresse || '',
    datePrevue: data.datePrevue ? formatDateToFrench(data.datePrevue) : 'À définir',
    consigneArtisan: data.consigneArtisan || 'Aucune description fournie',
    coutSST: data.coutSST || 'Non spécifié',
    commentaire: data.commentaire || '',
    idIntervention: data.idIntervention || '',
    isVacant: data.isVacant || false,
    keyCode: data.keyCode || '',
    floor: data.floor || '',
    apartmentNumber: data.apartmentNumber || '',
    vacantHousingInstructions: data.vacantHousingInstructions || '',
  };
}

/**
 * Generates the HTML block for client or vacant housing information
 */
function renderClientInfoHtml(d: ReturnType<typeof applyDefaults>): string {
  if (d.isVacant) {
    const details = [
      d.keyCode ? `<strong>Code clé :</strong> ${escapeHtml(d.keyCode)}` : '',
      d.floor ? `<strong>Étage :</strong> ${escapeHtml(d.floor)}` : '',
      d.apartmentNumber ? `<strong>N° appart. :</strong> ${escapeHtml(d.apartmentNumber)}` : '',
    ].filter(Boolean);

    return `
              <p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>🏠 Logement vacant</strong>
              </p>
              ${details.length > 0 ? `
              <p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                ${details.join(' &nbsp;|&nbsp; ')}
              </p>` : ''}
              <p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Adresse :</strong> ${escapeHtml(d.adresse)}
              </p>
              ${d.vacantHousingInstructions ? `
              <p style="margin: 8px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Consignes d'accès :</strong> ${escapeHtml(d.vacantHousingInstructions)}
              </p>` : `
              <p style="margin: 8px 0 30px 0;"></p>`}`;
  }

  return `
              <p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Client :</strong> ${escapeHtml(d.nomClient)}
              </p>
              <p style="margin: 8px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Téléphone :</strong> ${escapeHtml(d.telephoneClient)}
                ${d.telephoneClient2 ? `<br /><strong>Téléphone 2 :</strong> ${escapeHtml(d.telephoneClient2)}` : ''}
              </p>
              <p style="margin: 8px 0 30px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                <strong>Adresse :</strong> ${escapeHtml(d.adresse)}
              </p>`;
}

/**
 * Generates the plain text block for client or vacant housing information
 */
function renderClientInfoText(d: ReturnType<typeof applyDefaults>): string {
  if (d.isVacant) {
    let text = `Logement vacant\n`;
    if (d.keyCode) text += `Code cle : ${d.keyCode}\n`;
    if (d.floor) text += `Etage : ${d.floor}\n`;
    if (d.apartmentNumber) text += `N appart. : ${d.apartmentNumber}\n`;
    text += `Adresse : ${d.adresse}`;
    if (d.vacantHousingInstructions) text += `\nConsignes d'acces : ${d.vacantHousingInstructions}`;
    return text;
  }

  let text = `Client : ${d.nomClient}\n`;
  text += `Telephone : ${d.telephoneClient}`;
  if (d.telephoneClient2) text += `\nTelephone 2 : ${d.telephoneClient2}`;
  text += `\nAdresse : ${d.adresse}`;
  return text;
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
              
              <!-- Client / Logement Information -->
              ${renderClientInfoHtml(d)}

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
              
              <!-- Client / Logement Information -->
              ${renderClientInfoHtml(d)}

              <!-- Consignes d'intervention -->
              <p style="margin: 20px 0 10px 0; color: #333333; font-size: 16px; font-weight: bold; line-height: 1.6;">
                🛠 CONSIGNES D'INTERVENTION :
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Intervention à réaliser : ${escapeHtml(d.consigneArtisan)}
              </p>
              <p style="margin: 5px 0; color: #333333; font-size: 14px; line-height: 1.6;">
                Budget maximum autorisé : <strong>${escapeHtml(d.coutSST)} € (HT)</strong>
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

  if (!data.isVacant) {
    if (!data.nomClient || data.nomClient.trim().length === 0) {
      missing.push('nomClient');
    }
    if (!data.telephoneClient || data.telephoneClient.trim().length === 0) {
      missing.push('telephoneClient');
    }
  }

  if (!data.adresse || data.adresse.trim().length === 0) {
    missing.push('adresse');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Generates WhatsApp text message for "Demande de devis" (visit request)
 */
export function generateDevisWhatsAppText(data: EmailTemplateData): string {
  const d = applyDefaults(data);

  let message = `Bonjour,\n\n`;
  message += `Merci d'effectuer une visite technique avant le ${d.datePrevue} :\n\n`;

  // Client / Logement Information
  message += renderClientInfoText(d) + `\n\n`;

  // Consignes de visite technique
  message += `--- CONSIGNES DE VISITE TECHNIQUE ---\n`;
  message += `Devis a effectuer : ${d.consigneArtisan}\n`;
  message += `Se presenter en tant que technicien GMBS, mandate par l'agence du client\n`;
  message += `Ne pas parler de prix avec le client\n\n`;

  // Commentaire
  if (d.commentaire) {
    message += `--- COMMENTAIRE ---\n${d.commentaire}\n\n`;
  }

  // À faire après la visite technique
  message += `--- A FAIRE APRES LA VISITE TECHNIQUE ---\n`;
  message += `1. Envoyer le devis en reponse a ce mail\n`;
  message += `2. Envoyer les photos de la visite technique\n\n`;

  // Coordonnées GMBS
  message += `--- Coordonnees GMBS ---\n`;
  message += `GMBS\n`;
  message += `44 rue de la Faisanderie\n`;
  message += `75116 Paris\n`;
  message += `SIRET : 914 370 689 00012\n\n`;

  message += `Le suivi de cette chronologie permet un traitement rapide et efficace.\n`;
  message += `L'équipe GMBS vous remercie pour votre collaboration !`;

  return message;
}

/**
 * Generates WhatsApp text message for "Demande d'intervention" (intervention request)
 */
export function generateInterventionWhatsAppText(data: EmailTemplateData): string {
  const d = applyDefaults(data);
  const interventionId = d.idIntervention || 'XXXX';

  let message = `Bonjour,\n\n`;
  message += `Merci d'intervenir dès que possible, avant le ${d.datePrevue}, pour le client suivant :\n\n`;

  // Client / Logement Information
  message += renderClientInfoText(d) + `\n\n`;

  // Consignes d'intervention
  message += `--- CONSIGNES D'INTERVENTION ---\n`;
  message += `Intervention a realiser : ${d.consigneArtisan}\n`;
  message += `Budget maximum autorise : ${d.coutSST}\n`;
  message += `Se presenter en tant que technicien GMBS, mandate par l'agence du client\n`;
  message += `Ne pas discuter le prix avec le client\n`;
  message += `En cas de depassement du budget, avertir GMBS avant toute action supplementaire\n\n`;

  // Commentaire
  if (d.commentaire) {
    message += `--- COMMENTAIRE ---\n${d.commentaire}\n\n`;
  }

  // À faire après l'intervention
  message += `--- A FAIRE APRES L'INTERVENTION ---\n`;
  message += `1. Faire apparaitre la reference GMBS (ID ${interventionId}) dans l'objet du mail et dans le corps de la facture\n`;
  message += `2. Photos de l'intervention : avant et apres obligatoires\n`;
  message += `3. Envoyer la facture en autoliquidation\n`;
  message += `4. RIB : a joindre avec la facture\n`;
  message += `5. Envoyer l'ensemble des documents a : gmbs.compta@gmail.com\n`;
  message += `IMPORTANT : Tous les documents (photos, facture et RIB) doivent etre envoyes dans le meme mail\n\n`;

  // Coordonnées de facturation GMBS
  message += `--- Coordonnees de facturation GMBS ---\n`;
  message += `GMBS\n`;
  message += `44 rue de la Faisanderie\n`;
  message += `75116 Paris\n`;
  message += `SIRET : 914 370 689 00012\n\n`;

  message += `Le suivi de cette chronologie permet un traitement rapide et efficace.\n`;
  message += `L'équipe GMBS vous remercie pour votre collaboration !`;

  return message;
}

