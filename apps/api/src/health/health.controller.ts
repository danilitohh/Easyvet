import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@veterinary-saas/contracts';
import { Public } from '../authorization/public.decorator';

@Controller('health')
export class HealthController {
  // Return only the minimal public liveness contract; no infrastructure detail is leaked.
  @Get()
  @Public()
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
