import { Module } from '@nestjs/common';
import { DatabaseModule } from '@app/database';
import { RedisModule } from '@app/redis';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
