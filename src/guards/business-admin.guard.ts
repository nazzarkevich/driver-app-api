import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserRequestType } from 'src/users/decorators/current-user.decorator';

@Injectable()
export class BusinessAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.currentUser as UserRequestType;

    if (!user) {
      return false;
    }

    // Allow both SuperAdmins and regular business admins
    return user.isSuperAdmin === true || user.isAdmin === true;
  }
}
