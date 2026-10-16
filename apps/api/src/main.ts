import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { Request, Response } from 'express';
import { AppModule } from './app.module';
import type { Environment } from './config/env';
import { ApiExceptionFilter } from './http/api-exception.filter';

type ExpressHandler = (request: Request, response: Response) => void;

let applicationPromise: ReturnType<typeof createApplication> | undefined;
let vercelHandler: ExpressHandler | undefined;

async function createApplication() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  const config = app.get(ConfigService<Environment, true>);
  const origin = config.get('APP_ORIGIN', { infer: true });

  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  return app;
}

// Vercel's NestJS service adapter requires a default request handler. Keep the
// initialized Nest/Express app warm between invocations in the same instance.
export default async function handler(request: Request, response: Response): Promise<void> {
  const app = await (applicationPromise ??= createApplication());

  if (!vercelHandler) {
    await app.init();
    vercelHandler = app.getHttpAdapter().getInstance() as ExpressHandler;
  }

  vercelHandler(request, response);
}

// Bootstrap configures transport concerns only; schema changes are never run here.
export async function bootstrap(): Promise<void> {
  const app = await createApplication();
  const config = app.get(ConfigService<Environment, true>);
  const configuredPort = config.get('API_PORT', { infer: true });
  const port = process.env.PORT ? Number(process.env.PORT) : configuredPort;
  await app.listen(port);
}

if (require.main === module) {
  void bootstrap();
}
