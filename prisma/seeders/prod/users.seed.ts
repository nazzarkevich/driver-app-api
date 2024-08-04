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
      isAdmin: true,
      firstName: 'Admin',
      lastName: '',
      email: 'admin@admin.com',
      password: await bcrypt.hash('password', 10),
      type: 'Moderator',
      dateOfBirth: new Date('1995-05-08'),
      gender: 'Male',
    },
  });
};
