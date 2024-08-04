import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const seedUsers = async (businessId: number) => {
  await prisma.user.create({
    data: {
      business: {
        connect: { id: businessId },
      },
      phoneNumber: {
        create: {
          countryCode: '+38',
          number: '0677772233',
        },
      },
      firstName: 'Moderator',
      lastName: 'User',
      email: 'moderator@example.com',
      password: await bcrypt.hash('password', 10),
      type: 'Moderator',
      dateOfBirth: new Date('1995-05-08'),
      gender: 'Male',
    },
  });

  await prisma.user.create({
    data: {
      business: {
        connect: { id: businessId },
      },
      phoneNumber: {
        create: {
          countryCode: '+38',
          number: '0677772244',
        },
      },
      firstName: 'Manager',
      lastName: 'User',
      email: 'manager@example.com',
      password: await bcrypt.hash('password', 10),
      type: 'Manager',
      dateOfBirth: new Date('1991-01-08'),
      gender: 'Male',
    },
  });
};
