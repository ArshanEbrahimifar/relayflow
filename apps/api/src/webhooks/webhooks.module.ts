import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { DatabaseModule } from '@app/database';
import { QueueModule } from '@app/queue';

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
