import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { TenantRequest, TenantContext } from './authorization.types';

// Keeps tenant-aware controllers independent from raw Express request access.
export const CurrentTenant = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TenantContext => {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    if (!request.tenant) {
      throw new Error('Tenant context was not initialized');
    }
    return request.tenant;
  },
);
