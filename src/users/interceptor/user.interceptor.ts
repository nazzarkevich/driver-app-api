import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

export class UserInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, handler: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const token = request?.headers?.authorization?.split('Bearer ')[1];
    let currentUser = null;

    try {
      currentUser = await jwt.decode(token);
    } catch (er) {
      console.log(er);
    }

    request.currentUser = currentUser;

    return handler.handle();
  }
}
