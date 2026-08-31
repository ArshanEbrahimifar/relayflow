import { Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { AppConfigModule } from '@app/config';

@Module({
  imports: [AppConfigModule],
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
