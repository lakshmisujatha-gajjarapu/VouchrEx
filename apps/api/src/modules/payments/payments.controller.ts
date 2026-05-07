import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  @Get('checkout-page')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('X-Frame-Options', 'DENY')
  @Header('Cache-Control', 'no-store')
  getCheckoutPage(
    @Query('rzpOrderId') rzpOrderId: string,
    @Query('amountPaise') amountPaise: string,
    @Query('currency') currency: string,
    @Query('keyId') keyId: string,
    @Query('appOrderId') appOrderId: string
  ): string {
    if (!rzpOrderId || !amountPaise || !currency || !keyId || !appOrderId) {
      throw new BadRequestException('Missing required checkout parameters.');
    }

    const amountNum = Number(amountPaise);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
      throw new BadRequestException('Invalid amount.');
    }

    // JSON-encode all user-supplied params so they're never injected raw into JS.
    const config = JSON.stringify({
      keyId,
      razorpayOrderId: rzpOrderId,
      amountPaise: amountNum,
      currency,
      appOrderId
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>VouchrEx Payment</title>
  <style>
    body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;
         font-family:sans-serif;background:#0D0B1E;color:#fff;}
    p{font-size:16px;}
  </style>
</head>
<body>
  <p>Opening secure payment&hellip;</p>
  <script id="cfg" type="application/json">${config}</script>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var cfg = JSON.parse(document.getElementById('cfg').textContent);
    var rzp = new Razorpay({
      key: cfg.keyId,
      amount: cfg.amountPaise,
      currency: cfg.currency,
      order_id: cfg.razorpayOrderId,
      name: 'VouchrEx',
      description: 'Secure voucher escrow',
      theme: { color: '#6366F1' },
      handler: function(response) {
        var p = new URLSearchParams({
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          app_order_id: cfg.appOrderId
        });
        window.location.href = 'vouchrex://payment-callback?' + p.toString();
      },
      modal: {
        ondismiss: function() {
          window.location.href = 'vouchrex://payment-callback?cancelled=true'
            + '&app_order_id=' + encodeURIComponent(cfg.appOrderId);
        }
      }
    });
    rzp.open();
  </script>
</body>
</html>`;
  }
}
