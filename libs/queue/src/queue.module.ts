import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import { WORKFLOW_EXECUTION_QUEUE } from './queue.constants';

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
    }),
  ],

  exports: [BullModule],
})
export class QueueModule {}
