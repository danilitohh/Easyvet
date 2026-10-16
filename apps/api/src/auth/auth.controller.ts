import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type {
  AuthMeResponse,
  LoginResponse,
  LogoutResponse,
  PublicActionResponse,
} from '@veterinary-saas/contracts';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AccountLifecycleService } from './account-lifecycle.service';
import {
  ChangePasswordRequestDto,
  EmailRequestDto,
  LoginRequestDto,
  PlatformAdminBootstrapDto,
  PasswordResetRequestDto,
  RegistrationRequestDto,
  SwitchOrganizationRequestDto,
  TokenRequestDto,
} from './auth.dto';
import type { AuthenticatedRequest } from './auth.types';
import { SessionCookieService } from './session-cookie.service';
import { SessionsService } from './sessions.service';
import { RealtimeTokenService } from './realtime-token.service';
import { PlatformAdminBootstrapService } from './platform-admin-bootstrap.service';
import { Public } from '../authorization/public.decorator';
import { PasswordChangeAllowed } from '../authorization/password-change-allowed.decorator';
import { RateLimit } from '../http/rate-limit.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly accounts: AccountLifecycleService,
    private readonly cookies: SessionCookieService,
    private readonly sessions: SessionsService,
    private readonly realtimeTokens: RealtimeTokenService,
    private readonly platformBootstrap: PlatformAdminBootstrapService,
  ) {}

  @Post('login')
  @Public()
  @RateLimit(
    { name: 'auth.login.ip', identity: 'ip', limit: 30, windowMs: 15 * 60_000 },
    {
      name: 'auth.login.failure.email',
      identity: 'email',
      limit: 5,
      windowMs: 15 * 60_000,
      mode: 'check',
    },
  )
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.auth.login(body.email, body.password);
    this.cookies.set(response, result.token, result.expiresAt);
    return result.response;
  }

  @Post('register')
  @Public()
  @RateLimit(
    { name: 'auth.register.ip', identity: 'ip', limit: 8, windowMs: 60 * 60_000 },
    { name: 'auth.register.email', identity: 'email', limit: 3, windowMs: 60 * 60_000 },
  )
  @HttpCode(HttpStatus.OK)
  register(@Body() body: RegistrationRequestDto): Promise<PublicActionResponse> {
    return this.accounts.register(body);
  }

  @Post('platform-admin/bootstrap')
  @Public()
  @RateLimit({ name: 'auth.bootstrap.ip', identity: 'ip', limit: 5, windowMs: 60 * 60_000 })
  @HttpCode(HttpStatus.OK)
  bootstrapPlatformAdmin(@Body() body: PlatformAdminBootstrapDto): Promise<PublicActionResponse> {
    return this.platformBootstrap.createFirstAdmin(body);
  }

  @Post('verify-email')
  @Public()
  @RateLimit(
    { name: 'auth.verify-email.ip', identity: 'ip', limit: 20, windowMs: 60 * 60_000 },
    { name: 'auth.verify-email.token', identity: 'token', limit: 5, windowMs: 60 * 60_000 },
  )
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() body: TokenRequestDto): Promise<PublicActionResponse> {
    return this.accounts.verifyEmail(body.token);
  }

  @Post('verification/resend')
  @Public()
  @RateLimit(
    { name: 'auth.resend-verification.ip', identity: 'ip', limit: 10, windowMs: 60 * 60_000 },
    { name: 'auth.resend-verification.email', identity: 'email', limit: 3, windowMs: 60 * 60_000 },
  )
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() body: EmailRequestDto): Promise<PublicActionResponse> {
    return this.accounts.resendVerification(body.email);
  }

  @Post('password-reset/request')
  @Public()
  @RateLimit(
    { name: 'auth.password-reset-request.ip', identity: 'ip', limit: 10, windowMs: 60 * 60_000 },
    { name: 'auth.password-reset-request.email', identity: 'email', limit: 3, windowMs: 60 * 60_000 },
  )
  @HttpCode(HttpStatus.OK)
  requestPasswordReset(@Body() body: EmailRequestDto): Promise<PublicActionResponse> {
    return this.accounts.requestPasswordReset(body.email);
  }

  @Post('password-reset/confirm')
  @Public()
  @RateLimit(
    { name: 'auth.password-reset-confirm.ip', identity: 'ip', limit: 10, windowMs: 60 * 60_000 },
    { name: 'auth.password-reset-confirm.token', identity: 'token', limit: 5, windowMs: 60 * 60_000 },
  )
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() body: PasswordResetRequestDto): Promise<PublicActionResponse> {
    return this.accounts.resetPassword(body.token, body.newPassword);
  }

  @Get('me')
  @PasswordChangeAllowed()
  async me(@Req() request: AuthenticatedRequest): Promise<AuthMeResponse> {
    return this.auth.me(request.auth!);
  }

  @Get('realtime-token')
  realtimeToken(@Req() request: AuthenticatedRequest) {
    return this.realtimeTokens.issue(request.auth!);
  }

  @Post('switch-organization')
  @HttpCode(HttpStatus.OK)
  async switchOrganization(
    @Req() request: AuthenticatedRequest,
    @Body() body: SwitchOrganizationRequestDto,
  ): Promise<AuthMeResponse> {
    return this.auth.switchOrganization(request.auth!, body.membershipId);
  }

  @Post('logout')
  @PasswordChangeAllowed()
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LogoutResponse> {
    await this.sessions.revokeByToken(this.cookies.read(request));
    this.cookies.clear(response);
    return { success: true };
  }

  @Post('change-password')
  @PasswordChangeAllowed()
  @HttpCode(HttpStatus.OK)
  changePassword(@Req() request: AuthenticatedRequest, @Body() body: ChangePasswordRequestDto) {
    return this.auth.changePassword(request.auth!, body.currentPassword, body.newPassword);
  }
}
