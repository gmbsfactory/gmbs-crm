/**
 * Email template for lateness notification
 * 
 * This template generates an HTML email to notify users when they are late.
 * The logo GMBS is referenced via CID (Content-ID) and must be included as an inline attachment.
 */

export interface LatenessEmailData {
  firstname: string;
  lastname: string;
  latenessMinutes: number;
  loginTime: string; // Format: "HH:MM"
  latenessCount: number;
  motivationMessage: string;
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
 * Formats lateness duration in a human-readable way
 */
function formatLateness(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} heure${hours > 1 ? 's' : ''}`;
  }
  return `${hours}h${remainingMinutes.toString().padStart(2, '0')}`;
}

/**
 * Gets a motivational emoji based on lateness count
 */
function getMotivationalEmoji(count: number): string {
  if (count <= 2) return '😊';
  if (count <= 5) return '💪';
  if (count <= 10) return '🎯';
  return '🚀';
}

/**
 * Generates HTML email template for lateness notification
 */
export function generateLatenessEmailTemplate(data: LatenessEmailData): string {
  const { firstname, lastname, latenessMinutes, loginTime, latenessCount, motivationMessage } = data;
  const fullName = `${escapeHtml(firstname)} ${escapeHtml(lastname)}`;
  const formattedLateness = formatLateness(latenessMinutes);
  const emoji = getMotivationalEmoji(latenessCount);

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tu es en retard aujourd'hui</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 30px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); text-align: center;">
              <img src="cid:logoGM" alt="GMBS Logo" style="max-width: 150px; height: auto; display: block; margin: 0 auto 15px;" />
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                ⏰ Notification de retard
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 25px 0; color: #1f2937; font-size: 22px; font-weight: bold; line-height: 1.3;">
                Bonjour ${fullName} !
              </h2>
              
              <!-- Lateness info card -->
              <div style="padding: 25px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; margin-bottom: 25px; border-left: 5px solid #f59e0b;">
                <p style="margin: 0 0 10px 0; color: #92400e; font-size: 18px; font-weight: bold; line-height: 1.4;">
                  Tu t'es connecté(e) à <span style="color: #d97706;">${escapeHtml(loginTime)}</span> ce matin
                </p>
                <p style="margin: 0; color: #78350f; font-size: 24px; font-weight: bold; line-height: 1.4;">
                  Soit <span style="color: #dc2626;">${formattedLateness}</span> de retard
                </p>
              </div>
              
              <!-- Lateness count -->
              <div style="padding: 20px; background-color: #f3f4f6; border-radius: 10px; margin-bottom: 25px; text-align: center;">
                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                  C'est ton
                </p>
                <p style="margin: 5px 0; color: #1f2937; font-size: 36px; font-weight: bold; line-height: 1.2;">
                  ${latenessCount}<sup style="font-size: 16px;">${latenessCount === 1 ? 'er' : 'ème'}</sup>
                </p>
                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                  retard cette année
                </p>
              </div>
              
              <!-- Motivation message -->
              <div style="padding: 25px; background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; margin-bottom: 25px; text-align: center; border: 2px solid #10b981;">
                <p style="margin: 0 0 10px 0; font-size: 32px;">
                  ${emoji}
                </p>
                <p style="margin: 0; color: #065f46; font-size: 18px; font-weight: 500; line-height: 1.5; font-style: italic;">
                  "${escapeHtml(motivationMessage)}"
                </p>
              </div>
              
              <!-- Reminder -->
              <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                L'heure d'arrivée prévue est <strong>10h00</strong> les jours ouvrés (lundi-vendredi).
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Bonne journée !<br />
                <strong>L'équipe GMBS</strong>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                GMBS - 44 rue de la Faisanderie, 75116 Paris
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Footer disclaimer -->
        <table width="600" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 20px 40px; text-align: center;">
              <p style="margin: 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                Cet email a été envoyé automatiquement par le système GMBS.<br />
                Merci de ne pas répondre directement à cet email.
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
 * Generates email subject for lateness notification
 */
export function generateLatenessEmailSubject(latenessMinutes: number): string {
  const formattedLateness = formatLateness(latenessMinutes);
  return `⏰ Tu es en retard de ${formattedLateness} aujourd'hui`;
}
