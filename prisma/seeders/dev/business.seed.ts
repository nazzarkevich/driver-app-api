import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedBusiness = async () => {
  return await prisma.business.upsert({
    where: { id: 1 },
    update: {
      name: 'UALogistics',
      isActive: true,
    },
    create: {
      id: 1,
      name: 'UALogistics',
      isActive: true,
    },
  });
};
