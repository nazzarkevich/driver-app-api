import { Module } from '@nestjs/common';

import { PrismaModule } from 'src/prisma/prisma.module';
import { BusinessesService } from './businesses.service';
import { BusinessesController } from './businesses.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  exports: [BusinessesService],
  controllers: [BusinessesController],
  providers: [BusinessesService],
})
export class BusinessesModule {}
