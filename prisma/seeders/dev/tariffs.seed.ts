import { PrismaClient, ParcelType } from '@prisma/client';

const prisma = new PrismaClient();

export const seedTariffs = async (businessId: number) => {
  const tariffs = [];

  const tariffData = [
    {
      name: 'UK Document',
      description: 'Flat rate for document delivery to UK.',
      minimumPrice: 15,
      pricePerKg: null,
      weightThreshold: null,
      currency: 'GBP',
      isWeightBased: false,
      parcelTypes: [ParcelType.Document],
      isActive: true,
    },
    {
      name: 'UK Passport',
      description: 'Flat rate for passport delivery to UK.',
      minimumPrice: 20,
      pricePerKg: null,
      weightThreshold: null,
      currency: 'GBP',
      isWeightBased: false,
      parcelTypes: [ParcelType.Passport],
      isActive: true,
    },
    {
      name: 'UK Money Transfer',
      description: 'Flat rate for money transfer to UK.',
      minimumPrice: 25,
      pricePerKg: null,
      weightThreshold: null,
      currency: 'GBP',
      isWeightBased: false,
      parcelTypes: [ParcelType.Money],
      isActive: true,
    },
    {
      name: 'UK Standard Parcel',
      description:
        'Standard tariff for parcels to UK. Minimum £25 for under 20kg, £2/kg for heavier items.',
      minimumPrice: 25,
      pricePerKg: 2,
      weightThreshold: 20,
      currency: 'GBP',
      isWeightBased: true,
      parcelTypes: [ParcelType.Regular],
      isActive: true,
    },
    {
      name: 'UK Express Parcel',
      description:
        'Express tariff for urgent deliveries to UK. Minimum £40 for under 15kg, £3/kg for heavier items.',
      minimumPrice: 40,
      pricePerKg: 3,
      weightThreshold: 15,
      currency: 'GBP',
      isWeightBased: true,
      parcelTypes: [ParcelType.Regular],
      isActive: true,
    },
    {
      name: 'EU Document',
      description: 'Flat rate for document delivery to EU countries.',
      minimumPrice: 18,
      pricePerKg: null,
      weightThreshold: null,
      currency: 'EUR',
      isWeightBased: false,
      parcelTypes: [ParcelType.Document],
      isActive: true,
    },
    {
      name: 'EU Passport',
      description: 'Flat rate for passport delivery to EU countries.',
      minimumPrice: 22,
      pricePerKg: null,
      weightThreshold: null,
      currency: 'EUR',
      isWeightBased: false,
      parcelTypes: [ParcelType.Passport],
      isActive: true,
    },
    {
      name: 'EU Money Transfer',
      description: 'Flat rate for money transfer to EU countries.',
      minimumPrice: 28,
      pricePerKg: null,
      weightThreshold: null,
      currency: 'EUR',
      isWeightBased: false,
      parcelTypes: [ParcelType.Money],
      isActive: true,
    },
    {
      name: 'EU Standard Parcel',
      description:
        'Standard tariff for parcels to EU countries. Minimum €30 for under 20kg, €2.5/kg for heavier items.',
      minimumPrice: 30,
      pricePerKg: 2.5,
      weightThreshold: 20,
      currency: 'EUR',
      isWeightBased: true,
      parcelTypes: [ParcelType.Regular],
      isActive: true,
    },
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
