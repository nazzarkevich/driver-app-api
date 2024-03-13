import { Module } from '@nestjs/common';

import { CountriesService } from './countries.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CountriesController } from './countries.controller';

@Module({
  imports: [PrismaModule],
  providers: [CountriesService],
  controllers: [CountriesController],
})
export class CountriesModule {}
