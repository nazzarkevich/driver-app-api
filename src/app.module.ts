import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Module } from '@nestjs/common';

import { AppService } from './app.service';
import { AuthGuard } from './guards/auth.guard';
import { AppController } from './app.controller';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserInterceptor } from './users/interceptor/user.interceptor';
import { DriversModule } from './profiles/drivers/drivers.module';
import { CustomersController } from './profiles/customers/customers.controller';
import { CustomersModule } from './profiles/customers/customers.module';
import { CouriersModule } from './profiles/couriers/couriers.module';
import { BusinessesModule } from './businesses/businesses.module';

@Module({
  imports: [PrismaModule, UsersModule, DriversModule, CustomersModule, CouriersModule, BusinessesModule],
  controllers: [AppController, CustomersController],
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
