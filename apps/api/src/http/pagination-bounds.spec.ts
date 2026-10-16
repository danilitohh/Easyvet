import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from '@jest/globals';
import { CashMovementListQueryDto } from '../commercial/commercial.dto';
import { DocumentListQueryDto } from '../documents/documents.dto';
import { ClinicalFollowUpListQueryDto } from '../follow-ups/follow-ups.dto';
import { GroomingVisitListQueryDto } from '../grooming/grooming.dto';
import {
  InventoryItemListQueryDto,
  InventoryMovementListQueryDto,
  InventoryStockQueryDto,
} from '../inventory/inventory.dto';
import { ListStaffDto } from '../memberships/memberships.dto';
import { PlatformActivityQueryDto } from '../platform/platform.dto';

const boundedPageQueries = [
  CashMovementListQueryDto,
  DocumentListQueryDto,
  ClinicalFollowUpListQueryDto,
  GroomingVisitListQueryDto,
  InventoryItemListQueryDto,
  InventoryMovementListQueryDto,
  InventoryStockQueryDto,
  ListStaffDto,
  PlatformActivityQueryDto,
];

describe('pagination bounds', () => {
  it.each(boundedPageQueries)('%p rejects offsets beyond the supported limit', (queryDto) => {
    const query = plainToInstance(queryDto, { page: '10001' });

    expect(validateSync(query)).not.toHaveLength(0);
  });

  it.each(boundedPageQueries)('%p accepts the maximum supported page', (queryDto) => {
    const query = plainToInstance(queryDto, { page: '10000' });

    expect(validateSync(query)).toHaveLength(0);
  });
});
