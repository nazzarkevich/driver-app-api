import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { TariffsService } from './tariffs.service';
import { CreateTariffDto } from './dtos/create-tariff.dto';
import { UpdateTariffDto } from './dtos/update-tariff.dto';
import { TariffDto } from './dtos/tariff.dto';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuditAction } from '@prisma/client';

@ApiTags('Tariffs')
@Controller('tariffs')
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  @Post()
  @AuditLog({
    action: AuditAction.CREATE,
    entityType: 'tariff',
  })
  @ApiOperation({ summary: 'Create a new tariff' })
  async create(
    @CurrentUser() currentUser: UserRequestType,
    @Body() createTariffDto: CreateTariffDto,
  ): Promise<TariffDto> {
    return this.tariffsService.create(currentUser, createTariffDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all tariffs for the current business' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Filter only active tariffs',
  })
  async findAll(
    @CurrentUser() currentUser: UserRequestType,
    @Query('activeOnly') activeOnly?: string,
  ): Promise<TariffDto[]> {
    const isActiveOnly = activeOnly === 'true';
    return this.tariffsService.findAll(
      currentUser.businessId,
      currentUser,
      isActiveOnly,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific tariff by ID' })
  async findOne(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<TariffDto> {
    return this.tariffsService.findOne(id, currentUser.businessId, currentUser);
  }

  @Patch(':id')
  @AuditLog({
    action: AuditAction.UPDATE,
    entityType: 'tariff',
  })
  @ApiOperation({ summary: 'Update a tariff' })
  async update(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTariffDto: UpdateTariffDto,
  ): Promise<TariffDto> {
    return this.tariffsService.update(
      id,
      currentUser.businessId,
      updateTariffDto,
      currentUser,
    );
  }

  @Delete(':id')
  @AuditLog({
    action: AuditAction.DELETE,
    entityType: 'tariff',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete a tariff' })
  async remove(
    @CurrentUser() currentUser: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.tariffsService.remove(id, currentUser.businessId, currentUser);
  }

  @Get(':id/calculate-price')
  @ApiOperation({
    summary:
      'Calculate price for a given weight and parcel type using a tariff',
  })
  @ApiQuery({
    name: 'weight',
    required: true,
    type: Number,
    description: 'Weight in kilograms',
  })
  @ApiQuery({
    name: 'parcelType',
    required: true,
    enum: ['Regular', 'Passport', 'Document', 'Money'],
    description: 'Type of parcel',
  })
  async calculatePrice(
    @Param('id', ParseIntPipe) id: number,
    @Query('weight', ParseIntPipe) weight: number,
    @Query('parcelType') parcelType: string,
  ): Promise<{ price: number }> {
    const price = await this.tariffsService.calculatePrice(
      weight,
      id,
      parcelType,
    );
    return { price };
  }
}
