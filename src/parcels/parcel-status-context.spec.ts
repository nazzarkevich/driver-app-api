import { UserType } from '@prisma/client';
import { ParcelsService } from './parcels.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';
import { TariffsService } from 'src/tariffs/tariffs.service';
import { AuditService } from 'src/audit/audit.service';
const user = {
  id: 7,
  businessId: 3,
  type: UserType.Manager,
  isAdmin: false,
  isSuperAdmin: false,
  name: 'Manager',
  iat: 1,
  exp: 2,
};
it('loads exception and damage context independently of paginated history', async () => {
  const date = new Date();
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    parcel: {
      findUnique: jest.fn().mockResolvedValue({
        id: 18,
        businessId: 3,
        deliveryStatus: 'Lost',
        isDamaged: false,
      }),
    },
    parcelStatusTransition: {
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({ fromStatus: 'InTransit' })
        .mockResolvedValueOnce({ reason: 'Не знайдено', createdAt: date }),
    },
    auditLog: { findFirst: jest.fn() },
  };
  const service = new ParcelsService(
    prisma as unknown as PrismaService,
    {} as UsersService,
    {} as TariffsService,
    {} as AuditService,
  );
  const result = await service.findOne(18, 3, user);
  expect(result.deliveryState).toEqual({
    lastActiveStatus: 'InTransit',
    problemReason: 'Не знайдено',
    problemReportedAt: date,
  });
  expect(prisma.parcelStatusTransition.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ businessId: 3, parcelId: 18 }),
    }),
  );
  prisma.parcel.findUnique.mockResolvedValue({
    id: 18,
    businessId: 3,
    deliveryStatus: 'InTransit',
    isDamaged: true,
  });
  prisma.auditLog.findFirst.mockResolvedValue({
    createdAt: date,
    metadata: { details: { reason: 'Розбите скло' } },
  });
  expect((await service.findOne(18, 3, user)).deliveryState).toEqual({
    lastActiveStatus: null,
    problemReason: 'Розбите скло',
    problemReportedAt: date,
  });
});
