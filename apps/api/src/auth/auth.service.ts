import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { DatabaseService } from '@app/database';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.database.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.database.user.create({
      data: {
        email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    return user;
  }
}
