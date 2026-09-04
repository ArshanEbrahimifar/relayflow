import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';

import type { Response } from 'express';

import { WebhookRateLimitException } from '../exceptions/webhook-rate-limit.exception';

@Catch(WebhookRateLimitException)
export class WebhookRateLimitFilter implements ExceptionFilter {
  catch(exception: WebhookRateLimitException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.setHeader('Retry-After', String(exception.retryAfterSeconds));

    response.status(exception.getStatus()).json(exception.getResponse());
  }
}
