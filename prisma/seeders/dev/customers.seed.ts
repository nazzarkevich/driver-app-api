import { PrismaClient, Gender } from '@prisma/client';

const prisma = new PrismaClient();

export const seedCustomers = async (businessId: number) => {
  const ukraine = await prisma.country.findUnique({
    where: { isoCode: 'UA' },
  });

  if (!ukraine) {
    console.log('⚠️  Ukraine country not found, skipping customer seed');
    return;
  }

  const phone1 = await prisma.phone.create({
    data: {
      countryCode: '+380',
      number: '0677771111',
    },
  });

  const alice = await prisma.customerProfile.create({
    data: {
      firstName: 'Alice',
      lastName: 'Johnson',
      gender: Gender.Female,
      businessId,
      phoneId: phone1.id,
    },
  });

  await prisma.address.create({
    data: {
      street: '123 Main St',
      city: 'Kyiv',
      businessId,
      profileId: alice.id,
      countryId: ukraine.id,
    },
  });

  const phone2 = await prisma.phone.create({
    data: {
      countryCode: '+380',
      number: '0677772222',
    },
  });

  const bob = await prisma.customerProfile.create({
    data: {
      firstName: 'Bob',
      lastName: 'Smith',
      gender: Gender.Male,
      businessId,
      phoneId: phone2.id,
    },
  });

  await prisma.address.create({
    data: {
      street: '456 Oak Ave',
      village: 'Yaremche',
      businessId,
      profileId: bob.id,
      countryId: ukraine.id,
    },
  });
};
