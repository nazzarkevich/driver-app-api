import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { ParcelsModule } from 'src/parcels/parcels.module';
import { VehiclesModule } from 'src/vehicles/vehicles.module';
import { CourierJourneysService } from './courier-journeys.service';
import { CouriersModule } from 'src/profiles/couriers/couriers.module';
import { CourierJourneysController } from './courier-journeys.controller';

@Module({
  imports: [PrismaModule, ParcelsModule, VehiclesModule, CouriersModule],
  exports: [CourierJourneysService],
  providers: [CourierJourneysService],
  controllers: [CourierJourneysController],
})
export class CourierJourneysModule {}
