import { Module } from '@nestjs/common';

import { ParcelsService } from './parcels.service';
import { UsersModule } from 'src/users/users.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ParcelsController } from './parcels.controller';
import { BusinessesModule } from 'src/businesses/businesses.module';

@Module({
  imports: [PrismaModule, BusinessesModule, UsersModule],
  exports: [ParcelsService],
  providers: [ParcelsService],
  controllers: [ParcelsController],
})
export class ParcelsModule {}
