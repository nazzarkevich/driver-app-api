import { Request } from 'express';
import { createHash } from 'crypto';

export class TokenUtils {
  static requestSource(request: Request) {
    return {
      origin: request.get('origin') ?? null,
      userAgent: request.get('user-agent') ?? null,
      remoteAddress: request.socket?.remoteAddress ?? null,
    };
  }

  // Correlate requests without writing bearer credentials to logs.
  static fingerprint(token?: string): string | null {
    return typeof token === 'string' && token
      ? createHash('sha256').update(token).digest('hex').slice(0, 16)
      : null;
  }

  static diagnostics(accessToken?: string, refreshToken?: string) {
    let issuedAt: number | null = null;
    let expiresAt: number | null = null;
    try {
      // Unverified claims are diagnostic only; getUser still authenticates.
      const claims = JSON.parse(
        Buffer.from(accessToken?.split('.')[1] ?? '', 'base64url').toString(),
      );
      issuedAt = Number.isFinite(claims.iat) ? claims.iat : null;
      expiresAt = Number.isFinite(claims.exp) ? claims.exp : null;
    } catch {
      // Missing or malformed tokens must not break error reporting.
    }
    const now = Math.floor(Date.now() / 1000);
    return {
      accessFingerprint: this.fingerprint(accessToken),
      refreshFingerprint: this.fingerprint(refreshToken),
      issuedAt,
      expiresAt,
      serverTime: now,
      secondsUntilExpiry: expiresAt === null ? null : expiresAt - now,
    };
  }

  static extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers?.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
