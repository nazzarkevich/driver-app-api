import { CanActivate, ExecutionContext } from '@nestjs/common';

// TODO: refactor guard to have a current user

export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (!request.currentUser) {
      return false;
    }

    return request.currentUser.isAdmin;
  }
}
