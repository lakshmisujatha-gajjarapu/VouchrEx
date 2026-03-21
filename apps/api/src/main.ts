import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, patchNestJsSwagger } from 'nestjs-zod';
import helmet from 'helmet';

import { AppModule } from './modules/app.module';

function validateEnv() {
  const always = ['CODE_ENCRYPTION_KEY', 'DATABASE_URL', 'ADMIN_API_TOKEN'];
  const missing = always.filter((k) => !process.env[k]?.trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill in all values.'
    );
  }

  if (process.env.NODE_ENV === 'production') {
    const prodOnly = ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'];
    const prodMissing = prodOnly.filter((k) => !process.env[k]?.trim());
    if (prodMissing.length > 0) {
      throw new Error(
        `Production requires these variables to be set: ${prodMissing.join(', ')}`
      );
    }
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
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-session-token', 'x-admin-token'],
    credentials: false,
  });

  app.useGlobalPipes(new ZodValidationPipe());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CouponBazaar API')
    .setDescription('Phase 1 API for the CouponBazaar voucher resale marketplace.')
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
    customSiteTitle: 'CouponBazaar API Docs'
  });

  const port = Number(process.env.PORT ?? 3010);
  await app.listen(port);

  const logger = new Logger('bootstrap');
  logger.log(`CouponBazaar API listening on http://localhost:${String(port)}`);
  logger.log(`Swagger docs available at http://localhost:${String(port)}/docs`);
}

void bootstrap();
