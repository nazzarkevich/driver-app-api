import { Module } from '@nestjs/common';

import { JourneysService } from './journeys.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { JourneysController } from './journeys.controller';
import { ParcelsModule } from 'src/parcels/parcels.module';
import { VehiclesModule } from 'src/vehicles/vehicles.module';
import { DriversModule } from 'src/profiles/drivers/drivers.module';
import { JourneyNumberService } from './services/journey-number.service';

@Module({
  imports: [PrismaModule, ParcelsModule, VehiclesModule, DriversModule],
  exports: [JourneysService],
  providers: [JourneysService, JourneyNumberService],
  controllers: [JourneysController],
})
export class JourneysModule {}
