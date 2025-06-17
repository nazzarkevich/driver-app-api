import {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
  UnauthorizedException,
} from '@nestjs/common';
import { TokenUtils } from 'src/utils/token.utils';

export class UserInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, handler: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const token = TokenUtils.extractTokenFromHeader(request);
    let currentUser = null;

    if (token) {
      try {
        currentUser = await TokenUtils.verifyToken(
          token,
          process.env.JSON_TOKEN_KEY,
        );
      } catch (error) {
        console.error('Token verification failed:', error);
        throw new UnauthorizedException('Invalid token');
      }
    }

    request.currentUser = currentUser;
    return handler.handle();
  }
}
