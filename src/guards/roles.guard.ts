import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '@prisma/client';
import { Request } from 'express';

import { UserDto } from 'src/users/dtos/user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseService } from 'src/supabase/supabase.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaService: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    const roles = this.reflector.getAllAndOverride('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!token) {
      return false;
    }

    try {
      const {
        data: { user },
        error,
      } = await this.supabaseService.client.auth.getUser(token);

      if (error || !user) {
        return false;
      }

      const dbUser = await this.prismaService.user.findUnique({
        where: {
          supabaseId: user.id,
        },
      });

      if (!dbUser) {
        return false;
      }

      if (this.hasRolePermit(roles, dbUser.type) || this.isAdminRole(dbUser)) {
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  private isAdminRole = (user: UserDto): boolean => {
    return user.type === UserType.Moderator || user.isAdmin;
  };

  private hasRolePermit = (roles: UserType[], type: UserType): boolean => {
    const hasRoles = roles.length > 0;

    return hasRoles && roles.includes(type);
  };

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers?.authorization?.split(' ') ?? [];

    return type === 'Bearer' ? token : undefined;
  }
}

/*
    1) Determine the UserTypes that can execute the called endpoint
    2) Grab Supabase token from the request header and verify it
    3) Database request to get user by supabaseId
    4) Determine if user has permissions
*/
