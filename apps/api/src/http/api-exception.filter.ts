import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
}

// Normalize public errors and keep stack traces inside Nest's logger only.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.readMessage(exceptionResponse, status);
    const body: ErrorBody = {
      statusCode: status,
      code: this.readCode(exceptionResponse, status),
      message,
    };

    response.status(status).json({ ...body, path: request.url });
  }

  private readCode(payload: unknown, status: number): string {
    if (typeof payload === 'object' && payload !== null && 'code' in payload) {
      const value = (payload as { code?: unknown }).code;
      if (typeof value === 'string' && value.trim()) return value;
    }
    return `HTTP_${status}`;
  }

  private readMessage(payload: unknown, status: number): string | string[] {
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const value = (payload as { message?: unknown }).message;
      if (typeof value === 'string' || Array.isArray(value)) {
        return value as string | string[];
      }
    }
    return status >= 500 ? 'Internal server error' : 'Request failed';
  }
}
