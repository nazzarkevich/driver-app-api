import { Module } from '@nestjs/common';
import { AuthProfilesService } from './auth-profiles.service';
import { AuthProfilesController } from './auth-profiles.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [AuthProfilesController],
  providers: [AuthProfilesService],
  exports: [AuthProfilesService],
})
export class AuthProfilesModule {}
