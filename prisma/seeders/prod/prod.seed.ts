import { seedUsers } from './users.seed';
import { seedBusiness } from './business.seed';

export async function prodSeeder() {
  const business = await seedBusiness();

  await seedUsers(business.id);
}
