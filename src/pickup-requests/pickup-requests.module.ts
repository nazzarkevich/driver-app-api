import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { BusinessesModule } from 'src/businesses/businesses.module';
import { PickupRequestsService } from './pickup-requests.service';
import { PickupRequestsController } from './pickup-requests.controller';

@Module({
  imports: [PrismaModule, BusinessesModule],
  providers: [PickupRequestsService],
  controllers: [PickupRequestsController],
})
export class PickupRequestsModule {}
