import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthProvider } from '@prisma/client';

import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';
import { TokenUtils } from '../utils/token.utils';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
    private readonly prismaService: PrismaService,
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
      throw new UnauthorizedException('Access token is required');
    }

    request.accessToken = token;

    console.log('[AuthTrace] access validation', {
      method: request.method,
      path: request.path,
      ...TokenUtils.requestSource(request),
      ...TokenUtils.diagnostics(token),
    });

    try {
      const result = await this.validateToken(token);
      if (result.success) {
        return this.setupUserContext(request, result.user, result.dbUser);
      }

      throw new UnauthorizedException('Session expired. Please log in again.');
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
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
