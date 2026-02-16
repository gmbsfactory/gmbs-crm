import { NextResponse } from 'next/server';
import { createSSRServerClient } from '@/lib/supabase/server-ssr';
import { decryptPassword } from '@/lib/utils/encryption';
import { sendEmailToArtisan, validateGmailEmail, type Attachment } from '@/lib/services/email-service';
import { validateRequiredFields } from '@/lib/email-templates/intervention-emails';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

interface SendEmailRequest {
  type: 'devis' | 'intervention';
  artisanId: string;
  artisanEmail?: string; // Email passé directement depuis le frontend (pour artisan non encore sauvegardé)
  subject: string;
  htmlContent: string;
  attachments?: Array<{
    filename: string;
    contentType?: string;
    content?: string; // base64 encoded
  }>;
}

/**
 * POST /api/interventions/[id]/send-email
 * Sends an email to an artisan from an intervention
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id: interventionId } = await params;

    // @supabase/ssr lit automatiquement les cookies de session
    const supabase = await createSSRServerClient();
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non authentifié' }, { status: 401 });
    }

    // Parse request body
    const body: SendEmailRequest = await request.json();

    // Validate email type
    if (body.type !== 'devis' && body.type !== 'intervention') {
      return NextResponse.json(
        { error: "Type d'email invalide. Doit être 'devis' ou 'intervention'" },
        { status: 400 }
      );
    }

    // Validate artisan ID
    if (!body.artisanId) {
      return NextResponse.json({ error: 'Artisan ID requis' }, { status: 400 });
    }

    // Validate subject and content
    if (!body.subject || body.subject.trim().length === 0) {
      return NextResponse.json({ error: 'Sujet requis' }, { status: 400 });
    }

    if (!body.htmlContent || body.htmlContent.trim().length === 0) {
      return NextResponse.json({ error: 'Contenu HTML requis' }, { status: 400 });
    }

    // Fetch intervention (only to verify it exists)
    const { data: intervention, error: interventionError } = await supabase
      .from('interventions')
      .select('id, id_inter')
      .eq('id', interventionId)
      .single();

    if (interventionError || !intervention) {
      return NextResponse.json({ error: 'Intervention introuvable' }, { status: 404 });
    }

    // Determine artisan email - prioritize email from frontend (for unsaved artisan selection)
    let artisanEmail = body.artisanEmail?.trim() || '';

    // If no email provided in request, fetch from artisans table directly
    if (!artisanEmail) {
      const { data: artisanData, error: artisanError } = await supabase
        .from('artisans')
        .select('id, email')
        .eq('id', body.artisanId)
        .single();

      if (artisanError || !artisanData) {
        return NextResponse.json({ error: 'Artisan non trouvé' }, { status: 404 });
      }

      artisanEmail = artisanData.email?.trim() || '';
    }

    // Validate artisan email
    if (!artisanEmail || artisanEmail.length === 0) {
      return NextResponse.json(
        { error: "L'artisan sélectionné n'a pas d'email valide" },
        { status: 400 }
      );
    }

    // Fetch user email credentials via auth_user_mapping
    let user: { email_smtp: string | null; email_password_encrypted: string | null } | null = null;
    const authEmail = auth?.user?.email;
    
    
    // 1. Chercher via le mapping
    const { data: mapping, error: mappingError } = await supabase
      .from('auth_user_mapping')
      .select('public_user_id')
      .eq('auth_user_id', userId)
      .maybeSingle();
    
    
    if (mapping?.public_user_id) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email_smtp, email_password_encrypted')
        .eq('id', mapping.public_user_id)
        .single();
      
      
      if (!userError) {
        user = userData;
      }
    }
    
    // 2. Fallback: chercher par email
    if (!user && authEmail) {
      const { data: userData, error: emailError } = await supabase
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
            'Credentials email non configurés. Veuillez configurer votre email dans Settings > Profile',
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
      console.error('[send-email] Password decryption failed:', error);
      return NextResponse.json(
        { error: 'Erreur lors du déchiffrement du mot de passe' },
        { status: 500 }
      );
    }

    // Prepare attachments from request
    const attachments: Attachment[] = [];
    if (body.attachments && body.attachments.length > 0) {
      for (const att of body.attachments) {
        if (att.content) {
          // Decode base64 content
          try {
            const contentBuffer = Buffer.from(att.content, 'base64');
            attachments.push({
              filename: att.filename,
              content: contentBuffer,
              contentType: att.contentType,
            });
          } catch (error) {
            console.error('[send-email] Failed to decode attachment:', att.filename, error);
            // Continue with other attachments
          }
        }
      }
    }

    // Send email
    const emailResult = await sendEmailToArtisan({
      type: body.type,
      artisanEmail,
      subject: body.subject,
      htmlContent: body.htmlContent,
      smtpEmail: user.email_smtp,
      smtpPassword,
      attachments,
    });

    // Create log entry (async, non-blocking)
    const logStatus = emailResult.success ? 'sent' : 'failed';
    const logData = {
      intervention_id: interventionId,
      artisan_id: body.artisanId,
      sent_by: userId,
      recipient_email: artisanEmail,
      subject: body.subject,
      message_html: body.htmlContent,
      email_type: body.type,
      attachments_count: attachments.length + 1, // +1 for logo GMBS
      status: logStatus,
      error_message: emailResult.error || null,
    };

    // Don't await - log asynchronously
    Promise.resolve(
      supabase
        .from('email_logs')
        .insert(logData)
    )
      .then((result) => {
        if (result.error) {
          console.error('[send-email] Failed to create email log:', result.error);
        }
      })
      .catch((error) => {
        console.error('[send-email] Error creating email log:', error);
      });

    if (!emailResult.success) {
      return NextResponse.json(
        { error: emailResult.error || "Erreur lors de l'envoi de l'email" },
        { status: 500 }
      );
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Email envoyé avec succès',
    });
  } catch (error) {
    console.error('[send-email] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

