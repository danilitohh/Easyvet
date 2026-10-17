import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { REQUEST_ID_HEADER, validRequestId } from './request-id.middleware';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  requestId: string;
}

const SENSITIVE_ASSIGNMENT =
  /(\b(?:password|secret|token|api[_-]?key|authorization|cookie|dsn|database[_-]?url)(?:[_-][a-z0-9]+)*\b\s*[:=]\s*)("[^"]*"|'[^']*'|Bearer\s+[^\s,}]+|[^\s,}]+)/gi;

function redactSensitiveText(value: string): string {
  return value
    .replace(SENSITIVE_ASSIGNMENT, '$1[redacted]')
    .replace(/\bBearer\s+[^\s,}]+/gi, 'Bearer [redacted]')
    .replace(/\b(?:postgres(?:ql)?|mysql):\/\/\S+/gi, '[redacted database URL]');
}

// Error responses omit query values and redact the bearer token used by public signing routes.
function responsePath(request: Request): string {
  const path = request.originalUrl.split('?', 1)[0] || request.path;
  return path.replace(/(^|\/public\/signatures\/)[^/]+(?=\/|$)/i, '$1[redacted]');
}

// Normalize public errors and keep stack traces inside Nest's logger only.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = this.requestId(request, response);
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logInternalError(exception, request, requestId);
    }
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message =
      status >= HttpStatus.INTERNAL_SERVER_ERROR
        ? 'Internal server error'
        : this.readMessage(exceptionResponse, status);
    const body: ErrorBody = {
      statusCode: status,
      code:
        status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? `HTTP_${status}`
          : this.readCode(exceptionResponse, status),
      message,
      requestId,
    };

    response.status(status).json({ ...body, path: responsePath(request) });
  }

  private logInternalError(exception: unknown, request: Request, requestId: string): void {
    const error = exception instanceof Error ? exception : undefined;
    const prismaCode =
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof exception.code === 'string'
        ? exception.code
        : undefined;
    const message = error?.message ? redactSensitiveText(error.message) : undefined;

    this.logger.error({
      requestId,
      method: request.method,
      path: responsePath(request),
      errorName: error?.name ?? 'UnknownError',
      ...(prismaCode ? { prismaCode } : {}),
      ...(message ? { message } : {}),
    });
  }

  private requestId(request: Request, response: Response): string {
    const responseId =
      typeof response.getHeader === 'function' ? response.getHeader(REQUEST_ID_HEADER) : undefined;
    if (validRequestId(responseId)) return responseId;
    const incoming = typeof request.header === 'function' ? request.header('x-request-id') : null;
    if (validRequestId(incoming)) return incoming;
    return 'unassigned';
  }

  private readCode(payload: unknown, status: number): string {
    if (typeof payload === 'object' && payload !== null && 'code' in payload) {
      const value = (payload as { code?: unknown }).code;
      if (typeof value === 'string' && value.trim()) return value;
    }
    if (status === HttpStatus.BAD_REQUEST) return 'VALIDATION_ERROR';
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
