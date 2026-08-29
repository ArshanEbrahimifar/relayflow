import {
  Body,
  Controller,
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
  receive(@Param('token') token: string, @Body() payload: unknown) {
    return this.webhooksService.receive(token, payload);
  }
}
