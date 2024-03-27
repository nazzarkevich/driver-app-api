import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { AuthGuard } from './guards/auth.guard';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserInterceptor } from './users/interceptor/user.interceptor';
import { DriversModule } from './profiles/drivers/drivers.module';
import { CustomersModule } from './profiles/customers/customers.module';
import { CouriersModule } from './profiles/couriers/couriers.module';
import { BusinessesModule } from './businesses/businesses.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { ParcelsModule } from './parcels/parcels.module';
import { JourneysModule } from './journeys/journeys.module';
import { CountriesModule } from './countries/countries.module';
import { AddressesModule } from './addresses/addresses.module';
import { CourierJourneysService } from './courier-journeys/courier-journeys.service';
import { CourierJourneysModule } from './courier-journeys/courier-journeys.module';

// TODO: Question: how to add action logs to the system?

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    DriversModule,
    CustomersModule,
    CouriersModule,
    BusinessesModule,
    VehiclesModule,
    ParcelsModule,
    JourneysModule,
    CountriesModule,
    AddressesModule,
    CourierJourneysModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    CourierJourneysService,
  ],
})
export class AppModule {}
