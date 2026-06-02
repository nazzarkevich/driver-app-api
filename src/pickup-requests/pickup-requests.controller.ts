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
  @ApiOperation({ summary: 'Create a new pickup request' })
  create(
    @CurrentUser() currentUser: UserRequestType,
    @Body() body: CreatePickupRequestDto,
  ) {
    return this.pickupRequestsService.create(body, currentUser.businessId);
  }

  @Patch('/:id')
  @ApiOperation({ summary: 'Update a pickup request' })
  update(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdatePickupRequestDto,
  ) {
    return this.pickupRequestsService.update(id, body, currentUser.businessId);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a pickup request' })
  remove(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.pickupRequestsService.remove(id, currentUser.businessId);
  }
}
