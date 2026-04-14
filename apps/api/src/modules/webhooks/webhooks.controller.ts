import { Controller, Headers, Logger, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { WebhooksService } from './webhooks.service';
import { WEBHOOKS_ROUTES } from './webhooks.routes';

@SkipThrottle()
@ApiTags('webhooks')
@Controller(WEBHOOKS_ROUTES.BASE)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post(WEBHOOKS_ROUTES.RAZORPAY)
  async handleRazorpay(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
    @Headers('x-razorpay-event-id') eventId?: string,
  ) {
    if (!signature || !req.rawBody) {
      throw new UnauthorizedException('Missing Razorpay signature or raw body.');
    }

    const isValid = this.webhooksService.verifySignature(req.rawBody, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Razorpay webhook signature.');
    }

    await this.webhooksService.handleRazorpayEvent(req.body as unknown, eventId ?? 'unknown');

    return { received: true };
  }
}
