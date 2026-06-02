import { Global, Module } from '@nestjs/common';
import { TokenStorageService } from './token-storage.service';
import { AuthService } from '../users/auth/auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { BusinessesModule } from '../businesses/businesses.module';
import { AuthProfilesModule } from '../users/auth-profiles/auth-profiles.module';

@Global()
@Module({
  imports: [PrismaModule, SupabaseModule, BusinessesModule, AuthProfilesModule],
  providers: [TokenStorageService, AuthService],
  exports: [TokenStorageService, AuthService],
})
export class AuthModule {}
