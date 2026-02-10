import nodemailer, { type Transporter } from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';

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

  // Load logo attachment (automatic, always included)
  let logoAttachment: Attachment;
  try {
    logoAttachment = loadLogoAttachment();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load logo',
    };
  }

  // Prepare all attachments (logo + user attachments)
  const allAttachments: SendMailOptions['attachments'] = [
    logoAttachment,
    ...attachments.map((att) => ({
      filename: att.filename,
      path: att.path,
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
      
      // Success
      return {
        success: true,
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

