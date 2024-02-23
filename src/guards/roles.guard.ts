import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

import { UserDto } from 'src/users/dtos/user.dto';
import { PrismaService } from 'src/prisma/prisma.service';

export interface JWTPayload {
  name: string;
  id: number;
  iat: number;
  exp: number;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    const roles = this.reflector.getAllAndOverride('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    try {
      const payload = (await jwt.verify(
        token,
        process.env.JSON_TOKEN_KEY,
      )) as JWTPayload;

      const user = await this.prismaService.user.findUnique({
        where: {
          id: payload.id,
        },
      });

      if (!user) {
        return false;
      }

      if (this.hasRolePermit(roles, user.type) || this.isAdminRole(user)) {
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
    2) Grab JWT from the request header and verify it
    3) Database request to get user by id
    4) Determine if user has permissions
*/
