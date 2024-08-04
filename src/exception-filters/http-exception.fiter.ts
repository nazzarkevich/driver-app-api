import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private logger: Logger) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const errorDetails = exception.getResponse();

    this.logger.error(
      `${request.method} ${request.originalUrl} ${status} error: ${exception.message}`,
    );

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      error: true,
      errorDetails,
    });
  }
}
