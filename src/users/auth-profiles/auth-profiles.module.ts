import { Module } from '@nestjs/common';
import { AuthProfilesService } from './auth-profiles.service';
import { AuthProfilesController } from './auth-profiles.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuthProfilesController],
  providers: [AuthProfilesService],
  exports: [AuthProfilesService],
})
export class AuthProfilesModule {}
