import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';

@Module({
  imports: [PrismaModule],
  exports: [BusinessesService],
  controllers: [BusinessesController],
  providers: [BusinessesService],
})
export class BusinessesModule {}
