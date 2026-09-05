import nodemailer, { type Transporter } from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { safeErrorMessage } from "@/lib/api/common/error-handler";

/**
 * Email service for sending emails via Gmail SMTP
 * 
 * Features:
 * - Gmail SMTP integration
 * - Automatic logo GMBS inline attachment
 * - Retry logic with exponential backoff (3 attempts)
 * - User attachments support
 * - Error handling and logging
 */

export interface Attachment {
  filename: string;
  /**
   * Chemin de fichier LOCAL — réservé aux pièces internes du service (le logo GMBS).
   *
   * Nodemailer lit ce chemin sur le disque du serveur : une valeur venue d'un appelant
   * ferait sortir n'importe quel fichier lisible par le processus en pièce jointe d'un
   * e-mail. `sendEmailToArtisan` refuse donc tout appel qui en fournit un (voir
   * `assertNoLocalPathAttachment`). Les pièces métier passent par `content`.
   */
  path?: string;
  content?: Buffer;
  cid?: string;
  contentType?: string;
}

export interface SendEmailParams {
  type: 'devis' | 'intervention';
  artisanEmail: string;
  subject: string;
  htmlContent: string;
  smtpEmail: string;
  smtpPassword: string;
  attachments?: Attachment[];
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
  smtpResponse?: string;
  accepted?: string[];
  rejected?: string[];
}

/**
 * Creates a nodemailer transporter for Gmail SMTP
 */
function createTransporter(smtpEmail: string, smtpPassword: string): Transporter {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpEmail,
      pass: smtpPassword,
    },
    // Timeout settings
    connectionTimeout: 60000, // 60 seconds
    socketTimeout: 60000, // 60 seconds
  });
}

/**
 * Loads the GMBS logo as an inline attachment
 */
function loadLogoAttachment(): Attachment {
  const logoPath = path.join(process.cwd(), 'public', 'logoGM.png');
  
  // Check if logo exists
  if (!fs.existsSync(logoPath)) {
    // Fallback: try SVG if PNG doesn't exist
    const logoSvgPath = path.join(process.cwd(), 'public', 'gmbs-logo.svg');
    if (fs.existsSync(logoSvgPath)) {
      return {
        filename: 'logoGM.svg',
        path: logoSvgPath,
        cid: 'logoGM',
        contentType: 'image/svg+xml',
      };
    }
    throw new Error('Logo GMBS not found. Expected: public/logoGM.png or public/gmbs-logo.svg');
  }

  return {
    filename: 'logoGM.png',
    path: logoPath,
    cid: 'logoGM',
    contentType: 'image/png',
  };
}

/**
 * Refuse toute pièce jointe désignée par un chemin de fichier local.
 *
 * Même motif que la faille SSRF corrigée dans `email-attachment-loader.ts` : une source de
 * données extérieure ne doit jamais décider de ce que le serveur lit puis expédie. Ici, la
 * lecture serait locale (`/etc/passwd`, `.env`, un secret monté) plutôt que réseau, mais
 * l'exfiltration serait la même — par pièce jointe d'un e-mail. Seul le logo GMBS, construit
 * dans ce module, a le droit d'utiliser `path`.
 *
 * @returns le libellé de la pièce fautive, ou `null` si toutes les pièces sont saines.
 */
function assertNoLocalPathAttachment(attachments: readonly Attachment[]): string | null {
  const offending = attachments.find(
    (attachment) => typeof attachment.path === 'string' && attachment.path.trim().length > 0
  );
  return offending ? offending.filename || 'sans nom' : null;
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends an email to an artisan with retry logic
 * 
 * Retry strategy:
 * - Attempt 1: Immediate
 * - Attempt 2: After 2 seconds (backoff: 2^1)
 * - Attempt 3: After 4 seconds (backoff: 2^2)
 * 
 * @param params - Email parameters
 * @returns Result with success status and optional error message
 */
export async function sendEmailToArtisan(params: SendEmailParams): Promise<SendEmailResult> {
  const { artisanEmail, subject, htmlContent, smtpEmail, smtpPassword, attachments = [] } = params;

  // Garde-fou : aucune pièce jointe ne peut désigner un fichier du disque du serveur.
  const localPathAttachment = assertNoLocalPathAttachment(attachments);
  if (localPathAttachment) {
    console.error(
      `[Email Service] Pièce jointe refusée : chemin de fichier local interdit (${localPathAttachment})`
    );
    return {
      success: false,
      error:
        "Pièce jointe refusée : seules les pièces de l'intervention peuvent être jointes " +
        '(chemin de fichier local interdit).',
    };
  }

  // Load logo attachment (automatic, always included)
  let logoAttachment: Attachment;
  try {
    logoAttachment = loadLogoAttachment();
  } catch (error) {
    return {
      success: false,
      error: safeErrorMessage(error, "le chargement du logo"),
    };
  }

  // Prepare all attachments (logo + user attachments)
  const allAttachments: SendMailOptions['attachments'] = [
    logoAttachment,
    // `path` n'est volontairement PAS recopié : seul le logo ci-dessus lit un fichier local.
    ...attachments.map((att) => ({
      filename: att.filename,
      content: att.content,
      cid: att.cid,
      contentType: att.contentType,
    })),
  ];

  // Prepare email options
  const mailOptions: SendMailOptions = {
    from: smtpEmail,
    to: artisanEmail,
    subject,
    html: htmlContent,
    attachments: allAttachments,
  };

  // Retry logic with exponential backoff
  const maxAttempts = 3;
  const backoffDelays = [0, 2000, 4000]; // 0s, 2s, 4s

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const transporter = createTransporter(smtpEmail, smtpPassword);
      
      // Send email
      const info = await transporter.sendMail(mailOptions);

      // Success — capture SMTP feedback
      return {
        success: true,
        messageId: info.messageId,
        smtpResponse: info.response,
        accepted: Array.isArray(info.accepted) ? info.accepted.map(String) : [],
        rejected: Array.isArray(info.rejected) ? info.rejected.map(String) : [],
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Log attempt
      console.error(`[Email Service] Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);
      
      // If not the last attempt, wait before retrying
      if (attempt < maxAttempts) {
        const delay = backoffDelays[attempt];
        await sleep(delay);
      }
    }
  }

  // All attempts failed
  return {
    success: false,
    error: lastError?.message || 'Failed to send email after 3 attempts',
  };
}

/**
 * Validates email address format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates Gmail email address format
 */
export function validateGmailEmail(email: string): boolean {
  if (!validateEmail(email)) {
    return false;
  }
  // Check if it's a Gmail address (gmail.com or googlemail.com)
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === 'gmail.com' || domain === 'googlemail.com';
}

