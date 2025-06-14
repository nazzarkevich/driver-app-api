import { Module } from '@nestjs/common';

import { UsersService } from './users.service';
import { AuthService } from './auth/auth.service';
import { UsersController } from './users.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthController } from './auth/auth.controller';
import { DriversModule } from 'src/profiles/drivers/drivers.module';
import { CouriersModule } from 'src/profiles/couriers/couriers.module';
import { SupabaseModule } from 'src/supabase/supabase.module';

@Module({
  imports: [PrismaModule, DriversModule, CouriersModule, SupabaseModule],
  controllers: [UsersController, AuthController],
  providers: [UsersService, AuthService],
  exports: [UsersService],
})
export class UsersModule {}
