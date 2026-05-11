import { Module } from '@nestjs/common';

import { ParcelsService } from './parcels.service';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ParcelsController } from './parcels.controller';
import { BusinessesModule } from 'src/businesses/businesses.module';
import { TariffsModule } from 'src/tariffs/tariffs.module';

@Module({
  imports: [PrismaModule, BusinessesModule, UsersModule, TariffsModule],
  exports: [ParcelsService],
  providers: [ParcelsService],
  controllers: [ParcelsController],
})
export class ParcelsModule {}
