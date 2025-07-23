import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthController } from './auth/auth.controller';
import { AuthProfilesModule } from './auth-profiles/auth-profiles.module';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [AuthProfilesModule, SupabaseModule],
  controllers: [UsersController, AuthController],
  providers: [UsersService, PrismaService],
  exports: [UsersService],
})
export class UsersModule {}
