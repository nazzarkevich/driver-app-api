import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { UnauthorizedException } from '@nestjs/common';

export class TokenUtils {
  static extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers?.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  static async verifyToken(token: string, secret: string) {
    try {
      return await jwt.verify(token, secret);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
