import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedCustomers = async (businessId: number) => {
  const customers = [];

  for (let i = 1; i <= 25; i++) {
    const customer = await prisma.customerProfile.create({
      data: {
        business: {
          connect: { id: businessId },
        },
        firstName: `Customer ${i}`,
        lastName: 'User',
        gender: 'Male',
        phoneNumber: {
          create: {
            countryCode: '+38',
            number: `06777788${i}`,
          },
        },
        primaryAddress: {
          create: {
            street: '15 Rocket av.',
            city: 'Austin',
            country: {
              connect: {
                isoCode: i % 2 === 0 ? 'UK' : 'UA',
              },
            },
          },
        },
      },
    });

    customers.push(customer);
  }
};
