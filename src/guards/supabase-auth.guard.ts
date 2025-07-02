import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../prisma/prisma.service';

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
      return false;
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.client.auth.getUser(token);

      if (error || !user) {
        console.log(`❌ Supabase auth failed:`, error?.message);
        return false;
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
        return false;
      }

      if (dbUser.isBlocked) {
        console.log(`❌ User is blocked: ${dbUser.email}`);
        return false;
      }

      if (!dbUser.business?.isActive) {
        console.log(`❌ User's business is not active:`, {
          userEmail: dbUser.email,
          businessId: dbUser.businessId,
          businessName: dbUser.business?.name,
          businessIsActive: dbUser.business?.isActive,
        });
        return false;
      }

      console.log(`✅ User authorized successfully: ${dbUser.email}`);

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
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers?.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
