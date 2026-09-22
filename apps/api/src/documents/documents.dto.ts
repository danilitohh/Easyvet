import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ClinicalDocumentOrigin,
  ClinicalDocumentSourceType,
  ClinicalDocumentStatus,
  ClinicalDocumentType,
} from '@prisma/client';

export class GenerateDocumentDto {
  @IsEnum(ClinicalDocumentType)
  documentType!: ClinicalDocumentType;

  @IsUUID()
  sourceId!: string;
}

export class UploadDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsUUID()
  clinicalEncounterId?: string;

  @IsOptional()
  @IsEnum(ClinicalDocumentSourceType)
  sourceType?: ClinicalDocumentSourceType;

  @IsOptional()
  @IsUUID()
  sourceId?: string;
}

export class DocumentListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @IsOptional()
  @IsEnum(ClinicalDocumentStatus)
  status?: ClinicalDocumentStatus;

  @IsOptional()
  @IsEnum(ClinicalDocumentType)
  documentType?: ClinicalDocumentType;

  @IsOptional()
  @IsEnum(ClinicalDocumentOrigin)
  origin?: ClinicalDocumentOrigin;

  @IsOptional()
  @IsUUID()
  clinicalEncounterId?: string;
}

export class VoidDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class CreateConsentDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  purposeText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  risksText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  benefitsText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  alternativesText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  estimatedCostText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  declarationText?: string | null;

  @IsOptional()
  @IsUUID()
  responsiblePractitionerMembershipId?: string | null;

  @IsOptional()
  @IsUUID()
  clinicalProcedureId?: string | null;
}

export class UpdateConsentDraftDto extends CreateConsentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ExpectedVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class VoidConsentDto extends ExpectedVersionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class PublicSignatureDto {
  @IsString()
  @Matches(/^\d{6}$/)
  verificationCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  signerName!: string;

  @IsIn(['TYPED', 'DRAWN'])
  signatureMethod!: 'TYPED' | 'DRAWN';

  @IsString()
  @Matches(/^true$/i)
  accepted!: string;
}
