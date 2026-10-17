import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from '@jest/globals';
import {
  CashMovementListQueryDto,
  CashSessionListQueryDto,
  InvoiceListQueryDto,
  SaleListQueryDto,
} from '../commercial/commercial.dto';
import {
  AnesthesiaObservationListQueryDto,
  AnesthesiaRecordListQueryDto,
} from '../anesthesia/anesthesia.dto';
import {
  ClinicalEncounterQueryDto,
  ClinicalEvolutionQueryDto,
  ClinicalMembershipListQueryDto,
  ClinicalVitalQueryDto,
} from '../clinical/clinical.dto';
import { AvailabilityRuleListQueryDto } from '../appointments/appointment.dto';
import { ConsentListQueryDto, DocumentListQueryDto } from '../documents/documents.dto';
import { DewormingListQueryDto } from '../dewormings/deworming.dto';
import { DiagnosticOrderListQueryDto } from '../diagnostics/diagnostic.dto';
import { ClinicalFollowUpListQueryDto } from '../follow-ups/follow-ups.dto';
import { GroomingGroomerListQueryDto, GroomingVisitListQueryDto } from '../grooming/grooming.dto';
import {
  HospitalizationEntriesQueryDto,
  HospitalizationListQueryDto,
} from '../hospitalizations/hospitalization.dto';
import {
  InventoryBatchListQueryDto,
  InventoryItemListQueryDto,
  InventoryMovementListQueryDto,
  InventoryStockQueryDto,
} from '../inventory/inventory.dto';
import { LocationListQueryDto } from '../locations/locations.dto';
import { ListStaffDto } from '../memberships/memberships.dto';
import { OwnersQueryDto } from '../owners/owner.dto';
import { PatientsQueryDto } from '../patients/patient.dto';
import {
  PlatformAccountsQueryDto,
  PlatformActivityQueryDto,
  PlatformOrganizationsQueryDto,
  PlatformSubscriptionsQueryDto,
} from '../platform/platform.dto';
import { PrescriptionListQueryDto } from '../prescriptions/prescription.dto';
import { ClinicalProcedureListQueryDto } from '../procedures/procedure.dto';
import { VaccinationListQueryDto } from '../vaccinations/vaccination.dto';

const boundedPageQueries = [
  AnesthesiaObservationListQueryDto,
  AnesthesiaRecordListQueryDto,
  AvailabilityRuleListQueryDto,
  CashMovementListQueryDto,
  CashSessionListQueryDto,
  ClinicalEncounterQueryDto,
  ClinicalEvolutionQueryDto,
  DocumentListQueryDto,
  ConsentListQueryDto,
  ClinicalFollowUpListQueryDto,
  ClinicalMembershipListQueryDto,
  ClinicalProcedureListQueryDto,
  ClinicalVitalQueryDto,
  DewormingListQueryDto,
  DiagnosticOrderListQueryDto,
  GroomingGroomerListQueryDto,
  GroomingVisitListQueryDto,
  HospitalizationEntriesQueryDto,
  HospitalizationListQueryDto,
  InventoryBatchListQueryDto,
  InventoryItemListQueryDto,
  InventoryMovementListQueryDto,
  InventoryStockQueryDto,
  InvoiceListQueryDto,
  ListStaffDto,
  LocationListQueryDto,
  OwnersQueryDto,
  PatientsQueryDto,
  PlatformAccountsQueryDto,
  PlatformActivityQueryDto,
  PlatformOrganizationsQueryDto,
  PlatformSubscriptionsQueryDto,
  PrescriptionListQueryDto,
  SaleListQueryDto,
  VaccinationListQueryDto,
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

  it.each(boundedPageQueries)('%p rejects an oversized page size', (queryDto) => {
    const query = plainToInstance(queryDto, { pageSize: '101' });

    expect(validateSync(query)).not.toHaveLength(0);
  });
});
