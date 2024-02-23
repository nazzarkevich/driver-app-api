import { Module } from '@nestjs/common';

import { CouriersService } from './couriers.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CouriersController } from './couriers.controller';

@Module({
  imports: [PrismaModule],
  exports: [CouriersService],
  providers: [CouriersService],
  controllers: [CouriersController],
})
export class CouriersModule {}
