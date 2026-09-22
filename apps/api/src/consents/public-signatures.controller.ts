import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import type { UploadedFile as UploadedMultipartFile } from '../http/uploaded-file';
import { Public } from '../authorization/public.decorator';
import { PublicSignatureDto } from '../documents/documents.dto';
import { ConsentsService } from './consents.service';

// Public token routes return only consent-signing data and explicitly prohibit caching or referrer leakage.
@Controller('public/signatures')
export class PublicSignaturesController {
  constructor(private readonly consents: ConsentsService) {}

  @Get(':token')
  @Public()
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Referrer-Policy', 'no-referrer')
  get(@Param('token') token: string) {
    return this.consents.getPublicConsent(token);
  }

  @Post(':token/sign')
  @Public()
  @Header('Cache-Control', 'no-store, max-age=0')
  @Header('Referrer-Policy', 'no-referrer')
  @UseInterceptors(FileInterceptor('signature', { limits: { fileSize: 1024 * 1024, files: 1 } }))
  sign(
    @Param('token') token: string,
    @Body() body: PublicSignatureDto,
    @UploadedFile() file: UploadedMultipartFile | undefined,
    @Req() request: Request,
  ) {
    if (!body)
      throw new BadRequestException({
        code: 'SIGNATURE_UNAVAILABLE',
        message: 'No fue posible continuar con esta solicitud de firma.',
      });
    return this.consents.signPublic(
      token,
      {
        verificationCode: body.verificationCode,
        signerName: body.signerName,
        signatureMethod: body.signatureMethod,
        accepted: body.accepted,
      },
      file,
      request,
    );
  }
}
