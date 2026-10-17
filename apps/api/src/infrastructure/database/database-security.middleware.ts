import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { DatabaseSecurityContext } from './database-security-context';

// Every request starts denied; guards must explicitly establish system or tenant scope.
@Injectable()
export class DatabaseSecurityMiddleware implements NestMiddleware {
  constructor(private readonly security: DatabaseSecurityContext) {}

  use(_request: Request, _response: Response, next: NextFunction): void {
    this.security.runDenied(next);
  }
}
