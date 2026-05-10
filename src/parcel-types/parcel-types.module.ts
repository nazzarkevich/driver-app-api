import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { ParcelTypesController } from './parcel-types.controller';
import { ParcelTypesService } from './parcel-types.service';

@Module({
  imports: [PrismaModule],
  controllers: [ParcelTypesController],
  providers: [ParcelTypesService],
  exports: [ParcelTypesService],
})
export class ParcelTypesModule {}
