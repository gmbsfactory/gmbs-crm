import crypto from 'crypto';

/**
 * Encryption utilities for email passwords using AES-256-CBC
 * 
 * The encryption key and IV must be set in environment variables:
 * - EMAIL_PASSWORD_ENCRYPTION_KEY: 32+ character hex string
 * - EMAIL_PASSWORD_ENCRYPTION_IV: 16 character hex string
 */

// Lazy initialization to avoid build-time errors
// Check only at runtime when functions are actually called
function getEncryptionKey(): string {
  const key = process.env.EMAIL_PASSWORD_ENCRYPTION_KEY;
  if (!key) {
    // During build/static analysis, return a dummy value to allow build to pass
    // At runtime, this will be caught by validation in the functions
    if (typeof window === 'undefined' && (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-development-build')) {
      return '0'.repeat(64); // Dummy 32-byte hex key for build (64 hex chars = 32 bytes)
    }
    throw new Error(
      'EMAIL_PASSWORD_ENCRYPTION_KEY must be set in environment variables'
    );
  }
  return key;
}

function getEncryptionIV(): string {
  const iv = process.env.EMAIL_PASSWORD_ENCRYPTION_IV;
  if (!iv) {
    // During build/static analysis, return a dummy value to allow build to pass
    // At runtime, this will be caught by validation in the functions
    if (typeof window === 'undefined' && (process.env.NEXT_PHASE === 'phase-production-build' || process.env.NEXT_PHASE === 'phase-development-build')) {
      return '0'.repeat(32); // Dummy 16-byte hex IV for build (32 hex chars = 16 bytes)
    }
    throw new Error(
      'EMAIL_PASSWORD_ENCRYPTION_IV must be set in environment variables'
    );
  }
  return iv;
}

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
    const ENCRYPTION_KEY_SAFE = getEncryptionKey();
    const ENCRYPTION_IV_SAFE = getEncryptionIV();
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
    const ENCRYPTION_KEY_SAFE = getEncryptionKey();
    const ENCRYPTION_IV_SAFE = getEncryptionIV();
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

