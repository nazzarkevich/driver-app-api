import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import {
  ADMIN_EXTRA_PERMISSIONS,
  APP_PERMISSION_MAP,
  AppName,
  Permission,
  ROLE_PERMISSIONS,
} from 'src/permissions/permissions';
import { PERMISSIONS_KEY } from 'src/decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: UserRequestType = request.currentUser;

    if (!user) {
      return false;
    }

    if (user.isSuperAdmin) {
      return true;
    }

    const rolePermissions = ROLE_PERMISSIONS[user.type] ?? [];
    const effectivePermissions = user.isAdmin
      ? [...rolePermissions, ...ADMIN_EXTRA_PERMISSIONS]
      : rolePermissions;

    const appName = request.headers['x-app-name'] as AppName | undefined;
    if (appName && APP_PERMISSION_MAP[appName]) {
      const appPermission = APP_PERMISSION_MAP[appName];
      if (!effectivePermissions.includes(appPermission)) {
        return false;
      }
    }

    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    return required.every((p) => effectivePermissions.includes(p));
  }
}
