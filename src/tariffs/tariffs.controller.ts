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
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import { AuditAction } from '@prisma/client';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';
import { resolveBusinessScope } from 'src/common/business-scope';
import { parseTariffListQuery } from './tariff-list-query';

@ApiTags('Tariffs')
@Controller('tariffs')
export class TariffsController {
  constructor(private readonly tariffsService: TariffsService) {}

  @Post()
  @Permissions(Permission.TARIFF_CREATE)
  @AuditLog({ action: AuditAction.CREATE, entityType: 'tariff' })
  create(
    @CurrentUser() user: UserRequestType,
    @Body() dto: CreateTariffDto,
    @Query('businessId') businessId?: string,
  ) {
    return this.tariffsService.create(
      user,
      dto,
      resolveBusinessScope(user, businessId),
    );
  }

  @Get()
  @Permissions(Permission.TARIFF_READ)
  @ApiOperation({
    summary: 'List scoped tariffs; omit page for the legacy array response',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'businessId', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'tariffGroupId', required: false, type: Number })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  findAll(
    @CurrentUser() user: UserRequestType,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.tariffsService.findAll(
      resolveBusinessScope(user, query.businessId),
      user,
      parseTariffListQuery(query),
    );
  }

  @Get(':id')
  @Permissions(Permission.TARIFF_READ)
  findOne(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query('businessId') businessId?: string,
  ) {
    return this.tariffsService.findOne(
      id,
      resolveBusinessScope(user, businessId),
      user,
    );
  }

  @Patch(':id')
  @Permissions(Permission.TARIFF_UPDATE)
  @AuditLog({ action: AuditAction.UPDATE, entityType: 'tariff' })
  update(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTariffDto,
    @Query('businessId') businessId?: string,
  ) {
    return this.tariffsService.update(
      id,
      resolveBusinessScope(user, businessId),
      dto,
      user,
    );
  }

  @Delete(':id')
  @Permissions(Permission.TARIFF_DELETE)
  @AuditLog({ action: AuditAction.DELETE, entityType: 'tariff' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query('businessId') businessId?: string,
  ) {
    return this.tariffsService.remove(
      id,
      resolveBusinessScope(user, businessId),
      user,
    );
  }
}
