import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from '@prisma/client';
import { Permissions } from '../decorators/permissions.decorator';
import { Permission } from '../permissions/permissions';
import { PermissionsGuard } from './permissions.guard';

class JourneyNotesController {
  @Permissions(Permission.JOURNEY_NOTE_READ)
  read() {
    return undefined;
  }
  @Permissions(Permission.JOURNEY_NOTE_CREATE)
  create() {
    return undefined;
  }
  @Permissions(Permission.JOURNEY_NOTE_DELETE)
  delete() {
    return undefined;
  }
}

function canAccess(
  type: UserType,
  action: keyof JourneyNotesController,
  isAdmin = false,
  isSuperAdmin = false,
) {
  const context = {
    getHandler: () => JourneyNotesController.prototype[action],
    getClass: () => JourneyNotesController,
    switchToHttp: () => ({
      getRequest: () => ({ currentUser: { type, isAdmin, isSuperAdmin } }),
    }),
  } as unknown as ExecutionContext;
  return new PermissionsGuard(new Reflector()).canActivate(context);
}

describe.each([UserType.InternationalDriver, UserType.ParcelCourier])(
  '%s journey note permissions',
  (type) => {
    it.each([false, true])('can read notes with isAdmin=%s', (isAdmin) => {
      expect(canAccess(type, 'read', isAdmin)).toBe(true);
    });
    it.each([false, true])(
      'does not gain note editing permissions with isAdmin=%s',
      (isAdmin) => {
        expect(canAccess(type, 'create', isAdmin)).toBe(false);
        expect(canAccess(type, 'delete', isAdmin)).toBe(false);
      },
    );
  },
);

describe('other journey note permissions', () => {
  it.each([UserType.Customer, UserType.Member, UserType.Subscriber])(
    '%s cannot read journey notes',
    (type) => {
      expect(canAccess(type, 'read')).toBe(false);
    },
  );
  it.each([UserType.Manager, UserType.Moderator])(
    '%s retains note management access',
    (type) => {
      expect(canAccess(type, 'read')).toBe(true);
      expect(canAccess(type, 'create')).toBe(true);
      expect(canAccess(type, 'delete')).toBe(true);
    },
  );
  it('retains superadmin access', () => {
    expect(canAccess(UserType.InternationalDriver, 'read', false, true)).toBe(
      true,
    );
  });
});
