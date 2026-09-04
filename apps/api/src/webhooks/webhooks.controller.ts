import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';

import { WebhooksService } from './webhooks.service';
import { WebhookRateLimitFilter } from './filters/webhook-rate-limit.filter';

@UseFilters(WebhookRateLimitFilter)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post(':token')
  @HttpCode(HttpStatus.ACCEPTED)
  receive(
    @Param('token') token: string,
    @Body() payload: unknown,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.webhooksService.receive(token, payload, idempotencyKey);
  }
}
