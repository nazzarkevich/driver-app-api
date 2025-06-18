import { Module } from '@nestjs/common';

import { ParcelsService } from './parcels.service';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ParcelsController } from './parcels.controller';
import { BusinessesModule } from 'src/businesses/businesses.module';
import { ConnectedParcelsService } from './connected-parcels.service';

@Module({
  imports: [PrismaModule, BusinessesModule, UsersModule],
  exports: [ParcelsService, ConnectedParcelsService],
  providers: [ParcelsService, ConnectedParcelsService],
  controllers: [ParcelsController],
})
export class ParcelsModule {}
