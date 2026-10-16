import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import type { UploadedFile as UploadedMultipartFile } from '../http/uploaded-file';
import { CurrentTenant } from '../authorization/current-tenant.decorator';
import type { TenantContext } from '../authorization/authorization.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { PERMISSIONS } from '../authorization/permissions';
import { RequirePermissions } from '../authorization/require-permissions.decorator';
import { TenantContextGuard } from '../authorization/tenant-context.guard';
import { RateLimit } from '../http/rate-limit.decorator';
import { DocumentsService } from './documents.service';
import {
  DocumentListQueryDto,
  GenerateDocumentDto,
  UploadDocumentDto,
  VoidDocumentDto,
} from './documents.dto';

// Routes expose metadata and authenticated file streams without ever returning internal storage keys.
@Controller()
@UseGuards(TenantContextGuard, PermissionGuard)
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('patients/:patientId/documents')
  @RequirePermissions(PERMISSIONS.CLINICAL.DOCUMENTS_READ)
  listByPatient(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Query() query: DocumentListQueryDto,
  ) {
    return this.documents.listByPatient(tenant, patientId, query);
  }

  @Get('documents/:documentId')
  @RequirePermissions(PERMISSIONS.CLINICAL.DOCUMENTS_READ)
  findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ) {
    return this.documents.findOne(tenant, documentId);
  }

  @Post('documents/generate')
  @RequirePermissions(PERMISSIONS.CLINICAL.DOCUMENTS_GENERATE)
  generate(@CurrentTenant() tenant: TenantContext, @Body() body: GenerateDocumentDto) {
    return this.documents.generate(tenant, body.documentType, body.sourceId);
  }

  @Post('patients/:patientId/documents')
  @RequirePermissions(PERMISSIONS.CLINICAL.DOCUMENTS_UPLOAD)
  @RateLimit({ name: 'documents.upload.ip', identity: 'ip', limit: 20, windowMs: 15 * 60_000 })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  upload(
    @CurrentTenant() tenant: TenantContext,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body() body: UploadDocumentDto,
    @UploadedFile() file: UploadedMultipartFile | undefined,
  ) {
    if (!file)
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Selecciona un archivo para subir.',
      });
    return this.documents.upload(tenant, patientId, body, file);
  }

  @Get('documents/:documentId/file')
  @RequirePermissions(PERMISSIONS.CLINICAL.DOCUMENTS_READ)
  async download(
    @CurrentTenant() tenant: TenantContext,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { metadata, bytes } = await this.documents.download(tenant, documentId);
    const filename =
      metadata.originalFileName ||
      `${metadata.title}.${metadata.mimeType === 'application/pdf' ? 'pdf' : metadata.mimeType === 'image/png' ? 'png' : 'jpg'}`;
    response.set({
      'Content-Type': metadata.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(bytes);
  }

  @Post('documents/:documentId/void')
  @RequirePermissions(PERMISSIONS.CLINICAL.DOCUMENTS_VOID)
  void(
    @CurrentTenant() tenant: TenantContext,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
    @Body() body: VoidDocumentDto,
  ) {
    return this.documents.void(tenant, documentId, body.reason);
  }
}
