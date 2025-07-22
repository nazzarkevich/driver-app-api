import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedJourneys = async (businessId: number) => {
  const journeys = [];
  const vehicles = await prisma.vehicle.findMany();
  const countries = await prisma.country.findMany();
  const countryUK = countries.find((country) => country.isoCode === 'UK');
  const countryUA = countries.find((country) => country.isoCode === 'UA');

  for (let i = 0; i < 5; i++) {
    const today = new Date();
    const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const journeyUKtoUA = await prisma.journey.create({
      data: {
        journeyNumber: `${datePrefix}-${i * 2 + 1}`,
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
        journeyNumber: `${datePrefix}-${i * 2 + 2}`,
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
