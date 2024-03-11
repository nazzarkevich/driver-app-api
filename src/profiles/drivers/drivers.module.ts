import { Module } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

// TODO: Question: do we need driverProfile?

@Module({
  imports: [PrismaModule],
  exports: [DriversService],
  providers: [DriversService],
  controllers: [DriversController],
})
export class DriversModule {}
