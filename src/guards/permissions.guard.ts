import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '@prisma/client';

import { UserRequestType } from 'src/users/decorators/current-user.decorator';
import {
  ADMIN_EXTRA_PERMISSIONS,
  Permission,
  ROLE_PERMISSIONS,
} from 'src/permissions/permissions';
import { PERMISSIONS_KEY } from 'src/decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserRequestType = request.currentUser;

    if (!user) {
      return false;
    }

    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Couriers can create customers, but cannot modify existing customer data,
    // even with elevated account flags. Addresses can be supplied at creation.
    if (
      user.type === UserType.ParcelCourier &&
      required?.some(
        (permission) =>
          permission.startsWith('customer:') &&
          permission !== Permission.CUSTOMER_CREATE &&
          permission !== Permission.CUSTOMER_READ &&
          permission !== Permission.CUSTOMER_NOTE_READ,
      )
    ) {
      return false;
    }

    if (user.isSuperAdmin) {
      return true;
    }

    const rolePermissions = ROLE_PERMISSIONS[user.type] ?? [];
    const effectivePermissions = user.isAdmin
      ? [...rolePermissions, ...ADMIN_EXTRA_PERMISSIONS]
      : rolePermissions;

    if (!required || required.length === 0) {
      return true;
    }

    return required.every((p) => effectivePermissions.includes(p));
  }
}
