import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { DatabaseModule } from '@app/database';
import { QueueModule } from '@app/queue';
import { RateLimitModule } from '@app/rate-limit';

@Module({
  imports: [DatabaseModule, QueueModule, RateLimitModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
