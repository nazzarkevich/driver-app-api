import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { AuthGuard } from './guards/auth.guard';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserInterceptor } from './users/interceptor/user.interceptor';

@Module({
  imports: [PrismaModule, UsersModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
