import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const seedInternationalDrivers = async (businessId: number) => {
  const internationalDrivers = [];

  for (let i = 1; i <= 4; i++) {
    const driver = await prisma.user.create({
      data: {
        business: {
          connect: { id: businessId },
        },
        phoneNumber: {
          create: {
            countryCode: '+38',
            number: `06777722${i}`,
          },
        },
        firstName: `International Driver ${i}`,
        lastName: 'User',
        email: `driver${i}@example.com`,
        password: await bcrypt.hash('password', 10),
        type: 'InternationalDriver',
        dateOfBirth: new Date(`199${i}-01-08`),
        gender: 'Male',
      },
    });
    internationalDrivers.push(driver);
  }
};
