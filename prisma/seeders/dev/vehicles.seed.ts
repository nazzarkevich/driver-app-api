import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedVehicles = async (businessId: number) => {
  const vehicles = [];

  for (let i = 1; i <= 4; i++) {
    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber: `BO${i}EO`,
        model: 'Mercedes',
        make: 'Sprinter',
        year: new Date('2020'),
        isActive: true,
        business: { connect: { id: businessId } },
      },
    });

    vehicles.push(vehicle);
  }
};
