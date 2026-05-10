import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const seedParcelTypes = async () => {
  const types = [
    { name: 'Regular', description: 'Standard parcel', icon: 'package-variant' },
    { name: 'Passport', description: 'Passport document delivery', icon: 'passport' },
    { name: 'Document', description: 'Official documents', icon: 'file-document' },
    { name: 'Money', description: 'Money transfer', icon: 'cash' },
  ];

  const result = [];
  for (const data of types) {
    const parcelType = await prisma.parcelType.upsert({
      where: { name: data.name },
      update: { icon: data.icon },
      create: { ...data, businessId: null },
    });
    result.push(parcelType);
  }

  console.log(`✅ Seeded ${result.length} parcel types`);
  return result;
};
