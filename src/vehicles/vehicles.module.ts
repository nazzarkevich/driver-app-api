import { Module } from '@nestjs/common';

import { VehiclesService } from './vehicles.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { VehiclesController } from './vehicles.controller';

@Module({
  imports: [PrismaModule],
  exports: [VehiclesService],
  providers: [VehiclesService],
  controllers: [VehiclesController],
})
export class VehiclesModule {}
