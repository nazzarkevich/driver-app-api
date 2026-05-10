import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedTariffs = async (businessId: number) => {
  const tariffs = [];

  const tariffData = [
    { name: 'UK Document', description: 'Flat rate for document delivery to UK.', currency: 'GBP' },
    { name: 'UK Passport', description: 'Flat rate for passport delivery to UK.', currency: 'GBP' },
    { name: 'UK Money Transfer', description: 'Flat rate for money transfer to UK.', currency: 'GBP' },
    { name: 'UK Standard Parcel', description: 'Standard tariff for parcels to UK.', currency: 'GBP' },
    { name: 'UK Express Parcel', description: 'Express tariff for urgent deliveries to UK.', currency: 'GBP' },
    { name: 'EU Document', description: 'Flat rate for document delivery to EU countries.', currency: 'EUR' },
    { name: 'EU Passport', description: 'Flat rate for passport delivery to EU countries.', currency: 'EUR' },
    { name: 'EU Money Transfer', description: 'Flat rate for money transfer to EU countries.', currency: 'EUR' },
    { name: 'EU Standard Parcel', description: 'Standard tariff for parcels to EU countries.', currency: 'EUR' },
  ];

  for (const data of tariffData) {
    const existingTariff = await prisma.tariff.findFirst({
      where: {
        name: data.name,
        businessId,
      },
    });

    if (existingTariff) {
      tariffs.push(existingTariff);
      continue;
    }

    const tariff = await prisma.tariff.create({
      data: {
        ...data,
        business: { connect: { id: businessId } },
      },
    });

    tariffs.push(tariff);
  }

  console.log(`✅ Seeded ${tariffs.length} tariffs`);
  return tariffs;
};
