import { Module } from '@nestjs/common';

import { CustomersService } from './customers.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { CustomersController } from './customers.controller';
import { BusinessesModule } from 'src/businesses/businesses.module';
import { AuditModule } from 'src/audit/audit.module';

@Module({
  imports: [PrismaModule, BusinessesModule, AuditModule],
  providers: [CustomersService],
  controllers: [CustomersController],
})
export class CustomersModule {}
