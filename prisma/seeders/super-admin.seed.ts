import { PrismaClient, UserType } from '@prisma/client';

const prisma = new PrismaClient();

export const seedSuperAdmin = async () => {
  console.log('🏢 Creating System Business & SuperAdmin...');

  // Create or update system business (ID 1)
  const systemBusiness = await prisma.business.upsert({
    where: { id: 1 },
    update: {
      name: 'System Administration',
      description: 'Platform administration business for SuperAdmins',
      isActive: true,
    },
    create: {
      id: 1,
      name: 'System Administration',
      description: 'Platform administration business for SuperAdmins',
      isActive: true,
      activationDate: new Date(),
    },
  });

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { email: 'superadmin@platform.com', businessId: systemBusiness.id },
  });

  const superAdmin = existingSuperAdmin
    ? await prisma.user.update({
        where: { id: existingSuperAdmin.id },
        data: { isSuperAdmin: true, isAdmin: true },
      })
    : await prisma.user.create({
        data: {
          firstName: 'Super',
          lastName: 'Admin',
          email: 'superadmin@platform.com',
          type: UserType.Moderator,
          isAdmin: true,
          isSuperAdmin: true,
          businessId: systemBusiness.id,
          dateOfBirth: new Date('1990-01-01'),
          gender: 'Male',
        },
      });

  console.log(`✅ System Business created: ID ${systemBusiness.id}`);
  console.log(`✅ SuperAdmin created: ${superAdmin.email} (ID: ${superAdmin.id})`);
  console.log('⚠️  Remember to create the SuperAdmin user in Supabase and create an AuthProfile for them!');

  return { systemBusiness, superAdmin };
};

// Run seeder if called directly
if (require.main === module) {
  seedSuperAdmin()
    .then(() => {
      console.log('SuperAdmin seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('SuperAdmin seeding failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
