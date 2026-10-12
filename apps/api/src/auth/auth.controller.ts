import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import type { AuthMeResponse, LoginResponse, LogoutResponse } from '@veterinary-saas/contracts';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  ChangePasswordRequestDto,
  LoginRequestDto,
  SwitchOrganizationRequestDto,
} from './auth.dto';
import type { AuthenticatedRequest } from './auth.types';
import { SessionCookieService } from './session-cookie.service';
import { SessionsService } from './sessions.service';
import { Public } from '../authorization/public.decorator';
import { PasswordChangeAllowed } from '../authorization/password-change-allowed.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: SessionCookieService,
    private readonly sessions: SessionsService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const result = await this.auth.login(body.email, body.password);
    this.cookies.set(response, result.token, result.expiresAt);
    return result.response;
  }

  @Get('me')
  @PasswordChangeAllowed()
  async me(@Req() request: AuthenticatedRequest): Promise<AuthMeResponse> {
    return this.auth.me(request.auth!);
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
