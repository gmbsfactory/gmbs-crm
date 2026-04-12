import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSSRServerClient } from '@/lib/supabase/server-ssr';
import { decryptPassword } from '@/lib/utils/encryption';
import { sendEmailToArtisan, validateGmailEmail } from '@/lib/services/email-service';
import { requirePermission, isPermissionError } from '@/lib/auth/permissions';
import { createPasswordResetToken, getSiteUrlFromRequest } from '@/lib/password-reset-tokens';

export const runtime = 'nodejs';

interface ResetPasswordRequest {
  userId: string;
  sendEmail?: boolean;
}

/**
 * POST /api/settings/team/user/reset-password
 * Generates a password reset link for an existing user and optionally sends it by email
 */
export async function POST(request: Request) {
  // Check permission: write_users to reset passwords
  const permCheck = await requirePermission(request, 'write_users');
  if (isPermissionError(permCheck)) return permCheck.error;

  try {
    const body: ResetPasswordRequest = await request.json();
    const { userId, sendEmail } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      console.error('[reset-password] supabaseAdmin is null');
      return NextResponse.json({ error: 'Configuration serveur invalide' }, { status: 500 });
    }

    // Get the user's email from public.users
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, firstname, lastname')
      .eq('id', userId)
      .maybeSingle();

    if (userError || !userData) {
      console.error('[reset-password] User not found:', userError?.message);
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    if (!userData.email) {
      return NextResponse.json({ error: 'L\'utilisateur n\'a pas d\'email configuré' }, { status: 400 });
    }

    // Créer un token custom réutilisable (24h) au lieu d'un lien Supabase à usage unique
    const siteUrl = getSiteUrlFromRequest(request);
    const tokenResult = await createPasswordResetToken(userData.id, siteUrl);

    if (!tokenResult) {
      return NextResponse.json({
        error: 'Le lien de réinitialisation n\'a pas pu être généré'
      }, { status: 500 });
    }

    const resetLink = tokenResult.resetLink;

    // If sendEmail is true, send the email
    if (sendEmail) {
      // @supabase/ssr lit automatiquement les cookies de session
      const supabase = await createSSRServerClient();
      const { data: auth } = await supabase.auth.getUser();
      const adminUserId = auth?.user?.id;
      const adminEmail = auth?.user?.email;

      // Get admin's SMTP credentials
      let adminUser: { email_smtp: string | null; email_password_encrypted: string | null } | null = null;

      if (adminUserId) {
        const { data } = await supabase
          .from('users')
          .select('email_smtp, email_password_encrypted')
          .eq('id', adminUserId)
          .maybeSingle();
        adminUser = data;
      }

      if (!adminUser && adminEmail) {
        const { data } = await supabase
          .from('users')
          .select('email_smtp, email_password_encrypted')
          .eq('email', adminEmail)
          .maybeSingle();
        adminUser = data;
      }

      if (!adminUser?.email_smtp || !adminUser?.email_password_encrypted) {
        return NextResponse.json({ 
          ok: true, 
          resetLink,
          emailSent: false,
          message: 'Lien généré mais SMTP non configuré'
        });
      }

      if (!validateGmailEmail(adminUser.email_smtp)) {
        return NextResponse.json({ 
          ok: true, 
          resetLink,
          emailSent: false,
          message: 'Lien généré mais email SMTP invalide'
        });
      }

      // Decrypt password and send email
      let smtpPassword: string;
      try {
        smtpPassword = decryptPassword(adminUser.email_password_encrypted);
      } catch (error) {
        console.error('[reset-password] Password decryption failed:', error);
        return NextResponse.json({ 
          ok: true, 
          resetLink,
          emailSent: false,
          message: 'Lien généré mais erreur de déchiffrement SMTP'
        });
      }

      // Generate email content
      const htmlContent = generateResetPasswordEmailTemplate({
        firstname: userData.firstname || '',
        lastname: userData.lastname || '',
        resetLink,
      });

      const result = await sendEmailToArtisan({
        type: 'intervention',
        artisanEmail: userData.email,
        subject: 'Réinitialisation de votre mot de passe - GMBS Gestion',
        htmlContent,
        smtpEmail: adminUser.email_smtp,
        smtpPassword,
        attachments: [],
      });

      if (!result.success) {
        console.error('[reset-password] Email sending failed:', result.error);
        return NextResponse.json({ 
          ok: true, 
          resetLink,
          emailSent: false,
          message: 'Lien généré mais erreur d\'envoi email: ' + result.error
        });
      }

      return NextResponse.json({
        ok: true,
        resetLink,
        emailSent: true,
        message: `Email de réinitialisation envoyé à ${userData.email}`
      });
    }

    // Just return the link without sending email
    return NextResponse.json({
      ok: true,
      resetLink,
      emailSent: false,
      userEmail: userData.email,
      userFirstname: userData.firstname,
      userLastname: userData.lastname,
    });

  } catch (error: any) {
    console.error('[reset-password] Unexpected error:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur inattendue' },
      { status: 500 }
    );
  }
}

// Email template for password reset
function generateResetPasswordEmailTemplate(data: {
  firstname: string;
  lastname: string;
  resetLink: string;
}): string {
  const fullName = [data.firstname, data.lastname].filter(Boolean).join(' ') || 'Utilisateur';
  
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Réinitialisation de mot de passe</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                🔐 Réinitialisation de mot de passe
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #18181b; font-size: 16px; line-height: 1.6;">
                Bonjour <strong>${escapeHtml(fullName)}</strong>,
              </p>

              <p style="margin: 0 0 30px; color: #52525b; font-size: 15px; line-height: 1.6;">
                Vous avez reçu ce message car un administrateur a demandé la réinitialisation de votre mot de passe pour votre compte GMBS Gestion.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 10px 0 30px;">
                    <a href="${escapeHtml(data.resetLink)}" 
                       target="_blank" 
                       style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 12px; box-shadow: 0 4px 14px 0 rgba(59,130,246,0.4);">
                      Définir un nouveau mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <div style="padding: 20px; background-color: #fef3c7; border-radius: 12px; margin-bottom: 30px;">
                <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.5;">
                  ⏰ <strong>Ce lien expire dans 24 heures.</strong> Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
                </p>
              </div>

              <p style="margin: 0 0 15px; color: #71717a; font-size: 13px; line-height: 1.5;">
                Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
              </p>
              <p style="margin: 0; padding: 15px; background-color: #f4f4f5; border-radius: 8px; word-break: break-all;">
                <a href="${escapeHtml(data.resetLink)}" style="color: #3b82f6; font-size: 13px; text-decoration: none;">
                  ${escapeHtml(data.resetLink)}
                </a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e4e4e7; text-align: center;">
              <p style="margin: 0; color: #a1a1aa; font-size: 13px;">
                GMBS Gestion • Cet email a été envoyé automatiquement
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
