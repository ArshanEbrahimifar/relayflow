import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { WORKFLOW_EXECUTION_QUEUE } from './queue.constants';
import { QueueCapacityService } from './queue-capacity.service';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),

          port: configService.getOrThrow<number>('REDIS_PORT'),
        },
      }),
    }),

    BullModule.registerQueue({
      name: WORKFLOW_EXECUTION_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    }),
  ],

  exports: [BullModule, QueueCapacityService],
})
export class QueueModule {}
