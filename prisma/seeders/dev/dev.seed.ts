import { seedUsers } from './users.seed';
import { seedParcels } from './parcels.seed';
import { seedBusiness } from './business.seed';
import { seedJourneys } from './journeys.seed';
import { seedVehicles } from './vehicles.seed';
import { seedCountries } from './countries.seed';
import { seedCustomers } from './customers.seed';
import { seedParcelCouriers } from './parcelCouriers.seed';
import { seedCourierJourneys } from './courierJourneys.seed';
import { seedInternationalDrivers } from './internationalDrivers.seed';
import { seedTariffs } from './tariffs.seed';

export async function devSeeder() {
  const business = await seedBusiness();

  await seedUsers(business.id);
  await seedInternationalDrivers(business.id);
  await seedParcelCouriers(business.id);
  await seedCountries();
  await seedCustomers(business.id);
  await seedVehicles(business.id);
  await seedTariffs(business.id);
  await seedJourneys(business.id);
  await seedParcels(business.id);
  await seedCourierJourneys(business.id);
}
