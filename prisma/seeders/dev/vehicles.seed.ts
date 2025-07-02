import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedVehicles = async (businessId: number) => {
  const vehicles = [];

  for (let i = 1; i <= 4; i++) {
    const plateNumber = `BO${i}EO`;

    // Check if vehicle already exists
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        plateNumber,
        businessId,
      },
    });

    if (existingVehicle) {
      vehicles.push(existingVehicle);
      continue;
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        plateNumber,
        model: 'Mercedes',
        make: 'Sprinter',
        year: new Date('2020'),
        isActive: true,
        business: { connect: { id: businessId } },
      },
    });

    vehicles.push(vehicle);
  }

  console.log(`✅ Seeded ${vehicles.length} vehicles`);
  return vehicles;
};
