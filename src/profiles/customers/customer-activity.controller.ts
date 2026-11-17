import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';
import { CustomerActivityService } from './customer-activity.service';
import { customerBusinessScope } from './customer-business-scope';
@ApiTags('Customer Profile')
@Controller('customers')
export class CustomerActivityController {
  constructor(private readonly activity: CustomerActivityService) {}
  @Get('/:id/summary')
  @Permissions(Permission.CUSTOMER_READ, Permission.PARCEL_READ)
  @ApiQuery({ name: 'businessId', required: false, type: Number })
  summary(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query('businessId') businessId?: string,
  ) {
    return this.activity.getSummary(
      id,
      customerBusinessScope(user, businessId),
      user,
    );
  }
  @Get('/:id/parcels')
  @Permissions(Permission.CUSTOMER_READ, Permission.PARCEL_READ)
  @ApiQuery({ name: 'businessId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  parcels(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('businessId') businessId?: string,
  ) {
    if (!Number.isSafeInteger(page) || page < 1)
      throw new BadRequestException('Invalid page');
    return this.activity.getParcels(
      id,
      customerBusinessScope(user, businessId),
      user,
      page,
    );
  }
}
