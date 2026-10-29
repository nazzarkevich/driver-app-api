import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { hashTrackingValue } from './tracking.utils';

@Injectable()
export class TrackingRateLimitGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    response.setHeader('Cache-Control', 'no-store');
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    await this.consume(`tracking:ip:${ip}`, 20, 60, response);
    if (Reflect.getMetadata(PATH_METADATA, context.getHandler()) === 'lookup') {
      const reference =
        typeof request.body?.trackingNumber === 'string'
          ? request.body.trackingNumber.trim().toUpperCase().slice(0, 128)
          : '';
      const businessId = Number(request.body?.businessId) || 0;
      await this.consume(
        `tracking:reference:${businessId}:${reference}:${ip}`,
        5,
        900,
        response,
      );
    }
    await this.prisma.$executeRaw`
      DELETE FROM "TrackingRateLimit" WHERE "key" IN (
        SELECT "key" FROM "TrackingRateLimit" WHERE "expiresAt" < NOW() LIMIT 100
      )`;
    return true;
  }

  private async consume(
    scope: string,
    limit: number,
    seconds: number,
    response: { setHeader: (name: string, value: string) => void },
  ) {
    const key = hashTrackingValue(scope);
    const [bucket] = await this.prisma.$queryRaw<
      { count: number; retryAfter: number }[]
    >`
      INSERT INTO "TrackingRateLimit" ("key", "count", "expiresAt")
      VALUES (${key}, 1, NOW() + ${seconds} * INTERVAL '1 second')
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "TrackingRateLimit"."expiresAt" <= NOW() THEN 1
          ELSE LEAST("TrackingRateLimit"."count" + 1, ${limit + 1}) END,
        "expiresAt" = CASE WHEN "TrackingRateLimit"."expiresAt" <= NOW()
          THEN NOW() + ${seconds} * INTERVAL '1 second' ELSE "TrackingRateLimit"."expiresAt" END
      RETURNING "count", GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - NOW()))))::int AS "retryAfter"`;
    if (bucket.count > limit) {
      response.setHeader('Retry-After', String(bucket.retryAfter));
      throw new HttpException(
        'Too many tracking attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
