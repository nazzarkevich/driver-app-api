import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { DriversService } from 'src/profiles/drivers/drivers.service';
import { CouriersService } from 'src/profiles/couriers/couriers.service';
import { SupabaseService } from 'src/supabase/supabase.service';
import { AuthProfilesModule } from './auth-profiles/auth-profiles.module';
import { BusinessesService } from 'src/businesses/businesses.service';
import { TokenStorageService } from 'src/auth/token-storage.service';

@Module({
  imports: [AuthProfilesModule],
  controllers: [UsersController, AuthController],
  providers: [
    UsersService,
    PrismaService,
    AuthService,
    DriversService,
    CouriersService,
    SupabaseService,
    BusinessesService,
    TokenStorageService,
  ],
  exports: [UsersService, AuthService],
})
export class UsersModule {}
