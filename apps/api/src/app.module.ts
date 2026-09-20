import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { validateEnvironment } from './config/env';
import { ApiExceptionFilter } from './http/api-exception.filter';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './infrastructure/database/prisma.module';
import { LocationsModule } from './locations/locations.module';
import { MembershipsModule } from './memberships/memberships.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { CsrfOriginMiddleware } from './http/csrf-origin.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    PlatformModule,
    OrganizationsModule,
    UsersModule,
    MembershipsModule,
    LocationsModule,
  ],
  providers: [ApiExceptionFilter],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser(), CsrfOriginMiddleware).forRoutes('*');
  }
}
