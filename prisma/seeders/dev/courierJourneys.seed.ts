import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedCourierJourneys = async (businessId: number) => {
  const courierJourneys = [];
  const countries = await prisma.country.findMany();
  const vehicles = await prisma.vehicle.findMany();

  for (let i = 1; i <= 10; i++) {
    const courierJourney = await prisma.courierJourney.create({
      data: {
        destination: countries[i % countries.length].name,
        departureDate: new Date(),
        isCompleted: false,
        business: { connect: { id: businessId } },
        vehicle: { connect: { id: vehicles[i % vehicles.length].id } },
      },
    });

    courierJourneys.push(courierJourney);
  }
};
