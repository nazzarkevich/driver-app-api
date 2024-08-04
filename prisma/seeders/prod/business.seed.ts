import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedBusiness = async () => {
  return await prisma.business.create({
    data: {
      id: 101,
      name: 'Ukrainets-UK',
      isActive: true,
    },
  });
};
