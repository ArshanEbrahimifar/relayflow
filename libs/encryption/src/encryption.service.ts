import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export type EncryptedValue = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

@Injectable()
export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';

  private static readonly IV_LENGTH = 12;

  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const encryptionKey = this.configService.getOrThrow<string>(
      'CREDENTIAL_ENCRYPTION_KEY',
    );

    this.key = Buffer.from(encryptionKey, 'hex');

    if (this.key.length !== 32) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be 32 bytes');
    }
  }

  encrypt(data: unknown): EncryptedValue {
    const plaintext = JSON.stringify(data);

    if (plaintext === undefined) {
      throw new Error('Unable to serialize data for encryption');
    }

    const iv = randomBytes(EncryptionService.IV_LENGTH);

    const cipher = createCipheriv(EncryptionService.ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  decrypt(encryptedValue: EncryptedValue): unknown {
    const iv = Buffer.from(encryptedValue.iv, 'hex');

    const ciphertext = Buffer.from(encryptedValue.ciphertext, 'hex');

    const authTag = Buffer.from(encryptedValue.authTag, 'hex');

    const decipher = createDecipheriv(
      EncryptionService.ALGORITHM,
      this.key,
      iv,
    );

    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(plaintext) as unknown;
  }
}
