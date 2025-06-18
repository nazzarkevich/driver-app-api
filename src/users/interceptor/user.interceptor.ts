import {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  UnauthorizedException,
  Injectable,
} from '@nestjs/common';
import { TokenUtils } from 'src/utils/token.utils';
import { PrismaService } from 'src/prisma/prisma.service';

interface JWTPayload {
  id: number;
  name: string;
  iat: number;
  exp: number;
}

@Injectable()
export class UserInterceptor implements NestInterceptor {
  constructor(private readonly prismaService: PrismaService) {}

  async intercept(context: ExecutionContext, handler: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const token = TokenUtils.extractTokenFromHeader(request);
    let currentUser = null;

    if (token) {
      try {
        const payload = await TokenUtils.verifyToken(
          token,
          process.env.JSON_TOKEN_KEY,
        );

        // Check if payload is an object and has the expected structure
        if (typeof payload === 'object' && payload && 'id' in payload) {
          const jwtPayload = payload as JWTPayload;

          // Load user with business context from database
          const user = await this.prismaService.user.findUnique({
            where: { id: jwtPayload.id },
            include: { business: true },
          });

          if (user && user.business?.isActive) {
            currentUser = {
              id: jwtPayload.id,
              name: jwtPayload.name,
              iat: jwtPayload.iat,
              exp: jwtPayload.exp,
              businessId: user.businessId,
              type: user.type,
              isAdmin: user.isAdmin,
              isSuperAdmin: user.isSuperAdmin,
            };
          }
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        throw new UnauthorizedException('Invalid token');
      }
    }

    request.currentUser = currentUser;
    return handler.handle();
  }
}
