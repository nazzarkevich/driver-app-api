import { Module } from '@nestjs/common';

import { CouriersService } from './couriers.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CouriersController } from './couriers.controller';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { AuthProfilesModule } from 'src/users/auth-profiles/auth-profiles.module';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [PrismaModule, SupabaseModule, AuthProfilesModule, AuditModule],
  exports: [CouriersService],
  providers: [CouriersService],
  controllers: [CouriersController],
})
export class CouriersModule {}
