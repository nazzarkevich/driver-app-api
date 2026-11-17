import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CarriersService } from './carriers.service';
import { Pagination } from 'src/dtos/pagination.dto';
import { CarrierDto } from './dtos/carrier.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';
import { resolveBusinessScope } from 'src/common/business-scope';

@ApiTags('Carrier')
@Controller('carriers')
export class CarriersController {
  constructor(private readonly carriersService: CarriersService) {}

  @Get()
  @Permissions(Permission.DRIVER_PROFILE_READ)
  async getAllCarriers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('search') search: string,
    @CurrentUser() actor: UserRequestType,
    @Query('businessId') businessId?: string,
    @Query('type') type?: string,
    @Query('isBlocked') isBlocked?: string,
  ): Promise<Pagination<CarrierDto>> {
    if (page < 1 || !Number.isSafeInteger(page))
      throw new BadRequestException('Invalid page');
    if (type !== undefined && type !== 'driver' && type !== 'courier')
      throw new BadRequestException('Invalid carrier type');
    if (
      isBlocked !== undefined &&
      isBlocked !== 'true' &&
      isBlocked !== 'false'
    )
      throw new BadRequestException('Invalid blocked status');
    return this.carriersService.findAll(
      page,
      search?.trim(),
      resolveBusinessScope(actor, businessId),
      {
        type: type as 'driver' | 'courier' | undefined,
        isBlocked: isBlocked === undefined ? undefined : isBlocked === 'true',
      },
    );
  }
}
