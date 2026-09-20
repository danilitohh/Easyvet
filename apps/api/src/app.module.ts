import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env';
import { ApiExceptionFilter } from './http/api-exception.filter';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './infrastructure/database/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
  ],
  providers: [ApiExceptionFilter],
})
export class AppModule {}
