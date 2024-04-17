import {
  DeliveryStatus,
  ParcelType,
  PaymentStatus,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seed() {
  try {
    // Seed business
    const business = await prisma.business.create({
      data: {
        id: 1,
        name: 'NovaUkraine',
        isActive: true,
      },
    });

    // Seed users
    await prisma.user.create({
      data: {
        business: {
          connect: { id: business.id },
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
          connect: { id: business.id },
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

    const internationalDrivers = [];
    for (let i = 1; i <= 4; i++) {
      const driver = await prisma.user.create({
        data: {
          business: {
            connect: { id: business.id },
          },
          phoneNumber: {
            create: {
              countryCode: '+38',
              number: `06777722${i}`,
            },
          },
          firstName: `International Driver ${i}`,
          lastName: 'User',
          email: `driver${i}@example.com`,
          password: await bcrypt.hash('password', 10),
          type: 'InternationalDriver',
          dateOfBirth: new Date(`199${i}-01-08`),
          gender: 'Male',
        },
      });
      internationalDrivers.push(driver);
    }

    const parcelCouriers = [];
    for (let i = 1; i <= 4; i++) {
      const courier = await prisma.user.create({
        data: {
          business: {
            connect: { id: business.id },
          },
          phoneNumber: {
            create: {
              countryCode: '+38',
              number: `06777788${i}`,
            },
          },
          firstName: `Parcel Courier ${i}`,
          lastName: 'User',
          email: `courier${i}@example.com`,
          password: await bcrypt.hash('password', 10),
          type: 'ParcelCourier',
          dateOfBirth: new Date(`1988-${i}-08`),
          gender: 'Male',
        },
      });
      parcelCouriers.push(courier);
    }

    // Seed countries
    await prisma.country.createMany({
      data: [
        { name: 'United Kingdom', isoCode: 'UK' },
        { name: 'Ukraine', isoCode: 'UA' },
      ],
    });

    // Seed customers
    const customers = [];
    for (let i = 1; i <= 25; i++) {
      const customer = await prisma.customerProfile.create({
        data: {
          business: {
            connect: { id: business.id },
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

    // Seed vehicles
    const vehicles = [];
    for (let i = 1; i <= 4; i++) {
      const vehicle = await prisma.vehicle.create({
        data: {
          plateNumber: `BO${i}EO`,
          model: 'Mercedes',
          make: 'Sprinter',
          year: new Date('2020'),
          isActive: true,
          business: { connect: { id: business.id } },
        },
      });
      vehicles.push(vehicle);
    }

    // Seed journeys
    const countries = await prisma.country.findMany();
    const countryUK = countries.find((country) => country.isoCode === 'UK');
    const countryUA = countries.find((country) => country.isoCode === 'UA');
    const journeys = [];
    for (let i = 0; i < 5; i++) {
      const journeyUKtoUA = await prisma.journey.create({
        data: {
          startLocation: countryUK.name,
          endLocation: countryUA.name,
          departureDate: new Date(),
          vehicle: { connect: { id: vehicles[i % vehicles.length].id } },
          business: { connect: { id: business.id } },
        },
      });
      journeys.push(journeyUKtoUA);
      const journeyUAtoUK = await prisma.journey.create({
        data: {
          startLocation: countryUA.name,
          endLocation: countryUK.name,
          departureDate: new Date(),
          vehicle: { connect: { id: vehicles[i % vehicles.length].id } },
          business: { connect: { id: business.id } },
        },
      });
      journeys.push(journeyUAtoUK);
    }

    // Seed parcels
    const addresses = await prisma.address.findMany();
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
          business: { connect: { id: business.id } },
          journey: { connect: { id: journeys[i % journeys.length].id } },
          originAddress: { connect: { id: addresses[0].id } }, // Assuming you have 10 addresses with ids from 1 to 10
          destinationAddress: { connect: { id: addresses[1].id } },
        },
      });
    }

    // Seed courier journeys
    const courierJourneys = [];
    for (let i = 1; i <= 10; i++) {
      const courierJourney = await prisma.courierJourney.create({
        data: {
          destination: countries[i % countries.length].name,
          departureDate: new Date(),
          isCompleted: false,
          business: { connect: { id: business.id } },
          vehicle: { connect: { id: vehicles[i % vehicles.length].id } },
        },
      });
      courierJourneys.push(courierJourney);
    }
    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
