import CryptoJS from 'crypto-js';

export class ClientEncryption {
  static encrypt(text: string, password: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(text, password).toString();
      return encrypted;
    } catch (error) {
      throw new Error('Encryption failed');
    }
  }

  static decrypt(encryptedText: string, password: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) {
        throw new Error('Invalid password');
      }
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed - invalid password or corrupted data');
    }
  }
}
