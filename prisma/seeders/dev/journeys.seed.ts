import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedJourneys = async (businessId: number) => {
  const journeys = [];
  const vehicles = await prisma.vehicle.findMany();
  const countries = await prisma.country.findMany();
  const countryUK = countries.find((country) => country.isoCode === 'UK');
  const countryUA = countries.find((country) => country.isoCode === 'UA');

  for (let i = 0; i < 5; i++) {
    const journeyUKtoUA = await prisma.journey.create({
      data: {
        startLocation: countryUK.name,
        endLocation: countryUA.name,
        departureDate: new Date(),
        vehicle: { connect: { id: vehicles[i % vehicles.length].id } },
        business: { connect: { id: businessId } },
      },
    });
    journeys.push(journeyUKtoUA);
    const journeyUAtoUK = await prisma.journey.create({
      data: {
        startLocation: countryUA.name,
        endLocation: countryUK.name,
        departureDate: new Date(),
        vehicle: { connect: { id: vehicles[i % vehicles.length].id } },
        business: { connect: { id: businessId } },
      },
    });
    journeys.push(journeyUAtoUK);
  }
};
