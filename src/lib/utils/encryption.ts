import crypto from 'crypto';

/**
 * Encryption utilities for email passwords using AES-256-CBC
 * 
 * The encryption key and IV must be set in environment variables:
 * - EMAIL_PASSWORD_ENCRYPTION_KEY: 32+ character hex string
 * - EMAIL_PASSWORD_ENCRYPTION_IV: 16 character hex string
 */

const ENCRYPTION_KEY = process.env.EMAIL_PASSWORD_ENCRYPTION_KEY;
const ENCRYPTION_IV = process.env.EMAIL_PASSWORD_ENCRYPTION_IV;

if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
  throw new Error(
    'EMAIL_PASSWORD_ENCRYPTION_KEY and EMAIL_PASSWORD_ENCRYPTION_IV must be set in environment variables'
  );
}

// TypeScript assertion: these are guaranteed to be strings after the check above
const ENCRYPTION_KEY_SAFE: string = ENCRYPTION_KEY;
const ENCRYPTION_IV_SAFE: string = ENCRYPTION_IV;

/**
 * Encrypts a password using AES-256-CBC
 * @param password - The plain text password to encrypt
 * @returns The encrypted password as a hex string
 * @throws Error if encryption fails
 */
export function encryptPassword(password: string): string {
  if (!password) {
    throw new Error('Password cannot be empty');
  }

  try {
    const keyBuffer = Buffer.from(ENCRYPTION_KEY_SAFE, 'hex');
    const ivBuffer = Buffer.from(ENCRYPTION_IV_SAFE, 'hex');

    if (keyBuffer.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    }

    if (ivBuffer.length !== 16) {
      throw new Error('Encryption IV must be 16 bytes (32 hex characters)');
    }

    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, ivBuffer);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Decrypts a password using AES-256-CBC
 * @param encryptedPassword - The encrypted password as a hex string
 * @returns The decrypted plain text password
 * @throws Error if decryption fails
 */
export function decryptPassword(encryptedPassword: string): string {
  if (!encryptedPassword) {
    throw new Error('Encrypted password cannot be empty');
  }

  try {
    const keyBuffer = Buffer.from(ENCRYPTION_KEY_SAFE, 'hex');
    const ivBuffer = Buffer.from(ENCRYPTION_IV_SAFE, 'hex');

    if (keyBuffer.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (64 hex characters)');
    }

    if (ivBuffer.length !== 16) {
      throw new Error('Encryption IV must be 16 bytes (32 hex characters)');
    }

    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
    let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

