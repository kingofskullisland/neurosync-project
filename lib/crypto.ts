import { Buffer } from 'buffer';

let QuickCrypto: any;
try {
    QuickCrypto = require('react-native-quick-crypto').default || require('react-native-quick-crypto');
} catch (e) {
    console.warn('Native QuickCrypto module not found. Secure Beam functionality will be restricted.');
    QuickCrypto = null;
}

// Polyfill for React Native if needed, though usually handled at entry
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}

/**
 * AES-256-GCM Encryption (Native)
 * Uses react-native-quick-crypto for high performance on iOS/Android
 */
export class BeamCrypto {
    key: any;

    constructor(keyBase64: string) {
        this.key = Buffer.from(keyBase64, 'base64');
    }

    async encrypt(plaintext: string): Promise<{ c: string; n: string; t: string }> {
        if (!QuickCrypto) {
            throw new Error('QuickCrypto native module is not available in this environment.');
        }

        // GCM IV is typically 12 bytes
        const iv = QuickCrypto.randomBytes(12);

        const cipher = QuickCrypto.createCipheriv('aes-256-gcm', this.key, iv);

        let encrypted = cipher.update(plaintext, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        const tag = cipher.getAuthTag();

        return {
            c: encrypted,
            n: iv.toString('base64'),
            t: tag.toString('base64'),
        };
    }

    async decrypt(envelope: { c: string; n: string; t: string }): Promise<string> {
        if (!QuickCrypto) {
            throw new Error('QuickCrypto native module is not available in this environment.');
        }

        const iv = Buffer.from(envelope.n, 'base64');
        const tag = Buffer.from(envelope.t, 'base64');

        const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', this.key, iv);
        decipher.setAuthTag(tag as any);

        let decrypted = decipher.update(envelope.c, 'base64', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    }
}
