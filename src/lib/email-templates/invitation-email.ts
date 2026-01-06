/**
 * Email template for user invitation
 * 
 * This template generates an HTML email for inviting new users to set their password.
 * The logo GMBS is referenced via CID (Content-ID) and must be included as an inline attachment.
 */

export interface InvitationEmailData {
  firstname: string;
  lastname: string;
  inviteLink: string;
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
 * Generates HTML email template for user invitation
 */
export function generateInvitationEmailTemplate(data: InvitationEmailData): string {
  const { firstname, lastname, inviteLink } = data;
  const fullName = `${escapeHtml(firstname)} ${escapeHtml(lastname)}`;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue chez GMBS - Créez votre mot de passe</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header with Logo -->
          <tr>
            <td align="center" style="padding: 40px 40px 30px; background: linear-gradient(135deg, #4f46e5 0%, #1e1b4b 100%); text-align: center;">
              <img src="cid:logoGM" alt="GMBS Logo" style="max-width: 180px; height: auto; display: block; margin: 0 auto;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h1 style="margin: 0 0 20px 0; color: #1f2937; font-size: 24px; font-weight: bold; line-height: 1.3;">
                Bienvenue chez GMBS, ${fullName} !
              </h1>
              
              <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Un compte a été créé pour vous sur le CRM GMBS. Pour accéder à votre espace, vous devez d'abord définir votre mot de passe.
              </p>
              
              <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Cliquez sur le bouton ci-dessous pour créer votre mot de passe et activer votre compte :
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${escapeHtml(inviteLink)}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 8px; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);">
                      Définir mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Warning -->
              <div style="padding: 16px 20px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 0 8px 8px 0; margin-bottom: 30px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  <strong>Important :</strong> Ce lien expire dans <strong>24 heures</strong>. Si le lien a expiré, contactez votre administrateur pour en obtenir un nouveau.
                </p>
              </div>
              
              <!-- Alternative link -->
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :
              </p>
              <p style="margin: 0 0 30px 0; word-break: break-all;">
                <a href="${escapeHtml(inviteLink)}" style="color: #4f46e5; font-size: 13px; text-decoration: underline;">
                  ${escapeHtml(inviteLink)}
                </a>
              </p>
              
              <!-- Help text -->
              <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.6;">
                Si vous n'avez pas demandé ce compte, vous pouvez ignorer cet email en toute sécurité.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Cordialement,<br />
                <strong>L'équipe GMBS</strong>
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">
                GMBS - 44 rue de la Faisanderie, 75116 Paris<br />
                SIRET : 914 370 689 00012
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
 * Generates email subject for invitation
 */
export function generateInvitationEmailSubject(): string {
  return 'Bienvenue chez GMBS - Créez votre mot de passe';
}
