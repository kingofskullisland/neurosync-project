import { Buffer } from 'buffer';

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// Helper to convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * AES-256-GCM Encryption (Web)
 * Uses standard Web Crypto API for browser compatibility
 */
export class BeamCrypto {
    keyBytes: Uint8Array;
    cryptoKey: CryptoKey | null = null;

    constructor(keyBase64: string) {
        // Create a buffer from the key
        this.keyBytes = new Uint8Array(Buffer.from(keyBase64, 'base64'));
    }

    private async getKey(): Promise<CryptoKey> {
        if (this.cryptoKey) return this.cryptoKey;

        this.cryptoKey = await window.crypto.subtle.importKey(
            "raw",
            this.keyBytes as unknown as ArrayBuffer,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        );
        return this.cryptoKey;
    }

    async encrypt(plaintext: string): Promise<{ c: string; n: string; t: string }> {
        const key = await this.getKey();
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encodedText = new TextEncoder().encode(plaintext);

        const encryptedBuffer = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            encodedText
        );

        // WebCrypto returns ciphertext + tag appended at the end
        // default tag length is 128 bits (16 bytes)
        const encryptedBytes = new Uint8Array(encryptedBuffer);
        const tagLength = 16;
        const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - tagLength);
        const tag = encryptedBytes.slice(encryptedBytes.length - tagLength);

        return {
            c: uint8ArrayToBase64(ciphertext),
            n: uint8ArrayToBase64(iv),
            t: uint8ArrayToBase64(tag),
        };
    }

    async decrypt(envelope: { c: string; n: string; t: string }): Promise<string> {
        const key = await this.getKey();
        const iv = base64ToUint8Array(envelope.n);
        const ciphertext = base64ToUint8Array(envelope.c);
        const tag = base64ToUint8Array(envelope.t);

        // WebCrypto expects ciphertext + tag concatenated
        const encryptedData = new Uint8Array(ciphertext.length + tag.length);
        encryptedData.set(ciphertext);
        encryptedData.set(tag, ciphertext.length);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv as any
            },
            key,
            encryptedData as unknown as ArrayBuffer
        );

        return new TextDecoder().decode(decryptedBuffer);
    }
}
