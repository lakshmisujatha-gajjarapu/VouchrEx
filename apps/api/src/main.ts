import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, patchNestJsSwagger } from 'nestjs-zod';
import helmet from 'helmet';
import { z } from 'zod';

import { AppModule } from './modules/app.module';

const envSchema = z.object({
  // ── Required ─────────────────────────────────────────────────────────────
  CODE_ENCRYPTION_KEY:      z.string().min(1),
  DATABASE_URL:             z.string().min(1),
  ADMIN_API_TOKEN:          z.string().min(1),
  // Razorpay — payment collection
  RAZORPAY_KEY_ID:          z.string().min(1),
  RAZORPAY_KEY_SECRET:      z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET:  z.string().min(1),
  // RazorpayX — payouts to sellers
  RAZORPAY_X_KEY_ID:        z.string().min(1),
  RAZORPAY_X_KEY_SECRET:    z.string().min(1),
  RAZORPAY_X_ACCOUNT_NUMBER: z.string().min(1),

  // ── Optional with defaults ────────────────────────────────────────────────
  PORT:                         z.coerce.number().default(3010),
  RAZORPAY_PAYMENT_CALLBACK_URL: z.string().default('vouchrex://payment-callback'),
  // Marketplace economics
  PLATFORM_FEE_INR:             z.coerce.number().default(10),
  COMMISSION_RATE:              z.coerce.number().default(0.12),
  HIGH_VALUE_THRESHOLD_INR:     z.coerce.number().default(2000),
  HIGH_VALUE_WINDOW_HOURS:      z.coerce.number().default(4),
  // Fraud / velocity limits
  BUYER_MAX_ORDERS_PER_HOUR:    z.coerce.number().default(3),
  SELLER_MAX_LISTINGS_PER_HOUR: z.coerce.number().default(5),
  LISTING_MIN_EXPIRY_HOURS:     z.coerce.number().default(48),
  // Payments & reconciliation
  PAYMENT_TIMEOUT_MINUTES:      z.coerce.number().default(30),
  STALE_PAYMENT_SYNC_MINUTES:   z.coerce.number().default(5),
  // Auth / sessions
  OTP_TTL_MINUTES:              z.coerce.number().default(5),
  OTP_MAX_ATTEMPTS:             z.coerce.number().default(5),
  SESSION_TTL_HOURS:            z.coerce.number().default(2160),
  AUDIT_RETENTION_DAYS:         z.coerce.number().default(7),
  OTP_CHALLENGE_GRACE_HOURS:    z.coerce.number().default(24),
  // Throttler
  THROTTLE_SHORT_TTL_MS:        z.coerce.number().default(1000),
  THROTTLE_SHORT_LIMIT:         z.coerce.number().default(10),
  THROTTLE_MEDIUM_TTL_MS:       z.coerce.number().default(60000),
  THROTTLE_MEDIUM_LIMIT:        z.coerce.number().default(100),
  THROTTLE_LONG_TTL_MS:         z.coerce.number().default(900000),
  THROTTLE_LONG_LIMIT:          z.coerce.number().default(500),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.'));
    throw new Error(
      `Missing or empty required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in all values.'
    );
  }
}

async function bootstrap() {
  validateEnv();
  patchNestJsSwagger();

  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Trust Nginx reverse proxy — required for correct client IP in throttler/logs
  const expressApp = app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void };
  expressApp.set('trust proxy', 'loopback');

  // Security headers — tuned for a JSON API (no browser rendering)
  app.use(helmet({
    contentSecurityPolicy: false,      // irrelevant for JSON API
    crossOriginEmbedderPolicy: false,  // would break Swagger UI
    hsts: {
      maxAge: 31536000,                // 1 year
      includeSubDomains: true,
      preload: true,
    },
  }));

  // CORS — allow the mobile app origins; tighten ALLOWED_ORIGINS in prod
  const rawOrigins = process.env.ALLOWED_ORIGINS ?? '';
  const allowedOrigins = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: process.env.NODE_ENV === 'production'
      ? (allowedOrigins.length > 0 ? allowedOrigins : false)
      : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-session-token', 'x-admin-token'],
    credentials: false,
  });

  app.useGlobalPipes(new ZodValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VouchrEx API')
    .setDescription('Phase 1 API for the VouchrEx voucher resale marketplace.')
    .setVersion('0.1.0')
    .addTag('health')
    .addTag('auth')
    .addTag('brands')
    .addTag('listings')
    .addTag('orders')
    .addTag('notifications')
    .addTag('admin')
    .build();

  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig, {
      operationIdFactory: (_controllerKey, methodKey) => methodKey
    });

  SwaggerModule.setup('docs', app, documentFactory, {
    jsonDocumentUrl: 'docs/json',
    customSiteTitle: 'VouchrEx API Docs'
  });

  const port = Number(process.env.PORT ?? 3010);
  await app.listen(port);

  const logger = new Logger('bootstrap');
  logger.log(`VouchrEx API listening on http://localhost:${String(port)}`);
  logger.log(`Swagger docs available at http://localhost:${String(port)}/docs`);
}

void bootstrap();
