import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';

import { PrismaService } from 'src/prisma/prisma.service';

export interface JWTPayload {
  name: string;
  id: number;
  iat: number;
  exp: number;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
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

    try {
      const payload = (await jwt.verify(
        token,
        process.env.JSON_TOKEN_KEY,
      )) as JWTPayload;

      const user = await this.prismaService.user.findUnique({
        where: {
          id: payload.id,
        },
        include: {
          business: true,
        },
      });

      if (user && user.business?.isActive && !user.isBlocked) {
        // Set business context in request for use by interceptors
        request.currentUser = {
          id: user.id,
          name: payload.name,
          iat: payload.iat,
          exp: payload.exp,
          businessId: user.businessId,
          type: user.type,
          isAdmin: user.isAdmin,
          isSuperAdmin: user.isSuperAdmin,
        };
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }

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
