import { Module } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { AuthProfilesModule } from 'src/users/auth-profiles/auth-profiles.module';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [PrismaModule, SupabaseModule, AuthProfilesModule, AuditModule],
  exports: [DriversService],
  providers: [DriversService],
  controllers: [DriversController],
})
export class DriversModule {}
