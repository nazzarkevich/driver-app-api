import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** No origins are allowed until configured; native bearer-token clients are unaffected. */
export function createCorsOptions(allowedOrigins = ''): CorsOptions {
  const origins = new Set(
    allowedOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  return {
    origin: (origin, callback) =>
      callback(null, !!origin && origins.has(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
    credentials: false,
    maxAge: 600,
  };
}
