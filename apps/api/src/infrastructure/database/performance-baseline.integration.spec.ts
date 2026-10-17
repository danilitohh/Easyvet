import { performance } from 'node:perf_hooks';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { PatientsService } from '../../patients/patients.service';

const describePerformance =
  process.env.RUN_DB_TESTS === '1' && process.env.RUN_PERF_TESTS === '1' ? describe : describe.skip;

const ROW_COUNTS = [10, 100, 1000] as const;
const PAGE_SIZE = 20;

type Fixture = {
  organizationId: string;
  ownerId: string;
  rowCount: number;
};

type QueryEventClient = {
  $on(event: 'query', callback: (event: unknown) => void): void;
};

jest.setTimeout(120_000);

describePerformance('patient list performance baseline', () => {
  let prisma: PrismaClient;
  let patients: PatientsService;
  const fixtures: Fixture[] = [];
  let countingQueries = false;
  let queryCount = 0;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL_TEST;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL_TEST is required when RUN_PERF_TESTS=1');
    }

    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
      log: [{ emit: 'event', level: 'query' }],
    });
    await prisma.$connect();
    patients = new PatientsService(prisma as never);
    (prisma as unknown as QueryEventClient).$on('query', () => {
      if (countingQueries) queryCount += 1;
    });

    const suffix = `${Date.now()}-${process.pid}`;
    for (const rowCount of ROW_COUNTS) {
      const organization = await prisma.organization.create({
        data: {
          name: `Performance ${rowCount} ${suffix}`,
          slug: `performance-${rowCount}-${suffix}`,
        },
      });
      const owner = await prisma.owner.create({
        data: { organizationId: organization.id, firstName: 'Performance', lastName: 'Owner' },
      });
      await prisma.patient.createMany({
        data: Array.from({ length: rowCount }, (_, index) => ({
          organizationId: organization.id,
          ownerId: owner.id,
          name: `Patient ${index.toString().padStart(4, '0')}`,
          nameNormalized: `patient ${index.toString().padStart(4, '0')}`,
          species: index % 2 === 0 ? 'DOG' : 'CAT',
        })),
      });
      fixtures.push({ organizationId: organization.id, ownerId: owner.id, rowCount });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    const organizationIds = fixtures.map(({ organizationId }) => organizationId);
    await prisma.patient.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.owner.deleteMany({ where: { organizationId: { in: organizationIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.$disconnect();
  });

  it.each(ROW_COUNTS)('keeps the paginated list bounded at %i rows', async (rowCount) => {
    const fixture = fixtures.find((candidate) => candidate.rowCount === rowCount);
    if (!fixture) throw new Error(`Missing fixture for ${rowCount} rows`);

    queryCount = 0;
    countingQueries = true;
    const startedAt = performance.now();
    const result = await patients.listForOrganization(fixture.organizationId, {
      page: 1,
      pageSize: PAGE_SIZE,
      status: 'ACTIVE',
      sortBy: 'createdAt',
      sortDirection: 'asc',
    });
    const elapsedMs = Number((performance.now() - startedAt).toFixed(2));
    countingQueries = false;

    expect(result.total).toBe(rowCount);
    expect(result.items).toHaveLength(Math.min(rowCount, PAGE_SIZE));
    expect(result.items.length).toBeLessThanOrEqual(PAGE_SIZE);
    expect(queryCount).toBe(2);

    console.info(
      JSON.stringify({
        benchmark: 'patient-list',
        rows: rowCount,
        returned: result.items.length,
        queries: queryCount,
        elapsedMs,
        note: 'local/ephemeral baseline; not a production SLA',
      }),
    );
  });
});
