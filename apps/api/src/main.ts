import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Environment } from './config/env';
import { ApiExceptionFilter } from './http/api-exception.filter';

// Bootstrap configures transport concerns only; schema changes are never run here.
export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Environment, true>);
  const origin = config.get('APP_ORIGIN', { infer: true });
  const port = config.get('API_PORT', { infer: true });

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(port);
}

if (require.main === module) {
  void bootstrap();
}
