import { Module } from '@nestjs/common';

import { UsersService } from './users.service';
import { AuthService } from './auth/auth.service';
import { UsersController } from './users.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthController } from './auth/auth.controller';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, AuthController],
  providers: [UsersService, AuthService],
})
export class UsersModule {}
