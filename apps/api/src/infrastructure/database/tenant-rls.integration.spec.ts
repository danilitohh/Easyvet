import { Prisma, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

const describeDatabase = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;

describeDatabase('tenant RLS context', () => {
  let prisma: PrismaClient;
  const suffix = Date.now().toString();
  const organizationIds: string[] = [];

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) throw new Error('DATABASE_URL_TEST is required when RUN_DB_TESTS=1');
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!prisma) return;
    await withScope('system', null, async (tx) => {
      await tx.owner.deleteMany({ where: { organizationId: { in: organizationIds } } });
      await tx.organization.deleteMany({ where: { id: { in: organizationIds } } });
    });
    await prisma.$disconnect();
  });

  async function withScope<T>(
    mode: 'system' | 'tenant',
    organizationId: string | null,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT
          set_config('app.easyvet_context', ${mode}, TRUE),
          set_config('app.easyvet_organization_id', ${organizationId ?? ''}, TRUE)
      `;
      return callback(tx);
    });
  }

  it('only exposes rows for the selected organization and rejects cross-tenant writes', async () => {
    const organizations = await withScope('system', null, async (tx) =>
      Promise.all([
        tx.organization.create({
          data: { name: `RLS North ${suffix}`, slug: `rls-north-${suffix}` },
        }),
        tx.organization.create({
          data: { name: `RLS South ${suffix}`, slug: `rls-south-${suffix}` },
        }),
      ]),
    );
    organizationIds.push(...organizations.map(({ id }) => id));

    await withScope('system', null, async (tx) => {
      await tx.owner.createMany({
        data: organizations.map((organization, index) => ({
          organizationId: organization.id,
          firstName: index === 0 ? 'North owner' : 'South owner',
        })),
      });
    });

    const northOwners = await withScope('tenant', organizations[0].id, (tx) =>
      tx.owner.findMany({ orderBy: { firstName: 'asc' } }),
    );
    expect(northOwners).toHaveLength(1);
    expect(northOwners[0]?.organizationId).toBe(organizations[0].id);

    await expect(
      withScope('tenant', organizations[0].id, (tx) =>
        tx.owner.create({
          data: { organizationId: organizations[1].id, firstName: 'Cross tenant' },
        }),
      ),
    ).rejects.toThrow();
  });
});
