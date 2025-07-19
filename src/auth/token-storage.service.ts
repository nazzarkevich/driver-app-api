import { Injectable, Logger } from '@nestjs/common';

interface StoredTokenData {
  refreshToken: string;
  userId: string;
  expiresAt: Date;
}

@Injectable()
export class TokenStorageService {
  private readonly logger = new Logger(TokenStorageService.name);
  private readonly tokenStore = new Map<string, StoredTokenData>();
  private readonly userTokenMap = new Map<string, string>();

  storeRefreshToken(
    accessToken: string,
    refreshToken: string,
    userId: string,
    expiresAt: Date,
  ): void {
    this.tokenStore.set(accessToken, {
      refreshToken,
      userId,
      expiresAt,
    });

    this.userTokenMap.set(userId, accessToken);

    this.logger.debug(`Stored refresh token for user ${userId}`);
  }

  getRefreshToken(accessToken: string): string | null {
    const tokenData = this.tokenStore.get(accessToken);
    if (!tokenData) {
      return null;
    }

    if (new Date() > tokenData.expiresAt) {
      this.removeToken(accessToken);
      this.logger.debug(`Refresh token expired for user ${tokenData.userId}`);
      return null;
    }

    return tokenData.refreshToken;
  }

  removeToken(accessToken: string): void {
    const tokenData = this.tokenStore.get(accessToken);
    if (tokenData) {
      this.userTokenMap.delete(tokenData.userId);
      this.tokenStore.delete(accessToken);
      this.logger.debug(`Removed token for user ${tokenData.userId}`);
    }
  }

  removeUserTokens(userId: string): void {
    const accessToken = this.userTokenMap.get(userId);
    if (accessToken) {
      this.tokenStore.delete(accessToken);
      this.userTokenMap.delete(userId);
      this.logger.debug(`Removed all tokens for user ${userId}`);
    }
  }

  updateAccessToken(
    oldAccessToken: string,
    newAccessToken: string,
    newRefreshToken: string,
    expiresAt: Date,
  ): void {
    const tokenData = this.tokenStore.get(oldAccessToken);
    if (tokenData) {
      this.removeToken(oldAccessToken);
      this.storeRefreshToken(
        newAccessToken,
        newRefreshToken,
        tokenData.userId,
        expiresAt,
      );
      this.logger.debug(`Updated tokens for user ${tokenData.userId}`);
    }
  }

  cleanupExpiredTokens(): void {
    const now = new Date();
    const expiredTokens: string[] = [];

    for (const [accessToken, tokenData] of this.tokenStore.entries()) {
      if (now > tokenData.expiresAt) {
        expiredTokens.push(accessToken);
      }
    }

    expiredTokens.forEach((token) => this.removeToken(token));

    if (expiredTokens.length > 0) {
      this.logger.debug(`Cleaned up ${expiredTokens.length} expired tokens`);
    }
  }
}
