import { NotFoundException } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { VehiclesService } from './vehicles.service';
import type { PrismaService } from 'src/prisma/prisma.service';
import prismaWithPagination from 'src/prisma/prisma-client';
const withPages = jest.fn();
jest.mock('src/prisma/prisma-client', () => ({
  __esModule: true,
  default: { vehicle: { paginate: jest.fn(() => ({ withPages })) } },
}));
const vehicle = {
  id: 1,
  businessId: 3,
  plateNumber: 'BC1234AA',
  make: 'Mercedes',
  model: 'Sprinter',
  year: 2024,
  isActive: true,
  isDeleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};
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
  const prisma = {
    business: {
      findUnique: jest.fn().mockResolvedValue({ id: 3, isActive: true }),
    },
    vehicle: {
      findMany: jest.fn().mockResolvedValue([vehicle]),
      findUnique: jest.fn().mockResolvedValue(vehicle),
      create: jest.fn().mockResolvedValue(vehicle),
      update: jest.fn().mockResolvedValue(vehicle),
    },
  };
  return {
    prisma,
    service: new VehiclesService(prisma as unknown as PrismaService),
  };
}
beforeEach(() => {
  jest.clearAllMocks();
});
describe('vehicle registry data', () => {
  it('returns a legacy array with stable ordering and excludes deleted records', async () => {
    const { service, prisma } = setup();
    const result = await service.findAll(3);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toMatchObject([{ id: 1 }]);
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith({
      where: { businessId: 3, isDeleted: false },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });
  it('applies status and case-insensitive search before pagination, returning metadata', async () => {
    const { service, prisma } = setup();
    const metadata = {
      currentPage: 2,
      totalCount: 16,
      pageCount: 2,
      isFirstPage: false,
      isLastPage: true,
      previousPage: 1,
      nextPage: null,
    };
    withPages.mockResolvedValue([[vehicle], metadata]);
    const result = await service.findAll(
      3,
      { page: 2, search: '  sprinter ', isActive: false },
      user,
    );
    expect(prismaWithPagination.vehicle.paginate).toHaveBeenCalledWith({
      where: {
        businessId: 3,
        isDeleted: false,
        isActive: false,
        OR: ['plateNumber', 'make', 'model'].map((field) => ({
          [field]: { contains: 'sprinter', mode: 'insensitive' },
        })),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(withPages).toHaveBeenCalledWith({ page: 2 });
    expect(result).toMatchObject({ ...metadata, items: [{ id: 1 }] });
    expect(prisma.vehicle.findMany).not.toHaveBeenCalled();
  });
  it('also applies filters in the legacy array mode', async () => {
    const { service, prisma } = setup();
    await service.findAll(3, { isActive: true, search: 'mercedes' });
    expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.any(Array),
        }),
      }),
    );
  });
  it('rejects foreign and deleted details and validates the selected business', async () => {
    const { service, prisma } = setup();
    await expect(
      service.findOne(1, 4, { ...user, isSuperAdmin: true }),
    ).rejects.toThrow(NotFoundException);
    prisma.vehicle.findUnique.mockResolvedValue({
      ...vehicle,
      isDeleted: true,
    });
    await expect(service.findOne(1, 3, user)).rejects.toThrow(
      NotFoundException,
    );
    prisma.business.findUnique.mockResolvedValue(null);
    await expect(service.findAll(3, {}, user)).rejects.toThrow(
      NotFoundException,
    );
  });
  it('updates vehicle details and returns the saved record', async () => {
    const { service, prisma } = setup();
    const changes = {
      make: 'Ford',
      model: 'Transit',
      plateNumber: 'BC5678BB',
      year: 2025,
    };
    prisma.vehicle.update.mockResolvedValue({ ...vehicle, ...changes });
    await expect(service.updateVehicle(1, changes, 3)).resolves.toMatchObject(
      changes,
    );
    expect(prisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: changes,
    });
  });
  it('rejects foreign and deleted vehicle updates before writing', async () => {
    const { service, prisma } = setup();
    await expect(service.updateVehicle(1, { make: 'Ford' }, 9)).rejects.toThrow(
      NotFoundException,
    );
    prisma.vehicle.findUnique.mockResolvedValue({
      ...vehicle,
      isDeleted: true,
    });
    await expect(service.updateVehicle(1, { make: 'Ford' }, 3)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.vehicle.update).not.toHaveBeenCalled();
  });
  it('preserves the empty create response and integer year', async () => {
    const { service, prisma } = setup();
    const values = {
      plateNumber: vehicle.plateNumber,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
    };
    await expect(service.createVehicle(values, 3)).resolves.toBeUndefined();
    expect(prisma.vehicle.create).toHaveBeenCalledWith({
      data: { ...values, businessId: 3 },
    });
  });
});
