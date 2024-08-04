import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Start seeding database from seeders...');

  try {
    if (process.env.NODE_ENV === 'production') {
      const { prodSeeder } = await import('./seeders/prod/prod.seed');

      await prodSeeder();
    } else {
      const { devSeeder } = await import('./seeders/dev/dev.seed');

      await devSeeder();
    }

    console.log('Seeding completed successfully.');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
