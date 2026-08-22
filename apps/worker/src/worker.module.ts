import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { RedisModule } from '@app/redis';
import { Module } from '@nestjs/common';

@Module({
  imports: [AppConfigModule, DatabaseModule, RedisModule],
})
export class WorkerModule {}
