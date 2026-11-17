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
import { AuditAction } from '@prisma/client';
import { ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuditLog } from 'src/decorators/audit-log.decorator';
import {
  CurrentUser,
  UserRequestType,
} from 'src/users/decorators/current-user.decorator';
import { CreateTariffGroupDto } from './dtos/create-tariff-group.dto';
import { UpdateTariffGroupDto } from './dtos/update-tariff-group.dto';
import { resolveBusinessScope } from 'src/common/business-scope';
import { Permissions } from 'src/decorators/permissions.decorator';
import { Permission } from 'src/permissions/permissions';
import { parseTariffListQuery } from 'src/tariffs/tariff-list-query';
import { TariffGroupsService } from './tariff-groups.service';

@ApiTags('Tariff groups')
@Controller('tariff-groups')
export class TariffGroupsController {
  constructor(private readonly tariffGroupsService: TariffGroupsService) {}
  @Post()
  @Permissions(Permission.TARIFF_GROUP_CREATE)
  @AuditLog({ action: AuditAction.CREATE, entityType: 'tariff-group' })
  create(
    @CurrentUser() user: UserRequestType,
    @Body() dto: CreateTariffGroupDto,
    @Query('businessId') businessId?: string,
  ) {
    return this.tariffGroupsService.create(
      user,
      dto,
      resolveBusinessScope(user, businessId),
    );
  }
  @Get()
  @Permissions(Permission.TARIFF_GROUP_READ)
  @ApiOperation({
    summary:
      'List scoped tariff groups; omit page for the legacy array response',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'businessId', required: false, type: Number })
  findAll(
    @CurrentUser() user: UserRequestType,
    @Query() query: Record<string, string | undefined>,
  ) {
    const { page, limit, search, isActive } = parseTariffListQuery(query);
    return this.tariffGroupsService.findAll(
      user,
      resolveBusinessScope(user, query.businessId),
      { page, limit, search, isActive },
    );
  }
  @Get(':id')
  @Permissions(Permission.TARIFF_GROUP_READ)
  findOne(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query('businessId') businessId?: string,
  ) {
    return this.tariffGroupsService.findOne(
      id,
      user,
      resolveBusinessScope(user, businessId),
    );
  }
  @Patch(':id')
  @Permissions(Permission.TARIFF_GROUP_UPDATE)
  @AuditLog({ action: AuditAction.UPDATE, entityType: 'tariff-group' })
  update(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTariffGroupDto,
    @Query('businessId') businessId?: string,
  ) {
    return this.tariffGroupsService.update(
      id,
      user,
      dto,
      resolveBusinessScope(user, businessId),
    );
  }
  @Delete(':id')
  @Permissions(Permission.TARIFF_GROUP_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @AuditLog({ action: AuditAction.DELETE, entityType: 'tariff-group' })
  remove(
    @CurrentUser() user: UserRequestType,
    @Param('id', ParseIntPipe) id: number,
    @Query('businessId') businessId?: string,
  ) {
    return this.tariffGroupsService.remove(
      id,
      user,
      resolveBusinessScope(user, businessId),
    );
  }
}
