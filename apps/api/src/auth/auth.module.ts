import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionCookieService } from './session-cookie.service';
import { SessionsService } from './sessions.service';

// Authentication owns credentials and session lifecycle; authorization stays in Fase 3C.
@Module({
  imports: [PrismaModule, UsersModule, AuthorizationModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionAuthGuard,
    SessionCookieService,
    SessionsService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
  exports: [AuthService, SessionAuthGuard, SessionCookieService, SessionsService],
})
export class AuthModule {}
