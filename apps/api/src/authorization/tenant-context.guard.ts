import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { TenantRequest } from './authorization.types';
import { TenantContextService } from './tenant-context.service';

// Establishes the tenant boundary only after the global authentication guard has succeeded.
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private readonly tenantContext: TenantContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    request.tenant = await this.tenantContext.resolve(request);
    return true;
  }
}
