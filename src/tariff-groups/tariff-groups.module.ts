import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TariffGroupsController } from './tariff-groups.controller';
import { TariffGroupsService } from './tariff-groups.service';

@Module({
  imports: [PrismaModule],
  controllers: [TariffGroupsController],
  providers: [TariffGroupsService],
  exports: [TariffGroupsService],
})
export class TariffGroupsModule {}
