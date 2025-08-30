import crypto from 'crypto';

export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 16;

  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(password, salt, 100000, this.keyLength, 'sha512');
  }

  encrypt(text: string, password: string): string {
    try {
      const salt = crypto.randomBytes(this.saltLength);
      const key = this.deriveKey(password, salt);
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine salt + iv + encrypted data
      const combined = Buffer.concat([
        salt,
        iv,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return combined.toString('base64');
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  decrypt(encryptedData: string, password: string): string {
    try {
      const combined = Buffer.from(encryptedData, 'base64');
      
      const salt = combined.subarray(0, this.saltLength);
      const iv = combined.subarray(this.saltLength, this.saltLength + this.ivLength);
      const encrypted = combined.subarray(this.saltLength + this.ivLength);
      
      const key = this.deriveKey(password, salt);
      
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
  }

  // For API keys and sensitive data
  encryptApiKey(apiKey: string, masterKey: string): string {
    return this.encrypt(apiKey, masterKey);
  }

  decryptApiKey(encryptedApiKey: string, masterKey: string): string {
    return this.decrypt(encryptedApiKey, masterKey);
  }
}

export const encryptionService = new EncryptionService();