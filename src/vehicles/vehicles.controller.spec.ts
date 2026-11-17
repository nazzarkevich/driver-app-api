import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { PermissionsGuard } from 'src/guards/permissions.guard';
import { PERMISSIONS_KEY } from 'src/decorators/permissions.decorator';
import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
const user = {
  id: 7,
  businessId: 3,
  name: 'Test',
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
  iat: 0,
  exp: 9999999999,
};
function setup() {
  const service = {
    findAll: jest.fn(),
    updateVehicle: jest.fn(),
    findOne: jest.fn(),
    createVehicle: jest.fn(),
  };
  return {
    service,
    controller: new VehiclesController(service as unknown as VehiclesService),
  };
}
describe('vehicle endpoints', () => {
  it('preserves legacy reads and forwards parsed search, status and page', () => {
    const { controller, service } = setup();
    controller.findAllVehicles(user);
    expect(service.findAll).toHaveBeenCalledWith(
      3,
      { page: undefined, search: undefined, isActive: undefined },
      user,
    );
    controller.findAllVehicles(user, '3', '2', '  sprinter ', 'false');
    expect(service.findAll).toHaveBeenLastCalledWith(
      3,
      { page: 2, search: 'sprinter', isActive: false },
      user,
    );
  });
  it.each(['0', '-1', '1.2', 'abc', '9007199254740992'])(
    'rejects invalid page %s before querying',
    (page) => {
      const { controller, service } = setup();
      expect(() => controller.findAllVehicles(user, undefined, page)).toThrow(
        BadRequestException,
      );
      expect(service.findAll).not.toHaveBeenCalled();
    },
  );
  it('rejects invalid statuses and business IDs', () => {
    const { controller } = setup();
    expect(() =>
      controller.findAllVehicles(user, undefined, '1', undefined, 'yes'),
    ).toThrow(BadRequestException);
    for (const id of ['0', 'abc', '1.5'])
      expect(() => controller.findVehicle(user, 1, id)).toThrow(
        BadRequestException,
      );
  });
  it('allows only superadmins to read another business, including details', () => {
    const { controller, service } = setup();
    expect(() => controller.findAllVehicles(user, '4')).toThrow(
      ForbiddenException,
    );
    expect(() => controller.findVehicle(user, 1, '4')).toThrow(
      ForbiddenException,
    );
    const admin = { ...user, isSuperAdmin: true };
    controller.findAllVehicles(admin, '4', '1');
    expect(service.findAll).toHaveBeenCalledWith(4, expect.any(Object), admin);
    controller.findVehicle(admin, 1, '4');
    expect(service.findOne).toHaveBeenCalledWith(1, 4, admin);
  });
  it('keeps creation scoped to the authenticated company', () => {
    const { controller, service } = setup();
    const values = {
      plateNumber: 'BC1234AA',
      make: 'Mercedes',
      model: 'Sprinter',
      year: 2024,
    };
    controller.createVehicle(user, values);
    expect(service.createVehicle).toHaveBeenCalledWith(values, 3);
  });
  it('keeps updates in the authenticated company and rejects a foreign requested scope', () => {
    const { controller, service } = setup();
    controller.updateVehicle(user, 1, { make: 'Ford' }, '3');
    expect(service.updateVehicle).toHaveBeenCalledWith(1, { make: 'Ford' }, 3);
    expect(() =>
      controller.updateVehicle(user, 1, { make: 'Ford' }, '9'),
    ).toThrow(ForbiddenException);
    expect(() =>
      controller.updateVehicle(
        { ...user, isSuperAdmin: true },
        1,
        { make: 'Ford' },
        '9',
      ),
    ).toThrow(ForbiddenException);
    expect(service.updateVehicle).toHaveBeenCalledTimes(1);
  });
  it.each([
    [{ ...user, isAdmin: true }, true],
    [{ ...user, isSuperAdmin: true }, true],
    [user, true],
    [{ ...user, type: UserType.InternationalDriver }, true],
    [{ ...user, type: UserType.Moderator }, false],
    [{ ...user, type: UserType.ParcelCourier }, false],
  ])(
    'allows vehicle creation for drivers, managers and admins only',
    (currentUser, allowed) => {
      const reflector = {
        getAllAndOverride: jest.fn((key) =>
          key === PERMISSIONS_KEY
            ? Reflect.getMetadata(
                PERMISSIONS_KEY,
                VehiclesController.prototype.createVehicle,
              )
            : undefined,
        ),
      };
      const context = {
        getHandler: () => VehiclesController.prototype.createVehicle,
        getClass: () => VehiclesController,
        switchToHttp: () => ({ getRequest: () => ({ currentUser }) }),
      };
      expect(
        new PermissionsGuard(reflector as unknown as Reflector).canActivate(
          context as unknown as ExecutionContext,
        ),
      ).toBe(allowed);
    },
  );
  it.each([
    [{ ...user, isAdmin: true }, true],
    [{ ...user, isSuperAdmin: true }, true],
    [user, true],
    [{ ...user, type: UserType.InternationalDriver }, true],
    [{ ...user, type: UserType.Moderator }, false],
    [{ ...user, type: UserType.ParcelCourier }, false],
  ])(
    'allows vehicle updates for drivers, managers and admins only',
    (currentUser, allowed) => {
      const reflector = {
        getAllAndOverride: jest.fn((key) =>
          key === PERMISSIONS_KEY
            ? Reflect.getMetadata(
                PERMISSIONS_KEY,
                VehiclesController.prototype.updateVehicle,
              )
            : undefined,
        ),
      };
      const context = {
        getHandler: () => VehiclesController.prototype.updateVehicle,
        getClass: () => VehiclesController,
        switchToHttp: () => ({ getRequest: () => ({ currentUser }) }),
      };
      expect(
        new PermissionsGuard(reflector as unknown as Reflector).canActivate(
          context as unknown as ExecutionContext,
        ),
      ).toBe(allowed);
    },
  );
});
