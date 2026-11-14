import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_SERVER_ERROR';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (exceptionResponse && typeof exceptionResponse === 'object') {
        message = exceptionResponse.message || message;
        code = exceptionResponse.code || code;
        details = exceptionResponse.error || exceptionResponse.details || null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = (exception as any).code || 'ERROR';
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      code,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
