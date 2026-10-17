import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ClinicalDocumentOrigin,
  ClinicalDocumentStatus,
  ClinicalDocumentType,
} from '@prisma/client';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { TenantContext } from '../authorization/authorization.types';
import type { PrismaService } from '../infrastructure/database/prisma.service';
import type { StorageService } from '../storage/storage.service';
import { DocumentsService } from './documents.service';

const ORGANIZATION_ID = '10000000-0000-4000-8000-000000000001';
const PATIENT_ID = '10000000-0000-4000-8000-000000000002';
const MEMBERSHIP_ID = '10000000-0000-4000-8000-000000000003';
const DOCUMENT_ID = '10000000-0000-4000-8000-000000000004';
const TENANT: TenantContext = {
  organizationId: ORGANIZATION_ID,
  membershipId: MEMBERSHIP_ID,
  role: 'OWNER',
  clinicalRole: 'PRACTITIONER',
  userId: '10000000-0000-4000-8000-000000000005',
};

function storedDocument(bytes: Buffer, overrides: Record<string, unknown> = {}) {
  return {
    id: DOCUMENT_ID,
    organizationId: ORGANIZATION_ID,
    patientId: PATIENT_ID,
    clinicalEncounterId: null,
    origin: ClinicalDocumentOrigin.UPLOADED,
    status: ClinicalDocumentStatus.ACTIVE,
    documentType: ClinicalDocumentType.CLINICAL_ATTACHMENT,
    title: 'Adjunto clínico',
    originalFileName: 'nota.pdf',
    sourceType: null,
    sourceId: null,
    sourceVersion: null,
    mimeType: 'application/pdf',
    storageKey: `${ORGANIZATION_ID}/${DOCUMENT_ID}.pdf`,
    sizeBytes: BigInt(bytes.byteLength),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    createdByMembershipId: MEMBERSHIP_ID,
    voidedAt: null,
    voidedByMembershipId: null,
    voidReason: null,
    createdAt: new Date('2035-01-08T15:00:00.000Z'),
    ...overrides,
  };
}

// The service boundary test isolates database operations and proves no client-controlled file metadata becomes storage authority.
describe('documents service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('validates file magic, stores server-named bytes, derives the hash, and omits storageKey from responses', async () => {
    const bytes = Buffer.from('%PDF-1.7 fictitious');
    const stored = storedDocument(bytes);
    const storage: StorageService = {
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => bytes),
      exists: jest.fn(async () => true),
      deleteForRollback: jest.fn(async () => undefined),
    };
    const transaction = {
      $queryRaw: jest.fn(async () => [{ id: PATIENT_ID }]),
      patient: { findFirst: jest.fn(async () => ({ status: 'ACTIVE' })) },
      clinicalDocument: { create: jest.fn(async () => stored) },
      clinicalAuditEvent: { create: jest.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new DocumentsService(prisma as unknown as PrismaService, storage);

    const result = await service.upload(
      TENANT,
      PATIENT_ID,
      { title: 'Adjunto clínico' },
      {
        buffer: bytes,
        size: bytes.byteLength,
        mimetype: 'application/pdf',
        originalname: '..\\nota.pdf',
        fieldname: 'file',
        encoding: '7bit',
        stream: Readable.from(bytes),
        destination: '',
        filename: 'fictitious.pdf',
        path: '',
      },
    );

    expect(storage.put).toHaveBeenCalledTimes(1);
    const storedKey = jest.mocked(storage.put).mock.calls[0]?.[0] as string;
    expect(storedKey).toMatch(new RegExp(`^${ORGANIZATION_ID}/[0-9a-f-]+\\.pdf$`));
    expect(storage.put).toHaveBeenCalledWith(storedKey, bytes, 'application/pdf');
    expect(result.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(result.originalFileName).toBe('nota.pdf');
    expect(result).not.toHaveProperty('storageKey');
  });

  it('rejects MIME/magic mismatches before touching storage or the database', async () => {
    const storage: StorageService = {
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => Buffer.alloc(0)),
      exists: jest.fn(async () => false),
      deleteForRollback: jest.fn(async () => undefined),
    };
    const prisma = { $transaction: jest.fn() };
    const service = new DocumentsService(prisma as unknown as PrismaService, storage);

    await expect(
      service.upload(
        TENANT,
        PATIENT_ID,
        { title: 'No es PDF' },
        {
          buffer: Buffer.from('<html>no</html>'),
          size: 15,
          mimetype: 'application/pdf',
          originalname: 'bad.pdf',
          fieldname: 'file',
          encoding: '7bit',
          stream: Readable.from(Buffer.from('<html>no</html>')),
          destination: '',
          filename: 'bad.pdf',
          path: '',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects metadata whose byte length differs from the actual in-memory upload', async () => {
    const storage: StorageService = {
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => Buffer.alloc(0)),
      exists: jest.fn(async () => false),
      deleteForRollback: jest.fn(async () => undefined),
    };
    const prisma = { $transaction: jest.fn() };
    const service = new DocumentsService(prisma as unknown as PrismaService, storage);
    const bytes = Buffer.from('%PDF-1.7 valid header');

    await expect(
      service.upload(TENANT, PATIENT_ID, { title: 'Incorrect size' }, {
        buffer: bytes,
        size: bytes.byteLength - 1,
        mimetype: 'application/pdf',
        originalname: 'note.pdf',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('compensates an uploaded object when the database transaction fails', async () => {
    const bytes = Buffer.from('%PDF-1.7 fictitious');
    const storage: StorageService = {
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => bytes),
      exists: jest.fn(async () => true),
      deleteForRollback: jest.fn(async () => undefined),
    };
    const transaction = {
      $queryRaw: jest.fn(async () => [{ id: PATIENT_ID }]),
      patient: { findFirst: jest.fn(async () => ({ status: 'ACTIVE' })) },
      clinicalDocument: {
        create: jest.fn(async () => {
          throw new Error('db failure');
        }),
      },
      clinicalAuditEvent: { create: jest.fn(async () => ({})) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new DocumentsService(prisma as unknown as PrismaService, storage);

    await expect(
      service.upload(
        TENANT,
        PATIENT_ID,
        { title: 'Adjunto' },
        {
          buffer: bytes,
          size: bytes.byteLength,
          mimetype: 'application/pdf',
          originalname: 'nota.pdf',
          fieldname: 'file',
          encoding: '7bit',
          stream: Readable.from(bytes),
          destination: '',
          filename: 'fictitious.pdf',
          path: '',
        },
      ),
    ).rejects.toThrow('db failure');
    expect(storage.deleteForRollback).toHaveBeenCalledTimes(1);
  });

  it('compensates even when a storage adapter partially writes and then rejects', async () => {
    const bytes = Buffer.from('%PDF-1.7 fictitious');
    const storage: StorageService = {
      put: jest.fn(async () => {
        throw new Error('storage put failed');
      }),
      get: jest.fn(async () => Buffer.alloc(0)),
      exists: jest.fn(async () => false),
      deleteForRollback: jest.fn(async () => undefined),
    };
    const transaction = {
      $queryRaw: jest.fn(async () => [{ id: PATIENT_ID }]),
      patient: { findFirst: jest.fn(async () => ({ status: 'ACTIVE' })) },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new DocumentsService(prisma as unknown as PrismaService, storage);

    await expect(
      service.upload(TENANT, PATIENT_ID, { title: 'Storage failure' }, {
        buffer: bytes,
        size: bytes.byteLength,
        mimetype: 'application/pdf',
        originalname: 'note.pdf',
      } as never),
    ).rejects.toThrow('storage put failed');
    expect(storage.deleteForRollback).toHaveBeenCalledTimes(1);
  });

  it('returns 404 for another tenant before looking up any private storage object', async () => {
    const storage: StorageService = {
      put: jest.fn(async () => undefined),
      get: jest.fn(async () => Buffer.alloc(0)),
      exists: jest.fn(async () => false),
      deleteForRollback: jest.fn(async () => undefined),
    };
    const prisma = { clinicalDocument: { findFirst: jest.fn(async (_query: unknown) => null) } };
    const service = new DocumentsService(prisma as unknown as PrismaService, storage);

    await expect(service.download(TENANT, DOCUMENT_ID)).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.get).not.toHaveBeenCalled();
    expect(prisma.clinicalDocument.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOCUMENT_ID, organizationId: ORGANIZATION_ID },
        select: expect.objectContaining({ storageKey: true, sha256: true }),
      }),
    );
  });
});
