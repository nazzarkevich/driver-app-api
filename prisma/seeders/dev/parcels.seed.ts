import {
  DeliveryStatus,
  ParcelType,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

export const seedParcels = async (businessId: number) => {
  const addresses = await prisma.address.findMany();
  const customers = await prisma.customerProfile.findMany();
  const journeys = await prisma.journey.findMany();
  const parcelTypes = ['Regular', 'Passport', 'Document', 'Money'];

  if (addresses.length < 2) {
    console.log('⚠️  Not enough addresses found, skipping parcel seeding');
    return;
  }

  if (customers.length < 2) {
    console.log('⚠️  Not enough customers found, skipping parcel seeding');
    return;
  }

  if (journeys.length === 0) {
    console.log('⚠️  No journeys found, skipping parcel seeding');
    return;
  }

  const parcels = [];

  for (let i = 1; i <= 10; i++) {
    const trackingNumber = `ABC123${i}`;

    // Check if parcel already exists
    const existingParcel = await prisma.parcel.findFirst({
      where: {
        trackingNumber,
        businessId,
      },
    });

    if (existingParcel) {
      parcels.push(existingParcel);
      continue;
    }

    const parcel = await prisma.parcel.create({
      data: {
        weight: 1.5,
        cargoType: parcelTypes[i % parcelTypes.length] as ParcelType,
        trackingNumber,
        price: 10,
        cost: 5,
        deliveryStatus: DeliveryStatus.Delivered,
        paymentStatus: PaymentStatus.Paid,
        sender: { connect: { id: customers[i % customers.length].id } },
        recipient: {
          connect: { id: customers[(i + 1) % customers.length].id },
        },
        business: { connect: { id: businessId } },
        journey: { connect: { id: journeys[i % journeys.length].id } },
        originAddress: { connect: { id: addresses[0].id } },
        destinationAddress: { connect: { id: addresses[1].id } },
      },
    });

    parcels.push(parcel);
  }

  console.log(`✅ Seeded ${parcels.length} parcels`);
  return parcels;
};
