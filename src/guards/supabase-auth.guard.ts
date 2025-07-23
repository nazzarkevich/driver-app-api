import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

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
      console.log('❌ No token provided');
      return false;
    }

    // Store token in request context early for interceptor access
    request.accessToken = token;

    // Get refresh token from storage
    const refreshToken = this.tokenStorageService.getRefreshToken(token);
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

      // Token validation failed, attempt refresh if we have a refresh token
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
      }

      console.log('❌ Token validation and refresh both failed');
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

      // Find the user in our database
      const dbUser = await this.prismaService.user.findUnique({
        where: { supabaseId: user.id },
        include: {
          business: true,
        },
      });

      if (!dbUser) {
        console.log(`❌ User not found with supabaseId: ${user.id}`);
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

      // Update request with new tokens
      request.accessToken = refreshResult.token;
      request.refreshToken = refreshResult.refreshToken;

      // Update authorization header
      request.headers.authorization = `Bearer ${refreshResult.token}`;

      console.log('✅ Token refresh successful');

      // Validate the new token
      return await this.validateToken(refreshResult.token);
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
