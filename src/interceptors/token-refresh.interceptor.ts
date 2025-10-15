import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

import { AuthService } from '../users/auth/auth.service';
import { TokenStorageService } from '../auth/token-storage.service';

@Injectable()
export class TokenRefreshInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TokenRefreshInterceptor.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenStorageService: TokenStorageService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!request.refreshToken) {
      const headerRefreshToken = request.headers['x-refresh-token'] as string;
      if (headerRefreshToken) {
        request.refreshToken = headerRefreshToken;
        this.logger.debug(
          `[TokenRefreshInterceptor] Using refresh token from header`,
        );
      }
    }

    this.logger.debug(`[TokenRefreshInterceptor] Request: ${request.method} ${request.url}`);
    this.logger.debug(
      `[TokenRefreshInterceptor] Auth state: accessToken=${!!request.accessToken}, refreshToken=${!!request.refreshToken}, alreadyRefreshed=${!!request.tokenWasRefreshed}`,
    );

    return next.handle().pipe(
      catchError((error) => {
        const response = context.switchToHttp().getResponse<Response>();

        this.logger.debug(
          `[TokenRefreshInterceptor] Error caught - Status: ${error.status}, Message: ${error.message}`,
        );

        if (request.tokenWasRefreshed) {
          this.logger.debug(
            `[TokenRefreshInterceptor] Skipping refresh - token already refreshed by guard`,
          );
          return throwError(() => error);
        }

        const isTokenRelatedError =
          error.status === 401 ||
          (error.status === 403 && this.isTokenRelated403(error));

        const canAttemptRefresh =
          isTokenRelatedError &&
          error.message !== 'Invalid refresh token' &&
          error.message !== 'Refresh token is required' &&
          request.accessToken &&
          request.refreshToken;

        if (canAttemptRefresh) {
          this.logger.debug(
            `[TokenRefreshInterceptor] Attempting automatic refresh for user ${request.currentUser?.id}`,
          );
          return this.attemptTokenRefresh(request, response, context, next);
        }

        this.logger.debug(
          `[TokenRefreshInterceptor] Not attempting refresh - isTokenError=${isTokenRelatedError}, hasTokens=${!!(request.accessToken && request.refreshToken)}, errorMsg="${error.message}"`,
        );

        return throwError(() => error);
      }),
    );
  }

  private isTokenRelated403(error: any): boolean {
    // Check if the 403 error is likely due to token issues rather than permissions
    // Common indicators of token-related 403 errors:
    const tokenRelatedMessages = [
      'token expired',
      'invalid token',
      'token invalid',
      'jwt expired',
      'session expired',
      'unauthorized',
      'authentication failed',
      'auth',
    ];

    const errorMessage = (error.message || '').toLowerCase();
    return (
      tokenRelatedMessages.some((msg) => errorMessage.includes(msg)) ||
      !errorMessage || // Empty message might indicate auth failure
      errorMessage.includes('403')
    ); // Generic 403 without specific permission message
  }

  private attemptTokenRefresh(
    request: Request,
    response: Response,
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    return new Observable((observer) => {
      this.authService
        .refreshToken(request.refreshToken, request.accessToken)
        .then((refreshResult) => {
          this.logger.debug(
            `Token refresh successful for user ${request.currentUser?.id}`,
          );

          // Update the authorization header with the new token
          request.headers.authorization = `Bearer ${refreshResult.token}`;
          request.accessToken = refreshResult.token;
          request.refreshToken = refreshResult.refreshToken;

          // Set response headers to inform client about new tokens
          response.setHeader('X-New-Access-Token', refreshResult.token);
          response.setHeader('X-New-Refresh-Token', refreshResult.refreshToken);

          // Retry the original request with the new token
          next.handle().subscribe({
            next: (data) => observer.next(data),
            error: (retryError) => {
              this.logger.error(
                `Request failed even after token refresh: ${retryError.message}`,
              );
              observer.error(retryError);
            },
            complete: () => observer.complete(),
          });
        })
        .catch((refreshError) => {
          this.logger.warn(
            `Token refresh failed for user ${request.currentUser?.id}: ${refreshError.message}`,
          );

          // Refresh failed - user needs to log in again
          // Clean up tokens and force logout
          if (request.accessToken) {
            this.tokenStorageService.removeToken(request.accessToken);
          }

          if (request.currentUser?.id) {
            this.authService.logout(
              request.accessToken,
              request.currentUser.id.toString(),
            );
          }

          // Return unauthorized error to force client logout
          observer.error(
            new UnauthorizedException('Session expired. Please log in again.'),
          );
        });
    });
  }
}
