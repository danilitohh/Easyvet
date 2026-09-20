import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';

// Separates platform operations from tenant operations without granting tenant bypass.
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.auth?.user.platformRole === 'PLATFORM_ADMIN') return true;
    throw new ForbiddenException({
      code: 'INSUFFICIENT_PERMISSION',
      message: 'Platform administrator access required',
    });
  }
}
