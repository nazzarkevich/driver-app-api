import { Module } from '@nestjs/common';

import { CustomersService } from './customers.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CustomersController } from './customers.controller';
import { BusinessesModule } from 'src/businesses/businesses.module';
import { AuditModule } from 'src/audit/audit.module';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [PrismaModule, BusinessesModule, AuditModule, SupabaseModule],
  providers: [CustomersService],
  controllers: [CustomersController],
})
export class CustomersModule {}
