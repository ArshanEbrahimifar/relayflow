import { Module } from '@nestjs/common';
import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { RedisModule } from '@app/redis';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
  ],
})
export class AppModule {}
