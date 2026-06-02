import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';

import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { PickupRequestsService } from './pickup-requests.service';
import { CreatePickupRequestDto } from './dtos/create-pickup-request.dto';
import { UpdatePickupRequestDto } from './dtos/update-pickup-request.dto';

@ApiTags('Pickup Requests')
@Controller('pickup-requests')
export class PickupRequestsController {
  constructor(private readonly pickupRequestsService: PickupRequestsService) {}

  @Get()
  @Permissions(Permission.PICKUP_REQUEST_READ)
  @ApiOperation({ summary: 'Get pickup requests, optionally filtered by date' })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    description: 'Filter by scheduled date (YYYY-MM-DD)',
  })
  findAll(
    @CurrentUser() currentUser: UserRequestType,
    @Query('date') date?: string,
  ) {
    return this.pickupRequestsService.findAll(currentUser.businessId, date);
  }

  @Post()
  @Permissions(Permission.PICKUP_REQUEST_CREATE)
  @ApiOperation({ summary: 'Create a new pickup request' })
  create(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreatePickupRequestDto,
  ) {
    return this.pickupRequestsService.create(body, currentUser.businessId);
  }

  @Patch('/:id')
  @Permissions(Permission.PICKUP_REQUEST_UPDATE)
  @ApiOperation({ summary: 'Update a pickup request' })
  update(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePickupRequestDto,
  ) {
    return this.pickupRequestsService.update(id, body, currentUser.businessId);
  }

  @Delete('/:id')
  @Permissions(Permission.PICKUP_REQUEST_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a pickup request' })
  remove(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.pickupRequestsService.remove(id, currentUser.businessId);
  }
}
