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

  for (let i = 1; i <= 10; i++) {
    await prisma.parcel.create({
      data: {
        weight: 1.5,
        cargoType: parcelTypes[i % parcelTypes.length] as ParcelType,
        trackingNumber: `ABC123${i}`,
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
        originAddress: { connect: { id: addresses[0].id } }, // Assuming you have 10 addresses with ids from 1 to 10
        destinationAddress: { connect: { id: addresses[1].id } },
      },
    });
  }
};
