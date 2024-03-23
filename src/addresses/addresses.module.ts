import { Module } from '@nestjs/common';

import { AddressesService } from './addresses.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AddressesController } from './addresses.controller';

@Module({
  imports: [PrismaModule],
  providers: [AddressesService],
  controllers: [AddressesController],
})
export class AddressesModule {}
