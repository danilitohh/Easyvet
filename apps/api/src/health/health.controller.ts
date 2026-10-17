import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthReadinessResponse, HealthResponse } from '@veterinary-saas/contracts';
import { Public } from '../authorization/public.decorator';
import { DatabaseSecurityContext } from '../infrastructure/database/database-security-context';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { RateLimit } from '../http/rate-limit.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly databaseSecurity: DatabaseSecurityContext,
  ) {}

  // Return only the minimal public liveness contract; no infrastructure detail is leaked.
  @Get()
  @Public()
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  @Public()
  @RateLimit({ name: 'health.readiness.ip', identity: 'ip', limit: 60, windowMs: 60_000 })
  async getReadiness(): Promise<HealthReadinessResponse> {
    try {
      await this.databaseSecurity.runSystem(() => this.prisma.$queryRaw`SELECT 1`);
      return { status: 'ok', dependencies: { database: 'ok' } };
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'Service dependencies are not ready',
      });
    }
  }
}
