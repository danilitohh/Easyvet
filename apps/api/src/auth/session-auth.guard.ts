import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest } from './auth.types';
import { SessionCookieService } from './session-cookie.service';
import { SessionsService } from './sessions.service';

// Authenticates the request only; tenant authorization and permissions belong to Fase 3C.
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly cookies: SessionCookieService,
    private readonly sessions: SessionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.cookies.read(request);
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    const authenticated = await this.sessions.authenticate(token);
    if (!authenticated) {
      throw new UnauthorizedException('Authentication required');
    }

    request.auth = authenticated;
    return true;
  }
}
