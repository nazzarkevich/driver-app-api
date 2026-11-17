import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserType } from '@prisma/client';
import { ParcelsController } from './parcels.controller';
import { ParcelsService } from './parcels.service';
import { TariffsService } from 'src/tariffs/tariffs.service';
import { ParcelPaymentsService } from './parcel-payments.service';
import { AuditService } from 'src/audit/audit.service';
const user = {
  id: 1,
  businessId: 3,
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
  name: 'Manager',
  iat: 1,
  exp: 2,
};
function setup(businessId = 3) {
  const parcels = {
    findOne: jest.fn().mockResolvedValue({ id: 18, businessId }),
    findGroup: jest.fn().mockResolvedValue([]),
    getNotes: jest.fn().mockResolvedValue([]),
  };
  const payments = { history: jest.fn().mockResolvedValue({ items: [] }) };
  const audit = {
    getParcelHistory: jest.fn().mockResolvedValue({ items: [] }),
  };
  return {
    parcels,
    payments,
    audit,
    controller: new ParcelsController(
      parcels as unknown as ParcelsService,
      {} as TariffsService,
      payments as unknown as ParcelPaymentsService,
      audit as unknown as AuditService,
    ),
  };
}
describe('scoped parcel reads', () => {
  it('keeps requests without businessId in the current business', async () => {
    const { controller, parcels, payments, audit } = setup();
    await controller.findParcel(user, 18);
    await controller.getParcelPayments(user, 18, '2');
    await controller.getParcelHistory(user, 18, '2', '20');
    await controller.getNotes(user, 18);
    await controller.getParcelGroup(user, 18);
    expect(parcels.findOne).toHaveBeenCalledWith(18, 3, user);
    expect(payments.history).toHaveBeenCalledWith(18, 3, 2);
    expect(audit.getParcelHistory).toHaveBeenCalledWith(18, 3, 2, 20);
    expect(parcels.getNotes).toHaveBeenCalledWith(18, 3, user);
    expect(parcels.findGroup).toHaveBeenCalledWith(18, 3, user);
  });
  it('uses the selected business for all superadmin reads', async () => {
    const { controller, parcels, payments, audit } = setup(9);
    const admin = { ...user, isSuperAdmin: true };
    await controller.findParcel(admin, 18, '9');
    await controller.getParcelPayments(admin, 18, '1', '9');
    await controller.getParcelHistory(admin, 18, '1', '20', '9');
    await controller.getNotes(admin, 18, '9');
    await controller.getParcelGroup(admin, 18, '9');
    expect(parcels.findOne).toHaveBeenCalledWith(18, 9, admin);
    expect(payments.history).toHaveBeenCalledWith(18, 9, 1);
    expect(audit.getParcelHistory).toHaveBeenCalledWith(18, 9, 1, 20);
    expect(parcels.getNotes).toHaveBeenCalledWith(18, 9, admin);
    expect(parcels.findGroup).toHaveBeenCalledWith(18, 9, admin);
  });
  it('rejects ordinary cross-business reads and invalid business IDs before querying', async () => {
    const { controller, parcels } = setup();
    const calls = [
      () => controller.findParcel(user, 18, '9'),
      () => controller.getParcelPayments(user, 18, '1', '9'),
      () => controller.getParcelHistory(user, 18, '1', '20', '9'),
      () => controller.getNotes(user, 18, '9'),
      () => controller.getParcelGroup(user, 18, '9'),
    ];
    for (const call of calls)
      await expect(call()).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.findParcel(user, 18, 'bad')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(parcels.findOne).not.toHaveBeenCalled();
    expect(parcels.findGroup).not.toHaveBeenCalled();
  });
  it('rejects a parcel outside the selected business even for superadmins', async () => {
    const { controller, parcels, payments, audit } = setup(8);
    const admin = { ...user, isSuperAdmin: true };
    for (const call of [
      () => controller.findParcel(admin, 18, '9'),
      () => controller.getParcelPayments(admin, 18, '1', '9'),
      () => controller.getParcelHistory(admin, 18, '1', '20', '9'),
      () => controller.getNotes(admin, 18, '9'),
    ])
      await expect(call()).rejects.toBeInstanceOf(NotFoundException);
    expect(payments.history).not.toHaveBeenCalled();
    expect(audit.getParcelHistory).not.toHaveBeenCalled();
    expect(parcels.getNotes).not.toHaveBeenCalled();
  });
});
