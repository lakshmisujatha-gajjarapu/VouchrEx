import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe, patchNestJsSwagger } from 'nestjs-zod';

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
