import { Module } from '@nestjs/common';
import { AppConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { RedisModule } from '@app/redis';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { WorkflowsModule } from './workflows/workflows.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    WorkflowsModule,
  ],
})
export class AppModule {}
