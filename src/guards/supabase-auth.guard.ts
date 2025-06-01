import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
      throw new UnauthorizedException();
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.client.auth.getUser(token);

      if (error || !user) {
        throw new UnauthorizedException();
      }

      // Find or create the user in our database
      const dbUser = await this.prismaService.user.findUnique({
        where: { supabaseId: user.id },
      });

      if (!dbUser) {
        throw new UnauthorizedException(
          'User not found in application database',
        );
      }

      if (dbUser.isBlocked) {
        throw new UnauthorizedException('User is blocked');
      }

      // Attach user to request
      request.user = {
        ...dbUser,
        supabaseUser: user,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException();
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers?.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
