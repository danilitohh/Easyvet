import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

export type DatabaseSecurityScope =
  | { mode: 'deny'; organizationId: null }
  | { mode: 'system'; organizationId: null }
  | { mode: 'tenant'; organizationId: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Carries the trusted request scope to Prisma without putting tenant identity in client input.
@Injectable()
export class DatabaseSecurityContext {
  private readonly storage = new AsyncLocalStorage<DatabaseSecurityScope>();

  runDenied<T>(callback: () => T): T {
    return this.storage.run({ mode: 'deny', organizationId: null }, callback);
  }

  enterSystem(): void {
    const scope = this.storage.getStore();
    if (!scope) {
      throw new Error('Database security scope is not initialized for this request');
    }
    scope.mode = 'system';
    scope.organizationId = null;
  }

  setTenant(organizationId: string): void {
    if (!UUID_PATTERN.test(organizationId)) {
      throw new Error('A valid organization id is required for the tenant database scope');
    }
    const scope = this.storage.getStore();
    if (!scope) {
      throw new Error('Database security scope is not initialized for this request');
    }
    scope.mode = 'tenant';
    scope.organizationId = organizationId;
  }

  current(): DatabaseSecurityScope {
    return this.storage.getStore() ?? { mode: 'deny', organizationId: null };
  }
}
