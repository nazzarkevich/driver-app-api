import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthProvider } from '@prisma/client';

import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenStorageService } from '../auth/token-storage.service';
import { AuthService } from '../users/auth/auth.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
    private readonly prismaService: PrismaService,
    private readonly tokenStorageService: TokenStorageService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    const isPublic = this.reflector.getAllAndOverride('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (!token) {
      console.log('❌ No token provided in Authorization header');
      return false;
    }

    request.accessToken = token;

    let refreshToken = this.tokenStorageService.getRefreshToken(token);

    if (!refreshToken) {
      const headerRefreshToken = request.headers['x-refresh-token'] as string;
      if (headerRefreshToken) {
        refreshToken = headerRefreshToken;
        console.log('📥 Using refresh token from X-Refresh-Token header');
        this.tokenStorageService.storeRefreshToken(
          token,
          headerRefreshToken,
          'temp',
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        );
      } else {
        console.log(
          '⚠️  No refresh token found. Token validation may fail without ability to refresh.',
        );
      }
    } else {
      console.log('💾 Using refresh token from in-memory storage');
    }

    request.refreshToken = refreshToken;

    console.log(
      '🔍 Attempting token validation for:',
      token.substring(0, 20) + '...',
    );

    try {
      const result = await this.validateToken(token);
      if (result.success) {
        return this.setupUserContext(request, result.user, result.dbUser);
      }

      if (refreshToken) {
        console.log('🔄 Token validation failed, attempting refresh...');
        const refreshResult = await this.attemptTokenRefresh(
          request,
          refreshToken,
          token,
        );
        if (refreshResult.success) {
          return this.setupUserContext(
            request,
            refreshResult.user,
            refreshResult.dbUser,
          );
        }
        console.log('❌ Token refresh failed. User needs to log in again.');
      } else {
        console.log(
          '❌ Token validation failed and no refresh token available. User needs to log in again.',
        );
      }

      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  private async validateToken(
    token: string,
  ): Promise<{ success: boolean; user?: any; dbUser?: any }> {
    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.client.auth.getUser(token);

      if (error || !user) {
        console.log(`❌ Supabase auth failed:`, error?.message);
        return { success: false };
      }

      const authProfile = await this.prismaService.authProfile.findUnique({
        where: {
          provider_providerId: {
            provider: AuthProvider.Supabase,
            providerId: user.id,
          },
        },
        include: {
          user: {
            include: { business: true },
          },
        },
      });

      const dbUser = authProfile?.user ?? null;

      if (!dbUser) {
        console.log(`❌ User not found for Supabase ID: ${user.id}`);
        return { success: false };
      }

      if (dbUser.isBlocked) {
        console.log(`❌ User is blocked: ${dbUser.email}`);
        return { success: false };
      }

      if (!dbUser.business?.isActive) {
        console.log(`❌ User's business is not active:`, {
          userEmail: dbUser.email,
          businessId: dbUser.businessId,
          businessName: dbUser.business?.name,
          businessIsActive: dbUser.business?.isActive,
        });
        return { success: false };
      }

      console.log(`✅ User authorized successfully: ${dbUser.email}`);
      return { success: true, user, dbUser };
    } catch (error) {
      console.error('Token validation error:', error);
      return { success: false };
    }
  }

  private async attemptTokenRefresh(
    request: any,
    refreshToken: string,
    oldToken: string,
  ): Promise<{ success: boolean; user?: any; dbUser?: any }> {
    try {
      console.log('🔄 Attempting token refresh...');
      const refreshResult = await this.authService.refreshToken(
        refreshToken,
        oldToken,
      );

      request.accessToken = refreshResult.token;
      request.refreshToken = refreshResult.refreshToken;
      request.tokenWasRefreshed = true;
      request.headers.authorization = `Bearer ${refreshResult.token}`;

      console.log('✅ Token refresh successful');

      const dbUser = refreshResult.dbUser;

      if (!dbUser) {
        console.log(`❌ User data not available from refresh result`);
        return { success: false };
      }

      if (dbUser.isBlocked) {
        console.log(`❌ User is blocked: ${dbUser.email}`);
        return { success: false };
      }

      if (!dbUser.business?.isActive) {
        console.log(`❌ User's business is not active:`, {
          userEmail: dbUser.email,
          businessId: dbUser.businessId,
          businessName: dbUser.business?.name,
          businessIsActive: dbUser.business?.isActive,
        });
        return { success: false };
      }

      return { success: true, user: null, dbUser };
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      return { success: false };
    }
  }

  private setupUserContext(request: any, user: any, dbUser: any): boolean {
    // Set currentUser in request to match existing structure
    request.currentUser = {
      id: dbUser.id,
      name: `${dbUser.firstName} ${dbUser.lastName}`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      businessId: dbUser.businessId,
      type: dbUser.type,
      isAdmin: dbUser.isAdmin,
      isSuperAdmin: dbUser.isSuperAdmin,
    };

    // Also set user for backward compatibility
    request.user = {
      ...dbUser,
      supabaseUser: user,
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers?.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
