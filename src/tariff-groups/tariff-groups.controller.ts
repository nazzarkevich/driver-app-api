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
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { CreateTariffGroupDto } from './dtos/create-tariff-group.dto';
import { UpdateTariffGroupDto } from './dtos/update-tariff-group.dto';
import { TariffGroupsService } from './tariff-groups.service';

@ApiTags('Tariff groups')
@Controller('tariff-groups')
export class TariffGroupsController {
  constructor(private readonly tariffGroupsService: TariffGroupsService) {}

  @Post()
  @AuditLog({ action: AuditAction.CREATE, entityType: 'tariff-group' })
  @ApiOperation({ summary: 'Create a tariff group' })
  create(
    @CurrentUser() user: UserRequestType,
    @Body() dto: CreateTariffGroupDto,
  ) {
    return this.tariffGroupsService.create(user, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get tariff groups for the current business' })
  findAll(@CurrentUser() user: UserRequestType) {
    return this.tariffGroupsService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tariff group by ID' })
  findOne(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tariffGroupsService.findOne(id, user);
  }

  @Patch(':id')
  @AuditLog({ action: AuditAction.UPDATE, entityType: 'tariff-group' })
  @ApiOperation({ summary: 'Update a tariff group' })
  update(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTariffGroupDto,
  ) {
    return this.tariffGroupsService.update(id, user, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog({ action: AuditAction.DELETE, entityType: 'tariff-group' })
  @ApiOperation({ summary: 'Soft delete a tariff group' })
  remove(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.tariffGroupsService.remove(id, user);
  }
}
