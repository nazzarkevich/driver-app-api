import { Module } from '@nestjs/common';

import { ParcelsService } from './parcels.service';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ParcelsController } from './parcels.controller';
import { BusinessesModule } from 'src/businesses/businesses.module';
import { TariffsModule } from 'src/tariffs/tariffs.module';
import { ShipmentTrackingService } from './shipment-tracking.service';
import { TrackingRateLimitGuard } from './tracking-rate-limit.guard';
import {
  PublicTrackingController,
  ShipmentTrackingController,
} from './shipment-tracking.controller';
import { ParcelPaymentsService } from './parcel-payments.service';

@Module({
  imports: [PrismaModule, BusinessesModule, UsersModule, TariffsModule],
  exports: [ParcelsService],
  providers: [
    ParcelsService,
    ParcelPaymentsService,
    ShipmentTrackingService,
    TrackingRateLimitGuard,
  ],
  controllers: [
    ParcelsController,
    PublicTrackingController,
    ShipmentTrackingController,
  ],
})
export class ParcelsModule {}
