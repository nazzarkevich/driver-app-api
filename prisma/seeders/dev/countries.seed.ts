import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedCountries = async () => {
  await prisma.country.createMany({
    data: [
      { name: 'United Kingdom', isoCode: 'GB' },
      { name: 'Ukraine', isoCode: 'UA' },
    ],
  });
};
