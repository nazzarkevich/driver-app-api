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
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditAction } from '@prisma/client';
import { ParcelTypesService } from './parcel-types.service';
import { CreateParcelTypeDto } from './dtos/create-parcel-type.dto';
import { UpdateParcelTypeDto } from './dtos/update-parcel-type.dto';
import { ParcelTypeDto } from './dtos/parcel-type.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { AuditLog } from 'src/decorators/audit-log.decorator';

@ApiTags('Parcel Types')
@Controller('parcel-types')
export class ParcelTypesController {
  constructor(private readonly parcelTypesService: ParcelTypesService) {}

  @Post()
  @AuditLog({ action: AuditAction.CREATE, entityType: 'parcelType' })
  @ApiOperation({ summary: 'Create a new parcel type' })
  async create(
    @CurrentUser() currentUser: UserRequestType,
    @Body() createParcelTypeDto: CreateParcelTypeDto,
  ): Promise<ParcelTypeDto> {
    return this.parcelTypesService.create(currentUser, createParcelTypeDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all parcel types for the current business' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Filter only active parcel types',
  })
  async findAll(
    @CurrentUser() currentUser: UserRequestType,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<ParcelTypeDto[]> {
    const isActiveOnly = activeOnly === 'true';
    return this.parcelTypesService.findAll(
      currentUser.businessId,
      currentUser,
      isActiveOnly,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific parcel type by ID' })
  async findOne(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ParcelTypeDto> {
    return this.parcelTypesService.findOne(
      id,
      currentUser.businessId,
      currentUser,
    );
  }

  @Patch(':id')
  @AuditLog({ action: AuditAction.UPDATE, entityType: 'parcelType' })
  @ApiOperation({ summary: 'Update a parcel type' })
  async update(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateParcelTypeDto: UpdateParcelTypeDto,
  ): Promise<ParcelTypeDto> {
    return this.parcelTypesService.update(
      id,
      currentUser.businessId,
      updateParcelTypeDto,
      currentUser,
    );
  }

  @Delete(':id')
  @AuditLog({ action: AuditAction.DELETE, entityType: 'parcelType' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a parcel type' })
  async remove(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.parcelTypesService.remove(
      id,
      currentUser.businessId,
      currentUser,
    );
  }
}
