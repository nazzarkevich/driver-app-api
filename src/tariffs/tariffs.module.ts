import { Module } from '@nestjs/common';
import { TariffsService } from './tariffs.service';
import { TariffsController } from './tariffs.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TariffsController],
  providers: [TariffsService],
  exports: [TariffsService],
})
export class TariffsModule {}
