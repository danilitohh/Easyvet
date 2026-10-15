import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AccountLifecycleService } from './account-lifecycle.service';
import { AccountEmailService } from './account-email.service';
import { AuthActionTokenService } from './auth-action-token.service';
import { PasswordService } from './password.service';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionCookieService } from './session-cookie.service';
import { SessionsService } from './sessions.service';
import { RealtimeTokenService } from './realtime-token.service';
import { PlatformAdminBootstrapService } from './platform-admin-bootstrap.service';

// Authentication owns credentials and session lifecycle; authorization stays in Fase 3C.
@Module({
  imports: [PrismaModule, UsersModule, AuthorizationModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountLifecycleService,
    AccountEmailService,
    AuthActionTokenService,
    PasswordService,
    SessionAuthGuard,
    SessionCookieService,
    SessionsService,
    RealtimeTokenService,
    PlatformAdminBootstrapService,
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
  exports: [AuthService, PasswordService, SessionAuthGuard, SessionCookieService, SessionsService],
})
export class AuthModule {}
