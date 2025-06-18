import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.currentUser as UserRequestType;

    if (!user) {
      return false;
    }

    return user.isSuperAdmin === true;
  }
}
