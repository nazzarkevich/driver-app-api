import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

interface RateWindow {
  count: number;
  resetAt: number;
}

@Injectable()
export class AddressSearchRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, RateWindow>();
  private readonly limit = 60;
  private readonly windowMs = 60_000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & { currentUser?: { id?: number } }
    >();
    const key = request.currentUser?.id
      ? `user:${request.currentUser.id}`
      : `ip:${request.ip}`;
    const now = Date.now();
    const current = this.windows.get(key);

    if (!current || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (current.count >= this.limit) {
      throw new HttpException(
        'Too many address lookup requests. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    current.count += 1;
    return true;
  }
}
