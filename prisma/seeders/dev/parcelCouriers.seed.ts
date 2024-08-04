import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const seedParcelCouriers = async (businessId: number) => {
  const parcelCouriers = [];

  for (let i = 1; i <= 4; i++) {
    const courier = await prisma.user.create({
      data: {
        business: {
          connect: { id: businessId },
        },
        phoneNumber: {
          create: {
            countryCode: '+38',
            number: `06777788${i}`,
          },
        },
        firstName: `Parcel Courier ${i}`,
        lastName: 'User',
        email: `courier${i}@example.com`,
        password: await bcrypt.hash('password', 10),
        type: 'ParcelCourier',
        dateOfBirth: new Date(`1988-${i}-08`),
        gender: 'Male',
      },
    });
    parcelCouriers.push(courier);
  }
};
