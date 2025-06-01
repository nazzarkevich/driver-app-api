import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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
import { SupabaseModule } from './supabase/supabase.module';

/*
  - Extend courier service and controller ✅
  - Create Journey module/service/controller ✅
  - Create Country module/service/controller ✅
  - Create CourierJourney module/service/controller ✅
  - Add UA and UK address tables ✅
  - Extend Parcel schema with addresses UA and UK ✅
  - Create Address module/service/controller ✅
  - Add seed script for Prisma ✅
  - Script that creates first super user with default password
  
  - Investigate if we need controller for ConnectedParcel
  - Investigate Audit table to store all the actions
  - Roles and Permissions
  - Add error explanation to the DTO files

  Other:
  - Swagger ✅
  - Pagination (https://nodeteam.medium.com/nest-js-prisma-pagination-b776592f1867) ✅
  - Add default sorting for lists (https://www.prisma.io/docs/orm/prisma-client/queries/filtering-and-sorting)

  - Auth0 (reset pass logic)
  - Email service
  - SMS service (https://nodeteam.medium.com/nest-js-providers-twilio-e277ed924465)
  - Viber/Whatsapp
  - QRCode service

  Customer app:
  - Registration with UK number and sms

  Docs:
    Repository pattern:
     - https://github.com/prisma/prisma/issues/5273
     - https://github.com/johannesschobel/nest-prisma-crud

*/

// TODO: Question: how to add action logs to the system?

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigService available everywhere
    }),
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
    SupabaseModule,
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
    Logger,
  ],
})
export class AppModule {}
