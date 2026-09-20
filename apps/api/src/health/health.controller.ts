import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@veterinary-saas/contracts';

@Controller('health')
export class HealthController {
  // Return only the minimal public liveness contract; no infrastructure detail is leaked.
  @Get()
  getHealth(): HealthResponse {
    return { status: 'ok' };
  }
}
