import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CommercialPage,
  InvoiceDetail,
  InvoiceListQuery,
  InvoiceListResponse,
} from '@veterinary-saas/contracts';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { invoiceInclude, toInvoiceDetail, toInvoiceSummary } from './commercial.mapper';

// Billing reads never reveal whether an invoice UUID exists outside the active tenant.
function notFound(): NotFoundException {
  return new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Resource not found' });
}

// Invoice history is read-only here; lifecycle changes are always driven by Sale void.
@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  // Lists internal invoices with bounded filters and no fiscal or mutable InvoiceItem abstraction.
  async list(organizationId: string, query: InvoiceListQuery): Promise<InvoiceListResponse> {
    if (query.from && query.to && new Date(query.from).getTime() > new Date(query.to).getTime()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'from must be earlier than or equal to to',
      });
    }
    const where: Prisma.InvoiceWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clinicLocationId ? { sale: { clinicLocationId: query.clinicLocationId } } : {}),
      ...(query.from || query.to
        ? {
            issuedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(query.documentNumber ? { documentNumber: { startsWith: query.documentNumber } } : {}),
    };
    const [records, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return this.page(records.map(toInvoiceSummary), query.page, query.pageSize, total);
  }

  // Invoice detail is a tenant-scoped view over invoice snapshots and its immutable SaleItems.
  async findOne(organizationId: string, invoiceId: string): Promise<InvoiceDetail> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId },
      include: invoiceInclude,
    });
    if (!invoice) throw notFound();
    return toInvoiceDetail(invoice);
  }

  // Shared pagination metadata avoids leaking Prisma records to API consumers.
  private page<T>(data: T[], page: number, pageSize: number, total: number): CommercialPage<T> {
    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }
}
