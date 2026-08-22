import { Module } from '@nestjs/common';
import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { RedisModule } from '@app/redis';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, RedisModule, HealthModule],
})
export class AppModule {}
