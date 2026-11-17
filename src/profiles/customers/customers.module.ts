import { CustomerActivityService } from './customer-activity.service';
import { CustomerActivityController } from './customer-activity.controller';
import { ParcelsModule } from 'src/parcels/parcels.module';
import { Module } from '@nestjs/common';

import { CustomersService } from './customers.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CustomersController } from './customers.controller';
import { BusinessesModule } from 'src/businesses/businesses.module';
import { AuditModule } from 'src/audit/audit.module';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [
    ParcelsModule,
    PrismaModule,
    BusinessesModule,
    AuditModule,
    SupabaseModule,
  ],
  providers: [CustomersService, CustomerActivityService],
  controllers: [CustomersController, CustomerActivityController],
})
export class CustomersModule {}
