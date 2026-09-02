import { DatabaseService } from '@app/database';
import { EncryptionService } from '@app/encryption';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCredentialDto } from './dto/create-credential.dto';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly encryption: EncryptionService,
  ) {}

  async create(userId: string, dto: CreateCredentialDto) {
    const encrypted = this.encryption.encrypt(dto.data);

    return this.database.credential.create({
      data: {
        userId,
        name: dto.name.trim(),
        type: dto.type.trim(),

        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
      },

      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
      },
    });
  }

  async findAll(userId: string) {
    return this.database.credential.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async remove(userId: string, credentialId: string) {
    const credential = await this.database.credential.findFirst({
      where: {
        id: credentialId,
        userId,
      },
      select: {
        id: true,
      },
    });
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }
    await this.database.credential.delete({
      where: {
        id: credential.id,
      },
    });

    return {
      message: 'Credential deleted',
    };
  }
}
