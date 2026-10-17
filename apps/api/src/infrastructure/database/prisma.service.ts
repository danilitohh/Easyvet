import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { DatabaseSecurityContext } from './database-security-context';

function scopeValues(security: DatabaseSecurityContext) {
  const scope = security.current();
  return {
    mode: scope.mode,
    organizationId: scope.organizationId ?? '',
  };
}

function scopedClient(security: DatabaseSecurityContext) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      query: {
        $allModels: {
          async $allOperations({ args, query }) {
            const scope = scopeValues(security);
            const [, result] = await client.$transaction([
              client.$executeRaw`
                SELECT
                  set_config('app.easyvet_context', ${scope.mode}, TRUE),
                  set_config('app.easyvet_organization_id', ${scope.organizationId}, TRUE)
              `,
              query(args),
            ]);
            return result;
          },
        },
      },
    }),
  );
}

// Prisma remains an infrastructure adapter; domain repositories are intentionally deferred.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(security: DatabaseSecurityContext) {
    super();
    const scoped = scopedClient(security);
    // `$extends()` returns a client proxy and does not carry Nest lifecycle
    // methods declared on this subclass. Compose both surfaces explicitly.
    return new Proxy(this, {
      get(target, property, receiver) {
        if (property in scoped) {
          return Reflect.get(scoped, property, receiver);
        }
        return Reflect.get(target, property, receiver);
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
