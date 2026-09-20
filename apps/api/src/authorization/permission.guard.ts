import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Permission } from '@veterinary-saas/contracts';
import type { PermissionRequest } from './authorization.types';
import { REQUIRED_PERMISSIONS_KEY } from './require-permissions.decorator';
import { hasPermissions } from './permissions';

// Resolves every required permission with ALL semantics and denies missing context by default.
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<PermissionRequest>();
    if (!request.tenant || !hasPermissions(request.tenant.role, required)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'Insufficient permission',
      });
    }
    return true;
  }
}
