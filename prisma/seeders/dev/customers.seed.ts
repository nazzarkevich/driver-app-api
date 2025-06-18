import { PrismaClient, Gender } from '@prisma/client';

const prisma = new PrismaClient();

export const seedCustomers = async (businessId: number) => {
  // Create customers with complete phone and address
  await prisma.customerProfile.createMany({
    data: [
      {
        firstName: 'Alice',
        lastName: 'Johnson',
        gender: Gender.Female,
        businessId,
        phoneId: 1, // Assuming phone with ID 1 exists
        note: 'Regular customer',
      },
      {
        firstName: 'Bob',
        lastName: 'Smith',
        gender: Gender.Male,
        businessId,
        phoneId: 2, // Assuming phone with ID 2 exists
        note: 'VIP customer',
      },
    ],
  });

  // Create addresses separately with business context
  const customers = await prisma.customerProfile.findMany({
    where: { businessId },
    take: 2,
  });

  if (customers.length >= 2) {
    await prisma.address.create({
      data: {
        street: '123 Main St',
        city: 'Kyiv',
        businessId,
        profileId: customers[0].id,
        countryId: 1, // Assuming country with ID 1 exists
      },
    });

    await prisma.address.create({
      data: {
        street: '456 Oak Ave',
        city: 'Lviv',
        businessId,
        profileId: customers[1].id,
        countryId: 1, // Assuming country with ID 1 exists
      },
    });
  }
};
