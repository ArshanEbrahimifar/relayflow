import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { WebhooksService } from './webhooks.service';

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
