import { NextResponse } from 'next/server';
import { bearerFrom, createServerSupabase } from '@/lib/supabase/server';
import { decryptPassword } from '@/lib/utils/encryption';
import { sendEmailToArtisan, validateGmailEmail } from '@/lib/services/email-service';
import { generateInvitationEmailTemplate, generateInvitationEmailSubject } from '@/lib/email-templates/invitation-email';
import { requirePermission, isPermissionError, getAuthenticatedUser } from '@/lib/api/permissions';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

interface SendInviteRequest {
  recipientEmail: string;
  recipientFirstname: string;
  recipientLastname: string;
  inviteLink: string;
}

/**
 * POST /api/settings/team/user/send-invite
 * Sends an invitation email to a newly created user
 */
export async function POST(request: Request) {
  // Check permission: write_users to send invitations
  const permCheck = await requirePermission(request, 'write_users');
  if (isPermissionError(permCheck)) return permCheck.error;

  try {
    // Get token from Authorization header or cookies
    let token = bearerFrom(request);
    
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('sb-access-token')?.value || null;
    }

    if (!token) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const supabase = createServerSupabase(token);
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError || !auth?.user?.id) {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 });
    }

    const userId = auth.user.id;
    const authEmail = auth.user.email;

    // Parse request body
    const body: SendInviteRequest = await request.json();

    // Validate required fields
    if (!body.recipientEmail || !body.recipientEmail.trim()) {
      return NextResponse.json({ error: 'Email du destinataire requis' }, { status: 400 });
    }

    if (!body.recipientFirstname || !body.recipientFirstname.trim()) {
      return NextResponse.json({ error: 'Prénom du destinataire requis' }, { status: 400 });
    }

    if (!body.recipientLastname || !body.recipientLastname.trim()) {
      return NextResponse.json({ error: 'Nom du destinataire requis' }, { status: 400 });
    }

    if (!body.inviteLink || !body.inviteLink.trim()) {
      return NextResponse.json({ error: "Lien d'invitation requis" }, { status: 400 });
    }

    // Get the current user's SMTP credentials
    let user: { email_smtp: string | null; email_password_encrypted: string | null } | null = null;

    // 1. Try to find user by auth ID first
    if (userId) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email_smtp, email_password_encrypted')
        .eq('id', userId)
        .maybeSingle();

      if (!userError && userData) {
        user = userData;
      }
    }

    // 2. Fallback: find by email
    if (!user && authEmail) {
      const { data: userData } = await supabase
        .from('users')
        .select('email_smtp, email_password_encrypted')
        .eq('email', authEmail)
        .maybeSingle();

      user = userData;
    }

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    if (!user.email_smtp || !user.email_password_encrypted) {
      return NextResponse.json(
        {
          error:
            'Credentials email non configurés. Veuillez configurer votre email SMTP dans Paramètres > Profil',
        },
        { status: 400 }
      );
    }

    // Validate Gmail email format
    if (!validateGmailEmail(user.email_smtp)) {
      return NextResponse.json(
        { error: "L'email SMTP doit être une adresse Gmail valide" },
        { status: 400 }
      );
    }

    // Decrypt password
    let smtpPassword: string;
    try {
      smtpPassword = decryptPassword(user.email_password_encrypted);
    } catch (error) {
      console.error('[send-invite] Password decryption failed:', error);
      return NextResponse.json(
        { error: 'Erreur lors du déchiffrement du mot de passe SMTP' },
        { status: 500 }
      );
    }

    // Generate email content
    const htmlContent = generateInvitationEmailTemplate({
      firstname: body.recipientFirstname.trim(),
      lastname: body.recipientLastname.trim(),
      inviteLink: body.inviteLink.trim(),
    });

    const subject = generateInvitationEmailSubject();

    // Send email
    const result = await sendEmailToArtisan({
      type: 'intervention', // Using 'intervention' type as it's the generic sender
      artisanEmail: body.recipientEmail.trim(),
      subject,
      htmlContent,
      smtpEmail: user.email_smtp,
      smtpPassword,
      attachments: [], // No attachments for invitation email
    });

    if (!result.success) {
      console.error('[send-invite] Email sending failed:', result.error);
      return NextResponse.json(
        { error: result.error || "Erreur lors de l'envoi de l'email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Invitation envoyée à ${body.recipientEmail}`,
    });
  } catch (error: any) {
    console.error('[send-invite] Unexpected error:', error);
    return NextResponse.json(
      { error: error?.message || "Erreur lors de l'envoi de l'invitation" },
      { status: 500 }
    );
  }
}
