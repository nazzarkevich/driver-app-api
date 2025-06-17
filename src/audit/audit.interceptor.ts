import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { UserRequestType } from '../users/decorators/current-user.decorator';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();
    const requestId = uuidv4();

    // Extract request information
    const method = request.method;
    const endpoint = request.url;
    const ipAddress = request.ip || request.connection.remoteAddress;
    const userAgent = request.get('User-Agent');
    const currentUser: UserRequestType | null = request.currentUser;

    // Add request ID to request for tracking
    request.requestId = requestId;

    return next.handle().pipe(
      tap({
        next: (responseData) => {
          const duration = Date.now() - startTime;
          const statusCode = response.statusCode;

          // Only log certain actions (avoid logging every GET request)
          if (this.shouldLogRequest(method, endpoint, statusCode)) {
            this.auditService
              .log({
                userId: currentUser?.id,
                action: this.getActionFromRequest(method, endpoint),
                entityType: this.getEntityTypeFromEndpoint(endpoint),
                entityId: this.getEntityIdFromEndpoint(endpoint),
                description: this.getDescriptionFromRequest(
                  method,
                  endpoint,
                  statusCode,
                ),
                metadata: {
                  requestBody: this.sanitizeRequestBody(request.body),
                  responseData: this.sanitizeResponseData(responseData),
                  query: request.query,
                  params: request.params,
                },
                ipAddress,
                userAgent,
                method,
                endpoint,
                requestId,
                duration,
                statusCode,
                businessId: currentUser?.id ? undefined : undefined, // Will be set by service
              })
              .catch((error) => {
                console.error('Audit logging failed:', error);
              });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          // Log errors
          this.auditService
            .log({
              userId: currentUser?.id,
              action: this.getActionFromRequest(method, endpoint),
              entityType: this.getEntityTypeFromEndpoint(endpoint),
              entityId: this.getEntityIdFromEndpoint(endpoint),
              description: `Failed to ${this.getDescriptionFromRequest(method, endpoint, statusCode)}`,
              metadata: {
                requestBody: this.sanitizeRequestBody(request.body),
                error: {
                  message: error.message,
                  stack: error.stack,
                },
                query: request.query,
                params: request.params,
              },
              ipAddress,
              userAgent,
              method,
              endpoint,
              requestId,
              duration,
              statusCode,
            })
            .catch((auditError) => {
              console.error('Audit logging failed:', auditError);
            });
        },
      }),
    );
  }

  private shouldLogRequest(
    method: string,
    endpoint: string,
    statusCode: number,
  ): boolean {
    // Don't log health checks, swagger docs, etc.
    if (
      endpoint.includes('/health') ||
      endpoint.includes('/swagger') ||
      endpoint.includes('/api-docs')
    ) {
      return false;
    }

    // Log all non-GET requests
    if (method !== 'GET') return true;

    // Log failed GET requests
    if (statusCode >= 400) return true;

    // Log GET requests for sensitive endpoints
    if (
      endpoint.includes('/users/') ||
      endpoint.includes('/admin') ||
      endpoint.includes('/audit')
    ) {
      return true;
    }

    return false;
  }

  private getActionFromRequest(
    method: string,
    endpoint: string,
  ):
    | 'CREATE'
    | 'READ'
    | 'UPDATE'
    | 'DELETE'
    | 'LOGIN'
    | 'LOGOUT'
    | 'SIGNUP'
    | 'PASSWORD_CHANGE'
    | 'PROFILE_UPDATE'
    | 'CUSTOM' {
    switch (method) {
      case 'POST':
        if (endpoint.includes('/auth/login')) return 'LOGIN';
        if (endpoint.includes('/auth/signup')) return 'SIGNUP';
        if (endpoint.includes('/auth/logout')) return 'LOGOUT';
        return 'CREATE';
      case 'PUT':
      case 'PATCH':
        if (endpoint.includes('/password')) return 'PASSWORD_CHANGE';
        if (endpoint.includes('/profile')) return 'PROFILE_UPDATE';
        return 'UPDATE';
      case 'DELETE':
        return 'DELETE';
      case 'GET':
        return 'READ';
      default:
        return 'CUSTOM';
    }
  }

  private getEntityTypeFromEndpoint(endpoint: string): string {
    const parts = endpoint
      .split('/')
      .filter((part) => part && !part.match(/^\d+$/));

    if (parts.includes('users')) return 'User';
    if (parts.includes('parcels')) return 'Parcel';
    if (parts.includes('journeys')) return 'Journey';
    if (parts.includes('courier-journeys')) return 'CourierJourney';
    if (parts.includes('vehicles')) return 'Vehicle';
    if (parts.includes('businesses')) return 'Business';
    if (parts.includes('customers')) return 'CustomerProfile';
    if (parts.includes('drivers')) return 'DriverProfile';
    if (parts.includes('couriers')) return 'CourierProfile';
    if (parts.includes('addresses')) return 'Address';
    if (parts.includes('countries')) return 'Country';
    if (parts.includes('auth')) return 'Authentication';

    return 'Unknown';
  }

  private getEntityIdFromEndpoint(endpoint: string): string | undefined {
    const matches = endpoint.match(/\/(\d+)(?:\/|$)/);
    return matches ? matches[1] : undefined;
  }

  private getDescriptionFromRequest(
    method: string,
    endpoint: string,
    statusCode: number,
  ): string {
    const entityType = this.getEntityTypeFromEndpoint(endpoint);
    const entityId = this.getEntityIdFromEndpoint(endpoint);
    const action = method.toLowerCase();

    let description = `${action} ${entityType}`;
    if (entityId) {
      description += ` (ID: ${entityId})`;
    }

    if (statusCode >= 400) {
      description += ` - Failed (${statusCode})`;
    }

    return description;
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return undefined;

    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
    sensitiveFields.forEach((field) => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private sanitizeResponseData(data: any): any {
    if (!data) return undefined;

    // Limit the size of response data in logs
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 5000) {
      return {
        message: 'Response data too large for audit log',
        dataType: typeof data,
        size: dataStr.length,
      };
    }

    return data;
  }
}
