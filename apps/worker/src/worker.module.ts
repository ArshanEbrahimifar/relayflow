import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { Module } from '@nestjs/common';

@Module({
  imports: [AppConfigModule, DatabaseModule],
})
export class WorkerModule {}
