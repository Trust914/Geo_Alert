import crypto from 'crypto';
import { AppError } from './error.util.js';
import { serverConfig } from '../config/server.config.js';

const ENCRYPTION_KEY = serverConfig.encryption.twoFactorKey; // Must be 32 chars

// Convert the HEX string (64 chars) from .env into a Buffer (32 bytes)
const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');

// Validation: Stop the app if the key is wrong
if (keyBuffer.length !== 32) {
  throw AppError.internal(
    `Invalid TWO_FACTOR_ENCRYPTION_KEY length. Expected 32 bytes (64 hex chars), got ${keyBuffer.length} bytes.`
  );
}

export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(serverConfig.encryption.ivLength);
  const cipher = crypto.createCipheriv(serverConfig.encryption.cipherAlgorithm, keyBuffer, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decrypt = (text: string): string => {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(serverConfig.encryption.cipherAlgorithm, keyBuffer, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
};