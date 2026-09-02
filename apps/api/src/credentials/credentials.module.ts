import { Module } from '@nestjs/common';
import { CredentialsService } from './credentials.service';
import { CredentialsController } from './credentials.controller';
import { DatabaseModule } from '@app/database';
import { EncryptionModule } from '@app/encryption';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, EncryptionModule, AuthModule],
  providers: [CredentialsService],
  controllers: [CredentialsController],
})
export class CredentialsModule {}
