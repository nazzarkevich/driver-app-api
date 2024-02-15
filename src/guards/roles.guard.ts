import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';

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
    const token = request.headers?.authorization?.split('Bearer ')[1];
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

      if (roles.includes(user.type)) {
        return true;
      }

      return false;
    } catch (error) {
      return false;
    }
  }
}

/*
    1) Determine the UserTypes that can execute the called endpoint
    2) Grab JWT from the request header and verify it
    3) Database request to get user by id
    4) Determine if user has permissions
*/
