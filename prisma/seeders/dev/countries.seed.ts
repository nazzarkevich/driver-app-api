import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedCountries = async () => {
  await prisma.country.createMany({
    data: [
      { name: 'United Kingdom', isoCode: 'UK' },
      { name: 'Ukraine', isoCode: 'UA' },
    ],
  });
};
